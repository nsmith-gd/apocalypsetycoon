// Cadence rule checker (#164; GDD Pacing > Cadence rules 1, 2, 3 and 8) on a replayed campaign.
//
// Replays a simulated campaign on the real systems (src/debug/sim.js: the same bots and wiring as the pacing harness),
// records a timeline of what the player gets and when, and checks four rules against it:
//   1. PAIN BEFORE TOOL   every tool reaches the research shelf within one quarter after the problem it solves first
//                         appears, never before (the pain -> tool table below)
//   2. NO DEAD ZONES      never more than 8 minutes without a new room, client, scheme or story beat in chapters 1-2,
//                         or 12 minutes after that
//   3. TWO GOALS IN FLIGHT at every moment: a contract deadline under 5 minutes away (a shelter finishing or a sale)
//                         AND a research node or a band edge under 3 minutes away. The replay knows the future, so
//                         "under N minutes away" means "it actually happens within N minutes".
//   8. ONE NEW SYSTEM PER QUARTER, at most (after Q1, which introduces the core loop)
// Every violation carries its campaign time (h:mm).
//
//   const r = replayCadence({ bot: 'edge', seed: 1 })   -> { timeline, violations: { pain, deadZones, goals, systems }, stats }
//   const h = cadenceHarness({ bots, seeds })            -> { runs, summary: [{ rule, violations, runs, ok }], ok }

import { createSimGame, botWeek, endSimQuarter, CAMPAIGN } from './sim.js';
import { PACING } from './pacing.js';
import { STORY_BEATS } from '../story/beats.js';
import { bandOf } from '../world/momentum.js';

export const CADENCE = Object.freeze({
  deadZone: { early: 8, late: 12, earlyChapters: 2 },
  goals: { contract: 5, progress: 3 },
  painWindowMinutes: PACING.quarterMinutes, // "within one quarter"
  systemsPerQuarter: 1,
});

// Rule 1: each tool and the problem it solves. `pain` is checked every week on the live systems.
export const PAIN_TOOLS = Object.freeze([
  { tool: 's_spin', name: 'Spin doctors (scheme heat -25%)', pain: 'heat reaches 50 (an investigation)', test: (g) => g.pb.heat >= 50 },
  { tool: 'c_crew2', name: 'A second crew', pain: 'buyers waiting with nothing in stock (a build backlog)', test: (g) => backlog(g) },
  { tool: 'c_borer', name: 'Tunnel boring machine', pain: 'a build backlog with two crews', test: (g) => backlog(g) && g.workingCrews() >= 2 },
  { tool: 'a_scrubber', name: 'HEPA Scrubber Bay', pain: 'The Bloom opens (spores)', test: (g) => open(g, 'bloom') },
  { tool: 'l2_power', name: 'Battery Bank, Solar Mast', pain: 'Superstorm Season opens (fuel and grid failures)', test: (g) => open(g, 'superstorm') },
  { tool: 'a_hydro', name: 'Hydroponics Bay', pain: 'The Hush opens (food chains fail)', test: (g) => open(g, 'hush') },
  { tool: 'c_security', name: 'Security Post, Decoy Entrance, Armory', pain: 'The Pitchforks opens (sieges)', test: (g) => open(g, 'pitchforks') },
  { tool: 's3_bedrock', name: 'Bedrock digging, Blast Door Mk II', pain: 'the first breach (clients want blast ratings)', test: (g) => g.stats.breaches > 0 },
]);
const open = (g, id) => !!g.crisis.tracks[id]?.open;
const backlog = (g) => g.mapSales.stock.length === 0 && g.market.leads.length >= 3;

// Rule 8: the systems the player meets, by the first event that shows each one.
export const SYSTEMS = Object.freeze([
  { id: 'tracks', name: 'Threat tracks', first: (e) => e.type === 'track_open' },
  { id: 'schemes', name: 'Schemes', first: (e) => e.type === 'scheme' },
  { id: 'research', name: 'Research', first: (e) => e.type === 'unlock' },
  { id: 'pushback', name: 'Pushback cards (heat, leverage)', first: (e) => e.type === 'choice_card' },
  { id: 'breach', name: 'Breaches and containment', first: (e) => e.type === 'breach' },
  { id: 'collapse', name: 'Collapse and dominoes', first: (e) => e.type === 'collapse' || e.type === 'domino' },
]);

