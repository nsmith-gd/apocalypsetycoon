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
// GRADING   each apocalypse has a required Days Sealed and critical ratings (10 apocalypses; a linked
//           pair takes the longer duration + 180 days and both sets). Grades Platinum, Gold, Silver,
//           Bronze, The Gerald; one grade lower if Midnight came uncontrolled.
// OVERTIME  offered at the end of Q12 if Midnight hasn't come: endless quarters, the board quota grows
//           30% a quarter, and the 4 unused tracks open one per quarter.
//
// Pure rules, no DOM. Numbers from the GDD are exact; fees, Seal Order risks and grade payouts are provisional.

// Research unlocks (GDD > Research > The unlock schedule).
export const RESEARCH_UNLOCKS = Object.freeze({
  41: 'lights_out', // 4:50 The Last Resort tier; Project Lights Out; Abyss digging
  45: 'final_product', // 5:30 The Final Product: an engineered breach option per track (needs a board vote)
  46: 'helicopters', // 5:40 Seal Order logistics: convoys and helicopter lift
  48: 'overtime', // 5:50 The Overtime offer
});

// Fees are not given in the GDD (provisional).
export const PROJECTS = Object.freeze({
  lights_out: { id: 'lights_out', name: 'Project Lights Out', research: 41, timeline: '4:50', hours: 4 + 50 / 60, boardVote: null, payout: 25_000_000, pairPayout: 60_000_000 },
  final_product: { id: 'final_product', name: 'The Final Product', research: 45, timeline: '5:30', hours: 5.5, boardVote: { of: 5, need: 3 }, payout: 60_000_000, pairPayout: 150_000_000 },
});

export const ENGINEERED = Object.freeze({
  minWeeks: 4,
  maxWeeks: 12,
  lastCallPremium: 3,
  lastCallHeatPerWeek: 3,
  callOffConfidence: -20,
  sealOrderWeeks: 2,
  overtimeQuotaGrowth: 0.3,
  overtimeTracks: 4,
  combinedExtraDays: 180,
});

// GDD > Midnight and endings > Required sealed duration. `critical` holds the numeric ratings the
// life systems model (seal, blast, security); `needs` lists the named rooms/features the GDD also asks for
// (shown to the player, not yet checked: most of those rooms aren't in the catalog yet).
export const APOCALYPSES = Object.freeze({
  atomic: { name: 'Atomic Standoff', days: 730, critical: { blast: 4, seal: 3 }, needs: [], fails: 'Fallout through a cheap airlock; the diesel runs dry' },
  bloom: { name: 'The Bloom', days: 420, critical: { seal: 4 }, needs: ['decon', 'HEPA'], fails: 'Spores in the ducts; a germaphobe locks himself in the cinema' },
  superstorm: { name: 'Superstorm Season', days: 540, critical: { seal: 3 }, needs: ['flood seal', 'power independence'], fails: 'Lower floors flood; solar masts are torn away' },
  optimizer: { name: 'The Optimizer', days: 1095, critical: {}, needs: ['Faraday Room', 'analog backups'], fails: 'Smart locks open for the AI; the AI butler stops serving dinner' },
  hush: { name: 'The Hush', days: 1460, critical: {}, needs: ['food production', 'Seed Vault'], fails: 'Pantries run dry in year two without vats or aquaponics' },
  pitchforks: { name: 'The Pitchforks', days: 365, critical: { security: 4 }, needs: ['concealment'], fails: 'Sieges at visible shelters; the staff left outside knock' },
  goo: { name: 'The Grey Goo', days: 600, critical: { seal: 4 }, needs: ['ceramic lining', 'EMP Pulse Room'], fails: 'Goo gets into the ducts and eats the scrubbers; the gold taps go first' },
  long_shade: { name: 'The Long Shade', days: 900, critical: {}, needs: ['heating', 'thermal cladding', 'grow lights'], fails: 'Pipes freeze, and the Infinity Pool becomes an ice rink' },
  kessler: { name: 'The Kessler Rain', days: 480, critical: { blast: 3 }, needs: ['debris cap', 'Radio Room'], fails: 'The helipad is flattened; satellite-linked locks stop answering' },
  cloud: { name: 'The Cloud Strike', days: 1200, critical: {}, needs: ['water production', 'Water Vault'], fails: 'The pool is drained first, then the wine cellar' },
});

// The game's five crisis tracks (#4 schemes, #26 breach) mapped onto the GDD's apocalypses (provisional
// pairing until the track ids are renamed). The other five are this world's unused tracks.
export const TRACK_APOCALYPSE = Object.freeze({ war: 'atomic', pandemic: 'bloom', climate: 'superstorm', unrest: 'pitchforks', markets: 'hush' });
export const UNUSED_APOCALYPSES = Object.freeze(Object.keys(APOCALYPSES).filter((k) => !Object.values(TRACK_APOCALYPSE).includes(k)));

const apoc = (id) => APOCALYPSES[TRACK_APOCALYPSE[id] ?? id];

/** A linked pair: the longer duration plus 180 days, and both sets of requirements. */
export function combinedRequirement(a, b) {
  const A = apoc(a);
  const B = apoc(b);
  const critical = { ...A.critical };
  for (const [k, v] of Object.entries(B.critical)) critical[k] = Math.max(critical[k] ?? 0, v);
  return { name: `${A.name} + ${B.name}`, days: Math.max(A.days, B.days) + ENGINEERED.combinedExtraDays, critical, needs: [...new Set([...A.needs, ...B.needs])], combined: true };
}

/** Requirement for a track id (or apocalypse id), or a [track, track] linked pair. */
export function requirementFor(target) {
  if (Array.isArray(target)) return target.length === 2 ? combinedRequirement(target[0], target[1]) : { ...apoc(target[0]) };
  return { ...apoc(target) };
}

// GDD > Grades. Payout multipliers are provisional. Gerald is the client whose wine ran out first.
export const GRADES = Object.freeze([
  { id: 'platinum', name: 'Platinum', min: 0.9, payout: 1.5, press: '"The market has spoken"' },
  { id: 'gold', name: 'Gold', min: 0.75, payout: 1.2, press: 'Smug' },
  { id: 'silver', name: 'Silver', min: 0.5, payout: 1, press: 'Defensive' },
  { id: 'bronze', name: 'Bronze', min: 0.25, payout: 0.6, press: 'Lawsuits from beyond' },
  { id: 'gerald', name: 'The Gerald', min: 0, payout: 0, press: 'Named for the client whose wine ran out first' },
]);

/**
 * Grade from the share of clients surviving. Platinum also needs an engineered Midnight, no collapses
 * and heat under 75 (otherwise it caps at Gold). An uncontrolled Midnight drops the result one grade.
 */
export function gradeFor(survivalRate, { uncontrolled = false, engineered = !uncontrolled, collapses = 0, heat = 0 } = {}) {
  let i = GRADES.findIndex((g) => survivalRate >= g.min);
  if (i === 0 && (!engineered || collapses > 0 || heat >= 75)) i = 1;
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
  constructor({ baseQuota, unusedTracks = UNUSED_APOCALYPSES.slice(0, ENGINEERED.overtimeTracks), growth = ENGINEERED.overtimeQuotaGrowth } = {}) {
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
