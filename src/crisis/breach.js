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

export const BREACH = Object.freeze({
  tipBase: 90,
  tipOffset: [-8, 4], // hidden roll, inclusive
  tipMin: 72,
  scar: 3,
  windowWeeks: [6, 4, 3], // by the track's breach number (1st, 2nd, 3rd+)
  perBreachWeek: { heat: 2, boardConfidence: -2, panicMultiplier: 2 },
  recovery: { tension: 60, lockWeeks: 3 },
  collapseTension: 100,
  shove: { strong: 15, medium: 8, weak: 4 },
  shelterTest: { pass: { reputation: 2 }, fail: { reputation: -5, leverage: 15 } },
  brinkMargin: 10,
  // The five containment sources (GDD: Breach and containment). Money is in GDD dollars; the campaign
  // passes `costScale` to fit its economy.
  sources: {
    // +40 when it lands, 2 weeks after launch. $10M x the game's breach count. One per track at a time.
    op: { label: 'Containment op', points: 40, delayWeeks: 2, costPerBreach: 10_000_000, uses: Infinity, oneAtATime: true },
    // +15 every week it runs, for 40 RP that week. Needs R&D at level 2 or higher. Toggle on/off.
    research: { label: 'Crash research program', pointsPerWeek: 15, rpPerWeek: 40, rdLevel: 2, uses: Infinity, program: true },
    // Calming schemes on the breached track give half their momentum. The card's button runs Everything Is Fine
    // (-8 momentum, $1M, heat -2): +4.
    calming: { label: 'Everything Is Fine', points: 4, momentum: -8, cost: 1_000_000, heat: -2, uses: Infinity },
    // +25, once per breach. Needs reputation 50+. Heat -5.
    government: { label: 'Government partnership', points: 25, uses: 1, heat: -5, minReputation: 50 },
    // +20, once per executive per campaign.
    heroics: { label: 'Executive heroics', points: 20, uses: Infinity, perExec: true },
  },
  // The three executives who can step in once each (GDD: Characters). Theo's fix is dirty: heat +10.
  executives: {
    ruth: { name: 'Ruth', deed: "Ruth's engineering fix", heat: 0 },
    june: { name: 'June', deed: "June's media blackout", heat: 0 },
    theo: { name: 'Theo', deed: "Theo's dirty fix", heat: 10 },
  },
  costScale: 1,
});

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

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** Default shelter-in-place test: the shelter's air, water and food all cover its occupants. */
export function defaultShelterTest(shelter) {
  const g = gradeShelter(shelter);
  return Math.min(g.ratios.air, g.ratios.water, g.ratios.food) >= 1;
}

export class CrisisSystem {
  constructor({ seed = 1, tracks = TRACKS, links = DOMINO_LINKS, config = {}, pushback = null, doomClock = null, ledger = null, shelters = () => [], shelterTest = defaultShelterTest, tips = null, clockWeeks = false, research = null } = {}) {
    this.cfg = { ...BREACH, ...config, sources: { ...BREACH.sources, ...(config.sources ?? {}) }, executives: { ...BREACH.executives, ...(config.executives ?? {}) } };
    this.rng = rngFrom(seed);
    this.links = links;
    this.pb = pushback;
    this.clock = doomClock;
    this.clockWeeks = clockWeeks; // true: each advanceWeek() also advances the Doom Clock a week (campaign)
    this.ledger = ledger;
    this.getShelters = shelters;
    this.shelterTest = shelterTest;
    this.week = 0;
    this.reputation = 50;
    this.boardConfidence = 60;
    this.breachCount = 0; // across the whole game: the containment op costs $10M x this
    this.researchBlocked = false; // kept for saves; the crash program no longer blocks research (it costs RP)
    // R&D hooks for the crash program: level() and spend(rp) -> true if paid. Without hooks: level 2, RP free.
    this.research = { level: () => 2, spend: () => true, ...(research ?? {}) };
    this.heroicsUsed = {}; // exec id -> track id, for the whole campaign
    this.paused = false;
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
    this._emit('breach', { track: t.id, weeks, breachNo: this.breachCount });
    this._emit('pause', { reason: 'breach', track: t.id });
    this._shelterInPlace(t);
  }

