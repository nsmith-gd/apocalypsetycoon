import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate, validate, survival, factor, stratumAt, STRATA, digPlan, constructionPlan, ConstructionJob, twoScores, LIFE_ROOMS } from '../src/shelter/life.js';

const room = (type, floor, col) => ({ type, floor, col });

test('Days Sealed = min over air, water, food, power of stock / (use - production)', () => {
  const s = { occupants: 4, rooms: [room('oxygen_store', 1, 1), room('water_tank', 1, 2), room('pantry', 1, 3), room('battery', 1, 4)] };
  const sim = simulate(s);
  // use per day: air 4, water 4, food 4, power 4
  assert.deepEqual(sim.days, { air: 100, water: 150, food: 225, power: 125 });
  assert.equal(sim.daysSealed, 100);
  assert.equal(sim.limiting, 'air');
});

test('Days Sealed changes as rooms are added; production that covers use never runs out', () => {
  const s = { occupants: 4, rooms: [room('oxygen_store', 1, 1), room('water_tank', 1, 2), room('pantry', 1, 3), room('battery', 1, 4)] };
  const d0 = simulate(s).daysSealed;
  s.rooms.push(room('air_vent', 1, 5)); // air 4/day: air never runs out; air vent uses 1 power
  const sim = simulate(s);
  assert.equal(sim.days.air, Infinity);
  assert.equal(sim.days.power, 100); // 500 / 5
  assert.equal(sim.daysSealed, 100);
  s.rooms.push(room('diesel', 1, 6));
  assert.ok(simulate(s).daysSealed > d0);
  assert.equal(simulate(s).limiting, 'water');
});

test('depth gates: cellar 10 m, geothermal 50 m, reactor 60 m, aquifer 80 m', () => {
  const at = (type, floor) => validate({ rooms: [room(type, floor, 1)] }).filter((v) => v.rule === 'depth').length;
  assert.equal(at('cellar', 1), 1); // 5 m
  assert.equal(at('cellar', 2), 0); // 10 m
  assert.equal(at('geothermal', 9), 1);
  assert.equal(at('geothermal', 10), 0);
  assert.equal(at('reactor', 11), 1);
  assert.equal(at('reactor', 12), 0);
  assert.equal(at('aquifer', 15), 1);
  assert.equal(at('aquifer', 16), 0);
});

test('every floor must touch the Utility Spine', () => {
  assert.deepEqual(validate({ rooms: [room('bunk', 1, 1), room('pantry', 1, 2)] }), []);
  const cut = validate({ rooms: [room('bunk', 1, 1), room('pantry', 1, 3)] });
  assert.equal(cut.length, 1);
  assert.match(cut[0].text, /cut off/);
  const floating = validate({ rooms: [room('bunk', 2, 2)] });
  assert.match(floating[0].text, /does not touch the Utility Spine/);
});

test('surface features must be on the surface and raise visibility (costing security)', () => {
  assert.equal(validate({ rooms: [room('helipad', 1, 1)] })[0].rule, 'surface');
  const quiet = simulate({ occupants: 2, rooms: [room('armory', 1, 1)] });
  const loud = simulate({ occupants: 2, rooms: [room('armory', 1, 1), room('helipad', 0, 3), room('solar', 0, 4)] });
  assert.equal(loud.visibility, 5);
  assert.equal(quiet.ratings.security - loud.ratings.security, 2); // 5 visibility -> -2 security
});

test('noise within 6 tiles of quarters costs comfort', () => {
  const near = simulate({ occupants: 4, rooms: [room('bunk', 1, 1), room('diesel', 1, 2)] });
  const far = simulate({ occupants: 4, rooms: [room('bunk', 1, 1), room('diesel', 8, 1)] });
  assert.equal(near.noisePairs, 1);
  assert.equal(far.noisePairs, 0);
  assert.equal(far.comfort - near.comfort, 1);
});

test('adjacency: hydroponics next to the recycler grows more food', () => {
  const apart = simulate({ occupants: 4, rooms: [room('hydroponics', 1, 1), room('pantry', 1, 2), room('water_recycler', 1, 3)] });
  const together = simulate({ occupants: 4, rooms: [room('hydroponics', 1, 1), room('water_recycler', 1, 2), room('pantry', 1, 3)] });
  assert.equal(together.flows.food.produce - apart.flows.food.produce, 3);
});

