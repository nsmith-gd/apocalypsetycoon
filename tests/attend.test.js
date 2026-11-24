import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadVenueCatalog } from '../src/events/venues.js';
import { EventCircuit, AGENDA, classArrivedBy } from '../src/events/attend.js';
import { Ledger } from '../src/ledger/ledger.js';
import { CampaignClock } from '../src/campaign/clock.js';

const catalog = await loadVenueCatalog();
const setup = (opts = {}) => {
  const ledger = new Ledger({ startingCash: opts.cash ?? 10_000_000 });
  const heat = [], rep = [];
  const circuit = new EventCircuit({ catalog, ledger, seed: 7, addHeat: (n) => heat.push(n), addReputation: (n) => rep.push(n), ...opts });
  return { ledger, circuit, heat, rep };
};

test('attending deducts cash through the ledger and agenda days for the quarter', () => {
  const { ledger, circuit } = setup();
  const v = catalog.byId['prepper-expo'];
  circuit.attend(v.id, { quarter: 1, from: 'world' });
  assert.equal(ledger.cash, 10_000_000 - v.cost.cash);
  assert.equal(ledger.entries.at(-1).label, `Event: ${v.name}`);
  assert.equal(circuit.daysLeft(1), AGENDA.daysPerQuarter - v.cost.days);
  assert.equal(circuit.daysLeft(2), AGENDA.daysPerQuarter, 'days do not carry over');
});

test('guest list comes from the venue pool: right size, no repeats, only classes that have arrived', () => {
  const { circuit } = setup();
  const v = catalog.byId['prepper-expo']; // C1 x3, C2 x1 — C2 arrives at 1:10 (Q3)
  const visit = circuit.attend(v.id, { quarter: 1 });
  assert.ok(visit.guests.length >= v.guestList.min && visit.guests.length <= v.guestList.max);
  assert.equal(new Set(visit.guests.map((g) => g.id)).size, visit.guests.length);
  const poolIds = new Set(circuit.pool(v).map((g) => g.id));
  for (const g of visit.guests) {
    assert.ok(poolIds.has(g.id));
    assert.equal(g.wealthClass, 'C1');
    assert.equal(g.region, 'frontier');
    assert.ok(g.name && g.fears.length === 1);
  }
  assert.ok(classArrivedBy('C2', 3) && !classArrivedBy('C2', 2) && classArrivedBy('C5', 11) && !classArrivedBy('C5', 10));
});

test('the pool is stable for a seed, so a venue is the same crowd all campaign', () => {
  const a = setup().circuit, b = setup().circuit;
  const v = catalog.byId['embassy-ball'];
  assert.deepEqual(a.pool(v), b.pool(v));
  assert.equal(a.pool(v).length, v.guestPool.size);
});

test('leaving ends the visit cleanly and returns to the prior screen; the clock is held only while there', () => {
  const clock = new CampaignClock();
  const { circuit } = setup({ clock });
  const visit = circuit.attend('county-preparedness-fair', { quarter: 1, from: 'shelter' });
  assert.ok(clock.holds.has('event'));
  assert.equal(circuit.current, visit);
  const { returnTo, visit: closed } = circuit.leave();
  assert.equal(returnTo, 'shelter');
  assert.equal(closed, visit);
  assert.equal(circuit.current, null);
  assert.ok(!clock.holds.has('event'));
  assert.equal(circuit.history.length, 1);
  assert.deepEqual(circuit.leave(), { visit: null, returnTo: null }, 'leaving twice is harmless');
});

test('blockers: wrong quarter, twice a quarter, out of days, out of cash, one visit at a time', () => {
  const { circuit } = setup();
  assert.throws(() => circuit.attend('table-supper', { quarter: 1 }), /not running/);
  circuit.attend('county-preparedness-fair', { quarter: 1 });
  assert.throws(() => circuit.attend('prepper-expo', { quarter: 1 }), /already at an event/);
  circuit.leave();
  assert.throws(() => circuit.attend('county-preparedness-fair', { quarter: 1 }), /already attended/);
  circuit.attend('ice-hotel-retreat', { quarter: 1 }); circuit.leave(); // 1 + 3 days
  circuit.attend('prepper-expo', { quarter: 1 }); circuit.leave(); // + 2 = all 6 days
  assert.equal(circuit.daysLeft(1), 0);
  assert.ok(circuit.options(1).every((o) => !o.canAttend));
  assert.throws(() => circuit.attend('county-preparedness-fair', { quarter: 0 }), /current quarter/);
});

test('agenda and cash limits show up in options()', () => {
  const poor = setup({ cash: 20_000 }).circuit;
  const opts = poor.options(1);
  assert.deepEqual(opts.find((o) => o.venue.id === 'county-preparedness-fair'), { venue: catalog.byId['county-preparedness-fair'], canAttend: true, reason: null });
  assert.equal(opts.find((o) => o.venue.id === 'prepper-expo').reason, 'not enough cash');

  const busy = setup({ daysPerQuarter: 2 }).circuit;
  busy.attend('prepper-expo', { quarter: 1 }); busy.leave();
  assert.equal(busy.options(1).find((o) => o.venue.id === 'county-preparedness-fair').reason, 'not enough agenda days');
  assert.throws(() => busy.attend('county-preparedness-fair', { quarter: 1 }), /agenda days/);
});

test('a venue whose crowd has not arrived yet cannot be attended', () => {
  const { circuit } = setup();
  assert.equal(circuit.blocker(catalog.byId['founders-summit'], 3), null);
  const lateOnly = { ...catalog.byId['founders-summit'], quarters: [1], guestPool: { size: 5, classes: { C5: 1 } } };
  assert.equal(circuit.blocker(lateOnly, 1), 'this crowd has not arrived yet');
});

test('exposure applies on arrival; met guests drop off later lists for that venue', () => {
  const { circuit, heat, rep } = setup();
  const v = catalog.byId['funeral-of-a-tycoon'];
  const first = circuit.attend(v.id, { quarter: 2 });
  assert.deepEqual(heat, [v.exposure.heat]);
  assert.deepEqual(rep, [v.exposure.reputation]);
  assert.equal(typeof first.press, 'boolean');
  for (const g of first.guests) assert.equal(circuit.meet(g.id), true);
  assert.equal(circuit.meet(first.guests[0].id), false);
  assert.throws(() => circuit.meet('nobody'), /not on this guest list/);
  circuit.leave();
  const second = circuit.attend(v.id, { quarter: 5 });
  const metIds = new Set(first.guests.map((g) => g.id));
  assert.ok(second.guests.every((g) => !metIds.has(g.id)));
});

test('save and load keeps agenda, attendance and who you met; an open visit is closed', () => {
  const { circuit } = setup();
  const visit = circuit.attend('county-preparedness-fair', { quarter: 1 });
  circuit.meet(visit.guests[0].id);
  const saved = JSON.parse(JSON.stringify(circuit.toJSON()));
  const { circuit: again } = setup();
  again.load(saved);
  assert.equal(again.daysLeft(1), circuit.daysLeft(1));
  assert.equal(again.blocker(catalog.byId['county-preparedness-fair'], 1), 'already attended this quarter');
  assert.deepEqual(again.met, circuit.met);
  assert.equal(again.current, null);
});
