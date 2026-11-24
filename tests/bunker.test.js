import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BunkerSite } from '../src/shelter/bunker.js';
import { OBJECTS, STRATA, PRICE_SCALE } from '../src/shelter/bunker-catalog.js';
import { Ledger } from '../src/ledger/ledger.js';

// Spine down column 0-1, one room on the floor y 1..3 (ceiling slab y 0, floor slab y 4), x 2..12.
function starter({ surveyed = true, ledger = null } = {}) {
  const b = new BunkerSite({ surveyed, ledger });
  for (let y = 0; y < 9; y++) { b.dig(0, y); b.dig(1, y); b.build('spine', 0, y); b.build('spine', 1, y); }
  b.digRect(2, 0, 13, 4);
  b.buildRect('wall', 2, 0, 13, 0); // ceiling slab
  b.buildRect('wall', 2, 4, 13, 4); // floor slab
  b.buildRect('wall', 13, 1, 13, 3); // end wall
  return b;
}
const room = (b) => b.simulate().rooms.find((r) => r.minY === 1 && r.minX === 2);

test('GDD strata: dig cost per tile and crew speed', () => {
  assert.deepEqual(STRATA.map((s) => [s.from, s.digCost, s.speed, s.blast]), [[0, 10_000, 6, 1], [10, 25_000, 4, 2], [25, 80_000, 2, 3], [60, 200_000, 1, 4], [120, 500_000, 0.5, 5]]);
  const ledger = new Ledger({ startingCash: 1e9 });
  const b = new BunkerSite({ ledger, surveyed: true });
  b.dig(5, 0);
  b.dig(5, 12);
  assert.equal(ledger.entries.length, 2);
  assert.equal(-ledger.entries[0].amount, 10_000);
  assert.equal(-ledger.entries[1].amount, 25_000);
});

test('crews must reach a tile from the surface: you dig down, one tile at a time', () => {
  const b = new BunkerSite({ surveyed: true, crews: () => 1 });
  b.dig(5, 3); // unreachable until 0-2 are dug
  b.tick(b.cfg.daySeconds * 5);
  assert.equal(b.isDug(5, 3), false);
  b.dig(5, 0); b.dig(5, 1); b.dig(5, 2);
  b.tick(b.cfg.daySeconds * (4 / 6) + 1e-6); // topsoil: 6 tiles per crew-day
  assert.ok(b.isDug(5, 0) && b.isDug(5, 1) && b.isDug(5, 2) && b.isDug(5, 3));
});

test('the survey takes a week before any digging', () => {
  const b = new BunkerSite({ surveyed: false });
  b.dig(5, 0);
  b.tick(b.cfg.daySeconds * 6);
  assert.equal(b.phase().id, 'survey');
  assert.equal(b.isDug(5, 0), false);
  b.tick(b.cfg.daySeconds * 1.5);
  assert.ok(b.isDug(5, 0));
});

test('rooms come from enclosure, and their type from what is inside', () => {
  const b = starter();
  b.place('bunk', 3, 3);
  b.place('bunk', 5, 3);
  b.finishAll();
  assert.equal(room(b).type.name, 'Bunk Room');
  assert.equal(room(b).beds, 4);
  b.place('shelf', 10, 3);
  b.build('wall', 8, 1); b.build('wall', 8, 2); b.build('wall', 8, 3); // split it in two
  b.finishAll();
  const types = b.simulate().rooms.filter((r) => r.minY === 1).map((r) => r.type.name).sort();
  assert.deepEqual(types, ['Bunk Room', 'Pantry']);
});

test('placement: objects need a floor, depth gates, surface-only items, no overlaps', () => {
  const b = starter();
  b.finishAll();
  assert.equal(b.canPlace('bunk', 3, 2).ok, false); // floating
  assert.equal(b.canPlace('bunk', 3, 3).ok, true);
  assert.match(b.canPlace('geothermal', 3, 3).reason, /50 m/);
  assert.match(b.canPlace('solar', 3, 3).reason, /surface/);
  assert.equal(b.canPlace('solar', 6, -1).ok, true);
  b.place('bunk', 3, 3);
  assert.match(b.canPlace('shelf', 4, 3).reason, /already/);
});

