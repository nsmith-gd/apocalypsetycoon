// Breach, containment, recovery and collapse with domino spillover.
// GDD: Crises and tipping points > Breach and containment / Recovery / Collapse and the domino.
//
// Each crisis track has tension 0-100 and a HIDDEN tipping point rolled at 90 + (-8..+4).
// Scars (-3 each) and Doom Clock fragility lower it further (never below 72).
//
//   BREACH   tension reaches the tipping point -> the game auto-pauses and a containment window
//            opens: 6 weeks for a track's first breach, 4 for its second, 3 after that.
//            The player fills a 100-point containment bar from five sources (op, crash research,
//            calming schemes, government partnership, executive heroics). Every breach week:
//            +2 heat, -2 board confidence, panic premium doubled.
//   CONTAIN  bar reaches 100 -> tension resets to 60 and is locked for 3 weeks, the track is
//            scarred (tipping point -3) and its exact tipping point is revealed.
//   COLLAPSE window runs out -> the track is pinned at 100 and its linked tracks are shoved
//            +15 / +8 / +4 (strong / medium / weak link), which can set off more breaches.
//   SHELTER-IN-PLACE  every breach tests each sold shelter: pass +2 reputation, fail -5
//            reputation and +15 leverage for that shelter's client.
//
// Pure rules, no DOM. #4 owns how schemes move tension: route tension changes through
// `crisis.addTension(id, n)` / `setTension` so locks, pins and breaches apply. Optional hooks:
// a Pushback (heat, client leverage, calming relief), a DoomClock (brink / contained / collapse),
// and a shelter tester (default: Midnight's air/water/food check).

import { gradeShelter } from '../midnight/midnight.js';
import { apocalypseFor } from '../midnight/engineered.js';
import { survival } from '../shelter/life.js';
import { REGIONS as SALES_REGIONS } from '../demand/demand.js';
import { BREACH, TUNING } from '../config/tuning.js';
import { seededRng } from '../campaign/rng.js';
import { SCHEME_BY_ID } from '../world/schemeCatalog.js';

/** Executives who can each pull off one heroic save per campaign (GDD: Breach and containment). */
export const HEROICS = Object.freeze([
  { id: 'ruth', name: 'Ruth Abernathy', act: "Ruth's engineering fix", heat: 0 },
  { id: 'june', name: 'June Okafor', act: "June's media blackout", heat: 0 },
  { id: 'theo', name: 'Theo Lisk', act: "Theo's dirty fix", heat: 10 },
]);

export { BREACH }; // lives in the single tuning table (#77)

/** The domino map: 10 links over the five crisis tracks (every pair once). Provisional pairing. */
export const DOMINO_LINKS = Object.freeze([
  ['pandemic', 'markets', 'strong'],
  ['markets', 'unrest', 'strong'],
  ['war', 'markets', 'strong'],
  ['climate', 'unrest', 'medium'],
  ['war', 'unrest', 'medium'],
  ['pandemic', 'unrest', 'medium'],
  ['climate', 'markets', 'medium'],
  ['climate', 'pandemic', 'weak'],
  ['war', 'climate', 'weak'],
  ['war', 'pandemic', 'weak'],
]);

export const TRACKS = Object.freeze([
  { id: 'pandemic', name: 'Pandemic' },
  { id: 'climate', name: 'Climate' },
  { id: 'unrest', name: 'Civil unrest' },
  { id: 'markets', name: 'Market crash' },
  { id: 'war', name: 'War' },
]);

const rngFrom = seededRng; // saveable state (#80)

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/**
 * Shelter-in-place test (GDD: Crises and tipping points > Shelter-in-place tests): a handed-over shelter is
 * checked against its contract's Days Sealed and the breached track's critical ratings. A shelter built on the
 * life-systems grid carries `sealed: { daysSealed, ratings }`; its contract's requirement is
 * `contract.daysSealed`, or the track's apocalypse duration when there is no contract yet. Returns
 * { pass, p (0-1 survival odds), need, why }. Shelters without a sealed simulation fall back to the old check:
 * air, water and food all cover the occupants.
 */
