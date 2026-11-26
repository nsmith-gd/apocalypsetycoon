#!/usr/bin/env node
// Campaign pacing harness: plays full 12-quarter campaigns with every bot over several seeds,
// prints a per-quarter log and checks the 5-6.5 hour target and that both Midnight paths happen.
//
//   node tools/pacing-harness.mjs                 # all bots, seeds 1-5, summary + one log per bot
//   node tools/pacing-harness.mjs --bot edge --seed 3 --log   # one run, full per-quarter table
//   node tools/pacing-harness.mjs --out <dir>     # also write CSV logs and summary.json
//   node tools/pacing-harness.mjs --breach [--no-nudge]   # when the first breach lands (real crisis tracks, #68)
//   node tools/pacing-harness.mjs --cadence [--bot edge --seed 1] [--out dir]   # GDD cadence rules 1-3 and 8 (#164):
//                                every violation with its campaign time, a pass/fail summary; exit 1 on any violation
// Exit code 1 if a check fails.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runHarness, simulateCampaign, BOTS } from '../src/debug/sim.js';
import { PACING } from '../src/debug/pacing.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes(`--${k}`);
const k = (n) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${Math.round(n / 1e3)}K`);

function table(rows) {
  const cols = [
    ['Q', (r) => r.quarter], ['hours', (r) => r.hours.toFixed(2)], ['cash', (r) => k(r.cash)], ['net', (r) => k(r.net)],
    ['crisis', (r) => r.crisis], ['heat', (r) => r.heat], ['sales', (r) => r.sales], ['revenue', (r) => k(r.salesRevenue)],
    ['schemes', (r) => r.schemes], ['fines', (r) => k(r.fines)], ['board', (r) => (r.boardMet ? 'MET' : 'MISS')], ['X', (r) => r.strikes],
    ['runaway', (r) => r.runaways], ['events', (r) => r.events || '-'],
  ];
  const cells = [cols.map((c) => c[0]), ...rows.map((r) => cols.map((c) => String(c[1](r))))];
  const w = cols.map((_, i) => Math.max(...cells.map((row) => row[i].length)));
  return cells.map((row) => row.map((c, i) => c.padStart(i === cols.length - 1 ? 0 : w[i])).join('  ')).join('\n');
}

const out = opt('out');
if (out) mkdirSync(out, { recursive: true });

if (flag('cadence')) {
  const { cadenceHarness, replayCadence, RULES } = await import('../src/debug/cadence.js');
  const one = opt('bot') ? [replayCadence({ bot: opt('bot'), seed: Number(opt('seed', 1)) })] : null;
  const h = one ? { runs: one, summary: RULES.map(({ key, rule }) => ({ rule, key, violations: one[0].violations[key].length, runsWith: one[0].violations[key].length ? 1 : 0, runs: 1, ok: !one[0].violations[key].length })), goalsInFlightPct: one[0].stats.goalsInFlightPct } : cadenceHarness();
  h.ok = h.summary.every((x) => x.ok);
  const show = flag('all') || !!one ? Infinity : 6;
  for (const r of h.runs) {
    console.log(`\n=== ${r.bot} #${r.seed} (${Math.floor(r.minutes / 60)}:${String(r.minutes % 60).padStart(2, '0')} played) · goals in flight ${r.stats.goalsInFlightPct}% of the time · longest dead zone ${r.stats.longestDeadZone} min`);
    const v = r.violations;
    const list = (title, rows, fmt) => { if (!rows.length) return; console.log(`  ${title}: ${rows.length}`); for (const x of rows.slice(0, show)) console.log(`    ${fmt(x)}`); if (rows.length > show) console.log(`    ... ${rows.length - show} more (--all)`); };
    list('DEAD ZONES', v.deadZones, (x) => `${x.at}-${x.to}  ${x.minutes} min with nothing new (limit ${x.limit}, chapter ${x.chapter})`);
    list('GOALS IN FLIGHT', v.goals, (x) => `${x.at}-${x.to}  ${x.missing}`);
    list('PAIN BEFORE TOOL', v.pain, (x) => `${x.at}  ${x.tool}: ${x.issue} (problem: ${x.problem})`);
    list('NEW SYSTEMS', v.systems, (x) => `Q${x.quarter} ${x.at}  ${x.systems.length} new systems: ${x.systems.join(', ')}`);
  }
  console.log('\nCADENCE RULES (GDD Pacing)');
  for (const x of h.summary) console.log(`  ${x.ok ? 'PASS' : 'FAIL'}  ${x.rule.padEnd(46)} ${String(x.violations).padStart(4)} violation${x.violations === 1 ? '' : 's'} in ${x.runsWith}/${x.runs} runs`);
  console.log(`  goals in flight: ${h.goalsInFlightPct}% of sampled weeks (average over runs)`);
  if (out) writeFileSync(join(out, 'cadence.json'), JSON.stringify({ ok: h.ok, summary: h.summary, runs: h.runs.map(({ timeline, ...r }) => r) }, null, 1));
  console.log(h.ok ? '\nPASS' : '\nFAIL');
  process.exit(h.ok ? 0 : 1);
}

