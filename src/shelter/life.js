// Shelter life systems, strata, build rules and construction flow.
// GDD: Shelter canvas (Strata, Life systems, Build rules, Construction flow) and Clients > Two scores.
//
// EIGHT SYSTEMS
//   Flows  (person-days): AIR, WATER, FOOD, POWER — each has stock, use and production per day.
//   Ratings (0-5):        SEAL, BLAST, SECURITY, MORALE.
// DAYS SEALED = min over air, water, food, power of stock / (use - production)
//               (a system that produces at least what it uses never runs out: Infinity).
// P(SURVIVE)  = f_seal * f_blast * f_security * f_morale * f_days, where each f = 1 - 0.25 per rating
//               point short of what the apocalypse requires (never below 0) and f_days = 1 when Days Sealed
//               meets the requirement, else the fraction reached.
// BUILD RULES every floor must touch the Utility Spine; noise within 6 tiles of quarters costs comfort;
//             depth gates (cellar 10 m, geothermal 50 m, reactor 60 m, aquifer 80 m); adjacency bonuses;
//             surface features raise visibility (which costs security).
// STRATA      five bands with dig cost and crew speed; BLAST = stratum base + best blast door.
// CONSTRUCTION survey, dig, shell, fit-out, 30-day pressure test, walkthrough, handover, with crews.
//
// Pure rules, no DOM. #2's grid can feed `rooms` straight in: { type, floor, col }.
// Numbers marked provisional stand in for GDD tables not yet readable in the repo.

import { LIFE } from '../config/tuning.js';
export const FLOOR_METERS = 5; // floor n sits at n * 5 m below the surface (floor 0 = surface)
export const SPINE_COL = 0;
export const PER_PERSON = { air: 1, water: 1, food: 1, power: 1 }; // person-days used per occupant per day

// Five strata, top to bottom. digCost per tile, crew speed in tiles per crew-week, blast base rating.
// Provisional numbers.
export const STRATA = Object.freeze([
  { id: 'topsoil', name: 'Topsoil', from: 0, to: 10, digCost: 8_000, crewSpeed: 6, blastBase: 0 },
  { id: 'clay', name: 'Clay', from: 10, to: 30, digCost: 15_000, crewSpeed: 4, blastBase: 1 },
  { id: 'sandstone', name: 'Sandstone', from: 30, to: 50, digCost: 30_000, crewSpeed: 3, blastBase: 2 },
  { id: 'granite', name: 'Granite', from: 50, to: 80, digCost: 60_000, crewSpeed: 1.5, blastBase: 3 },
  { id: 'bedrock', name: 'Deep bedrock', from: 80, to: 200, digCost: 110_000, crewSpeed: 1, blastBase: 4 },
]);

export function stratumAt(depth) {
  return STRATA.find((s) => depth >= s.from && depth < s.to) ?? STRATA[STRATA.length - 1];
}
export const depthOf = (floor) => floor * FLOOR_METERS;

