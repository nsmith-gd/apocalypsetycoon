// DEMO-ONLY stand-in game + bots (formerly the pacing simulator, #12). The pacing harness now plays the real
// systems (src/debug/sim.js, #79); this file only drives the Midnight demo page's fast-forward debug panel,
// which runs on that page's own stand-in game. Nothing in the campaign or the harness uses it.
//
// It plays the systems that exist today (ledger, pushback, research, Midnight) with stand-ins for
// the ones still being built (shelter grid, world-map demand, scheme list). Every stand-in number is
// in SIM below, so it is obvious what to swap when the real systems land.

import { Ledger } from '../ledger/ledger.js';
import { Pushback, mulberry32 } from '../pushback/pushback.js';
import { ResearchTree } from '../research/research.js';
import { computeMidnight } from '../midnight/midnight.js';
import { PacingLog, PACING } from './pacing.js';

export const SIM = Object.freeze({
  // #91: this demo sim's own economy, x25 like pushback's stand-ins (GDD $M scale).
  startingCash: 10_000_000,
  payroll: 1_125_000,
  hqOccupants: 6,
  // Stand-in schemes: base three plus the research unlocks (#4 will replace these).
  schemes: [
    { id: 'podcast', name: 'Fund doom podcast', cost: 375_000, heat: 4, tension: 7 },
    { id: 'memo', name: 'Leak pandemic memo', cost: 750_000, heat: 14, tension: 18 },
    { id: 'riots', name: 'Bankroll riots', cost: 1_500_000, heat: 22, tension: 26 },
    { id: 'astroturf', name: 'Astroturf think tank', cost: 625_000, heat: 3, tension: 10, research: true },
    { id: 'deepfake', name: 'Deepfake broadcast', cost: 1_125_000, heat: 8, tension: 20, research: true },
    { id: 'shortage', name: 'Engineered shortage', cost: 1_750_000, heat: 10, tension: 28, research: true },
    { id: 'blackout', name: 'Grid blackout', cost: 2_250_000, heat: 12, tension: 35, research: true },
  ],
  // Tension relief is pushback's own Fund disaster relief action (pb.fundRelief()).
  // Stand-in shelter packages (#2/#3 will replace these). Price scales with crisis.
  packages: {
    luxury: { label: 'Luxury', base: 8_000_000, occupants: 8, rooms: ['gold_taps', 'cryo_pod', 'wine_cellar', 'air_vent', 'water_tank', 'pantry'] },
    balanced: { label: 'Balanced', base: 5_500_000, occupants: 8, rooms: ['gold_taps', 'mil_scrubber', 'water_tank', 'water_tank', 'hydroponics'] },
    survival: { label: 'Survival', base: 3_750_000, occupants: 8, rooms: ['mil_scrubber', 'water_recycler', 'hydroponics'] },
  },
  roomCost: { air_vent: 375_000, water_tank: 375_000, pantry: 300_000, mil_scrubber: 1_750_000, water_recycler: 1_125_000, hydroponics: 875_000, gold_taps: 1_000_000, cryo_pod: 3_000_000, wine_cellar: 2_250_000, bunk: 500_000, ai_butler: 5_000_000 },
  buildCostShare: 0.45, // building a sold shelter costs 45% of its room list (bulk rates)
  priceCrisisFactor: 60, // price = base * (1 + crisis / 60)
  demandPerCrisis: 18, // buyers this quarter = 1 + floor(crisis / 18) (calm worlds don't buy bunkers)
  sellsPerCrew: 2,
});

/** Player personalities. Each picks a crisis band to hold and what to sell. */
export const BOTS = Object.freeze({
  cautious: { label: 'Cautious builder', tension: [40, 60], heatCap: 45, sell: ['survival', 'balanced'], hq: 'survival', onInvestigation: 'settle', onLeverage: 'comply', research: ['a_hydro', 'a_water', 'c_crew2', 'a_scrubber', 's_thinktank', 'c_borer'] },
  edge: { label: 'Edge runner', tension: [72, 88], heatCap: 60, sell: ['balanced', 'luxury', 'survival'], hq: 'survival', onInvestigation: 'lawyers', onLeverage: 'pay', research: ['s_thinktank', 'c_crew2', 'a_hydro', 's_deepfake', 'a_water', 'c_borer', 'a_scrubber'] },
  luxury: { label: 'Luxury dealer', tension: [70, 85], heatCap: 60, sell: ['luxury'], hq: 'luxury', onInvestigation: 'settle', onLeverage: 'pay', research: ['a_hydro', 'a_cryo', 'c_crew2', 'a_cellar', 's_thinktank', 'c_borer'] },
  // Plays the edge, then deliberately burns the world down for the last quarters.
  arsonist: { label: 'Late arsonist', tension: [72, 88], heatCap: 60, sell: ['survival', 'balanced'], hq: 'survival', onInvestigation: 'settle', onLeverage: 'pay', research: ['a_hydro', 'a_water', 'c_crew2', 's_thinktank', 'a_scrubber', 's_deepfake'], switchAt: 10, then: 'reckless' },
  reckless: { label: 'Reckless arsonist', tension: [95, 100], heatCap: 100, coolDown: false, sell: ['balanced', 'luxury'], hq: 'luxury', onInvestigation: 'stonewall', onLeverage: 'call-bluff', research: ['s_thinktank', 's_deepfake', 's_shortage', 'c_crew2', 's_blackout'] },
});