test('five strata with dig cost and crew speed; blast = stratum base + best blast door', () => {
  assert.equal(STRATA.length, 5);
  assert.equal(stratumAt(5).id, 'topsoil');
  assert.equal(stratumAt(85).id, 'bedrock');
  const shallow = simulate({ occupants: 2, rooms: [room('blast_door_1', 1, 1), room('blast_door_2', 1, 2)] });
  assert.equal(shallow.ratings.blast, 0 + 2);
  const rooms = [];
  for (let f = 1; f <= 11; f++) rooms.push(room('bunk', f, 1));
  rooms.push(room('blast_door_1', 11, 2));
  assert.equal(simulate({ occupants: 2, rooms }).ratings.blast, 3 + 1); // 55 m granite
});

test('dig plan prices tiles by stratum and crew speed', () => {
  const s = { rooms: [room('bunk', 1, 1), room('bunk', 3, 1)] }; // 5 m and 15 m
  const d = digPlan(s);
  assert.equal(d.tiles, 3 + 2); // spine shaft floors 1-3 + two rooms
  assert.equal(d.byStratum.topsoil.tiles, 2); // shaft at 5 m + room at 5 m
  assert.equal(d.byStratum.clay.tiles, 3); // shaft at 10 m and 15 m + room at 15 m
  assert.equal(d.cost, 2 * 8_000 + 3 * 15_000);
  assert.equal(Math.round(d.crewWeeks * 100) / 100, Math.round((2 / 6 + 3 / 4) * 100) / 100);
});

test('construction phases in order, with a 30-day pressure test; more crews build faster', () => {
  const s = { occupants: 2, rooms: [room('bunk', 1, 1), room('oxygen_store', 1, 2), room('water_tank', 1, 3), room('pantry', 1, 4), room('battery', 1, 5)] };
  const plan = constructionPlan(s, { crews: 1 });
  assert.deepEqual(plan.phases.map((p) => p.id), ['survey', 'dig', 'shell', 'fitout', 'pressure', 'walkthrough', 'handover']);
  assert.equal(plan.phases.find((p) => p.id === 'pressure').days, 30);
  assert.ok(constructionPlan(s, { crews: 3 }).weeks < plan.weeks);
  const job = new ConstructionJob(s, { crews: 1 });
  let guard = 0;
  while (!job.done && !job.failed && guard++ < 50) job.advanceWeek();
  assert.equal(job.done, true);
  assert.ok(job.log.includes('Pressure test complete'));
});

test('a shelter that cannot last 30 days fails its pressure test', () => {
  const s = { occupants: 8, rooms: [room('bunk', 1, 1), room('pantry', 1, 2)] }; // no air, water or power stock
  const job = new ConstructionJob(s);
  for (let i = 0; i < 40 && !job.failed && !job.done; i++) job.advanceWeek();
  assert.equal(job.failed.phase, 'pressure');
});

test('P(survive): -0.25 per missing rating point, times the Days Sealed fraction', () => {
  assert.equal(factor(3, 3), 1);
  assert.equal(factor(1, 3), 0.5);
  assert.equal(factor(0, 5), 0);
  const sim = { daysSealed: 90, ratings: { seal: 3, blast: 2, security: 3, morale: 1 } };
  const r = survival(sim, { days: 180, seal: 3, blast: 3, security: 2, morale: 2 });
  assert.deepEqual(r.factors, { seal: 1, blast: 0.75, security: 1, morale: 0.75, days: 0.5 });
  assert.equal(r.p, 0.281);
});

test('two scores: wants vs needs', () => {
  const sim = { prestige: 10, daysSealed: 365, ratings: { seal: 5, blast: 5, security: 5, morale: 5 } };
  assert.deepEqual(twoScores(sim, { days: 180 }), { wantScore: 100, needScore: 100 });
  assert.deepEqual(twoScores({ ...sim, daysSealed: 90 }, { days: 180 }, [{ fitted: true }, { fitted: false }]), { wantScore: 50, needScore: 50 });
});

test('every room has a name and cost', () => {
  for (const [id, d] of Object.entries(LIFE_ROOMS)) assert.ok(d.name && d.cost > 0, id);
});
