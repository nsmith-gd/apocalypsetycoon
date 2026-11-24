import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MapSales, regionCrisis, specValue, salePrice, SALES } from '../src/worldmap/sales.js';
import { LeadMarket, REGIONS } from '../src/demand/demand.js';
import { Ledger } from '../src/ledger/ledger.js';
import { gradeShelter } from '../src/midnight/midnight.js';
import { ROOM_CATALOG } from '../src/clients/rooms.js';

const ROOMS = ['bunk', 'bunk', 'air_vent', 'water_tank', 'pantry', 'gold_taps'];
const region = (id) => REGIONS.find((r) => r.id === id);

function setup({ tensions = { pandemic: 60, climate: 40, unrest: 50, markets: 50, war: 20 }, weeks = 3 } = {}) {
  const market = new LeadMarket({ seed: 3 });
  const ledger = new Ledger({ startingCash: 1_000_000 });
  let t = { pandemic: 0, climate: 0, unrest: 0, markets: 0, war: 0 };
  market.week({ tensions: t });
  for (let i = 1; i <= weeks; i++) {
    t = Object.fromEntries(Object.entries(tensions).map(([k, v]) => [k, Math.round((v * i) / weeks)]));
    market.week({ tensions: t });
  }
  const sales = new MapSales({ market, ledger, getTensions: () => tensions });
  return { market, ledger, sales, tensions };
}

test('regional crisis is the worst track after exposure weighting (1 / 0.5 / 0.25)', () => {
  // Africa: pandemic high, climate high, unrest medium, markets low, war medium
  assert.deepEqual(regionCrisis(region('afr'), { pandemic: 40, war: 90 }), { level: 45, track: 'war' });
  assert.deepEqual(regionCrisis(region('afr'), { pandemic: 60, war: 90 }), { level: 60, track: 'pandemic' });
  assert.equal(regionCrisis(region('oce'), {}).level, 0);
});

test('demand rises with crisis: a hotter world puts more buyers in every region', () => {
  const calm = setup({ tensions: { pandemic: 10, climate: 10, unrest: 10, markets: 10, war: 10 } }).sales.overview();
  const hot = setup({ tensions: { pandemic: 70, climate: 70, unrest: 70, markets: 70, war: 70 } }).sales.overview();
  const sum = (rows, k) => rows.reduce((s, r) => s + r[k], 0);
  assert.ok(sum(hot, 'buyers') > sum(calm, 'buyers') * 3, `${sum(hot, 'buyers')} vs ${sum(calm, 'buyers')}`);
  for (const r of hot) assert.ok(r.crisis >= calm.find((c) => c.id === r.id).crisis);
});

test('spec value and sale price: build cost + 40% margin, x wealth class, x panic premium', () => {
  const s = { rooms: ROOMS };
  // no build cost on record: dig and shell estimate + rooms at catalog price, plus the 40% margin
  const roomCost = ROOMS.reduce((sum, id) => sum + ROOM_CATALOG[id].cost, 0);
  const spec = Math.round(((SALES.digShellEstimate + roomCost) * (1 + SALES.margin)) / 1000) * 1000;
  assert.equal(SALES.margin, 0.4, 'GDD: 40% contract margin');
  assert.equal(specValue(s), spec);
  // a recorded build cost replaces the estimate
  assert.equal(specValue({ rooms: ROOMS, buildCost: 10_000_000 }), 14_000_000);
  assert.equal(salePrice(s, 'comfortable', 1), spec);
  assert.equal(salePrice(s, 'rich', 1), Math.round((spec * SALES.wealthMultiplier.rich) / 1000) * 1000);
  assert.equal(salePrice(s, 'ultra', 1.2), Math.round((spec * SALES.wealthMultiplier.ultra * 1.2) / 1000) * 1000);
  assert.ok(salePrice(s, 'comfortable', 1) < salePrice(s, 'apex', 1));
});

test('selling pays out through the ledger and consumes one waiting buyer in that region', () => {
  const { market, ledger, sales } = setup();
  const shelter = sales.addFinished({ name: 'Test bunker', rooms: ROOMS, occupants: 6 });
  const id = sales.overview().sort((a, b) => b.buyers - a.buyers)[0].id;
  const before = sales.regionView(id);
  assert.ok(before.buyers >= 1);
  const q = sales.quote(id, shelter.id);
  const cash = ledger.cash;
  const rec = sales.sell(id, shelter.id);
  assert.equal(ledger.cash, cash + q.price);
  assert.equal(rec.price, q.price);
  assert.equal(sales.regionView(id).buyers, before.buyers - 1);
  assert.equal(sales.stock.length, 0);
  assert.equal(market.worked.length, 1);
  assert.equal(ledger.entries.at(-1).category, 'sales');
});

test('the richest waiting buyer is sold to first', () => {
  const { sales, market } = setup();
  const id = sales.overview().sort((a, b) => b.buyers - a.buyers)[0].id;
  market.leads.push({ id: 999, region: id, type: 'oil_heir', wealth: 'apex', week: market.weekNo });
  const s = sales.addFinished({ rooms: ROOMS });
  assert.equal(sales.quote(id, s.id).lead.id, 999);
  assert.equal(sales.sell(id, s.id).wealth, 'apex');
});

test('no buyers or no stock: the sale is refused and nothing moves', () => {
  const market = new LeadMarket({ seed: 1 });
  const ledger = new Ledger({ startingCash: 500 });
  const sales = new MapSales({ market, ledger });
  const s = sales.addFinished({ rooms: ROOMS });
  assert.match(sales.quote('oce', s.id).error, /No buyers/);
  assert.throws(() => sales.sell('oce', s.id), /No buyers/);
  assert.match(sales.quote('oce', 'nope').error, /not in stock/);
  assert.equal(ledger.cash, 500);
  assert.equal(sales.stock.length, 1);
});

test('sold shelters are Midnight-ready and the client goes to Pushback', () => {
  const { sales } = setup();
  const calls = [];
  sales.pushback = { onSale: (x) => calls.push(x) };
  const s = sales.addFinished({ rooms: ROOMS, occupants: 4 });
  const id = sales.overview().sort((a, b) => b.buyers - a.buyers)[0].id;
  sales.sell(id, s.id);
  const [m] = sales.sheltersForMidnight();
  assert.equal(m.sold, true);
  assert.deepEqual(m.grades, gradeShelter(m).grades);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].region, id);
});
