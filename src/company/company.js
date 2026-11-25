// Company tiers and departments (GDD: Company and board > Company tiers, Departments). L0 greybox (#73).
//
// Last Resort Holdings grows through five tiers that gate sites, crews and departments. Each tier caps
// how high any department can be levelled. Departments open by tier (Special Projects opens at 0:25 of
// play inside Startup). Engineering is the one wired so far: each level speeds every crew by 15%.
//
//   const co = new Company({ ledger, getPlayMinutes });
//   co.tier                         -> { id, name, sites, crews, cap, ... }
//   co.view()                       -> tier label, caps and every department (level, cap, open, why not)
//   co.levelUp('engineering')       -> { ok, reason? }   (refuses above the tier's cap, when closed or broke)
//   co.crewSpeed                    -> 1 + 0.15 x (Engineering level - 1)
//   co.crewCap                      -> the tier's crew limit (Startup 2)
//   co.setTier('boutique')          -> tier-ups come from the board (#18); this is the hook
//   co.extraCrews, co.rpPerWeek     -> #72: Engineering +1 crew per level above 1; R&D +3 RP a week per level
// #72: level-ups cost the GDD's $2M / $4M / $8M / $16M x PRICE_SCALE (the bunker economy's 0.1), so
//      $200K / $400K / $800K / $1.6M against the $400K opening treasury.

import { PRICE_SCALE } from '../shelter/bunker-catalog.js';
import { TUNING } from '../config/tuning.js';

export const TIERS = Object.freeze([
  { id: 'startup', name: 'Startup', sites: 1, crews: 2, cap: 2, opens: ['sales', 'engineering', 'special'] },
  { id: 'boutique', name: 'Boutique', sites: 2, crews: 4, cap: 3, opens: ['rnd', 'comms'] },
  { id: 'firm', name: 'Firm', sites: 4, crews: 6, cap: 4, opens: ['legal'] },
  { id: 'conglomerate', name: 'Conglomerate', sites: 6, crews: 10, cap: 5, opens: ['security'] },
  { id: 'last_resort', name: 'The Last Resort', sites: 8, crews: 16, cap: 5, opens: [] },
]);

// opensAt: minutes of play within its tier (GDD: Special Projects at 0:25, Legal at 2:25, Security at 3:30).
export const DEPARTMENTS = Object.freeze([
  { id: 'sales', name: 'Sales and Concierge', head: 'Avery Lin', perLevel: '+1 lead per week, better haggling' },
  { id: 'engineering', name: 'Engineering', head: 'Ruth Abernathy', perLevel: '+15% crew speed, +1 crew slot' },
  { id: 'special', name: 'Special Projects', head: 'Theo Lisk', perLevel: '+1 scheme slot, scheme heat -8%', opensAt: 25 },
  { id: 'rnd', name: 'R&D', head: 'Dr. Hana Sato', perLevel: '+3 RP per week; second research slot at level 3' },
  { id: 'comms', name: 'Communications', head: 'June Okafor', perLevel: '+1 heat decay per week' },
  { id: 'legal', name: 'Legal', head: 'Marcus Dell', perLevel: 'NDAs 20% cheaper; stories -5% a week', opensAt: 145 },
  { id: 'security', name: 'Security', head: 'Bo Kowalski', perLevel: '+1 security on every site', opensAt: 210 },
]);

export const COMPANY = Object.freeze({
  startLevel: 1,
  levelCostsM: [2, 4, 8, 16], // GDD $M for level 1->2, 2->3, 3->4, 4->5 (#72)
  priceScale: PRICE_SCALE,
  engineeringSpeedPerLevel: 0.15,
  engineeringCrewsPerLevel: 1, // +1 crew slot per level above 1
  rndRpPerLevel: 3, // RP a week per R&D level
});

