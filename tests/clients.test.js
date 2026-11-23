import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClientBook, CLIENT_TYPES, mulberry32 } from '../src/clients/clients.js';
import { availableRooms } from '../src/clients/rooms.js';
import { Ledger } from '../src/ledger/ledger.js';
import { computeMidnight } from '../src/midnight/midnight.js';

const fixedOrder = (book) => {
  const o = book.generateOrder({ type: 'celebrity' });
  o.occupants = 4;
  o.wants = [{ room: 'gold_taps', qty: 1, pays: 90_000 }, { room: 'cryo_pod', qty: 1, pays: 110_000 }];
  return o;
};

test('sale pays on luxury wants, not on survival rooms', () => {
  const book = new ClientBook();
  const o = fixedOrder(book);
  const luxury = book.price(o, ['gold_taps', 'cryo_pod']);
  const survival = book.price(o, ['air_vent', 'water_tank', 'pantry']);
  const both = book.price(o, ['gold_taps', 'cryo_pod', 'air_vent', 'water_tank', 'pantry']);
  assert.equal(survival.total, o.baseFee, 'survival-only earns just the base fee');
  assert.equal(luxury.total, o.baseFee + 200_000 + 50_000, 'wants + 25% all-wants bonus');
  assert.equal(both.total, luxury.total, 'adding survival rooms adds nothing to the price');
  assert.ok(both.lines.some((l) => l.unpaid));
});

test('partial wants pay partially and lose the bonus; price multiplier applies', () => {
  const book = new ClientBook();
  const o = fixedOrder(book);
  const p = book.price(o, ['gold_taps'], { priceMultiplier: 1.5 });
  assert.equal(p.wantsMet, 1);
  assert.equal(p.bonus, 0);
  assert.equal(p.total, Math.round((o.baseFee + 90_000) * 1.5));
});

test('deliver records the sale, stores air/water/food ratings and feeds Midnight', () => {
  const ledger = new Ledger({ startingCash: 0 });
  const sales = [];
  const book = new ClientBook({ ledger, pushback: { onSale: (s) => sales.push(s) } });
  const o = fixedOrder(book);
  const s = book.deliver(o.id, ['gold_taps', 'cryo_pod', 'air_vent', 'water_tank'], { quarter: 3 });
  assert.equal(ledger.cash, s.price);
  assert.equal(sales[0].client, o.client);
  assert.deepEqual(Object.keys(s.ratings), ['air', 'water', 'food']);
  // 4 people: vent = 4 air (1.0), tank 4 - taps leak 1 = 3 water (0.75), cryo 3 food (0.75)
  assert.deepEqual(s.ratings, { air: 1, water: 0.75, food: 0.75 });
  assert.deepEqual(s.grades, { air: 'B', water: 'C', food: 'C' });
  assert.equal(book.orders.length, 0);
  const m = computeMidnight({ shelters: book.sheltersForMidnight(), world: { tension: 50, heat: 0, runaways: 0 } });
  assert.equal(m.shelters[0].grades.water, 'C');
  assert.equal(m.shelters[0].occupants, 4);
});

test('validation: slot limit and empty shelters', () => {
  const book = new ClientBook();
  const o = fixedOrder(book);
  assert.throws(() => book.deliver(o.id, []), /empty/);
  assert.throws(() => book.deliver(o.id, Array(o.slots + 1).fill('pantry')), /slots/);
});

test('orders are data-driven, deterministic, respect research locks and expire', () => {
  const a = new ClientBook({ rng: mulberry32(7) });
  const b = new ClientBook({ rng: mulberry32(7) });
  for (let i = 0; i < 20; i++) {
    const oa = a.generateOrder({ crisis: i * 5, isUnlocked: () => false });
    const ob = b.generateOrder({ crisis: i * 5, isUnlocked: () => false });
    assert.deepEqual(oa, ob);
    assert.ok(CLIENT_TYPES[oa.type]);
    for (const w of oa.wants) assert.ok(availableRooms(() => false).includes(w.room), `${w.room} should be buildable`);
  }
  const o = a.orders[0];
  assert.equal(a.expire(o.expiresQuarter).length, 0);
  assert.ok(a.expire(o.expiresQuarter + 1).length > 0);
});

test('edge worlds draw more luxury clients than calm ones', () => {
  const count = (crisis) => {
    const book = new ClientBook({ rng: mulberry32(3) });
    let preppers = 0;
    for (let i = 0; i < 400; i++) if (book.generateOrder({ crisis }).type === 'prepper') preppers++;
    return preppers;
  };
  assert.ok(count(10) > count(85) * 2);
});