export function defaultShelterTest(shelter, trackId) {
  const apoc = apocalypseFor(trackId);
  if (shelter.sealed && apoc) {
    const need = { days: shelter.contract?.daysSealed ?? apoc.days, ...apoc.critical };
    const sv = survival({ daysSealed: shelter.sealed.daysSealed, ratings: shelter.sealed.ratings ?? {} }, need);
    const why = [];
    if (shelter.sealed.daysSealed < need.days) why.push(`${Math.round(shelter.sealed.daysSealed)} of ${need.days} days sealed`);
    for (const [k, v] of Object.entries(apoc.critical)) if ((shelter.sealed.ratings?.[k] ?? 0) < v) why.push(`${k} ${shelter.sealed.ratings?.[k] ?? 0}/${v}`);
    return { pass: sv.p >= 1, p: sv.p, need, why };
  }
  const g = gradeShelter(shelter);
  const worst = Math.min(g.ratios.air, g.ratios.water, g.ratios.food);
  return { pass: worst >= 1, p: Math.min(1, worst), need: null, why: worst >= 1 ? [] : [`${g.weakest} runs short`] };
}

/** Is a sales region highly exposed to this track? (Shelters with no region count as exposed.) */
export function highlyExposed(regionId, trackId, regions = SALES_REGIONS) {
  if (!regionId) return true;
  return regions.find((r) => r.id === regionId)?.exposure?.[trackId] === 'high';
}

export class CrisisSystem {
  constructor({ seed = 1, tracks = TRACKS, links = DOMINO_LINKS, config = {}, pushback = null, doomClock = null, ledger = null, shelters = () => [], shelterTest = defaultShelterTest, tips = null, clockWeeks = false, construction = () => [], rdLevel = null, spendRp = null } = {}) {
    this.cfg = { ...BREACH, ...config, sources: { ...BREACH.sources, ...(config.sources ?? {}) } };
    this.rng = rngFrom(seed);
    this.links = links;
    this.pb = pushback;
    this.clock = doomClock;
    this.clockWeeks = clockWeeks; // true: each advanceWeek() also advances the Doom Clock a week (campaign)
    this.ledger = ledger;
    this.getShelters = shelters;
    this.shelterTest = shelterTest;
    this.getConstruction = construction; // [{ id, name, region, delay(days) }]: sites still being built
    this.week = 0;
    this.reputation = TUNING.reputation.start; // GDD: 0-100, starting at 40 (#77)
    this.boardConfidence = 60;
    this.breachCount = 0; // across the whole game: the containment op costs $10M x this
    this.researchBlocked = false;
    this.paused = false;
    this.rdLevel = rdLevel; // () => R&D department level; null = no company in play, so the gate is open
    this.spendRp = spendRp; // (rp) => true if paid; null = crash research costs no RP (demos, sims)
    this.heroicsUsed = new Set(); // executive ids, once per campaign
    this.log = [];
    this._listeners = new Map();
    const [lo, hi] = this.cfg.tipOffset;
    this.tracks = {};
    for (const t of tracks) {
      const offset = tips?.[t.id] != null ? tips[t.id] - this.cfg.tipBase : lo + Math.floor(this.rng() * (hi - lo + 1));
      this.tracks[t.id] = {
        id: t.id, name: t.name, tension: t.tension ?? 0,
        tipRolled: this.cfg.tipBase + offset, // hidden
        scars: 0, revealed: false, breaches: 0,
        state: 'calm', // calm | brink | breach | locked | collapsed
        lockWeeks: 0, window: null,
        open: t.open ?? true, // a closed track waits for its opening time (openTrack); its tip still rolls now
      };
    }
  }

  /** Open tracks only: the ones that are in play. */
  get openTracks() { return Object.values(this.tracks).filter((t) => t.open); }

