import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MONEY } from '../src/config/tuning.js';
import { BunkerSite } from '../src/shelter/bunker.js';
import { Ledger } from '../src/ledger/ledger.js';
import { salePrice, specValue, SALES } from '../src/worldmap/sales.js';
import { quotaFor, BOARD } from '../src/board/board.js';
import { PRICE_SCALE } from '../src/shelter/bunker-catalog.js';
import { CARD_PRICE_SCALE } from '../src/events/weekly.js';
import { STARTING_CASH_FOR_TESTS } from './helpers/money-helpers.js';

// A typical Solo Pod (GDD Product lines: 16 wide, 2-4 people): spine, one living floor, one plant floor.
function soloPod(ledger) {
  const b = new BunkerSite({ surveyed: true, ledger });
  for (let y = 0; y < 9; y++) { b.dig(0, y); b.dig(1, y); b.build('spine', 0, y); b.build('spine', 1, y); }
  b.digRect(2, 0, 15, 4); b.buildRect('wall', 2, 0, 15, 0); b.buildRect('wall', 2, 4, 15, 4); b.buildRect('wall', 15, 1, 15, 3);
  b.place('bunk', 3, 3); b.place('bunk', 5, 3); b.place('hepa', 7, 3); b.place('tank', 9, 3); b.place('shelf', 11, 3); b.place('shelf', 12, 3); b.place('airlock', 14, 1);
  b.conduitLine('air', 2, 3, 14, 3); b.conduitLine('water', 2, 1, 14, 1); b.conduitLine('power', 2, 2, 14, 2);
  b.digRect(2, 5, 15, 8); b.buildRect('wall', 2, 8, 15, 8); b.buildRect('wall', 15, 5, 15, 7);
  b.place('diesel', 3, 7); b.place('fuel', 6, 7); b.place('battery', 9, 7);
  b.conduitLine('air', 2, 6, 4, 6); b.conduitLine('power', 2, 7, 9, 7);
  b.finishAll();
  return b;
}

test('one money scale: every scale knob is the GDD scale', () => {
  assert.equal(PRICE_SCALE, 1);
  assert.equal(CARD_PRICE_SCALE, 1);
  assert.equal(BOARD.quotaScale, 1);
  assert.equal(STARTING_CASH_FOR_TESTS, MONEY.startingCash);
});

test('a Solo Pod sale yields $3-5M (GDD Product lines)', () => {
  const ledger = new Ledger({ startingCash: 50_000_000 });
  const b = soloPod(ledger);
  const r = b.handOver('Solo Pod');
  assert.ok(r.ok);
  assert.equal(r.shelter.buildCost, 50_000_000 - ledger.cash, 'the handover carries what the dig and rooms cost');
  assert.equal(specValue(r.shelter), Math.round((r.shelter.buildCost * (1 + SALES.margin)) / 1000) * 1000);
  const [lo, hi] = MONEY.soloPodPrice;
  for (const [wealth, premium] of [['comfortable', 1], ['comfortable', 1.25], ['rich', 1.1]]) {
    const p = salePrice(r.shelter, wealth, premium);
    assert.ok(p >= lo && p <= hi, `${wealth} x${premium}: $${(p / 1e6).toFixed(2)}M`);
  }
  assert.equal(b.handOver('again').ok, false);
});

test('GDD money rows: quota, crews, departments, contract margin and class multipliers', () => {
  assert.equal(quotaFor(1), 6_000_000);
  assert.ok(Math.abs(quotaFor(4) - 13_182_000) < 5_000);
  assert.equal(MONEY.crewPerWeek * 13, 1_300_000);
  assert.deepEqual(MONEY.departmentLevelsM, [2, 4, 8, 16]);
  assert.equal(MONEY.contractMargin, 0.4);
  assert.deepEqual(Object.values(MONEY.classMultiplier), [1, 1.1, 1.2, 1.35, 1.5]);
});
