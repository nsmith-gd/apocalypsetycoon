// Track tension, momentum and the scheme rules for a roster (GDD: Core loop > The crisis dividend;
// Pushback > Runaway tension; World canvas > Schemes). Pure rules, no DOM.
//
// Weekly step per open track:  tension += band drift + 25% of momentum (released) + ongoing grants
//                              momentum keeps 75% (decays 25% a week, so a scheme fades unless renewed)
// A scheme's momentum value is therefore the total tension it delivers (a Leak adds 8 in all).
// Calming repeat penalty: calming schemes on the same track lose 25% per use within the last 8 weeks.
// Special Projects runs one scheme at a time at level 1, up to five at level 5; each level cuts scheme heat 8%.
// Scheme heat is multiplied by the target track's band.
// Breach and collapse are the crisis system's job; here tension simply stops at 100.

import { TRACK_BY_ID, openTracks } from './tracks.js';
import { SCHEME_BY_ID, schemesForRoster, schemeTargets, schemeSlots, SPECIAL_PROJECTS_LEVELS } from './schemeCatalog.js';

export const BANDS = Object.freeze([
  { id: 'calm', name: 'Calm', from: 0, drift: -1, heatMult: 1, grantRP: 0, premium: 0 },
  { id: 'simmer', name: 'Simmer', from: 20, drift: 0, heatMult: 1, grantRP: 2, premium: 0.1 },
  { id: 'boil', name: 'Boil', from: 45, drift: 0.5, heatMult: 1.1, grantRP: 6, premium: 0.25 },
  { id: 'brink', name: 'Brink', from: 70, drift: 1.5, heatMult: 1.25, grantRP: 15, premium: 0.5 },
]);
export const MOMENTUM = Object.freeze({ release: 0.25, calmRepeatPenalty: 0.25, calmRepeatWindow: 8, defaultWeeks: 2 });

export function bandOf(tension) {
  let b = BANDS[0];
  for (const x of BANDS) if (tension >= x.from) b = x;
  return b;
}

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const r2 = (n) => Math.round(n * 100) / 100;

export class ThreatWorld {
  /**
   * @param roster          six track ids (selectRoster)
   * @param minutes()       campaign minutes elapsed (drives track openings and scheme unlocks)
   * @param ledger          optional; cash schemes book a 'schemes' entry
   * @param onHeat(n, why)  optional; heat from schemes (already scaled by band and department)
   * @param spLevel()       Special Projects level (0 = not founded)
   * @param rp              optional { spend(n): boolean } for intel schemes
   */
  constructor({ roster, minutes = () => 0, ledger = null, onHeat = null, spLevel = null, rp = null, start = {} } = {}) {
    if (!Array.isArray(roster) || roster.length !== 6) throw new Error('roster must list six tracks');
    this.roster = [...roster];
    this.minutes = minutes;
    this.ledger = ledger;
    this.onHeat = onHeat;
    this.rp = rp;
    this.spLevel = spLevel ?? (() => SPECIAL_PROJECTS_LEVELS.filter((l) => l.unlockAt <= this.minutes()).length);
    this.week = 0;
    this.tracks = Object.fromEntries(this.roster.map((id) => [id, { id, tension: start[id] ?? 0, momentum: 0, calmUses: [], opened: false }]));
    this.active = []; // running schemes: { id, track, region, until, perWeek }
    this.listeners = new Set();
    this.openDue();
  }

  // ---------- queries ----------
  get open() { return openTracks(this.roster, this.minutes()); }
  band(trackId) { return bandOf(this.tracks[trackId].tension); }
  slotsTotal() { return schemeSlots(this.spLevel()); }
  slotsUsed() { return this.active.filter((a) => SCHEME_BY_ID[a.id].dept === 'specialProjects').length; }

  /** Calming effect multiplier for the next calming scheme on a track. */
  calmFactor(trackId) {
    const t = this.tracks[trackId];
    const recent = t.calmUses.filter((w) => this.week - w < MOMENTUM.calmRepeatWindow).length;
    return Math.max(0, 1 - MOMENTUM.calmRepeatPenalty * recent);
  }

  /** Every scheme this roster can use, with availability now. */
  schemes() {
    const open = this.open;
    return schemesForRoster(this.roster).map((s) => ({ ...s, ...this.check(s.id), targets: schemeTargets(s, open) }));
  }