  /**
   * What a containment source offers on this breach right now, or null if it can't be used.
   * opts.exec picks the executive for heroics. The offer says why it's unavailable in `blocked` (then null is
   * returned by contribute): { key, label, points, cash, heat, usesLeft, blocked, pending, running, ... }.
   */
  sourceOffer(id, key, opts = {}) {
    const t = this.tracks[id];
    const s = this.cfg.sources[key];
    if (!t?.window || !s) return null;
    const used = t.window.used[key] ?? 0;
    const scale = this.cfg.costScale ?? 1;
    const offer = { key, label: s.label, points: s.points ?? s.pointsPerWeek, cash: 0, heat: s.heat ?? 0, usesLeft: s.uses - used, blocked: null };
    if (used >= s.uses) offer.blocked = 'Used for this breach';
    if (key === 'op') {
      offer.cash = Math.round(s.costPerBreach * this.breachCount * scale);
      offer.delayWeeks = s.delayWeeks;
      offer.pending = t.window.ops?.length ?? 0;
      if (s.oneAtATime && offer.pending) offer.blocked = 'Op already under way';
    } else if (key === 'research') {
      offer.rpPerWeek = s.rpPerWeek;
      offer.running = !!t.window.program;
      if (this.research.level() < s.rdLevel) offer.blocked = `Needs R&D level ${s.rdLevel}`;
    } else if (key === 'calming') {
      offer.cash = Math.round(s.cost * scale);
      offer.momentum = s.momentum;
    } else if (key === 'government') {
      if (this.reputation < s.minReputation) offer.blocked = offer.blocked ?? `Needs reputation ${s.minReputation}`;
    } else if (key === 'heroics') {
      const free = Object.keys(this.cfg.executives).filter((e) => !this.heroicsUsed[e]);
      offer.execs = free;
      const exec = opts.exec ?? free[0];
      offer.exec = exec ?? null;
      if (!exec || this.heroicsUsed[exec]) offer.blocked = 'No executive left to step in';
      else { offer.label = this.cfg.executives[exec].deed; offer.heat = this.cfg.executives[exec].heat ?? 0; }
    }
    return offer;
  }

  /**
   * Spend a containment source on an open breach. Returns the bar value afterwards, or null if not possible.
   * The op is paid now and lands +40 two weeks later; research toggles a weekly program.
   */
  contribute(id, key, opts = {}) {
    const t = this.tracks[id];
    const offer = this.sourceOffer(id, key, opts);
    if (!offer || offer.blocked || t.state !== 'breach') return null;
    const s = this.cfg.sources[key];
    if (key === 'research') {
      t.window.program = !t.window.program;
      this._note(`${s.label} on ${t.name} ${t.window.program ? 'STARTED (+15 a week for 40 RP a week)' : 'stopped'}.`, { type: 'contain', track: t.id, source: key });
      this._emit('contribute', { track: t.id, source: key, bar: t.window.bar, program: t.window.program });
      return t.window.bar;
    }
    t.window.used[key] = (t.window.used[key] ?? 0) + 1;
    if (offer.cash) this.ledger?.record('schemes', `${offer.label}: ${t.name}`, -offer.cash);
    if (offer.heat > 0) this.pb?.addHeat(offer.heat, offer.label);
    else if (offer.heat < 0 && this.pb) this.pb.heat = clamp(this.pb.heat + offer.heat);
    if (key === 'op') {
      (t.window.ops ??= []).push({ weeksLeft: s.delayWeeks, points: s.points });
      this._note(`${offer.label} launched on ${t.name}: +${s.points} lands in ${s.delayWeeks} weeks.`, { type: 'contain', track: t.id, source: key });
      this._emit('contribute', { track: t.id, source: key, bar: t.window.bar, pending: true });
      this.pb?._changed?.();
      return t.window.bar;
    }
    if (key === 'heroics') this.heroicsUsed[offer.exec] = t.id;
    this.pb?._changed?.();
    return this._addPoints(t, offer.points, offer.label, key);
  }

  /**
   * A calming scheme ran on a track (from the scheme board). During a breach it adds half its momentum
   * value to the containment bar (Everything Is Fine, -8 momentum: +4). Returns the points added.
   */
  calmingScheme(id, momentum, label = 'Calming scheme') {
    const t = this.tracks[id];
    if (t?.state !== 'breach') return 0;
    const pts = Math.abs(momentum) / 2;
    this._addPoints(t, pts, label, 'calming');
    return pts;
  }