if (flag('breach')) {
  const { firstBreachHarness } = await import('../src/debug/breach-sim.js');
  const h = firstBreachHarness({ nudge: !flag('no-nudge') });
  console.log('bot        seed  first breach  track        how       wildcard pushed');
  for (const r of h.runs) {
    const f = r.firstBreach;
    const t = f ? `${Math.floor(f.minute / 60)}:${String(f.minute % 60).padStart(2, '0')}` : 'never';
    console.log(`${r.bot.padEnd(10)} ${String(r.seed).padStart(4)}  ${t.padStart(12)}  ${(f?.track ?? '-').padEnd(11)}  ${(f?.how ?? '-').padEnd(8)}  ${r.wildcard ? `${r.wildcard.from} -> ${r.wildcard.to}` : '-'}`);
  }
  console.log('\nChecks:', JSON.stringify(h.checks));
  const ok = h.checks.everyRunBreachesByDeadline;
  console.log(ok ? '\nPASS' : '\nFAIL');
  process.exit(ok ? 0 : 1);
}


if (opt('bot')) {
  const bot = opt('bot');
  const seed = Number(opt('seed', 1));
  const r = simulateCampaign({ bot, seed });
  console.log(`\n${BOTS[bot].label} (seed ${seed})\n`);
  console.log(table(r.rows));
  console.log(`\n${JSON.stringify(r.summary)}`);
  if (out) writeFileSync(join(out, `log-${bot}-${seed}.csv`), r.csv);
  process.exit(0);
}

const seeds = Array.from({ length: Number(opt('seeds', 5)) }, (_, i) => i + 1);
const h = runHarness({ seeds });
console.log(`Pacing model: ${PACING.clock} clock, ${PACING.quarterMinutes} min per quarter, target ${PACING.targetHours.join('-')} h\n`);
console.log('bot        seed  quarters  hours  paced-h  sales  final cash  peak crisis  ending');
for (const r of h.runs) {
  const s = r.summary;
  console.log(`${r.bot.padEnd(10)} ${String(r.seed).padStart(4)}  ${String(s.quarters).padStart(8)}  ${s.hours.toFixed(2).padStart(5)}  ${s.pacedHours.toFixed(2).padStart(7)}  ${String(s.totalSales).padStart(5)}  ${k(s.finalCash).padStart(10)}  ${String(s.peakCrisis).padStart(11)}  ${s.ending.type}/${s.ending.id}${s.ending.survivalRate != null ? ` (${Math.round(s.ending.survivalRate * 100)}% survive)` : ''}`);
}
if (flag('log') || out) {
  for (const bot of Object.keys(BOTS)) {
    const r = h.runs.find((x) => x.bot === bot && x.seed === 1);
    console.log(`\n--- ${BOTS[bot].label}, seed 1 ---`);
    console.log(table(r.rows));
  }
}
console.log('\nChecks:', JSON.stringify(h.checks, null, 1));
if (out) {
  for (const r of h.runs) {
    writeFileSync(join(out, `log-${r.bot}-${r.seed}.csv`), r.csv);
    // Telemetry (#78) from the real systems: per-week meters and every event.
    writeFileSync(join(out, `telemetry-${r.bot}-${r.seed}-weekly.csv`), r.telemetry.csv('weekly'));
    writeFileSync(join(out, `telemetry-${r.bot}-${r.seed}-events.csv`), r.telemetry.csv('events'));
  }
  writeFileSync(join(out, 'summary.json'), JSON.stringify({ pacing: PACING, checks: h.checks, gdd: h.gdd, runs: h.runs.map((r) => ({ bot: r.bot, seed: r.seed, ...r.summary })) }, null, 1));
}
console.log('\nGDD BALANCE TARGETS (real systems)');
for (const c of h.gdd) {
  console.log(`  ${c.ok ? 'PASS' : 'MISS'}  ${c.name.padEnd(62)} ${String(c.value).padEnd(36)} target ${c.target}`);
  if (c.unlocks) for (const u of c.unlocks) console.log(`          ${u.node.padEnd(12)} GDD ${String(Math.floor(u.target / 60)).padStart(1)}:${String(u.target % 60).padStart(2, '0')}  median ${u.median == null ? '-' : `${Math.floor(u.median / 60)}:${String(Math.round(u.median % 60)).padStart(2, '0')}`}  (${u.offBy > 0 ? '+' : ''}${u.offBy} min, ${u.runs} runs)`);
}
// Hard checks fail the run; GDD targets are balance findings and are reported, not enforced.
const ok = h.runs.every((r) => r.summary.quarters > 0) && h.checks.engineeredReachable;
console.log(ok ? '\nPASS' : '\nFAIL');
process.exit(ok ? 0 : 1);