  check(id, { track = null } = {}) {
    const s = SCHEME_BY_ID[id];
    if (!s) return { ok: false, reason: 'Unknown scheme' };
    if (s.requires && !this.roster.includes(s.requires)) return { ok: false, reason: 'Not in this world' };
    if (s.unlockAt > this.minutes()) return { ok: false, reason: `Unlocks at ${fmtTime(s.unlockAt)}` };
    if (s.breachOnly) return { ok: false, reason: 'Only during a breach' };
    if (s.dept === 'specialProjects' && this.slotsUsed() >= this.slotsTotal()) return { ok: false, reason: `Special Projects is busy (${this.slotsUsed()}/${this.slotsTotal()} slots)` };
    const targets = schemeTargets(s, this.open);
    if (track && !targets.includes(track)) return { ok: false, reason: 'Not a valid target' };
    if (s.target && s.target !== 'region' && !targets.length) return { ok: false, reason: 'Its track has not opened' };
    if (s.cost && this.ledger && this.ledger.cash < s.cost) return { ok: false, reason: 'Not enough cash' };
    return { ok: true };
  }

  // ---------- actions ----------
  /** Run a scheme on a track (or region for regional schemes). Returns what happened. */
  run(id, { track = null, region = null } = {}) {
    const s = SCHEME_BY_ID[id];
    const targets = s ? schemeTargets(s, this.open) : [];
    if (s && !track && targets.length === 1) track = targets[0];
    const c = this.check(id, { track });
    if (!c.ok) return c;
    if (s.target && s.target !== 'region' && s.target !== 'all' && !track) return { ok: false, reason: 'Pick a track' };
    if (s.rp && !(this.rp?.spend(s.rp) ?? true)) return { ok: false, reason: 'Not enough RP' };
    if (s.cost) this.ledger?.record('schemes', s.name, -s.cost);

    const hit = s.target === 'all' ? targets : track ? [track] : [];
    const applied = {};
    for (const t of hit) {
      let m = s.momentum;
      if (s.group === 'calm' && m < 0) {
        m *= this.calmFactor(t);
        this.tracks[t].calmUses.push(this.week);
      }
      this.tracks[t].momentum += m;
      applied[t] = r2(m);
    }
    // Heat: band of the target (hottest target for 'all'), less the Special Projects cut.
    const bandMult = hit.length ? Math.max(...hit.map((t) => this.band(t).heatMult)) : 1;
    const cut = s.dept === 'specialProjects' ? (SPECIAL_PROJECTS_LEVELS[Math.max(1, Math.min(5, this.spLevel())) - 1]?.heatCut ?? 0) : 0;
    const heat = r2(s.heat * (s.heat > 0 ? bandMult * (1 - cut) : 1));
    if (heat) this.onHeat?.(heat, s.name);
    const weeks = s.weeks ?? MOMENTUM.defaultWeeks;
    this.active.push({ id, track, region, until: this.week + weeks, perWeek: s.perWeek ?? 0, payback: s.payback ?? 0 });
    this.emit({ type: 'scheme', id, track, region, applied, heat });
    return { ok: true, applied, heat };
  }

  /** One in-game week. */
  advanceWeek() {
    this.week += 1;
    this.openDue();
    const open = new Set(this.open);
    for (const a of this.active) if (a.perWeek && a.track && open.has(a.track)) this.tracks[a.track].momentum += a.perWeek;
    for (const id of open) {
      const t = this.tracks[id];
      const release = t.momentum * MOMENTUM.release;
      t.tension = clamp(t.tension + this.band(id).drift + release);
      t.momentum -= release;
    }
    const done = this.active.filter((a) => a.until <= this.week);
    this.active = this.active.filter((a) => a.until > this.week);
    for (const a of done) if (a.payback) this.ledger?.record('schemes', `${SCHEME_BY_ID[a.id].name} payback`, a.payback);
    this.emit({ type: 'week', week: this.week });
  }

  openDue() {
    for (const id of this.open) {
      const t = this.tracks[id];
      if (!t.opened) { t.opened = true; this.emit({ type: 'open', track: id, name: TRACK_BY_ID[id].name }); }
    }
  }

  // ---------- events / save ----------
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(e) { for (const fn of this.listeners) fn(e, this); }
  toJSON() { return { roster: this.roster, week: this.week, tracks: this.tracks, active: this.active }; }
  load(d) {
    if (Array.isArray(d.roster) && d.roster.length === 6) this.roster = [...d.roster];
    this.week = d.week ?? 0;
    this.tracks = JSON.parse(JSON.stringify(d.tracks ?? this.tracks));
    this.active = d.active ?? [];
    this.emit({ type: 'load' });
  }
}

export function fmtTime(min) { return `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`; }
