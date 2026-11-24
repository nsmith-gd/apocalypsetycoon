import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ledger, formatMoney } from '../src/ledger/ledger.js';

test('cash tracks income and expenses', () => {
  const l = new Ledger({ startingCash: 1000 });
  l.record('sales', 'Bunker sold', 500);
  l.record('builds', 'Gold taps', -200);
  assert.equal(l.cash, 1300);
});

test('summary itemises by category and merges identical lines', () => {
  const l = new Ledger({ startingCash: 1000 });
  l.record('builds', 'Bunk room', -100);
  l.record('builds', 'Bunk room', -100);
  l.record('sales', 'Shelter sale: Europe', 900);
  l.record('fines', 'SEC settlement', -50);
  const s = l.summary(1);
  assert.equal(s.opening, 1000);
  assert.equal(s.income, 900);
  assert.equal(s.expenses, -250);
  assert.equal(s.closing, 1650);
  const builds = s.groups.find((g) => g.category === 'builds');
  assert.deepEqual(builds.lines, [{ label: 'Bunk room', count: 2, amount: -200 }]);
  assert.deepEqual(s.groups.map((g) => g.category), ['builds', 'sales', 'fines']);
});

test('quarters are separated and opening cash carries over', () => {
  const l = new Ledger({ startingCash: 0 });
  l.record('sales', 'Sale', 100);
  l.setQuarter(2);
  l.record('schemes', 'Leak a memo', -30);
  assert.equal(l.summary(1).net, 100);
  assert.equal(l.summary(2).opening, 100);
  assert.equal(l.summary(2).closing, 70);
});

test('unknown category falls back to other; zero amounts ignored', () => {
  const l = new Ledger();
  l.record('bribes', 'x', 5);
  assert.equal(l.entries[0].category, 'other');
  assert.equal(l.record('sales', 'nothing', 0), null);
});

test('formatMoney', () => {
  assert.equal(formatMoney(1500), '$1,500');
  assert.equal(formatMoney(25000, { sign: true }), '+$25.0K');
  assert.equal(formatMoney(-3_200_000), '-$3.20M');
});

test('recent, totalsByCategory and history feed the ledger rail and screen', () => {
  const l = new Ledger({ startingCash: 100 });
  l.record('builds', 'Bunk', -20);
  l.record('sales', 'Sale', 200);
  l.record('builds', 'Pantry', -10);
  assert.deepEqual(l.recent(2).map((e) => e.label), ['Pantry', 'Sale']);
  assert.deepEqual(l.totalsByCategory(1), { builds: -30, sales: 200 });
  l.setQuarter(2);
  l.record('fines', 'Fine', -5);
  const h = l.history();
  assert.equal(h.length, 2);
  assert.deepEqual(h[0], { quarter: 1, opening: 100, income: 200, expenses: -30, net: 170, closing: 270 });
  assert.equal(h[1].opening, 270);
  assert.equal(h[1].closing, 265);
});