// Room catalog for the life systems. Flows are person-days per day; stock in person-days.
// minDepth = depth gate in metres; surface = must be on floor 0; noisy = noise source; quarters = people live here.
// Provisional numbers except the four depth gates.
export const LIFE_ROOMS = Object.freeze({
  // quarters
  bunk: { name: 'Bunk room', beds: 4, use: { power: 1 }, comfort: 0, quarters: true, cost: 20_000 },
  suite: { name: 'Luxury suite', beds: 2, use: { power: 3 }, comfort: 2, quarters: true, prestige: 3, cost: 90_000 },
  // air
  air_vent: { name: 'Air vent', produce: { air: 4 }, use: { power: 1 }, cost: 15_000 },
  mil_scrubber: { name: 'Military air scrubber', produce: { air: 12 }, use: { power: 3 }, cost: 70_000 },
  oxygen_store: { name: 'Oxygen candles', stock: { air: 400 }, cost: 25_000 },
  // water
  water_tank: { name: 'Water tank', stock: { water: 600 }, cost: 15_000 },
  water_recycler: { name: 'Deep-well recycler', produce: { water: 10 }, use: { power: 3 }, cost: 45_000 },
  aquifer: { name: 'Aquifer well', produce: { water: 30 }, use: { power: 2 }, minDepth: 80, cost: 120_000 },
  // food
  pantry: { name: 'Pantry', stock: { food: 900 }, cost: 12_000 },
  hydroponics: { name: 'Hydroponic garden', produce: { food: 10 }, use: { power: 4, water: 2 }, comfort: 1, cost: 35_000 },
  kitchen: { name: 'Kitchen', comfort: 1, use: { power: 1 }, cost: 30_000 },
  // power
  battery: { name: 'Battery bank', stock: { power: 500 }, cost: 30_000 },
  diesel: { name: 'Diesel generator', stock: { power: 2_400 }, noisy: true, cost: 40_000 }, // fuel = stored power
  geothermal: { name: 'Geothermal tap', produce: { power: 30 }, minDepth: 50, cost: 300_000 },
  reactor: { name: 'Micro reactor', produce: { power: 90 }, minDepth: 60, noisy: true, security: -1, cost: 900_000 },
  solar: { name: 'Solar field', produce: { power: 8 }, surface: true, visibility: 2, cost: 60_000 },
  // seal / blast / security
  airlock: { name: 'Airlock', seal: 2, cost: 50_000 },
  nbc_filter: { name: 'NBC seal plant', seal: 2, use: { power: 2 }, cost: 120_000 },
  blast_door_1: { name: 'Blast door (steel)', blastDoor: 1, cost: 40_000 },
  blast_door_2: { name: 'Blast door (vault)', blastDoor: 2, cost: 150_000 },
  blast_door_3: { name: 'Blast door (bunker-buster)', blastDoor: 3, cost: 500_000 },
  armory: { name: 'Armory', security: 2, cost: 60_000 },
  cameras: { name: 'Camera net', security: 1, use: { power: 1 }, cost: 20_000 },
  // morale / luxury
  cellar: { name: 'Wine cellar', comfort: 2, prestige: 3, minDepth: 10, cost: 90_000 },
  gym: { name: 'Gym', comfort: 1, noisy: true, cost: 40_000 },
  cinema: { name: 'Cinema', comfort: 2, use: { power: 2 }, prestige: 1, cost: 70_000 },
  medbay: { name: 'Medbay', comfort: 1, use: { power: 2 }, cost: 80_000 },
  gold_taps: { name: 'Gold taps', comfort: 1, prestige: 2, use: { water: 1 }, cost: 40_000 },
  // surface features
  helipad: { name: 'Helipad', surface: true, visibility: 3, prestige: 2, cost: 200_000 },
  vent_stack: { name: 'Vent stack', surface: true, visibility: 1, produce: { air: 6 }, cost: 30_000 },
  decoy_barn: { name: 'Decoy barn', surface: true, visibility: -2, cost: 50_000 },
});

// Adjacency (same floor, neighbouring tiles): provisional.
export const ADJACENCY = Object.freeze([
  { a: 'hydroponics', b: 'water_recycler', effect: { produce: { food: 3 } }, text: 'Hydroponics next to the recycler: +3 food' },
  { a: 'hydroponics', b: 'aquifer', effect: { produce: { food: 4 } }, text: 'Hydroponics next to the aquifer: +4 food' },
  { a: 'kitchen', b: 'pantry', effect: { comfort: 1 }, text: 'Kitchen next to the pantry: +1 comfort' },
  { a: 'medbay', b: 'bunk', effect: { comfort: 1 }, text: 'Medbay next to quarters: +1 comfort' },
  { a: 'armory', b: 'airlock', effect: { security: 1 }, text: 'Armory covering the airlock: +1 security' },
]);

