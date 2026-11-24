// Engineered Midnight, Seal Order and Overtime.
// GDD: Midnight and endings; Research > unlocks 41, 45, 46, 48.
//
// PROJECTS  Project Lights Out (on the pacing timeline at 4:50) and The Final Product (5:30, needs a
//           3-of-5 board vote). The player names one crisis track, or a linked pair (harsher
//           requirements, bigger payout), and a date 4 to 12 weeks out.
// LAST CALL until the date: sales run at triple premium and heat rises 3 a week. The player may call
//           it off ONCE, for -20 board confidence.
// SEAL ORDER on the date, a 2-week phase of convoy and helicopter pickups. Distance, sieges and
//           high-leverage clients make clients late or lost.
// GRADING   each apocalypse has a required Days Sealed and critical ratings (10 apocalypses, plus a
//           combined rule for a linked pair). Final grade from Platinum down to The Gerald, one grade
//           lower if Midnight came uncontrolled.
// OVERTIME  offered at the end of Q12 if Midnight hasn't come: endless quarters, the board quota grows
//           30% a quarter, and the 4 unused tracks open one per quarter.
//
// Pure rules, no DOM. Numbers the ticket gives are exact; the rest are marked provisional.

// Research unlocks (ids from the GDD's research list). Provisional mapping of id -> what it unlocks.
export const RESEARCH_UNLOCKS = Object.freeze({
  41: 'lights_out', // Project Lights Out
  45: 'helicopters', // helicopter pickups for the Seal Order
  46: 'final_product', // The Final Product
  48: 'overtime', // Overtime contracts
});

export const PROJECTS = Object.freeze({
  lights_out: { id: 'lights_out', name: 'Project Lights Out', research: 41, timeline: '4:50', hours: 4 + 50 / 60, boardVote: null, payout: 25_000_000, pairPayout: 60_000_000 },
  final_product: { id: 'final_product', name: 'The Final Product', research: 46, timeline: '5:30', hours: 5.5, boardVote: { of: 5, need: 3 }, payout: 60_000_000, pairPayout: 150_000_000 },
});

export const ENGINEERED = Object.freeze({
  minWeeks: 4,
  maxWeeks: 12,
  lastCallPremium: 3,
  lastCallHeatPerWeek: 3,
  callOffConfidence: -20,
  sealOrderWeeks: 2,
  overtimeQuotaGrowth: 0.3,
});

// Required Days Sealed and critical ratings per apocalypse (0-5). Ten apocalypses: the five campaign
// tracks plus five that only open in Overtime (four of them) or as a rare combo. Provisional values.
export const APOCALYPSES = Object.freeze({
  pandemic: { name: 'Pandemic', days: 180, critical: { seal: 4, morale: 2 }, campaign: true },
  climate: { name: 'Climate collapse', days: 365, critical: { seal: 2, morale: 3 }, campaign: true },
  unrest: { name: 'Civil collapse', days: 120, critical: { security: 4, morale: 2 }, campaign: true },
  markets: { name: 'Market crash', days: 90, critical: { security: 3, morale: 3 }, campaign: true },
  war: { name: 'Nuclear war', days: 365, critical: { blast: 4, seal: 4 }, campaign: true },
  solar: { name: 'Solar superflare', days: 60, critical: { blast: 1, seal: 2 }, overtime: true },
  ai: { name: 'AI uprising', days: 240, critical: { security: 5 }, overtime: true },
  volcano: { name: 'Supervolcano winter', days: 540, critical: { seal: 3, morale: 4 }, overtime: true },
  goo: { name: 'Grey goo', days: 365, critical: { seal: 5, blast: 2 }, overtime: true },
  asteroid: { name: 'Asteroid strike', days: 730, critical: { blast: 5, morale: 3 } },
});

/** A linked pair: the longer Days Sealed x1.25, and every critical rating at the higher of the two, +1. */
export function combinedRequirement(a, b) {
  const A = APOCALYPSES[a];
  const B = APOCALYPSES[b];
  const critical = {};
  for (const k of new Set([...Object.keys(A.critical), ...Object.keys(B.critical)])) critical[k] = Math.min(5, Math.max(A.critical[k] ?? 0, B.critical[k] ?? 0) + 1);
  return { name: `${A.name} + ${B.name}`, days: Math.round(Math.max(A.days, B.days) * 1.25), critical, combined: true };
}

