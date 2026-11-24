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
  levelCost: 100_000, // stand-in: level n costs n x this (the GDD gives no department prices)
  engineeringSpeedPerLevel: 0.15,
});

export class Company {
  constructor({ ledger = null, getPlayMinutes = () => 0, cfg = COMPANY } = {}) {
    this.ledger = ledger;
    this.getPlayMinutes = getPlayMinutes;
    this.cfg = cfg;
    this.tierIndex = 0;
    this.levels = {}; // deptId -> level (0 = not yet opened)
    this._listeners = new Set();
  }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit(e) { for (const fn of this._listeners) fn(e, this); }

  get tier() { return TIERS[this.tierIndex]; }
  get cap() { return this.tier.cap; }
  get crewCap() { return this.tier.crews; }
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

  levelCost(deptId) { return (this.level(deptId) + 1) * this.cfg.levelCost; }

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

  /** Crews actually working: what you have, capped by the tier. */
  crews(have) { return Math.min(this.crewCap, have); }

  setTier(id) {
    const i = TIERS.findIndex((t) => t.id === id);
    if (i < 0) throw new Error(`Unknown tier ${id}`);
    this.tierIndex = i;
    this._emit({ type: 'tier', tier: this.tier });
  }

  view() {
    return {
      tier: this.tier.name, tierId: this.tier.id, sites: this.siteCap, crews: this.crewCap, cap: this.cap, crewSpeed: this.crewSpeed,
      departments: DEPARTMENTS.map((d) => ({ id: d.id, name: d.name, head: d.head, perLevel: d.perLevel, open: this.isOpen(d.id), level: this.level(d.id), cap: this.cap, cost: this.levelCost(d.id), blocker: this.blocker(d.id) })),
    };
  }

  toJSON() { return { tierIndex: this.tierIndex, levels: { ...this.levels } }; }
  load(d = {}) { this.tierIndex = d.tierIndex ?? 0; this.levels = { ...(d.levels ?? {}) }; this._emit({ type: 'load' }); }
}
