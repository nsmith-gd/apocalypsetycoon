// Campaign harness on the REAL systems (#79). Every system is the one the campaign runs, wired the way
// src/campaign/main.js wires it: Pushback (heat, board), CrisisSystem over the roster (tensions, breaches,
// containment, collapse, dominoes), the Doom Clock, LeadMarket demand (Fear), SchemeBoard, MapSales
// (prices, buyers), the research tree (cash + crisis grants), the company (crews), the first-breach nudge,
// Midnight (finaleArgs + computeMidnight) and Telemetry (#78). No stand-in economics remain: the bots only
// decide what a player would decide (which schemes, what to build, what to research, how to answer cards).
//
//   simulateCampaign({ bot: 'edge', seed: 1 }) -> { summary, rows, csv, telemetry }
//   runHarness({ bots, seeds })                -> { runs, checks, gdd }   gdd = GDD balance-target checks

import { Ledger } from '../ledger/ledger.js';
import { MONEY } from '../config/tuning.js';
import { Pushback, mulberry32 } from '../pushback/pushback.js';
import { ResearchTree } from '../research/research.js';
import { computeMidnight } from '../midnight/midnight.js';
import { finaleArgs } from '../midnight/finale.js';
import { CrisisSystem } from '../crisis/breach.js';
import { FirstBreachNudge, FIRST_BREACH } from '../crisis/first-breach.js';
import { DoomClock } from '../doomclock/doomclock.js';
import { LeadMarket, attachCrisis } from '../demand/demand.js';
import { SchemeBoard } from '../schemes/schemes.js';
import { MapSales } from '../worldmap/sales.js';
import { ROOM_CATALOG } from '../clients/rooms.js';
import { Company } from '../company/company.js';
import { Telemetry } from '../telemetry/telemetry.js';
import { TRACK_BY_ID, CLASSIC_ROSTER, rosterLinks } from '../world/tracks.js';
import { PacingLog, PACING } from './pacing.js';

// Mirrors of the campaign's own constants (src/campaign/main.js).
export const CAMPAIGN = Object.freeze({
  startingCash: MONEY.startingCash, trackOpenTension: 20, payrollPerCrew: MONEY.crewPerWeek * 13, chapterStarts: { 3: 2, 5: 3, 8: 4, 11: 5 }, weeksPerQuarter: 13,
});
const WEEK_MINUTES = PACING.quarterMinutes / CAMPAIGN.weeksPerQuarter;

// What a player builds: shelter designs per strategy (rooms from the real catalog; costs, prices and
// grades all come from the real systems).
export const DESIGNS = Object.freeze({
  luxury: { label: 'Luxury', occupants: 6, rooms: ['bunk', 'bunk', 'gold_taps', 'gold_taps', 'air_vent', 'water_tank', 'pantry'] },
  balanced: { label: 'Balanced', occupants: 8, rooms: ['bunk', 'bunk', 'bunk', 'gold_taps', 'air_vent', 'air_vent', 'water_tank', 'water_tank', 'pantry', 'pantry'] },
  survival: { label: 'Survival', occupants: 8, rooms: ['bunk', 'bunk', 'bunk', 'bunk', 'air_vent', 'air_vent', 'water_tank', 'water_tank', 'pantry', 'pantry'] },
});

/** Player personalities: the crisis band they hold, how hot they run, what they build and research. */
export const BOTS = Object.freeze({
  cautious: { label: 'Cautious builder', tension: [40, 60], heatCap: 45, sell: ['survival', 'balanced'], onInvestigation: 'settle', onLeverage: 'comply', contain: true, research: ['s1_clay', 'c_crew2', 'a_hydro', 'a_scrubber', 'l1_med', 's_thinktank', 'a_water'] },
  edge: { label: 'Edge runner', tension: [72, 88], heatCap: 60, sell: ['balanced', 'luxury', 'survival'], onInvestigation: 'lawyers', onLeverage: 'pay', contain: true, research: ['s_thinktank', 'c_crew2', 's1_clay', 'a_hydro', 's_deepfake', 'a_scrubber', 's_spin'] },
  luxury: { label: 'Luxury dealer', tension: [70, 85], heatCap: 60, sell: ['luxury'], onInvestigation: 'settle', onLeverage: 'pay', contain: true, research: ['x1_suite', 'c_crew2', 'a_cellar', 's_thinktank', 'a_hydro', 'x3_art'] },
  // Plays the edge, then deliberately burns the world down for the last quarters.
  arsonist: { label: 'Late arsonist', tension: [72, 88], heatCap: 60, sell: ['survival', 'balanced'], onInvestigation: 'settle', onLeverage: 'pay', contain: true, research: ['s_thinktank', 'c_crew2', 'a_hydro', 's_deepfake', 'a_scrubber'], switchAt: 10, then: 'reckless' },
  reckless: { label: 'Reckless arsonist', tension: [95, 100], heatCap: 100, sell: ['balanced', 'luxury'], onInvestigation: 'stonewall', onLeverage: 'call-bluff', contain: false, research: ['s_thinktank', 's_deepfake', 's_shortage', 'c_crew2', 's_blackout'] },
});