export { LIFE }; // lives in the single tuning table (#77)

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Rule check. Returns a list of { rule, room?, floor?, text }. */
export function validate(shelter) {
  const out = [];
  const byFloor = new Map();
  for (const r of shelter.rooms) {
    const def = LIFE_ROOMS[r.type];
    if (!def) { out.push({ rule: 'unknown', room: r, text: `Unknown room ${r.type}` }); continue; }
    const depth = depthOf(r.floor);
    if (def.minDepth && depth < def.minDepth) out.push({ rule: 'depth', room: r, text: `${def.name} needs ${def.minDepth} m (floor ${Math.ceil(def.minDepth / FLOOR_METERS)}+), it is at ${depth} m` });
    if (def.surface && r.floor !== 0) out.push({ rule: 'surface', room: r, text: `${def.name} must be on the surface` });
    if (!def.surface && r.floor === 0) out.push({ rule: 'underground', room: r, text: `${def.name} must be underground` });
    if (r.col === SPINE_COL && r.floor > 0) out.push({ rule: 'spine', room: r, text: 'The Utility Spine column is reserved' });
    if (r.floor > 0) {
      if (!byFloor.has(r.floor)) byFloor.set(r.floor, []);
      byFloor.get(r.floor).push(r);
    }
  }
  // Every floor must touch the Utility Spine: its rooms form a connected run that reaches the
  // tile next to the spine.
  for (const [floor, rooms] of byFloor) {
    const cols = new Set(rooms.map((r) => r.col));
    if (!cols.has(SPINE_COL + 1)) { out.push({ rule: 'spine', floor, text: `Floor ${floor} (${depthOf(floor)} m) does not touch the Utility Spine` }); continue; }
    let c = SPINE_COL + 1;
    while (cols.has(c + 1)) c++;
    for (const r of rooms) if (r.col > c) out.push({ rule: 'spine', room: r, floor, text: `${LIFE_ROOMS[r.type]?.name} on floor ${floor} is cut off from the Utility Spine` });
  }
  return out;
}

const tileDist = (a, b) => Math.abs(a.col - b.col) + Math.abs(a.floor - b.floor);
const neighbours = (a, b) => a.floor === b.floor && Math.abs(a.col - b.col) === 1;

/** Everything the eight systems need, computed from the room list. */
export function simulate(shelter, opts = {}) {
  const L = { ...LIFE, ...(opts.config ?? {}) };
  const rooms = shelter.rooms.filter((r) => LIFE_ROOMS[r.type]);
  const people = shelter.occupants ?? 0;
  const flows = {};
  for (const k of ['air', 'water', 'food', 'power']) flows[k] = { stock: 0, use: people * PER_PERSON[k], produce: 0 };
  let seal = L.baseSeal;
  let bestDoor = 0;
  let security = L.baseSecurity;
  let visibility = 0;
  let comfort = 0;
  let prestige = 0;
  let beds = 0;
  const notes = [];
  for (const r of rooms) {
    const d = LIFE_ROOMS[r.type];
    for (const [k, v] of Object.entries(d.stock ?? {})) flows[k].stock += v;
    for (const [k, v] of Object.entries(d.produce ?? {})) flows[k].produce += v;
    for (const [k, v] of Object.entries(d.use ?? {})) flows[k].use += v;
    seal += d.seal ?? 0;
    bestDoor = Math.max(bestDoor, d.blastDoor ?? 0);
    security += d.security ?? 0;
    visibility += d.visibility ?? 0;
    comfort += d.comfort ?? 0;
    prestige += d.prestige ?? 0;
    beds += d.beds ?? 0;
  }
  // Adjacency bonuses (each pair once).
  for (const rule of ADJACENCY) {
    for (const a of rooms.filter((r) => r.type === rule.a)) {
      if (!rooms.some((b) => b.type === rule.b && neighbours(a, b))) continue;
      for (const [k, v] of Object.entries(rule.effect.produce ?? {})) flows[k].produce += v;
      comfort += rule.effect.comfort ?? 0;
      security += rule.effect.security ?? 0;
      notes.push(rule.text);
    }
  }
  // Noise: each noisy room within 6 tiles of any quarters costs comfort.
  const quarters = rooms.filter((r) => LIFE_ROOMS[r.type].quarters);
  let noisePairs = 0;
  for (const n of rooms.filter((r) => LIFE_ROOMS[r.type].noisy)) {
    if (quarters.some((q) => tileDist(n, q) <= L.noiseRadius)) {
      noisePairs += 1;
      comfort -= L.noiseComfort;
      notes.push(`${LIFE_ROOMS[n.type].name} is within ${L.noiseRadius} tiles of quarters: -${L.noiseComfort} comfort`);
    }
  }
  // Ratings
  const deepest = rooms.reduce((m, r) => Math.max(m, r.floor), 0);
  const stratum = stratumAt(depthOf(deepest));
  const blast = clamp(stratum.blastBase + bestDoor, 0, L.ratingMax);
  security = clamp(security - Math.floor(Math.max(0, visibility) / L.visibilityPerSecurity), 0, L.ratingMax);
  seal = clamp(seal, 0, L.ratingMax);
  // Morale: base + comfort shared across every 4 occupants; people without a bed hurt it.
  const crowding = people > beds ? Math.ceil((people - beds) / 2) : 0;
  const morale = clamp(Math.round(L.moraleBase + comfort / Math.max(1, people / L.peoplePerComfort) - crowding), 0, L.ratingMax);
  // Days Sealed
  const days = {};
  for (const [k, f] of Object.entries(flows)) {
    const net = f.use - f.produce;
    days[k] = net <= 0 ? Infinity : Math.floor(f.stock / net);
  }
  const daysSealed = Math.min(days.air, days.water, days.food, days.power);
  const limiting = Object.keys(days).reduce((a, k) => (days[k] < days[a] ? k : a), 'air');
  return {
    occupants: people, beds, flows, days, daysSealed, limiting,
    ratings: { seal, blast, security, morale },
    stratum: stratum.id, deepestMeters: depthOf(deepest), bestDoor,
    visibility, comfort, prestige, noisePairs, notes, violations: validate(shelter),
  };
}