export const hm = (min) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;
const QUARTER_MIN = PACING.quarterMinutes;
const chapterAt = (min) => { const q = Math.floor(min / QUARTER_MIN) + 1; return q >= 11 ? 5 : q >= 8 ? 4 : q >= 5 ? 3 : q >= 3 ? 2 : 1; };

/** Replay one campaign and check the four rules. */
export function replayCadence({ bot = 'edge', seed = 1, cfg = CADENCE } = {}) {
  const g = createSimGame({ bot, seed });
  const timeline = []; // { minute, kind: room | client | scheme | beat | unlock | band | contract, what }
  const add = (kind, what, minute = g.minute) => timeline.push({ minute: Math.round(minute * 10) / 10, kind, what });
  g.mapSales.onChange((e) => {
    if (e.type === 'stock') add('room', `${e.shelter.name} finished: new rooms`);
    if (e.type === 'stock') add('contract', `${e.shelter.name} handed over`);
    if (e.type === 'sale') { add('client', `${e.record.owner} signs`); add('contract', `sale: ${e.record.name}`); }
  });
  g.schemes.onChange((e) => { if (e?.type === 'run') add('scheme', e.scheme?.name ?? 'a scheme'); });
  g.tree.onUnlock((n) => add('unlock', n.name));
  g.crisis.on('open', (e) => add('beat', `${e.track} opens`));
  const beats = STORY_BEATS.filter((b) => b.at != null);
  const pain = Object.fromEntries(PAIN_TOOLS.map((p) => [p.tool, { painAt: null, shelfAt: g.tree.byId.has(p.tool) && g.tree.status(p.tool) !== 'locked' ? 0 : null }]));
  let bands = {};
  const samples = [];
  const end = PACING.quarters * QUARTER_MIN;
  while (g.quarter <= PACING.quarters && !g.pb.board.ousted && !g.ended) {
    for (let w = 0; w < CAMPAIGN.weeksPerQuarter && !g.ended; w++) {
      const before = g.minute;
      botWeek(g);
      for (const b of beats) if (b.at > before && b.at <= g.minute) add('beat', b.id, b.at);
      for (const t of Object.values(g.crisis.tracks)) {
        if (!t.open) continue;
        const band = bandOf(t.tension).id;
        if (bands[t.id] && bands[t.id] !== band) add('band', `${t.id}: ${bands[t.id]} -> ${band}`);
        bands[t.id] = band;
      }
      for (const p of PAIN_TOOLS) {
        const s = pain[p.tool];
        if (s.painAt == null && p.test(g)) s.painAt = g.minute;
        if (s.shelfAt == null && g.tree.byId.has(p.tool) && g.tree.status(p.tool) !== 'locked') s.shelfAt = g.minute;
      }
      samples.push(g.minute);
    }
    endSimQuarter(g);
  }
  const stopAt = Math.min(end, g.minute);
  timeline.sort((a, b) => a.minute - b.minute);

  // Rule 2: dead zones
  const novelty = timeline.filter((e) => ['room', 'client', 'scheme', 'beat'].includes(e.kind)).map((e) => e.minute);
  const marks = [0, ...novelty, stopAt].sort((a, b) => a - b);
  const deadZones = [];
  for (let i = 1; i < marks.length; i++) {
    const from = marks[i - 1], to = marks[i];
    const limit = chapterAt(from) <= cfg.deadZone.earlyChapters ? cfg.deadZone.early : cfg.deadZone.late;
    if (to - from > limit + 1e-6) deadZones.push({ at: hm(from), to: hm(to), minutes: Math.round((to - from) * 10) / 10, limit, chapter: chapterAt(from) });
  }

  // Rule 3: two goals in flight, sampled every in-game week
  const within = (kind, t, n) => timeline.some((e) => kind.includes(e.kind) && e.minute > t && e.minute <= t + n + 1e-6);
  const goalFails = [];
  let inFlight = 0;
  for (const t of [0, ...samples].filter((x) => x < stopAt)) {
    const contract = within(['contract'], t, cfg.goals.contract);
    const progress = within(['unlock', 'band'], t, cfg.goals.progress);
    if (contract && progress) { inFlight++; continue; }
    const missing = [!contract && `no contract deadline within ${cfg.goals.contract} min`, !progress && `no research node or band edge within ${cfg.goals.progress} min`].filter(Boolean).join('; ');
    const last = goalFails.at(-1);
    if (last && last.missing === missing && Math.abs(last.until - t) < 2.5) { last.until = t; last.to = hm(t); }
    else goalFails.push({ at: hm(t), to: hm(t), from: t, until: t, missing });
  }
  const goals = goalFails.map(({ at, to, missing, from, until }) => ({ at, to, minutes: Math.round((until - from + 2.08) * 10) / 10, missing }));

  // Rule 1: pain before tool
  const painV = [];
  for (const p of PAIN_TOOLS) {
    const s = pain[p.tool];
    if (s.shelfAt == null) continue; // never reached the shelf in this run
    if (s.painAt == null) { painV.push({ at: hm(s.shelfAt), tool: p.name, problem: p.pain, issue: 'tool on the shelf, problem never appeared' }); continue; }
    if (s.shelfAt < s.painAt - 1e-6) painV.push({ at: hm(s.shelfAt), tool: p.name, problem: p.pain, issue: `tool before pain: on the shelf at ${hm(s.shelfAt)}, problem at ${hm(s.painAt)}` });
    else if (s.shelfAt > s.painAt + cfg.painWindowMinutes) painV.push({ at: hm(s.painAt), tool: p.name, problem: p.pain, issue: `tool late: problem at ${hm(s.painAt)}, on the shelf at ${hm(s.shelfAt)}` });
  }

  // Rule 8: new systems per quarter
  const firsts = SYSTEMS.map((sys) => { const e = g.telemetry.events.find(sys.first); return e ? { system: sys.name, minute: e.minutes ?? 0, quarter: e.quarter ?? 1 } : null; }).filter(Boolean);
  const byQ = {};
  for (const f of firsts) (byQ[f.quarter] ??= []).push(f);
  const systems = Object.entries(byQ).filter(([q, list]) => Number(q) > 1 && list.length > cfg.systemsPerQuarter)
    .map(([q, list]) => ({ at: hm(Math.min(...list.map((x) => x.minute))), quarter: Number(q), systems: list.map((x) => `${x.system} (${hm(x.minute)})`) }));

  const samplesN = [0, ...samples].filter((x) => x < stopAt).length;
  return {
    bot, seed, minutes: Math.round(stopAt),
    timeline,
    violations: { pain: painV, deadZones, goals, systems },
    stats: { goalsInFlightPct: Math.round((inFlight / Math.max(1, samplesN)) * 100), novelty: novelty.length, firsts, longestDeadZone: deadZones.reduce((m, d) => Math.max(m, d.minutes), 0) },
  };
}

export const RULES = Object.freeze([
  { key: 'pain', rule: '1. Pain before tool' },
  { key: 'deadZones', rule: '2. No dead zones (8 min in ch. 1-2, 12 after)' },
  { key: 'goals', rule: '3. Two goals in flight' },
  { key: 'systems', rule: '8. One new system per quarter' },
]);

/** Many replays: per-rule totals and an overall pass/fail (pass = no violations anywhere). */
export function cadenceHarness({ bots = ['cautious', 'edge', 'luxury'], seeds = [1, 2, 3] } = {}) {
  const runs = [];
  for (const bot of bots) for (const seed of seeds) runs.push(replayCadence({ bot, seed }));
  const summary = RULES.map(({ key, rule }) => {
    const n = runs.reduce((s, r) => s + r.violations[key].length, 0);
    return { rule, key, violations: n, runsWith: runs.filter((r) => r.violations[key].length).length, runs: runs.length, ok: n === 0 };
  });
  return { runs, summary, goalsInFlightPct: Math.round(runs.reduce((s, r) => s + r.stats.goalsInFlightPct, 0) / runs.length), ok: summary.every((s) => s.ok) };
}