export class Company {
  constructor({ ledger = null, getPlayMinutes = () => 0, cfg = COMPANY } = {}) {
    this.ledger = ledger;
    this.getPlayMinutes = getPlayMinutes;
    this.cfg = cfg;
    this.tierIndex = 0;
    this.levels = {}; // deptId -> level (0 = not yet opened)
    this._listeners = new Set();
    // #151: department heads' loyalty (0-100), who replaced a scapegoat, the Inspector hire, the once-a-campaign scapegoat.
    this.loyalty = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, TUNING.loyalty.start]));
    this.heads = {}; // deptId -> name of an acting head after a scapegoat
    this.inspectorHired = false;
    this.inspections = 0;
    this.scapegoated = null; // { dept, head, minute } once used
  }

  headOf(deptId) { return this.heads[deptId] ?? DEPARTMENTS.find((d) => d.id === deptId)?.head; }

  // ---------- the Inspector (#151) ----------
  /** Why the Inspector can't be hired, or null. */
  inspectorBlocker() {
    const need = TUNING.inspector.salesLevel;
    return this.level('sales') >= need ? null : `Needs Sales level ${need}`;
  }
  /** Hire or release the Inspector. While hired, every walkthrough is inspected and charged. */
  setInspector(on) {
    if (on && this.inspectorBlocker()) return { ok: false, reason: this.inspectorBlocker() };
    this.inspectorHired = !!on;
    this._emit({ type: 'inspector', hired: this.inspectorHired });
    return { ok: true, hired: this.inspectorHired };
  }
  /** A walkthrough happens (a handover). Inspected when the Inspector is hired: pays $0.2M. Returns true if inspected. */
  walkthrough(label = 'shelter') {
    if (!this.inspectorHired || this.inspectorBlocker()) return false;
    this.ledger?.record('upkeep', `Inspector walkthrough: ${label}`, -TUNING.inspector.costPerWalkthrough);
    this.inspections += 1;
    this._emit({ type: 'inspection', label });
    return true;
  }

  // ---------- the scapegoat (#151) ----------
  scapegoatBlocker(deptId) {
    if (this.scapegoated) return `Already used: ${this.scapegoated.head} took the fall`;
    if (!this.isOpen(deptId)) return 'That department is not open';
    return null;
  }
  /**
   * Once per campaign: the head of `deptId` leaves. Their department drops two levels (never below 1), every other
   * head loses 15 loyalty (Marcus Dell a further 10), and heat falls by 40 (`pushback.addHeat`).
   */
  scapegoat(deptId, { pushback = null } = {}) {
    const reason = this.scapegoatBlocker(deptId);
    if (reason) return { ok: false, reason };
    const S = TUNING.scapegoat;
    const head = this.headOf(deptId);
    const before = this.level(deptId);
    this.levels[deptId] = Math.max(this.cfg.startLevel, before + S.departmentLevels);
    for (const d of DEPARTMENTS) {
      if (d.id === deptId) continue;
      const hit = S.otherHeads + (d.id === 'legal' ? S.legalHead : 0);
      this.loyalty[d.id] = Math.max(0, Math.min(100, this.loyalty[d.id] + hit));
    }
    this.heads[deptId] = `Acting head (${DEPARTMENTS.find((d) => d.id === deptId).name})`;
    this.loyalty[deptId] = TUNING.loyalty.start;
    const heatBefore = pushback?.heat ?? null;
    pushback?.addHeat?.(S.heat, `Scapegoat: ${head}`);
    pushback?._changed?.();
    this.scapegoated = { dept: deptId, head, minute: Math.round(this.getPlayMinutes()) };
    const res = { ok: true, head, dept: deptId, levelBefore: before, levelAfter: this.level(deptId), heatBefore, heatAfter: pushback?.heat ?? null };
    this._emit({ type: 'scapegoat', ...res });
    return res;
  }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit(e) { for (const fn of this._listeners) fn(e, this); }

  get tier() { return TIERS[this.tierIndex]; }
  get cap() { return this.tier.cap; }
  get crewCap() { return this.tier.crews + this.extraCrews; }
  get siteCap() { return this.tier.sites; }

  /** Is a department open: its tier reached and its time in play come? */
  isOpen(deptId) {
    const tierAt = TIERS.findIndex((t) => t.opens.includes(deptId));
    if (tierAt < 0 || tierAt > this.tierIndex) return false;
    const d = DEPARTMENTS.find((x) => x.id === deptId);
    return !(d?.opensAt > this.getPlayMinutes());
  }

  level(deptId) {
    if (!this.isOpen(deptId)) return 0;
    return this.levels[deptId] ?? this.cfg.startLevel;
  }

  levelCost(deptId) {
    const m = this.cfg.levelCostsM[Math.max(1, this.level(deptId)) - 1] ?? this.cfg.levelCostsM.at(-1);
    return Math.round(m * 1_000_000 * this.cfg.priceScale);
  }

  /** Why a department can't be levelled now, or null. The tier's cap is the hard limit. */
  blocker(deptId) {
    const d = DEPARTMENTS.find((x) => x.id === deptId);
    if (!d) return 'Unknown department';
    if (!this.isOpen(deptId)) {
      const tierAt = TIERS.find((t) => t.opens.includes(deptId));
      return tierAt && TIERS.indexOf(tierAt) > this.tierIndex ? `Opens at the ${tierAt.name} tier` : `Opens at ${Math.floor(d.opensAt / 60)}:${String(d.opensAt % 60).padStart(2, '0')} of play`;
    }
    if (this.level(deptId) >= this.cap) return `${this.tier.name} cap: level ${this.cap}`;
    if (this.ledger && this.ledger.cash < this.levelCost(deptId)) return 'Not enough cash';
    return null;
  }

  levelUp(deptId) {
    const reason = this.blocker(deptId);
    if (reason) return { ok: false, reason };
    const d = DEPARTMENTS.find((x) => x.id === deptId);
    const cost = this.levelCost(deptId);
    this.ledger?.record('upkeep', `${d.name} to level ${this.level(deptId) + 1}`, -cost);
    this.levels[deptId] = this.level(deptId) + 1;
    this._emit({ type: 'level', dept: deptId, level: this.levels[deptId] });
    return { ok: true, level: this.levels[deptId], cost };
  }

  /** Engineering: every level above 1 speeds every crew by 15%. */
  get crewSpeed() { return 1 + this.cfg.engineeringSpeedPerLevel * Math.max(0, this.level('engineering') - 1); }

  /** Engineering: every level above 1 adds a crew (and the slot for it). */
  get extraCrews() { return this.cfg.engineeringCrewsPerLevel * Math.max(0, this.level('engineering') - 1); }

  /** R&D: RP a week, paid with the weekly crisis grants. */
  get rpPerWeek() { return this.cfg.rndRpPerLevel * this.level('rnd'); }

  /** Crews actually working: what you have plus Engineering's, capped by the tier (+ Engineering's slots). */
  crews(have) { return Math.min(this.crewCap, have + this.extraCrews); }

  setTier(id) {
    const i = TIERS.findIndex((t) => t.id === id);
    if (i < 0) throw new Error(`Unknown tier ${id}`);
    this.tierIndex = i;
    this._emit({ type: 'tier', tier: this.tier });
  }

  view() {
    return {
      tier: this.tier.name, tierId: this.tier.id, sites: this.siteCap, crews: this.crewCap, cap: this.cap, crewSpeed: this.crewSpeed, extraCrews: this.extraCrews, rpPerWeek: this.rpPerWeek,
      departments: DEPARTMENTS.map((d) => ({ id: d.id, name: d.name, head: this.headOf(d.id), loyalty: this.loyalty[d.id], perLevel: d.perLevel, open: this.isOpen(d.id), level: this.level(d.id), cap: this.cap, cost: this.levelCost(d.id), blocker: this.blocker(d.id) })),
    };
  }

  toJSON() {
    return { tierIndex: this.tierIndex, levels: { ...this.levels }, loyalty: { ...this.loyalty }, heads: { ...this.heads },
      inspectorHired: this.inspectorHired, inspections: this.inspections, scapegoated: this.scapegoated };
  }
  load(d = {}) {
    this.tierIndex = d.tierIndex ?? 0; this.levels = { ...(d.levels ?? {}) };
    Object.assign(this.loyalty, d.loyalty ?? {}); this.heads = { ...(d.heads ?? {}) };
    this.inspectorHired = !!d.inspectorHired; this.inspections = d.inspections ?? 0; this.scapegoated = d.scapegoated ?? null;
    this._emit({ type: 'load' });
  }
}