/** One factor: 1 - 0.25 per missing rating point, never below 0. */
export function factor(rating, required, penalty = LIFE.missingPointPenalty) {
  return Math.max(0, 1 - penalty * Math.max(0, required - rating));
}

/**
 * P(survive) for an apocalypse's requirements: { days, seal, blast, security, morale }.
 * Returns the probability and each factor.
 */
export function survival(sim, req = {}) {
  const f = {
    seal: factor(sim.ratings.seal, req.seal ?? 0),
    blast: factor(sim.ratings.blast, req.blast ?? 0),
    security: factor(sim.ratings.security, req.security ?? 0),
    morale: factor(sim.ratings.morale, req.morale ?? 0),
    days: req.days ? Math.min(1, sim.daysSealed / req.days) : 1,
  };
  const p = f.seal * f.blast * f.security * f.morale * f.days;
  return { p: Math.round(p * 1000) / 1000, factors: f };
}

/** The two client scores: WANTS (what they pay for) and NEEDS (what keeps them alive). */
export function twoScores(sim, req = {}, wants = []) {
  const fitted = wants.length ? wants.filter((w) => w.fitted).length / wants.length : null;
  const wantScore = Math.round(100 * (fitted ?? Math.min(1, sim.prestige / 10)));
  const needScore = Math.round(100 * survival(sim, req).p);
  return { wantScore, needScore };
}

// ---------------------------------------------------------------------------------------------
// Construction flow
// ---------------------------------------------------------------------------------------------
export const CONSTRUCTION = Object.freeze({
  surveyWeeks: 1,
  shellWeeksPerRoom: 0.5, // per crew
  fitOutWeeksPerRoom: 0.5, // per crew
  pressureTestDays: 30,
  walkthroughWeeks: 1,
  surveyCost: 50_000,
  shellCostPerRoom: 20_000,
});