  /**
   * A track opens (its time in the roster has come). Its tipping point was rolled at the start, and
   * Doom Clock fragility has been lowering it all along, so it opens already fragile.
   */
  openTrack(id, { tension = 0 } = {}) {
    const t = this.tracks[id];
    if (!t || t.open) return false;
    t.open = true;
    this._note(`${t.name} OPENS. Tipping point somewhere in ${JSON.stringify(this.visibleTip(id).range)}.`, { type: 'open', track: id });
    this._emit('open', { track: id });
    if (tension) this.setTension(id, tension, 'opening'); else this._sync();
    return true;
  }

  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
    return () => this._listeners.get(type).delete(fn);
  }
  _emit(type, payload) {
    for (const fn of this._listeners.get(type) ?? []) fn(payload, this);
  }
  _note(text, extra = {}) {
    const e = { week: this.week, text, ...extra };
    this.log.push(e);
    this._emit('log', e);
  }

  // ---------- reading ----------
  /** The real tipping point now: rolled - scars, then Doom Clock fragility, never below 72. */
  tippingPoint(id) {
    const t = this.tracks[id];
    const scarred = t.tipRolled - t.scars * this.cfg.scar;
    const fragile = this.clock ? this.clock.tippingPoint(scarred) : scarred;
    return Math.max(this.cfg.tipMin, fragile);
  }
  /** What the player sees: the exact point once revealed, otherwise a range. */
  visibleTip(id) {
    const t = this.tracks[id];
    if (t.revealed) return { exact: this.tippingPoint(id) };
    const [lo, hi] = this.cfg.tipOffset;
    const shift = this.tippingPoint(id) - t.tipRolled; // scars + fragility the player can infer
    return { range: [Math.max(this.cfg.tipMin, this.cfg.tipBase + lo + shift), Math.max(this.cfg.tipMin, this.cfg.tipBase + hi + shift)] };
  }
  get activeBreaches() {
    return Object.values(this.tracks).filter((t) => t.state === 'breach');
  }
  /** Panic premium multiplier: doubled while any breach is open. */
  get panicMultiplier() {
    return this.activeBreaches.length ? this.cfg.perBreachWeek.panicMultiplier : 1;
  }

  // ---------- tension input (schemes, world drift, spillover) ----------
  addTension(id, delta, source = '') {
    const t = this.tracks[id];
    if (!t) return;
    if (!t.open) return; // not in play yet
    if (t.state === 'collapsed') return; // pinned at 100
    if (t.state === 'locked' && delta > 0) return; // recovering: can't be pushed up
    this.setTension(id, t.tension + delta, source);
  }

  setTension(id, value, source = '') {
    const t = this.tracks[id];
    if (!t || !t.open || t.state === 'collapsed') return;
    t.tension = clamp(value);
    if (t.state === 'breach' || t.state === 'locked') return this._sync();
    const tip = this.tippingPoint(id);
    if (t.tension >= tip) this._breach(t, source);
    else {
      const wasBrink = t.state === 'brink';
      t.state = t.tension >= tip - this.cfg.brinkMargin ? 'brink' : 'calm';
      if (t.state === 'brink' && !wasBrink) this.clock?.brink(id);
    }
    this._sync();
  }

  /** Tipping point before Doom Clock fragility (rolled minus scars): what the clock lowers by itself. */
  baseTip(id) {
    const t = this.tracks[id];
    return t.tipRolled - t.scars * this.cfg.scar;
  }

  /** Push every OPEN track's tension, and its pre-fragility tip, to the Doom Clock. */
  _sync() {
    if (!this.clock) return;
    const open = this.openTracks;
    this.clock.setTensions(Object.fromEntries(open.map((t) => [t.id, t.tension])), { tips: Object.fromEntries(open.map((t) => [t.id, this.baseTip(t.id)])) });
  }

  // ---------- breach ----------
  _breach(t, source) {
    t.breaches += 1;
    this.breachCount += 1;
    t.state = 'breach';
    this.clock?.brink(t.id); // a breach always passes the Brink
    const weeks = this.cfg.windowWeeks[Math.min(t.breaches, this.cfg.windowWeeks.length) - 1];
    t.window = { weeksLeft: weeks, total: weeks, bar: 0, used: {}, breachNo: this.breachCount };
    this.paused = true;
    this._note(`${t.name} BREACHED${source ? ` (${source})` : ''}. Containment window: ${weeks} weeks.`, { type: 'breach', track: t.id });
    t.window.shelterTests = this._shelterInPlace(t); // clients move in at once; shown on the breach card
    this._emit('breach', { track: t.id, weeks, breachNo: this.breachCount });
    this._emit('pause', { reason: 'breach', track: t.id });
  }

  /**
   * What a containment source would do on this breach right now: { key, label, points, cash, heat, ... } plus
   * `available` and, when it isn't, a plain `reason`. Returns null for an unknown track/source or no breach.
   * opts: { scheme } for calming (default Everything Is Fine), { exec } for heroics (default: the first unused).
   */
  sourceOffer(id, key, opts = {}) {
    const t = this.tracks[id];
    const s = this.cfg.sources[key];
    if (!t?.window || !s) return null;
    const used = t.window.used[key] ?? 0;
    const offer = {
      key, label: s.label, points: s.points ?? 0, cash: s.costPerBreach ? s.costPerBreach * t.window.breachNo : 0,
      usesLeft: s.uses - used, heat: s.heat ?? 0, boardConfidence: s.boardConfidence ?? 0, blocksResearch: !!s.blocksResearch,
      weeks: s.weeks ?? 0, perWeek: !!s.perWeek, rpPerWeek: s.rpPerWeek ?? 0, available: true, reason: null,
    };
    const no = (reason) => Object.assign(offer, { available: false, reason });
    if (used >= s.uses) no(key === 'research' ? 'Already running' : 'Used for this breach');
    if (key === 'op' && (t.window.pending ?? []).some((p) => p.key === 'op')) no(`Op under way: lands in ${t.window.pending.find((p) => p.key === 'op').weeksLeft} week(s)`);
    if (s.requiresRD) {
      const lvl = this.rdLevel ? this.rdLevel() : Infinity;
      if (lvl < s.requiresRD) no(`Needs R&D level ${s.requiresRD} (now ${lvl})`);
    }
    if (s.minReputation && this.reputation < s.minReputation) no(`Needs reputation ${s.minReputation} (now ${Math.round(this.reputation)})`);
    if (key === 'calming') {
      const sc = SCHEME_BY_ID[opts.scheme ?? s.scheme];
      if (!sc || sc.group !== 'calm' || !(sc.momentum < 0)) return no('Not a calming scheme');
      offer.scheme = sc.id;
      offer.label = `${s.label}: ${sc.name}`;
      offer.points = Math.round(Math.abs(sc.momentum) * s.momentumShare * 10) / 10;
      offer.cash = sc.cost ?? 0;
      offer.heat = sc.heat ?? 0;
    }
    if (key === 'heroics') {
      const left = HEROICS.filter((e) => !this.heroicsUsed.has(e.id));
      offer.executives = left.map((e) => e.id);
      const ex = opts.exec ? HEROICS.find((e) => e.id === opts.exec) : left[0];
      if (!ex) no('No executive left for heroics');
      else if (this.heroicsUsed.has(ex.id)) no(`${ex.name} has already done this once`);
      else { offer.exec = ex.id; offer.label = `${s.label}: ${ex.act}`; offer.heat += ex.heat; }
    }
    return offer;
  }

  /**
   * Spend a containment source on an open breach. Immediate sources add their points now; the op lands after its
   * weeks, crash research drips points every breach week. Returns the bar value, or null if it can't be used.
   */
  contribute(id, key, opts = {}) {
    const t = this.tracks[id];
    const offer = this.sourceOffer(id, key, opts);
    if (!offer?.available || t.state !== 'breach') return null;
    t.window.used[key] = (t.window.used[key] ?? 0) + 1;
    if (offer.cash) this.ledger?.record('schemes', `${offer.label}: ${t.name}`, -offer.cash);
    if (offer.heat) this.pb?.addHeat(offer.heat, offer.label);
    if (offer.boardConfidence) this.boardConfidence = clamp(this.boardConfidence + offer.boardConfidence);
    if (offer.blocksResearch) this.researchBlocked = true;
    if (key === 'heroics') this.heroicsUsed.add(offer.exec);
    if (offer.weeks) {
      (t.window.pending ??= []).push({ key, label: offer.label, points: offer.points, weeksLeft: offer.weeks });
      this._note(`${offer.label} on ${t.name} launched: +${offer.points} in ${offer.weeks} weeks.`, { type: 'contain', track: t.id, source: key, pending: true });
      this._emit('contribute', { track: t.id, source: key, bar: t.window.bar, pending: true });
      return t.window.bar;
    }
    if (offer.perWeek) {
      t.window.research = { points: offer.points, rp: offer.rpPerWeek };
      this._note(`${offer.label} on ${t.name} started: +${offer.points} a week${offer.rpPerWeek ? ` for ${offer.rpPerWeek} RP a week` : ''}.`, { type: 'contain', track: t.id, source: key, pending: true });
      this._emit('contribute', { track: t.id, source: key, bar: t.window.bar, pending: true });
      return t.window.bar;
    }
    return this._addPoints(t, offer.points, offer.label, key);
  }

  /** Stop a crash research program early (normal research resumes once no breach needs it). */
  stopResearch(id) {
    const t = this.tracks[id];
    if (!t?.window?.research) return false;
    t.window.research = null;
    if (!this.activeBreaches.some((b) => b.window?.research)) this.researchBlocked = false;
    return true;
  }

  _addPoints(t, points, label, key) {
    const bar = (t.window.bar = Math.min(100, t.window.bar + points));
    this._note(`${label} on ${t.name}: +${points} (bar ${bar}/100).`, { type: 'contain', track: t.id, source: key });
    this._emit('contribute', { track: t.id, source: key, bar });
    if (bar >= 100) this._contain(t);
    return bar;
  }

  /** One breach week of the slow sources: ops count down and land, crash research drips (and costs RP). */
  _tickSources(t) {
    const w = t.window;
    if (w.research) {
      const paid = !w.research.rp || !this.spendRp || this.spendRp(w.research.rp);
      if (paid) this._addPoints(t, w.research.points, this.cfg.sources.research.label, 'research');
      else { this._note(`Crash research on ${t.name} stopped: not enough RP.`, { type: 'contain', track: t.id, source: 'research' }); this.stopResearch(t.id); }
      if (t.state !== 'breach') return;
    }
    for (const p of [...(w.pending ?? [])]) {
      p.weeksLeft -= 1;
      if (p.weeksLeft > 0) continue;
      w.pending = w.pending.filter((x) => x !== p);
      this._addPoints(t, p.points, p.label, p.key);
      if (t.state !== 'breach') return;
    }
  }

  _contain(t) {
    const R = this.cfg.recovery;
    t.state = 'locked';
    t.tension = R.tension;
    t.lockWeeks = R.lockWeeks;
    t.scars += 1;
    t.revealed = true;
    t.window = null;
    this.clock?.breachContained(t.id);
    this._note(`${t.name} CONTAINED. Tension 60, locked ${R.lockWeeks} weeks, scarred: tipping point now ${this.tippingPoint(t.id)} (revealed).`, { type: 'contained', track: t.id });
    this._emit('contained', { track: t.id, tip: this.tippingPoint(t.id) });
    this._afterWindow();
    this._sync();
  }

  _collapse(t) {
    t.state = 'collapsed';
    t.tension = this.cfg.collapseTension;
    t.window = null;
    this.clock?.collapse(t.id);
    this._note(`${t.name} COLLAPSED. Pinned at 100.`, { type: 'collapse', track: t.id });
    this._emit('collapse', { track: t.id });
    this._afterWindow();
    // Domino: shove every linked track.
    for (const [a, b, strength] of this.links) {
      const other = a === t.id ? b : b === t.id ? a : null;
      if (!other || !this.tracks[other]) continue;
      const shove = this.cfg.shove[strength];
      this._note(`Domino: ${t.name} → ${this.tracks[other].name} +${shove} (${strength} link).`, { type: 'domino', from: t.id, to: other, shove });
      this._emit('domino', { from: t.id, to: other, shove, strength });
      this.addTension(other, shove, `domino from ${t.name}`);
    }
    this._sync();
  }

  _afterWindow() {
    if (!this.activeBreaches.length) {
      this.researchBlocked = false;
      this.paused = false;
      this._emit('resume', {});
    }
  }

  /**
   * Shelter-in-place: clients in the breached track's high-exposure regions move into their shelters. Each
   * handed-over shelter there is tested: pass +2 reputation; fail -5 reputation and +15 leverage for its client,
   * and a badly failed one (survival odds under 50%) loses occupants. Sites still under construction in those
   * regions lose a week of work instead.
   */
  _shelterInPlace(t) {
    const T = this.cfg.shelterTest;
    const results = [];
    for (const s of this.getShelters()) {
      if (!s.sold || !highlyExposed(s.region, t.id)) continue;
      const raw = this.shelterTest(s, t.id);
      const r = typeof raw === 'boolean' ? { pass: raw, p: raw ? 1 : 0, why: [] } : raw;
      let lost = 0;
      if (r.pass) this.reputation = clamp(this.reputation + T.pass.reputation);
      else {
        this.reputation = clamp(this.reputation + T.fail.reputation);
        const client = this.pb?.clients?.find((c) => c.name === s.owner);
        if (client) client.leverage += T.fail.leverage;
        if (r.p < T.badlyBelow && (s.occupants ?? 0) > 0) {
          lost = Math.max(1, Math.round(s.occupants * (T.badlyBelow - r.p)));
          lost = Math.min(lost, s.occupants);
          s.occupants -= lost;
          s.lostInBreaches = (s.lostInBreaches ?? 0) + lost;
        }
      }
      const verdict = r.pass ? 'PASSED (+2 reputation)' : `FAILED (-5 reputation, +15 leverage${lost ? `, ${lost} occupant${lost === 1 ? '' : 's'} lost` : ''})`;
      this._note(`Shelter-in-place, ${t.name}: ${s.name}${s.owner ? ` (${s.owner})` : ''} ${verdict}${r.why?.length ? `: ${r.why.join(', ')}` : ''}.`, { type: 'shelter', shelter: s.id, pass: r.pass, lost });
      const result = { shelter: s.id, name: s.name, owner: s.owner, region: s.region, pass: r.pass, p: r.p, why: r.why ?? [], lost, track: t.id };
      results.push(result);
      this._emit('shelterTest', result);
    }
    for (const site of this.getConstruction()) {
      if (!highlyExposed(site.region, t.id)) continue;
      site.delay?.(T.constructionDelayDays);
      this._note(`Shelter-in-place, ${t.name}: construction at ${site.name} stops for a week.`, { type: 'construction', site: site.id });
      results.push({ site: site.id, name: site.name, delayedDays: T.constructionDelayDays, track: t.id });
      this._emit('constructionDelay', { site: site.id, days: T.constructionDelayDays, track: t.id });
    }
    return results;
  }

  // ---------- time ----------
  /** One in-game week. Call once per week from the campaign clock (after the player resumes). */
  advanceWeek() {
    this.week += 1;
    // The clock's week turns first, so a countdown started by this week's collapse gets its full 4 weeks.
    if (this.clockWeeks) this.clock?.advanceWeeks(1);
    const W = this.cfg.perBreachWeek;
    const breaches = this.activeBreaches;
    for (const t of breaches) {
      this._tickSources(t); // ops land and crash research drips before the window closes
      if (t.state !== 'breach') continue;
      this.pb?.addHeat(W.heat, `${t.name} breach`);
      this.boardConfidence = clamp(this.boardConfidence + W.boardConfidence);
      t.window.weeksLeft -= 1;
      this._note(`${t.name} breach week: +${W.heat} heat, ${W.boardConfidence} board confidence, panic premium x${W.panicMultiplier}. ${t.window.weeksLeft} weeks left.`, { type: 'breachWeek', track: t.id });
      if (t.window.weeksLeft <= 0 && t.window.bar < 100) this._collapse(t);
    }
    for (const t of Object.values(this.tracks)) {
      if (t.state !== 'locked') continue;
      t.lockWeeks -= 1;
      if (t.lockWeeks <= 0) {
        t.state = 'calm';
        this._note(`${t.name} recovery lock lifts.`, { type: 'unlock', track: t.id });
        this.setTension(t.id, t.tension);
      }
    }
    // Every week the clock hears every open track's tension and tip (and, in the campaign, the week itself).
    // Brink drift (#92, GDD Difficulty): a track at its Brink creeps toward the edge on its own each week.
    const drift = this.cfg.brinkDrift ?? 0;
    if (drift) for (const t of Object.values(this.tracks)) if (t.open && t.state === 'brink') this.addTension(t.id, drift, 'Brink drift');
    this._sync();
    this._emit('week', { week: this.week });
  }

  /** Save slot: every track (including its hidden roll), the week and the shared meters. */
  toJSON() {
    return {
      week: this.week, reputation: this.reputation, boardConfidence: this.boardConfidence, breachCount: this.breachCount,
      researchBlocked: this.researchBlocked, paused: this.paused, heroicsUsed: [...this.heroicsUsed],
      tracks: Object.values(this.tracks).map((t) => ({ ...t, window: t.window ? structuredClone(t.window) : null })),
    };
  }

  load(d = {}) {
    for (const k of ['week', 'reputation', 'boardConfidence', 'breachCount', 'researchBlocked', 'paused']) if (d[k] != null) this[k] = d[k];
    this.heroicsUsed = new Set(d.heroicsUsed ?? []);
    for (const saved of d.tracks ?? []) if (this.tracks[saved.id]) Object.assign(this.tracks[saved.id], saved);
    this._sync();
  }

  snapshot() {
    return {
      week: this.week, reputation: this.reputation, boardConfidence: this.boardConfidence, breachCount: this.breachCount,
      panicMultiplier: this.panicMultiplier, paused: this.paused, researchBlocked: this.researchBlocked,
      tracks: Object.values(this.tracks).map((t) => ({
        id: t.id, name: t.name, open: t.open, tension: t.tension, state: t.state, scars: t.scars, breaches: t.breaches,
        lockWeeks: t.lockWeeks, tip: this.visibleTip(t.id), window: t.window ? { ...t.window, used: { ...t.window.used } } : null,
      })),
    };
  }
}