export function requirementFor(target) {
  if (Array.isArray(target)) return target.length === 2 ? combinedRequirement(target[0], target[1]) : { ...APOCALYPSES[target[0]] };
  return { ...APOCALYPSES[target] };
}

// Grades, best to worst. The Gerald is named after the board member who signed off on gold taps.
export const GRADES = Object.freeze([
  { id: 'platinum', name: 'Platinum', min: 0.95, payout: 1.5 },
  { id: 'gold', name: 'Gold', min: 0.85, payout: 1.2 },
  { id: 'silver', name: 'Silver', min: 0.7, payout: 1 },
  { id: 'bronze', name: 'Bronze', min: 0.5, payout: 0.7 },
  { id: 'tin', name: 'Tin', min: 0.25, payout: 0.4 },
  { id: 'gerald', name: 'The Gerald', min: 0, payout: 0 },
]);

/** Grade from the share of people who survive; uncontrolled Midnight drops one grade. */
export function gradeFor(survivalRate, { uncontrolled = false } = {}) {
  let i = GRADES.findIndex((g) => survivalRate >= g.min);
  if (uncontrolled) i = Math.min(GRADES.length - 1, i + 1);
  return GRADES[i];
}

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

/** Board vote for The Final Product: 5 members, each votes yes with chance = confidence/100. */
export function boardVote({ confidence = 60, of = 5, need = 3, seed = 1 } = {}) {
  const rng = rngFrom(seed);
  const votes = Array.from({ length: of }, () => rng() < confidence / 100);
  const yes = votes.filter(Boolean).length;
  return { votes, yes, passed: yes >= need, need, of };
}

// ---------------------------------------------------------------------------------------------
// Seal Order pickups
// ---------------------------------------------------------------------------------------------
export const SEAL_ORDER = Object.freeze({
  // risk of a pickup going wrong (late, or lost if it goes wrong twice): provisional
  convoyPerDistance: 0.12, // per distance step (0 = same region as the shelter, 3 = other side of the world)
  heliPerDistance: 0.04,
  siegeRisk: 0.35, // the client's region has a crisis track at 90+
  leverageRisk: 0.25, // a high-leverage client (55+) dawdles, bargains and demands extras
  leverageLine: 55,
  lateSurvival: 0.75, // late arrivals: a quarter of the party doesn't make it through the door
});

/**
 * Run the 2-week Seal Order. `clients`: [{ id, name, distance 0-3, siege bool, leverage, heli bool }].
 * Returns each client's outcome: 'on_time' | 'late' | 'lost'.
 */
export function runSealOrder(clients, { seed = 1, helicopters = false, cfg = SEAL_ORDER } = {}) {
  const rng = rngFrom(seed);
  return clients.map((c) => {
    const heli = helicopters && (c.heli ?? c.distance >= 2);
    let risk = (heli ? cfg.heliPerDistance : cfg.convoyPerDistance) * (c.distance ?? 0);
    if (c.siege) risk += cfg.siegeRisk;
    if ((c.leverage ?? 0) >= cfg.leverageLine) risk += cfg.leverageRisk;
    risk = Math.min(0.95, risk);
    const first = rng() < risk;
    const second = first && rng() < risk;
    const outcome = second ? 'lost' : first ? 'late' : 'on_time';
    const why = [];
    if (c.distance >= 2) why.push(heli ? 'long flight' : 'long convoy');
    if (c.siege) why.push('siege');
    if ((c.leverage ?? 0) >= cfg.leverageLine) why.push('demands');
    return { ...c, transport: heli ? 'helicopter' : 'convoy', risk: Math.round(risk * 100) / 100, outcome, why };
  });
}

// ---------------------------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------------------------
export class EngineeredMidnight {
  constructor({ pushback = null, board = null, seed = 1, config = {} } = {}) {
    this.cfg = { ...ENGINEERED, ...config };
    this.pb = pushback;
    this.board = board ?? { confidence: 60 }; // anything with a `confidence` number
    this.seed = seed;
    this.plan = null; // { project, target, requirement, weeksLeft, date }
    this.calledOff = false;
    this.phase = 'none'; // none | last_call | seal_order | midnight
    this.sealWeeksLeft = 0;
    this.vote = null;
    this._listeners = new Map();
  }
  on(t, fn) { if (!this._listeners.has(t)) this._listeners.set(t, new Set()); this._listeners.get(t).add(fn); return () => this._listeners.get(t).delete(fn); }
  _emit(t, p) { for (const fn of this._listeners.get(t) ?? []) fn(p, this); }