/** Tiles to dig = every non-surface room tile plus the spine shaft down to the deepest floor. */
export function digPlan(shelter) {
  const tiles = [];
  const deepest = shelter.rooms.reduce((m, r) => Math.max(m, r.floor), 0);
  for (let f = 1; f <= deepest; f++) tiles.push({ floor: f, col: SPINE_COL });
  for (const r of shelter.rooms) if (r.floor > 0) tiles.push({ floor: r.floor, col: r.col });
  const byStratum = {};
  for (const t of tiles) {
    const s = stratumAt(depthOf(t.floor));
    byStratum[s.id] ??= { stratum: s, tiles: 0 };
    byStratum[s.id].tiles += 1;
  }
  let cost = 0;
  let crewWeeks = 0;
  for (const b of Object.values(byStratum)) {
    cost += b.tiles * b.stratum.digCost;
    crewWeeks += b.tiles / b.stratum.crewSpeed;
  }
  return { tiles: tiles.length, byStratum, cost, crewWeeks };
}

/** The phases, in order, with weeks for a crew count. */
export function constructionPlan(shelter, { crews = 1 } = {}) {
  const C = CONSTRUCTION;
  const rooms = shelter.rooms.filter((r) => LIFE_ROOMS[r.type]);
  const dig = digPlan(shelter);
  const n = Math.max(1, crews);
  const fit = rooms.reduce((s, r) => s + (LIFE_ROOMS[r.type].cost ?? 0), 0);
  const phases = [
    { id: 'survey', name: 'Survey', weeks: C.surveyWeeks, cost: C.surveyCost },
    { id: 'dig', name: 'Dig', weeks: Math.ceil((dig.crewWeeks / n) * 10) / 10, cost: dig.cost, detail: dig },
    { id: 'shell', name: 'Shell', weeks: Math.ceil(((rooms.length * C.shellWeeksPerRoom) / n) * 10) / 10, cost: rooms.length * C.shellCostPerRoom },
    { id: 'fitout', name: 'Fit-out', weeks: Math.ceil(((rooms.length * C.fitOutWeeksPerRoom) / n) * 10) / 10, cost: fit },
    { id: 'pressure', name: 'Pressure test', weeks: Math.round((C.pressureTestDays / 7) * 10) / 10, days: C.pressureTestDays, cost: 0 },
    { id: 'walkthrough', name: 'Walkthrough', weeks: C.walkthroughWeeks, cost: 0 },
    { id: 'handover', name: 'Handover', weeks: 0, cost: 0 },
  ];
  return { phases, weeks: Math.round(phases.reduce((s, p) => s + p.weeks, 0) * 10) / 10, cost: phases.reduce((s, p) => s + p.cost, 0) };
}

/** A build in progress, advanced a week at a time. The pressure test fails if Days Sealed < 30. */
export class ConstructionJob {
  constructor(shelter, { crews = 1 } = {}) {
    this.shelter = shelter;
    this.crews = crews;
    this.plan = constructionPlan(shelter, { crews });
    this.index = 0;
    this.left = this.plan.phases[0].weeks;
    this.done = false;
    this.failed = null;
    this.log = [];
  }
  get phase() { return this.plan.phases[this.index]; }
  /** Add or remove crews mid-build: remaining work rescales. */
  setCrews(crews) {
    const ratio = this.crews / Math.max(1, crews);
    if (['dig', 'shell', 'fitout'].includes(this.phase.id)) this.left = Math.round(this.left * ratio * 10) / 10;
    this.crews = crews;
  }
  advanceWeek() {
    if (this.done || this.failed) return this.phase;
    this.left = Math.round((this.left - 1) * 10) / 10;
    while (this.left <= 0 && !this.done && !this.failed) {
      const finished = this.phase;
      this.log.push(`${finished.name} complete`);
      if (finished.id === 'pressure') {
        const sim = simulate(this.shelter);
        if (sim.daysSealed < CONSTRUCTION.pressureTestDays) {
          this.failed = { phase: 'pressure', daysSealed: sim.daysSealed, limiting: sim.limiting };
          this.log.push(`Pressure test FAILED: ${sim.limiting} runs out after ${sim.daysSealed} days`);
          return this.phase;
        }
      }
      this.index += 1;
      if (this.index >= this.plan.phases.length - 1) {
        this.index = this.plan.phases.length - 1;
        this.done = true;
        this.log.push('Handover: keys to the client');
        break;
      }
      this.left += this.phase.weeks;
    }
    return this.phase;
  }
}
