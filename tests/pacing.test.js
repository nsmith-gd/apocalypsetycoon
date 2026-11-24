import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHarness, simulateCampaign } from '../src/debug/sim.js';
import { PacingLog, quarterMinutes, PACING } from '../src/debug/pacing.js';
import { Ledger } from '../src/ledger/ledger.js';
import { Pushback } from '../src/pushback/pushback.js';
import { PUSHBACK_DEFAULTS } from '../src/config/tuning.js';

test('a quarter on the fixed clock is the clock plus paused reading time', () => {
  const t = quarterMinutes({ choices: 2 });
  assert.equal(t.fixed, PACING.quarterMinutes + 2 * PACING.choiceCardMinutes + PACING.quarterReportMinutes);
});

test('the log records one row per quarter with cash, crisis, heat and sales', () => {
  // #91: amounts follow the pushback board's GDD-scale target (the sale beats it, as before)
  const target = PUSHBACK_DEFAULTS.board.firstTarget;
  const sale = target * 6;
  const ledger = new Ledger({ startingCash: target * 2 });
  const pb = new Pushback({ ledger });
  const log = new PacingLog({ ledger, pushback: pb });
  ledger.record('sales', 'Bunker', sale);
  pb.onScheme({ label: 'x', heat: 10, tension: 10 });
  const r = pb.endQuarter({ quarter: 1 });
  const row = log.endQuarter(1, r.board);
  assert.equal(row.sales, 1);
  assert.equal(row.salesRevenue, sale);
  assert.equal(r.board.met, true, 'the sale meets the board target, so no clawback');
  assert.ok(row.crisis > 0 && row.heat >= 0 && row.cash > 0);
  assert.match(log.toCSV(), /^quarter,hours,/);
});

test('a full simulated campaign has 12 logged quarters or ends in an ousting', () => {
  const r = simulateCampaign({ bot: 'edge', seed: 1 });
  assert.ok(r.rows.length === 12 || r.summary.ending.type === 'ousted');
});

test('harness: full runs land in 5-6.5 h and both Midnight paths are reachable', () => {
  const h = runHarness({ seeds: [1, 2, 3] });
  assert.ok(h.checks.allCompletedInTarget, JSON.stringify(h.checks.hoursRange));
  assert.ok(h.checks.engineeredReachable);
  assert.ok(h.checks.failedReachable);
});