// GDD unlock schedule (Research > The unlock schedule) target times for the tree's nodes, h:mm.
export const GDD_UNLOCK_TARGETS = Object.freeze({
  s1_blast: '0:06', x1_suite: '0:10', s1_spine: '0:15', s1_clay: '0:20', l1_med: '0:38', c_crew2: '0:50',
  a_scrubber: '0:55', a_cellar: '1:10', s_thinktank: '1:15', l2_power: '1:38', a_hydro: '1:45', s3_bedrock: '2:05',
  x3_art: '2:15', l3_geo: '2:45', a_water: '3:05', l4_vats: '3:20', c_security: '3:30', s4_deep: '3:40', l4_reactor: '4:00',
  a_cryo: '4:38', s5_abyss: '4:50',
});
const hmToMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

/** One campaign's real systems, wired like the campaign. */
export function createSimGame({ seed = 1, bot = 'edge', roster = CLASSIC_ROSTER } = {}) {
  const ledger = new Ledger({ startingCash: CAMPAIGN.startingCash });
  const pb = new Pushback({ ledger, seed });
  const tree = new ResearchTree({ ledger });
  const doom = new DoomClock();
  const game = { bot, seed, roster, quarter: 1, week: 0, minute: 0, ended: null };
  const company = new Company({ ledger, getPlayMinutes: () => game.minute });
  const workingCrews = () => company.crews(1 + tree.crewCount);
  let mapSales = null;
  const crisis = new CrisisSystem({
    seed: seed + 10, pushback: pb, doomClock: doom, ledger, shelters: () => mapSales?.sold ?? [],
    tracks: roster.map((id) => ({ id, name: TRACK_BY_ID[id].name, open: false })),
    links: rosterLinks(roster).map((l) => [l.from, l.to, l.strength]),
  });
  const tensions = () => Object.fromEntries(Object.values(crisis.tracks).map((t) => [t.id, t.tension]));
  const market = new LeadMarket({ seed: seed + 11, reputation: () => crisis.reputation });
  market.ownSite('nam');
  market.week({ tensions: tensions() });
  attachCrisis(market, crisis);
  const schemes = new SchemeBoard({ crisis, market, ledger, pushback: pb, isUnlocked: (id) => tree.isUnlocked(id), getHeatMultiplier: () => tree.schemeHeatMult });
  crisis.on('week', () => tree.fundWeek(Object.values(crisis.tracks)));
  mapSales = new MapSales({ market, ledger, pushback: pb, getTensions: tensions, getBreachMultiplier: () => crisis.panicMultiplier, getEdgeBonus: (id) => schemes.edgeBonus(id), getQuarter: () => game.quarter });
  mapSales.onChange((e) => { if (e.type === 'sale' && e.record.premium > 1) tree.fundFromIncome(e.record.price * (1 - 1 / e.record.premium), 'panic premium'); });
  const nudge = new FirstBreachNudge({ crisis, minutes: () => game.minute });
  const telemetry = new Telemetry({ getTime: () => ({ quarter: game.quarter, week: game.week, minutes: game.minute }), label: `${bot}-${seed}` });
  telemetry.attach({ crisis, pushback: pb, ledger, tree, schemes, mapSales });
  const log = new PacingLog({ ledger, pushback: pb, research: tree, label: `${bot} #${seed}` });
  const unlocks = {};
  tree.onUnlock((n) => { unlocks[n.id] = Math.round(game.minute); });
  const stats = { firstBreach: null, breaches: 0, contained: 0, collapses: 0, quotas: [] };
  crisis.on('breach', (e) => { stats.breaches++; if (!stats.firstBreach) stats.firstBreach = { minute: Math.round(game.minute), track: e.track, how: nudge.fired ? 'wildcard' : 'natural' }; });
  crisis.on('contained', () => { stats.contained++; });
  crisis.on('collapse', () => { stats.collapses++; });
  Object.assign(game, { ledger, pb, tree, doom, company, workingCrews, crisis, market, schemes, mapSales, nudge, telemetry, log, unlocks, stats, rng: mulberry32(seed * 7919) });
  return game;
}

