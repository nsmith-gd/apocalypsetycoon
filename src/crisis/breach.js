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
  // The five containment sources. Points and costs not given in the ticket are provisional
  // (marked) until the GDD text is in the repo.
  sources: {
    op: { label: 'Containment op', points: 40, costPerBreach: 10_000_000, uses: 1 }, // $10M x breach count (ticket); 40 pts provisional
    research: { label: 'Crash research program', points: 25, uses: 1, blocksResearch: true }, // provisional
    calming: { label: 'Calming scheme', points: 10, uses: 3 }, // per scheme, provisional
    government: { label: 'Government partnership', points: 30, uses: 1, heat: 10 }, // provisional
    heroics: { label: 'Executive heroics', points: 15, uses: 1, boardConfidence: -5 }, // provisional
  },
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
  constructor({ seed = 1, tracks = TRACKS, links = DOMINO_LINKS, config = {}, pushback = null, doomClock = null, ledger = null, shelters = () => [], shelterTest = defaultShelterTest, tips = null } = {}) {
    this.cfg = { ...BREACH, ...config, sources: { ...BREACH.sources, ...(config.sources ?? {}) } };
    this.rng = rngFrom(seed);
    this.links = links;
    this.pb = pushback;
    this.clock = doomClock;
    this.ledger = ledger;
    this.getShelters = shelters;
    this.shelterTest = shelterTest;
    this.week = 0;
    this.reputation = 50;
    this.boardConfidence = 60;
    this.breachCount = 0; // across the whole game: the containment op costs $10M x this
    this.researchBlocked = false;
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
      };
    }
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
    if (t.state === 'collapsed') return; // pinned at 100
    if (t.state === 'locked' && delta > 0) return; // recovering: can't be pushed up
    this.setTension(id, t.tension + delta, source);
  }

  setTension(id, value, source = '') {
    const t = this.tracks[id];
    if (!t || t.state === 'collapsed') return;
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

  _sync() {
    if (this.clock) this.clock.setTensions(Object.fromEntries(Object.values(this.tracks).map((t) => [t.id, t.tension])));
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

  /** Cost and points of a containment source for this breach (null if used up). */
  sourceOffer(id, key) {
    const t = this.tracks[id];
    const s = this.cfg.sources[key];
    if (!t?.window || !s) return null;
    const used = t.window.used[key] ?? 0;
    if (used >= s.uses) return null;
    return { key, label: s.label, points: s.points, cash: s.costPerBreach ? s.costPerBreach * t.window.breachNo : 0, usesLeft: s.uses - used, heat: s.heat ?? 0, boardConfidence: s.boardConfidence ?? 0, blocksResearch: !!s.blocksResearch };
  }

  /** Spend a containment source on an open breach. Returns the new bar value, or null. */
  contribute(id, key) {
    const t = this.tracks[id];
    const offer = this.sourceOffer(id, key);
    if (!offer || t.state !== 'breach') return null;
    t.window.used[key] = (t.window.used[key] ?? 0) + 1;
    if (offer.cash) this.ledger?.record('schemes', `${offer.label}: ${t.name}`, -offer.cash);
    if (offer.heat) this.pb?.addHeat(offer.heat, offer.label);
    if (offer.boardConfidence) this.boardConfidence = clamp(this.boardConfidence + offer.boardConfidence);
    if (offer.blocksResearch) this.researchBlocked = true;
    if (key === 'calming' && this.pb?.fundRelief) this.pb.fundRelief(); // the scheme itself (costs and heat via pushback)
    const bar = (t.window.bar = Math.min(100, t.window.bar + offer.points));
    this._note(`${offer.label} on ${t.name}: +${offer.points} (bar ${bar}/100).`, { type: 'contain', track: t.id, source: key });
    this._emit('contribute', { track: t.id, source: key, bar });
    if (bar >= 100) this._contain(t);
    return bar;
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
    const W = this.cfg.perBreachWeek;
    const breaches = this.activeBreaches;
    for (const t of breaches) {
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
    this._emit('week', { week: this.week });
  }

  snapshot() {
    return {
      week: this.week, reputation: this.reputation, boardConfidence: this.boardConfidence, breachCount: this.breachCount,
      panicMultiplier: this.panicMultiplier, paused: this.paused, researchBlocked: this.researchBlocked,
      tracks: Object.values(this.tracks).map((t) => ({
        id: t.id, name: t.name, tension: t.tension, state: t.state, scars: t.scars, breaches: t.breaches,
        lockWeeks: t.lockWeeks, tip: this.visibleTip(t.id), window: t.window ? { ...t.window, used: { ...t.window.used } } : null,
      })),
    };
  }
}