  /** Can this project be started? `researched` = set of research ids done; `hours` = hours played. */
  available(projectId, { researched = new Set(), hours = 0 } = {}) {
    const p = PROJECTS[projectId];
    return researched.has(p.research) || hours >= p.hours;
  }

  /**
   * Commit to the end of the world. `target` is a track id or a [track, track] linked pair.
   * Returns { ok, reason?, vote? }.
   */
  start({ project = 'lights_out', target, weeks }) {
    if (this.plan) return { ok: false, reason: 'A Midnight is already scheduled.' };
    if (weeks < this.cfg.minWeeks || weeks > this.cfg.maxWeeks) return { ok: false, reason: `Pick a date ${this.cfg.minWeeks} to ${this.cfg.maxWeeks} weeks out.` };
    const P = PROJECTS[project];
    if (P.boardVote) {
      this.vote = boardVote({ confidence: this.board.confidence, ...P.boardVote, seed: this.seed + 7 });
      this._emit('vote', this.vote);
      if (!this.vote.passed) return { ok: false, reason: `The board voted ${this.vote.yes}-${this.vote.of - this.vote.yes}. You needed ${P.boardVote.need}.`, vote: this.vote };
    }
    const pair = Array.isArray(target) && target.length === 2;
    this.plan = { project, projectName: P.name, target, pair, requirement: requirementFor(target), weeksLeft: weeks, weeks, payout: pair ? P.pairPayout : P.payout };
    this.phase = 'last_call';
    this._emit('start', this.plan);
    return { ok: true, plan: this.plan, vote: this.vote };
  }

  /** Price multiplier for sales right now (Last Call runs at triple premium). */
  get salesMultiplier() { return this.phase === 'last_call' ? this.cfg.lastCallPremium : 1; }

  /** Call it off: once per campaign, -20 board confidence. */
  callOff() {
    if (this.phase !== 'last_call' || this.calledOff) return false;
    this.calledOff = true;
    this.board.confidence = Math.max(0, (this.board.confidence ?? 0) + this.cfg.callOffConfidence);
    this._emit('callOff', { confidence: this.board.confidence });
    this.plan = null; // a new date can be set later, but it can't be called off again
    this.phase = 'none';
    return true;
  }

  /** One in-game week. Returns the phase after the week. */
  advanceWeek() {
    if (this.phase === 'last_call') {
      this.pb?.addHeat(this.cfg.lastCallHeatPerWeek, 'Last Call');
      this.plan.weeksLeft -= 1;
      this._emit('week', { weeksLeft: this.plan.weeksLeft });
      if (this.plan.weeksLeft <= 0) {
        this.phase = 'seal_order';
        this.sealWeeksLeft = this.cfg.sealOrderWeeks;
        this._emit('sealOrder', { weeks: this.sealWeeksLeft });
      }
    } else if (this.phase === 'seal_order') {
      this.sealWeeksLeft -= 1;
      this._emit('week', { sealWeeksLeft: this.sealWeeksLeft });
      if (this.sealWeeksLeft <= 0) {
        this.phase = 'midnight';
        this._emit('midnight', { plan: this.plan });
      }
    }
    return this.phase;
  }
}

// ---------------------------------------------------------------------------------------------
// Overtime
// ---------------------------------------------------------------------------------------------
export class Overtime {
  constructor({ baseQuota, unusedTracks = Object.keys(APOCALYPSES).filter((k) => APOCALYPSES[k].overtime), growth = ENGINEERED.overtimeQuotaGrowth } = {}) {
    this.quota = baseQuota;
    this.growth = growth;
    this.pending = [...unusedTracks];
    this.opened = [];
    this.quarter = 12;
  }
  /** Start the next Overtime quarter: quota +30%, one unused track opens (while any remain). */
  nextQuarter() {
    this.quarter += 1;
    this.quota = Math.round(this.quota * (1 + this.growth));
    const opened = this.pending.shift() ?? null;
    if (opened) this.opened.push(opened);
    return { quarter: this.quarter, quota: this.quota, opened };
  }
}