/** What the bot answers on a pushback choice card. */
export function botChoice(evt, profile) {
  const ids = evt.options.map((o) => o.id);
  const want = { investigation: profile.onInvestigation, demand: profile.onLeverage === 'call-bluff' ? 'refuse' : 'comply', blackmail: profile.onLeverage };
  const pick = want[evt.type];
  return ids.includes(pick) ? pick : ids[0];
}

export function resolvePending(game, profile) {
  let guard = 0;
  while (game.pb.pending.length && guard++ < 20) game.pb.resolve(game.pb.pending[0].id, botChoice(game.pb.pending[0], profile));
}

const profileFor = (game) => {
  let p = BOTS[game.bot];
  if (p.switchAt && game.quarter >= p.switchAt) p = { ...BOTS[p.then], sell: p.sell, research: p.research };
  return p;
};

function buildCost(design) { return design.rooms.reduce((s, id) => s + (ROOM_CATALOG[id]?.cost ?? 0), 0); }

/** One in-game week of bot play on the real systems. */
export function botWeek(game) {
  const { crisis, schemes, tree, ledger, pb, mapSales } = game;
  const p = profileFor(game);
  const [lo, hi] = p.tension;
  game.week += 1;
  game.minute = game.week * WEEK_MINUTES;
  // tracks open on the GDD schedule
  for (const id of game.roster) if (TRACK_BY_ID[id].opensAt <= game.minute && !crisis.tracks[id].open) crisis.openTrack(id, { tension: CAMPAIGN.trackOpenTension });
  // research: next affordable project on the bot's list, keeping a cash reserve
  if (!tree.active) {
    const next = p.research.find((id) => tree.status(id) === 'available' && tree.byId.get(id).cash <= ledger.cash - 2_500_000); // build money first
    if (next) tree.start(next);
  }
  // schemes: push the hottest open track toward the band (max two a week), within the heat cap
  for (let n = 0; n < 2; n++) {
    const target = crisis.openTracks.filter((t) => t.state === 'calm' || t.state === 'brink').sort((a, b) => b.tension - a.tension)[0];
    if (!target || target.tension >= lo) break;
    let best = null;
    for (const region of mapSales.regions) {
      for (const o of schemes.available(region.id)) {
        if (o.reason || o.locked || o.track.id !== target.id) continue;
        if (target.tension + o.gain > hi + 4 || o.cost > ledger.cash * 0.3) continue;
        if (pb.heat + o.heat > p.heatCap) continue;
        if (!best || o.gain / (o.heat + 1) > best.o.gain / (best.o.heat + 1)) best = { o, region: region.id };
      }
    }
    if (!best) break;
    try { schemes.run(best.o.scheme.id, best.region); } catch { break; }
    resolvePending(game, p);
  }
  // breaches: the containment window (a cautious player spends what it can; the reckless one doesn't)
  for (const t of crisis.activeBreaches) {
    if (!p.contain) continue;
    for (const key of ['calming', 'government', 'heroics', 'research', 'op']) {
      const offer = crisis.sourceOffer(t.id, key);
      if (offer && t.state === 'breach' && (!offer.cash || offer.cash < ledger.cash * 0.5)) crisis.contribute(t.id, key);
    }
  }
  crisis.paused = false; // the player resumes play after a breach screen
  // the first-breach wildcard (GDD 2:30) is dealt as a card; its only choice pushes the track over
  const card = game.nudge.check();
  if (card) game.nudge.apply(card);
  // build and sell: each crew finishes about one shelter every 6 weeks; sell to the best region with buyers
  if (game.week % 6 === 0) {
    for (let c = 0; c < game.workingCrews(); c++) {
      const design = DESIGNS[p.sell[(mapSales.sold.length + mapSales.stock.length + c) % p.sell.length]];
      const cost = Math.round(buildCost(design) * pb.board.buildCostMultiplier);
      if (cost > ledger.cash - 500_000) break;
      ledger.record('builds', `${design.label} shelter build`, -cost);
      mapSales.addFinished({ name: `${design.label} #${mapSales.sold.length + mapSales.stock.length + 1}`, rooms: [...design.rooms], occupants: design.occupants });
    }
  }
  for (const s of [...mapSales.stock]) {
    const rows = mapSales.overview().filter((r) => r.buyers > 0).sort((a, b) => b.premium - a.premium);
    if (!rows.length) break;
    try { mapSales.sell(rows[0].id, s.id); } catch { break; }
    resolvePending(game, p);
  }
  crisis.advanceWeek();
  game.doom.advanceWeeks(1);
  if (game.doom.midnight && !game.ended) game.ended = 'doom';
}

