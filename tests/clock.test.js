import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CampaignClock, QUARTER_SECONDS, TOTAL_QUARTERS, formatClock } from '../src/campaign/clock.js';
import { createSaveSlot, ledgerSaveable } from '../src/campaign/save.js';
import { Ledger } from '../src/ledger/ledger.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

test('twelve quarters of clock fit the 5 to 6.5 hour target', () => {
  const hours = (QUARTER_SECONDS * TOTAL_QUARTERS) / 3600;
  assert.equal(TOTAL_QUARTERS, 12);
  assert.ok(hours >= 5 && hours <= 6.5, `${hours}h`);
});

test('runs Q1 to Q12, fires each quarter-end hook once, then Midnight', async () => {
  const clock = new CampaignClock({ quarterSeconds: 10 });
  const ended = []; const started = []; let midnight = 0;
  clock.onQuarterEnd(({ quarter, isFinal }) => ended.push(isFinal ? `${quarter}!` : quarter));
  clock.onQuarterStart(({ quarter }) => started.push(quarter));
  clock.onMidnight(() => midnight++);
  for (let i = 0; i < 400 && !clock.midnight; i++) { clock.tick(1); await flush(); }
  assert.deepEqual(ended, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, '12!']);
  assert.deepEqual(started, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(midnight, 1);
  assert.equal(clock.label, 'MIDNIGHT');
  clock.tick(100); clock.skipQuarter();
  assert.equal(midnight, 1);
});

test('waits for an async quarter report before starting the next quarter', async () => {
  const clock = new CampaignClock({ quarterSeconds: 10 });
  let close;
  clock.onQuarterEnd(() => new Promise((r) => { close = r; }));
  clock.tick(10);
  await flush();
  assert.equal(clock.quarter, 1);
  assert.equal(clock.running, false);
  clock.tick(50); // ignored while the report is open
  close();
  await flush();
  assert.equal(clock.quarter, 2);
  assert.equal(clock.elapsed, 0);
  assert.equal(clock.running, true);
});

test('speed, pause and holds', () => {
  const clock = new CampaignClock({ quarterSeconds: 100 });
  clock.setSpeed(0); clock.tick(50);
  assert.equal(clock.elapsed, 0);
  clock.setSpeed(4); clock.tick(10);
  assert.equal(clock.elapsed, 40);
  clock.hold('menu'); clock.tick(10);
  assert.equal(clock.elapsed, 40);
  clock.release('menu'); clock.tick(1);
  assert.equal(clock.elapsed, 44);
  assert.equal(clock.label, 'Y1 Q1');
  assert.equal(formatClock(QUARTER_SECONDS), '27:00');
});

test('save slot round-trips the clock and the ledger', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const clock = new CampaignClock({ quarterSeconds: 10, state: { quarter: 5, elapsed: 3 } });
  const ledger = new Ledger({ startingCash: 1000 });
  ledger.record('sales', 'Bunker', 500);
  const slot = createSaveSlot({ storage });
  slot.register('clock', clock);
  slot.register('ledger', ledgerSaveable(ledger));
  assert.equal(slot.has(), false);
  assert.ok(slot.save());

  const clock2 = new CampaignClock({ quarterSeconds: 10 });
  const ledger2 = new Ledger({ startingCash: 0 });
  const slot2 = createSaveSlot({ storage });
  slot2.register('clock', clock2);
  slot2.register('ledger', ledgerSaveable(ledger2));
  assert.ok(slot2.load());
  assert.equal(clock2.quarter, 5);
  assert.equal(clock2.elapsed, 3);
  assert.equal(ledger2.cash, 1500);
  slot2.clear();
  assert.equal(slot2.has(), false);
});