/** A stand-in "game" the bots can play: the same verbs the demos expose. */
export function createSimGame({ seed = 1, bot = 'edge' } = {}) {
  const ledger = new Ledger({ startingCash: SIM.startingCash });
  const pb = new Pushback({ ledger, seed });
  const tree = new ResearchTree();
  const hq = { id: 'hq', name: 'Last Resort HQ', owner: 'your board', occupants: SIM.hqOccupants, rooms: [], sold: false };
  const shelters = [hq];
  const rng = mulberry32(seed * 7919);
  const log = new PacingLog({ ledger, pushback: pb, research: tree, label: `${bot} #${seed}` });
  const game = {
    ledger, pb, tree, hq, shelters, rng, log, quarter: 1, bot, soldThisQuarter: 0,
    schemesAvailable() { return tree.applyToSchemes(SIM.schemes); },
    scheme(s) { ledger.record('schemes', s.name, -s.cost); pb.onScheme({ label: s.name, heat: s.heat, tension: s.tension }); },
    // Buyers this quarter, with a little seeded luck (+/-1) so seeds differ.
    demand() { return Math.max(0, 1 + Math.floor(pb.tension / SIM.demandPerCrisis) + Math.floor(rng() * 3) - 1); },
    capacity() { return tree.crewCount * SIM.sellsPerCrew; },
    sell(kind) {
      const p = SIM.packages[kind];
      const calmPrice = p.base * (0.9 + rng() * 0.2);
      const price = Math.round(calmPrice * (1 + pb.tension / SIM.priceCrisisFactor));
      const cost = Math.round(p.rooms.reduce((s, r) => s + (SIM.roomCost[r] ?? 0), 0) * SIM.buildCostShare * pb.board.buildCostMultiplier);
      const n = shelters.length;
      const client = `Client ${n}`;
      ledger.record('builds', `${p.label} bunker build`, -cost);
      ledger.record('sales', `${p.label} bunker sold`, price);
      pb.onSale({ client, price });
      tree.fundFromIncome(price - calmPrice, `${p.label} bunker crisis premium`); // crisis profits fund research
      shelters.push({ id: `s${n}`, name: `${p.label} bunker #${n}`, owner: client, occupants: p.occupants, rooms: [...p.rooms], sold: true });
      game.soldThisQuarter++;
    },
    build(room) { ledger.record('builds', `HQ: ${room}`, -Math.round((SIM.roomCost[room] ?? 500_000) * pb.board.buildCostMultiplier)); hq.rooms.push(room); },
  };
  return game;
}

/** What the bot answers on a choice card. */
export function botChoice(evt, profile) {
  const ids = evt.options.map((o) => o.id);
  const want = { investigation: profile.onInvestigation, demand: profile.onLeverage === 'call-bluff' ? 'refuse' : 'comply', blackmail: profile.onLeverage };
  const pick = want[evt.type];
  return ids.includes(pick) ? pick : ids[0];
}

/** Resolve every pending choice the way the bot would. */
export function resolvePending(game, profile) {
  let guard = 0;
  while (game.pb.pending.length && guard++ < 20) {
    const e = game.pb.pending[0];
    game.pb.resolve(e.id, botChoice(e, profile));
  }
}

const HQ_PLANS = {
  survival: ['mil_scrubber', 'water_recycler', 'hydroponics', 'air_vent', 'water_tank', 'pantry'],
  luxury: ['gold_taps', 'air_vent', 'water_tank', 'pantry', 'gold_taps'],
};