test('machines only work when their conduits touch them; the spine carries all three', () => {
  const b = starter();
  b.place('bunk', 3, 3); b.place('bunk', 5, 3);
  b.place('crank_scrubber', 12, 3);
  b.finishAll();
  assert.equal(b.simulate().flows.air.supply, 0);
  assert.ok(b.simulate().notes.some((n) => /isn't connected \(air\)/.test(n)));
  b.conduitLine('air', 2, 3, 12, 3); // from the spine, along the floor, under the scrubber
  b.finishAll();
  assert.equal(b.simulate().flows.air.supply, 120);
});

test('Days Sealed is the minimum of air, water, food and power, and moves as things are added', () => {
  const b = starter();
  b.place('bunk', 3, 3); b.place('bunk', 5, 3); // 4 people
  b.finishAll();
  assert.equal(b.simulate().daysSealed, 0); // no air, no water, no power
  b.place('hepa', 7, 3); b.place('tank', 9, 3); b.place('shelf', 11, 3); b.place('shelf', 12, 3);
  b.conduitLine('air', 2, 3, 12, 3);
  b.conduitLine('water', 2, 1, 12, 1);
  b.conduitLine('power', 2, 2, 12, 2);
  b.finishAll();
  let s = b.simulate();
  assert.ok(s.days.air < 1); // the HEPA bay has no power yet: only the room air buffer
  assert.equal(s.days.water, 50); // 10,000 L / (4 x 50 L)
  assert.equal(s.days.food, 333.3); // 4,000 meals / 12 a day
  assert.equal(s.days.power, 0); // nothing generates
  assert.equal(s.daysSealed, 0); // unpowered: no scrubbing, no generation
  // a generator room below, with fuel and an exhaust duct
  b.digRect(2, 5, 8, 8); b.buildRect('wall', 2, 8, 8, 8); b.buildRect('wall', 8, 5, 8, 7);
  b.place('diesel', 3, 7); b.place('fuel', 6, 7);
  b.conduitLine('air', 2, 6, 4, 6); b.conduitLine('power', 2, 7, 4, 7);
  b.finishAll();
  s = b.simulate();
  // 12 kW can't carry 4 people (6 kW), the spine (3 kW) and the HEPA bay (4 kW): the HEPA bay is shed
  assert.ok(s.notes.some((n) => /shut down \(12 kW for 9 kW\)/.test(n)));
  assert.ok(s.days.air < 1);
  b.place('battery', 7, 7); b.conduitLine('power', 5, 7, 7, 7);
  b.finishAll();
  s = b.simulate();
  assert.equal(s.days.air, Infinity); // the HEPA bay runs on the battery top-up: 360 m3/h for 4 x 30
  assert.ok(s.days.power > 0 && s.days.power < 50); // the battery drains at 1 kW while the diesel burns
  assert.equal(s.daysSealed, s.days.power);
});

test('power networks shed the lowest priority devices when short', () => {
  const b = starter();
  b.place('battery', 12, 3); // only a battery: everything runs while it lasts
  b.place('hepa', 3, 3); b.place('led_sky', 6, 1 + 0); // led sky panel on the ceiling? it needs a floor
  b.conduitLine('power', 2, 2, 12, 2);
  b.finishAll();
  const s = b.simulate();
  assert.ok(s.online.size >= 1);
  const solo = new BunkerSite({ surveyed: true });
  // one small diesel (12 kW) vs a HEPA bay (4 kW) and three cinema screens (12 kW): the screens go first
  for (let y = 0; y < 5; y++) { solo.dig(0, y); solo.build('spine', 0, y); }
  solo.digRect(1, 1, 16, 3); solo.buildRect('wall', 1, 4, 16, 4);
  solo.place('diesel', 1, 3); solo.place('fuel', 3, 3); solo.place('hepa', 4, 3);
  solo.place('cinema_screen', 6, 3); solo.place('cinema_screen', 9, 3); solo.place('cinema_screen', 12, 3);
  solo.conduitLine('power', 1, 1, 15, 1); solo.conduitLine('power', 1, 2, 15, 2); solo.conduitLine('air', 1, 3, 5, 3);
  solo.finishAll();
  const t = solo.simulate();
  const hepa = solo.built.find((o) => o.kind === 'hepa');
  assert.ok(t.online.has(hepa.id), 'life support stays on');
  assert.ok(t.notes.some((n) => /shut down/.test(n)));
});

test('noise within 6 tiles costs a bedroom comfort', () => {
  const quiet = starter();
  quiet.place('bunk', 3, 3);
  quiet.finishAll();
  const loud = starter();
  loud.place('bunk', 3, 3);
  loud.digRect(2, 5, 6, 8); loud.buildRect('wall', 2, 8, 6, 8);
  loud.place('diesel', 3, 7); loud.place('fuel', 5, 7);
  loud.conduitLine('air', 2, 6, 4, 6); loud.conduitLine('power', 2, 7, 4, 7);
  loud.finishAll();
  assert.equal(room(loud).noise, 3);
  assert.ok(room(loud).impressiveness < room(quiet).impressiveness);
});

test('raw rock below the 12 m water table seeps unless a sump pump runs', () => {
  const b = new BunkerSite({ surveyed: true });
  for (let y = 0; y < 18; y++) { b.dig(0, y); b.build('spine', 0, y); }
  b.digRect(1, 13, 8, 15); // no walls: raw rock all round
  b.place('bunk', 2, 15);
  b.finishAll();
  let s = b.simulate();
  assert.ok(s.rooms.some((r) => r.seeps));
  assert.equal(s.sealParts.seepage, -1);
  b.place('sump', 5, 15); b.place('battery', 8, 15);
  b.conduitLine('power', 1, 14, 8, 14);
  b.finishAll();
  s = b.simulate();
  assert.equal(s.sealParts.seepage, 0);
});

test('blast rating = stratum base + the best blast door above the bedrooms, capped at 5', () => {
  const b = starter();
  b.place('bunk', 3, 3);
  b.finishAll();
  assert.equal(b.simulate().ratings.blast, 1); // topsoil
  // a deep bedroom in bedrock (30 m) behind a Mk II door in the spine shaft above it
  const d = new BunkerSite({ surveyed: true });
  for (let y = 0; y < 34; y++) { d.dig(0, y); d.dig(1, y); d.build('spine', 0, y); }
  for (let y = 0; y < 30; y++) if (y < 10 || y > 12) d.build('wall', 1, y); // a walled shaft with a door at 10-12 m
  d.place('blast_2', 1, 12);
  d.digRect(2, 30, 8, 32); d.buildRect('wall', 1, 33, 8, 33); d.buildRect('wall', 2, 29, 8, 29);
  d.place('bunk', 3, 32);
  d.finishAll();
  assert.equal(d.simulate().ratings.blast, 3 + 2);
});

test('construction phases and the 30-day pressure test', () => {
  const b = starter();
  assert.equal(b.phase().id, 'dig');
  b.finishAll();
  b.place('bunk', 3, 3);
  assert.equal(b.phase().id, 'fitout');
  b.finishAll();
  assert.equal(b.phase().id, 'ready');
  b.startPressureTest();
  b.tick(b.cfg.daySeconds * 29);
  assert.equal(b.phase().id, 'pressure');
  b.tick(b.cfg.daySeconds * 1.5);
  assert.equal(b.phase().id, 'walkthrough');
  assert.match(b.phase().detail, /Failed/); // no air, water or power
});

test('the campaign adapter: toShelter, handOver and save/load', () => {
  const b = starter();
  b.place('bunk', 3, 3); b.place('shelf', 6, 3); b.place('gold_taps', 8, 3);
  b.finishAll();
  const sh = b.toShelter();
  assert.equal(sh.occupants, 2);
  assert.deepEqual(sh.rooms.sort(), ['bunk', 'gold_taps', 'pantry']);
  assert.ok('daysSealed' in sh.sealed);
  const saved = JSON.parse(JSON.stringify(b));
  const c = new BunkerSite({ surveyed: true });
  c.load(saved);
  const back = c.toShelter();
  back.rooms.sort();
  assert.deepEqual(back, sh);
  const r = b.handOver('Shelter #1');
  assert.equal(r.ok, true);
  assert.equal(b.objects.size, 0);
  assert.equal(b.surveyed, false);
});

test('prices are the GDD price x PRICE_SCALE', () => {
  assert.equal(OBJECTS.blast_2.cost, 200_000 * PRICE_SCALE);
});
