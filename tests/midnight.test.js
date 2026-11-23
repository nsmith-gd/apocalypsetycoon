import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMidnight, gradeShelter, controlScore, shelterSupply, grade } from '../src/midnight/midnight.js';

const survival = (id, occupants = 8) => ({ id, name: `Survival ${id}`, owner: 'A', occupants, rooms: ['mil_scrubber', 'water_recycler', 'hydroponics'], sold: true });
const luxury = (id, occupants = 8) => ({ id, name: `Luxury ${id}`, owner: 'B', occupants, rooms: ['gold_taps', 'cryo_pod', 'wine_cellar', 'air_vent', 'water_tank', 'pantry'], sold: true });
const calm = { tension: 70, heat: 20, runaways: 0 };
const chaos = { tension: 98, heat: 70, runaways: 2 };

test('grades', () => {
  assert.equal(grade(1.3), 'A');
  assert.equal(grade(1), 'B');
  assert.equal(grade(0.8), 'C');
  assert.equal(grade(0.6), 'D');
  assert.equal(grade(0.2), 'F');
});

test('luxury sells but does not supply; gold taps leak water', () => {
  const s = shelterSupply({ rooms: ['gold_taps', 'water_tank'] });
  assert.equal(s.water, 3);
  assert.equal(s.prestige, 2);
});

test('AI butler boosts every supply', () => {
  const s = shelterSupply({ rooms: ['air_vent', 'ai_butler'] });
  assert.ok(Math.abs(s.air - 4.6) < 1e-9);
});

test('a well-supplied shelter survives; an under-supplied one rations or is lost', () => {
  assert.equal(gradeShelter(survival(1)).outcome, 'survived');
  const lux = gradeShelter(luxury(2));
  assert.equal(lux.outcome, 'rationing');
  assert.equal(lux.weakest, 'water');
  assert.equal(gradeShelter({ id: 3, occupants: 6, rooms: ['gold_taps'] }).outcome, 'lost');
});

test('control decides engineered vs failed-to-contain', () => {
  assert.ok(controlScore(calm) >= 50);
  assert.ok(controlScore(chaos) < 50);
  assert.equal(computeMidnight({ shelters: [survival(1)], world: calm }).type, 'engineered');
  assert.equal(computeMidnight({ shelters: [survival(1)], world: chaos }).type, 'failed');
});

test('four different endings from the same world switches', () => {
  const good = [survival(1), survival(2)];
  const bad = [luxury(1), luxury(2), { id: 3, occupants: 6, rooms: ['gold_taps', 'wine_cellar'] }];
  assert.equal(computeMidnight({ shelters: good, world: calm }).ending.id, 'architect');
  assert.equal(computeMidnight({ shelters: bad, world: calm }).ending.id, 'gilded');
  assert.equal(computeMidnight({ shelters: good, world: chaos }).ending.id, 'ark');
  assert.equal(computeMidnight({ shelters: bad, world: chaos }).ending.id, 'nobody');
});

test('failed-to-contain raises needs, which can sink a borderline shelter', () => {
  const borderline = { id: 1, occupants: 10, rooms: ['mil_scrubber', 'water_recycler', 'hydroponics'] };
  assert.equal(computeMidnight({ shelters: [borderline], world: calm }).shelters[0].outcome, 'survived');
  assert.equal(computeMidnight({ shelters: [borderline], world: chaos }).shelters[0].outcome, 'rationing');
});

test('totals aggregate every shelter, and overall grades count passing shelters', () => {
  const r = computeMidnight({ shelters: [survival(1, 8), luxury(2, 8)], world: calm, cash: 1e6 });
  assert.equal(r.totals.occupants, 16);
  assert.equal(r.overall.air.passing, 1);
  assert.equal(r.overall.air.grade, 'B'); // survival air 1.5, luxury air 0.5, averaged by people = 1.0
  assert.equal(r.overall.air.of, 2);
  assert.equal(r.wasted, 1);
  assert.equal(r.cash, 1e6);
});

test('no shelters at all is the worst ending', () => {
  assert.equal(computeMidnight({ shelters: [], world: calm }).ending.id, 'gilded');
});
