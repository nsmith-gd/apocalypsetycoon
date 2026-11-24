import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShelterGrid, GRID } from '../src/shelter/grid.js';
import { Ledger } from '../src/ledger/ledger.js';
import { ROOM_CATALOG } from '../src/clients/rooms.js';
import { STRATA } from '../src/shelter/life.js';

const setup = (opts = {}) => {
  const ledger = new Ledger({ startingCash: 100_000_000 });
  const grid = new ShelterGrid({ ledger, ...opts });
  return { ledger, grid };
};

test('placing a room charges room price plus digging, and only queues it', () => {
  const { ledger, grid } = setup();
  const r = grid.place(1, 1, 'gold_taps');
  assert.ok(r.ok);
  assert.equal(r.dig, STRATA[0].digCost);
  assert.equal(ledger.cash, 100_000_000 - ROOM_CATALOG.gold_taps.cost - STRATA[0].digCost);
  assert.equal(grid.built.length, 0);
  assert.equal(grid.stats().underConstruction, 1);
});

test('surface, shaft, occupied, locked and unaffordable cells are refused', () => {
  const { grid } = setup();
  assert.equal(grid.place(3, 0, 'pantry').ok, false);
  assert.equal(grid.place(GRID.shaftCol, 2, 'pantry').ok, false);
  grid.place(2, 2, 'pantry');
  assert.equal(grid.place(2, 2, 'pantry').ok, false);
  assert.equal(grid.place(3, 2, 'cryo_pod').reason, 'Needs research first');
  const poor = new ShelterGrid({ ledger: new Ledger({ startingCash: 10_000 }) });
  assert.equal(poor.place(1, 1, 'gold_taps').reason, 'Not enough cash');
});

test('one shovel crew builds one room at a time; a second crew doubles throughput', () => {
  const { grid } = setup();
  grid.place(1, 1, 'pantry');
  grid.place(2, 1, 'water_tank');
  const need = grid.at(1, 1).need;
  grid.tick(need);
  assert.equal(grid.at(1, 1).built, true);
  assert.equal(grid.at(2, 1).built, false);
  const two = setup({ crews: () => 2 }).grid;
  two.place(1, 1, 'pantry'); two.place(2, 1, 'water_tank');
  two.tick(need + 60);
  assert.equal(two.built.length, 2);
});

test('demolishing salvages half the room price; cancelling refunds everything; the hole stays dug', () => {
  const { ledger, grid } = setup();
  grid.place(1, 1, 'gold_taps');
  grid.finishAll();
  const before = ledger.cash;
  const r = grid.remove(1, 1);
  assert.equal(r.refund, ROOM_CATALOG.gold_taps.cost * GRID.salvage);
  assert.equal(ledger.cash, before + r.refund);
  assert.equal(grid.quote(1, 1, 'pantry').dig, 0);
  const cash = ledger.cash;
  grid.place(4, 3, 'air_vent');
  grid.remove(4, 3);
  assert.equal(ledger.cash, cash);
});

test('stat sheet: built rooms feed air/water/food against occupants, gold taps leak', () => {
  const { grid } = setup();
  for (const [c, id] of [[1, 'bunk'], [2, 'air_vent'], [3, 'water_tank'], [4, 'pantry'], [5, 'gold_taps']]) grid.place(c, 1, id);
  grid.finishAll();
  const s = grid.stats();
  assert.equal(s.occupants, GRID.baseOccupants + GRID.bedsPerBunk);
  assert.equal(s.supply.air, 4);
  assert.equal(s.supply.water, 3);
  assert.equal(s.supply.food, 4);
  assert.equal(s.luxury, 1);
  assert.equal(s.rooms, 5);
  assert.deepEqual(grid.toShelter().rooms.sort(), ['air_vent', 'bunk', 'gold_taps', 'pantry', 'water_tank']);
});

test('board budget freeze multiplies build costs', () => {
  const { grid } = setup({ costMultiplier: () => 1.5 });
  assert.equal(grid.quote(1, 2, 'pantry').room, ROOM_CATALOG.pantry.cost * 1.5);
});

test('save and load', () => {
  const { grid } = setup();
  grid.place(1, 1, 'pantry'); grid.finishAll(); grid.place(2, 1, 'bunk');
  const copy = new ShelterGrid({});
  copy.load(JSON.parse(JSON.stringify(grid)));
  assert.equal(copy.built.length, 1);
  assert.equal(copy.queue.length, 1);
  assert.equal(copy.quote(1, 1, 'pantry').ok, false);
});

test('hand over: needs finished rooms, returns the shelter and clears the site', () => {
  const { grid } = setup();
  assert.equal(grid.handOver().ok, false);
  grid.place(1, 1, 'bunk');
  assert.equal(grid.handOver().reason, 'The crew is still working');
  grid.finishAll();
  const r = grid.handOver('Shelter #1');
  assert.ok(r.ok);
  assert.deepEqual(r.shelter, { name: 'Shelter #1', rooms: ['bunk'], occupants: GRID.baseOccupants + GRID.bedsPerBunk });
  assert.equal(grid.rooms.length, 0);
  assert.equal(grid.quote(1, 1, 'pantry').dig > 0, true);
});