  _addPoints(t, points, label, key) {
    const bar = (t.window.bar = Math.min(100, Math.round((t.window.bar + points) * 10) / 10));
    this._note(`${label} on ${t.name}: +${points} (bar ${bar}/100).`, { type: 'contain', track: t.id, source: key });
    this._emit('contribute', { track: t.id, source: key, bar });
    if (bar >= 100) this._contain(t);
    return bar;
  }

  /** Weekly containment work: ops land after their delay, the crash program pays +15 for 40 RP. */
  _containmentWeek(t) {
    const w = t.window;
    for (const op of w.ops ?? []) op.weeksLeft -= 1;
    const landed = (w.ops ?? []).filter((op) => op.weeksLeft <= 0);
    w.ops = (w.ops ?? []).filter((op) => op.weeksLeft > 0);
    for (const op of landed) { this._addPoints(t, op.points, this.cfg.sources.op.label, 'op'); if (t.state !== 'breach') return; }
    if (w.program) {
      const R = this.cfg.sources.research;
      if (this.research.level() >= R.rdLevel && this.research.spend(R.rpPerWeek)) this._addPoints(t, R.pointsPerWeek, R.label, 'research');
      else { w.program = false; this._note(`${R.label} on ${t.name} stopped: not enough RP.`, { type: 'contain', track: t.id, source: 'research' }); }
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

  _shelterInPlace(t) {
    const T = this.cfg.shelterTest;
    for (const s of this.getShelters()) {
      if (!s.sold) continue;
      const pass = this.shelterTest(s, t.id);
      if (pass) this.reputation = clamp(this.reputation + T.pass.reputation);
      else {
        this.reputation = clamp(this.reputation + T.fail.reputation);
        const client = this.pb?.clients?.find((c) => c.name === s.owner);
        if (client) client.leverage += T.fail.leverage;
      }
      this._note(`Shelter-in-place test, ${s.name}: ${pass ? 'PASSED (+2 reputation)' : 'FAILED (-5 reputation, +15 leverage)'}.`, { type: 'shelter', shelter: s.id, pass });
      this._emit('shelterTest', { shelter: s.id, pass, track: t.id });
    }
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
      this._containmentWeek(t);
      if (t.state !== 'breach') continue; // contained by this week's work
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
    this._sync();
    this._emit('week', { week: this.week });
  }

  /** Save slot: every track (including its hidden roll), the week and the shared meters. */
  toJSON() {
    return {
      week: this.week, reputation: this.reputation, boardConfidence: this.boardConfidence, breachCount: this.breachCount,
      researchBlocked: this.researchBlocked, paused: this.paused, heroicsUsed: { ...this.heroicsUsed },
      tracks: Object.values(this.tracks).map((t) => ({ ...t, window: t.window ? { ...t.window, used: { ...t.window.used }, ops: (t.window.ops ?? []).map((o) => ({ ...o })) } : null })),
    };
  }

  load(d = {}) {
    for (const k of ['week', 'reputation', 'boardConfidence', 'breachCount', 'researchBlocked', 'paused']) if (d[k] != null) this[k] = d[k];
    this.heroicsUsed = { ...(d.heroicsUsed ?? {}) };
    for (const saved of d.tracks ?? []) if (this.tracks[saved.id]) Object.assign(this.tracks[saved.id], saved);
    this._sync();
  }

  snapshot() {
    return {
      week: this.week, reputation: this.reputation, boardConfidence: this.boardConfidence, breachCount: this.breachCount,
      panicMultiplier: this.panicMultiplier, paused: this.paused, researchBlocked: this.researchBlocked,
      tracks: Object.values(this.tracks).map((t) => ({
        id: t.id, name: t.name, open: t.open, tension: t.tension, state: t.state, scars: t.scars, breaches: t.breaches,
        lockWeeks: t.lockWeeks, tip: this.visibleTip(t.id), window: t.window ? { ...t.window, used: { ...t.window.used }, ops: (t.window.ops ?? []).map((o) => ({ ...o })) } : null,
      })),
    };
  }
}