/** One quarter of bot play: research, schemes to hold the crisis band, sell, build HQ. */
export function botQuarter(game, botName = game.bot) {
  let profile = BOTS[botName];
  if (profile.switchAt && game.quarter >= profile.switchAt) profile = { ...BOTS[profile.then], sell: profile.sell, hq: profile.hq, research: profile.research };
  const { pb, tree, ledger } = game;
  game.soldThisQuarter = 0;
  if (!tree.active) {
    const next = profile.research.find((id) => tree.status(id) === 'available');
    if (next) tree.start(next);
  }
  // Schemes: push crisis into the bot's band while heat allows.
  const [lo, hi] = profile.tension;
  let guard = 0;
  while (pb.tension < lo && guard++ < 8) {
    const opts = game.schemesAvailable().filter((s) => pb.tension + s.tension <= hi + 6 && s.cost < ledger.cash * 0.4);
    const heatOk = opts.filter((s) => pb.heat + s.heat <= profile.heatCap);
    const pickFrom = heatOk.length ? heatOk : profile.heatCap >= 100 ? opts : [];
    if (!pickFrom.length) break;
    // best tension per heat
    pickFrom.sort((a, b) => b.tension / (b.heat + 1) - a.tension / (a.heat + 1));
    game.scheme(pickFrom[0]);
    resolvePending(game, profile);
  }
  // Cool down if the world is running away from the band (momentum above 75 adds +6 a quarter),
  // using pushback's real relief valve (its price rises with each use in a quarter).
  guard = 0;
  while (pb.tension > hi && profile.coolDown !== false && guard++ < 4 && pb.reliefCost('fundRelief') < ledger.cash * 0.2) {
    pb.fundRelief();
    resolvePending(game, profile);
  }
  // Lay low if heat is closing on the fine line and the bot cares.
  if (profile.heatCap < 100 && pb.heat > profile.heatCap && pb.reliefCost('layLow') < ledger.cash * 0.1) pb.layLow();
  // Sales: as many as demand and crews allow, rotating the bot's packages.
  const n = Math.min(game.demand(), game.capacity());
  for (let i = 0; i < n; i++) game.sell(profile.sell[(game.shelters.length + i) % profile.sell.length]);
  resolvePending(game, profile);
  // HQ: one room a quarter while affordable.
  const plan = HQ_PLANS[profile.hq];
  const room = plan[game.hq.rooms.length % plan.length];
  if (ledger.cash > 6_250_000) game.build(room);
}

/** Close the quarter: payroll, research over the quarter's real time, pushback, log. */
export function endSimQuarter(game) {
  const { ledger, pb, tree, log } = game;
  const profile = BOTS[game.bot];
  ledger.record('upkeep', 'Crew payroll', -SIM.payroll * tree.crewCount);
  // Research runs on real time; 27 minutes a quarter, sampled each minute.
  for (let m = 0; m < PACING.quarterMinutes; m++) tree.tick(60, pb.tension);
  const q = game.quarter;
  const r = pb.endQuarter({ quarter: q });
  resolvePending(game, profile);
  const row = log.endQuarter(q, r.board);
  game.quarter += 1;
  ledger.setQuarter(game.quarter);
  return row;
}

/** Midnight for a finished (or ousted) run. */
export function simMidnight(game) {
  if (game.pb.board.ousted) return game.log.finish({ id: 'ousted', type: 'ousted', title: 'OUSTED BY THE BOARD' });
  const res = computeMidnight({ shelters: game.shelters, world: { tension: game.pb.tension, heat: game.pb.heat, runaways: game.pb.runaways }, cash: game.ledger.cash });
  return game.log.finish({ id: res.ending.id, type: res.type, title: res.ending.title, survivalRate: +res.survivalRate.toFixed(2), control: res.control });
}

/** A whole campaign. */
export function simulateCampaign({ bot = 'edge', seed = 1 } = {}) {
  const game = createSimGame({ seed, bot });
  while (game.quarter <= PACING.quarters && !game.pb.board.ousted) {
    botQuarter(game);
    endSimQuarter(game);
  }
  const summary = simMidnight(game);
  return { summary, rows: game.log.rows, csv: game.log.toCSV() };
}

/** Many campaigns: every bot x seeds. */
export function runHarness({ bots = Object.keys(BOTS), seeds = [1, 2, 3, 4, 5] } = {}) {
  const runs = [];
  for (const bot of bots) for (const seed of seeds) runs.push({ bot, seed, ...simulateCampaign({ bot, seed }) });
  const [lo, hi] = PACING.targetHours;
  const completed = runs.filter((r) => r.summary.quarters === PACING.quarters);
  const endingTypes = new Set(completed.map((r) => r.summary.ending.type));
  return {
    runs,
    checks: {
      allCompletedInTarget: completed.every((r) => r.summary.inTarget),
      hoursRange: completed.length ? [Math.min(...completed.map((r) => r.summary.hours)), Math.max(...completed.map((r) => r.summary.hours))] : null,
      pacedHoursRange: completed.length ? [Math.min(...completed.map((r) => r.summary.pacedHours)), Math.max(...completed.map((r) => r.summary.pacedHours))] : null,
      target: [lo, hi],
      engineeredReachable: endingTypes.has('engineered'),
      failedReachable: endingTypes.has('failed'),
      ousted: runs.filter((r) => r.summary.ending.type === 'ousted').length,
      endings: [...new Set(runs.map((r) => r.summary.ending.id))],
    },
  };
}
