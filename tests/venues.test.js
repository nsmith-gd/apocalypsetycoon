import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadVenueCatalog, parseVenueCatalog, validateVenue, VENUE_SCHEMA, VENUE_DATA_URL } from '../src/events/venues.js';

const raw = () => JSON.parse(readFileSync(VENUE_DATA_URL, 'utf8'));

test('the catalog loads from data/venues.json and every entry passes the schema', async () => {
  const cat = await loadVenueCatalog();
  assert.ok(cat.venues.length >= 8, `${cat.venues.length} venues`);
  for (const v of cat.venues) assert.deepEqual(validateVenue(v), [], v.id);
  assert.equal(cat.byId['embassy-ball'].region, 'capitals');
});

test('every quarter 1-12 has at least one venue, and Q1 has a choice', async () => {
  const cat = await loadVenueCatalog();
  assert.deepEqual(cat.uncoveredQuarters(), []);
  assert.ok(cat.inQuarter(1).length >= 2);
  assert.deepEqual(cat.inQuarter(14).map((v) => v.id), cat.inQuarter(12).map((v) => v.id), 'overtime reuses Q12');
});

test('covers galas, expos, summits and funerals as the ticket asks', async () => {
  const kinds = new Set((await loadVenueCatalog()).venues.map((v) => v.kind));
  for (const k of ['gala', 'expo', 'summit', 'funeral']) assert.ok(kinds.has(k), k);
});

test('the catalog is frozen', async () => {
  const cat = await loadVenueCatalog();
  assert.throws(() => { cat.venues[0].cost.cash = 0; });
});

test('bad entries are rejected with a reason per field', () => {
  const good = raw().venues[0];
  const cases = [
    [{ ...good, region: 'atlantis' }, /region/],
    [{ ...good, quarters: [3, 2] }, /quarters/],
    [{ ...good, quarters: [13] }, /quarters/],
    [{ ...good, cost: { cash: -1, days: 1 } }, /cost/],
    [{ ...good, cost: { cash: 0, days: 0 } }, /cost/],
    [{ ...good, guestPool: { size: 10, classes: { C9: 1 } } }, /guestPool/],
    [{ ...good, guestList: { min: 2, max: 99 } }, /guestList/],
    [{ ...good, exposure: { heat: 0, reputation: 0, press: 2 } }, /exposure/],
    [{ ...good, themes: ['zombies'] }, /themes/],
    [{ ...good, kind: 'rave' }, /kind/],
    [{ ...good, extra: 1 }, /unknown field/],
  ];
  for (const [bad, re] of cases) assert.match(validateVenue(bad).join('; '), re);
  const { blurb, ...missing } = good;
  assert.match(validateVenue(missing).join(), /blurb: missing/);
  assert.throws(() => parseVenueCatalog({ venues: [good, good] }), /duplicate id/);
  assert.ok(Object.keys(VENUE_SCHEMA).length >= 10);
});