/** Close the quarter: payroll, the board, telemetry and the pacing log. */
export function endSimQuarter(game) {
  const { ledger, pb } = game;
  const p = profileFor(game);
  const crews = game.workingCrews();
  ledger.record('upkeep', `Shovel crew payroll x${crews}`, -CAMPAIGN.payrollPerCrew * crews);
  const q = game.quarter;
  const r = pb.endQuarter({ quarter: q, profit: ledger.summary(q).net });
  resolvePending(game, p);
  game.telemetry.quota(q, r.board);
  game.stats.quotas.push(!!r.board.met);
  const row = game.log.endQuarter(q, r.board, { tension: Math.round(Math.max(0, ...game.crisis.openTracks.map((t) => t.tension))), breaches: game.stats.breaches });
  game.quarter += 1;
  ledger.setQuarter(game.quarter);
  const chapter = CAMPAIGN.chapterStarts[game.quarter];
  if (chapter) game.doom.chapterStart(chapter);
  return row;
}

/** Midnight for a finished, Doom-struck or ousted run. */
export function simMidnight(game) {
  if (game.pb.board.ousted) {
    game.telemetry.event('ending', { ending: 'ousted', title: 'OUSTED BY THE BOARD' });
    return game.log.finish({ id: 'ousted', type: 'ousted', title: 'OUSTED BY THE BOARD' });
  }
  const res = computeMidnight({ ...finaleArgs({ crisis: game.crisis, pushback: game.pb, shelters: game.mapSales.sheltersForMidnight(), cash: game.ledger.cash }),
    ...(game.ended === 'doom' ? { forceType: 'failed', cause: 'The Doom Clock struck zero.' } : {}) });
  game.telemetry.ending(res);
  return game.log.finish({ id: res.ending.id, type: res.type, title: res.ending.title, survivalRate: +res.survivalRate.toFixed(2), control: res.control, grade: res.grade?.name ?? null, apocalypse: res.apocalypse?.name ?? null });
}

/** A whole campaign on the real systems. */
export function simulateCampaign({ bot = 'edge', seed = 1, roster = CLASSIC_ROSTER } = {}) {
  const game = createSimGame({ seed, bot, roster });
  while (game.quarter <= PACING.quarters && !game.pb.board.ousted && !game.ended) {
    for (let w = 0; w < CAMPAIGN.weeksPerQuarter && !game.ended; w++) botWeek(game);
    endSimQuarter(game);
  }
  const summary = simMidnight(game);
  Object.assign(summary, {
    firstBreach: game.stats.firstBreach, breaches: game.stats.breaches, contained: game.stats.contained, collapses: game.stats.collapses,
    quotasHit: game.stats.quotas.filter(Boolean).length, quotas: game.stats.quotas.length, unlocks: game.unlocks, sold: game.mapSales.sold.length,
  });
  return { summary, rows: game.log.rows, csv: game.log.toCSV(), telemetry: game.telemetry };
}

const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const GRADES = ['The Gerald', 'Bronze', 'Silver', 'Gold', 'Platinum'];

/** GDD balance-target checks over a set of runs (GDD: Economy and tuning > Balance targets; Pacing). */
export function gddChecks(runs) {
  const done = runs.map((r) => r.summary);
  const quotasHit = done.reduce((s, x) => s + x.quotasHit, 0);
  const quotas = done.reduce((s, x) => s + x.quotas, 0);
  const natural = done.filter((x) => x.firstBreach?.how === 'natural' && x.firstBreach.minute <= 150).length;
  const firsts = done.filter((x) => x.firstBreach);
  const inWindow = firsts.filter((x) => x.firstBreach.minute >= 130 && x.firstBreach.minute <= 150 + WEEK_MINUTES).length;
  const firstBreachContained = done.filter((x) => x.firstBreach && x.contained > 0).length;
  const completed = done.filter((x) => x.quarters === PACING.quarters);
  const unlockRows = Object.entries(GDD_UNLOCK_TARGETS).map(([id, at]) => {
    const times = done.map((x) => x.unlocks[id]).filter((v) => v != null);
    const med = median(times);
    return { node: id, target: hmToMin(at), median: med, runs: times.length, offBy: med == null ? null : Math.round(med - hmToMin(at)) };
  }).filter((u) => u.runs);
  const reached = done.filter((x) => x.ending.type !== 'ousted'); // every run that reached Midnight (early Doom Clock ones too)
  const grades = reached.map((x) => GRADES.indexOf(x.ending.grade)).filter((g) => g >= 0);
  const engineered = reached.filter((x) => x.ending.type === 'engineered').length;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const check = (name, value, target, ok) => ({ name, value, target, ok });
  return [
    check('Campaign length (median, full runs)', `${median(completed.map((x) => x.hours)) ?? '-'} h`, '5 to 6.5 h', completed.length > 0 && median(completed.map((x) => x.hours)) >= 5 && median(completed.map((x) => x.hours)) <= 6.5),
    check('Quarters with the quota hit', `${pct(quotasHit, quotas)}%`, 'about 75%', Math.abs(pct(quotasHit, quotas) - 75) <= 15),
    check('Natural first breach by 2:30', `${pct(natural, done.length)}%`, '60%', Math.abs(pct(natural, done.length) - 60) <= 20),
    check('First breach lands in the 2:10-2:30 window', `${pct(inWindow, firsts.length)}% of first breaches (${firsts.length} runs breached)`, 'the signature moment', pct(inWindow, firsts.length) >= 50),
    check('First breaches contained', `${pct(firstBreachContained, firsts.length)}%`, '70%', Math.abs(pct(firstBreachContained, firsts.length) - 70) <= 20),
    check('Engineered vs uncontrolled Midnight', `${pct(engineered, reached.length)} / ${100 - pct(engineered, reached.length)}`, '60 / 40', Math.abs(pct(engineered, reached.length) - 60) <= 20),
    check('Median grade', grades.length ? GRADES[Math.round(median(grades))] : '-', 'Silver', grades.length > 0 && Math.round(median(grades)) === 2),
    check('Research unlocks on the GDD schedule (median within 30 min)', `${unlockRows.filter((u) => Math.abs(u.offBy) <= 30).length}/${unlockRows.length} nodes`, 'every node', unlockRows.length > 0 && unlockRows.every((u) => Math.abs(u.offBy) <= 30)),
  ].map((c) => ({ ...c, unlocks: c.name.startsWith('Research') ? unlockRows : undefined }));
}

/** Many campaigns: every bot x seeds, plus the GDD checks. */
export function runHarness({ bots = Object.keys(BOTS), seeds = [1, 2, 3, 4, 5], roster = CLASSIC_ROSTER } = {}) {
  const runs = [];
  for (const bot of bots) for (const seed of seeds) runs.push({ bot, seed, ...simulateCampaign({ bot, seed, roster }) });
  const [lo, hi] = PACING.targetHours;
  const completed = runs.filter((r) => r.summary.quarters === PACING.quarters);
  const endingTypes = new Set(runs.map((r) => r.summary.ending.type)); // early Doom Clock Midnights count too
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
    gdd: gddChecks(runs),
  };
}
