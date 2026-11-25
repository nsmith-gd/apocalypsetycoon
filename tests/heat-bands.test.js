import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pushback } from '../src/pushback/pushback.js';
import { TUNING } from '../src/config/tuning.js';
import { EndingWatch } from '../src/midnight/endings.js';

const fresh = (opts = {}) => {
  const pb = new Pushback({ config: { heat: { decayPerWeek: 1 } } });
  pb.getCommsLevel = () => opts.comms ?? 0;
  pb.getTierIndex = () => opts.tier ?? 0;
  return pb;
};

test('GDD heat levels at 30 / 55 / 75 / 95, values in tuning', () => {
  assert.deepEqual(TUNING.heatBands.map((b) => [b.id, b.from]), [['unnoticed', 0], ['whispers', 30], ['investigation', 55], ['hearings', 75], ['exposed', 95]]);
  const pb = fresh();
  for (const [h, id] of [[0, 'unnoticed'], [29, 'unnoticed'], [30, 'whispers'], [54, 'whispers'], [55, 'investigation'], [74, 'investigation'], [75, 'hearings'], [94, 'hearings'], [95, 'exposed'], [100, 'exposed']]) {
    pb.heat = h;
    assert.equal(pb.heatBand().id, id, `heat ${h}`);
  }
});

test('Whispers: schemes cost 10% more; Investigation: Sabotage locked and leverage grows 1.5x; Hearings: leads -25%', () => {
  const pb = fresh();
  pb.heat = 10;
  assert.equal(pb.schemeCostMultiplier, 1);
  pb.heat = 30;
  assert.equal(pb.schemeCostMultiplier, 1.1);
  assert.equal(pb.sabotageLocked, false);
  pb.heat = 60;
  assert.equal(pb.sabotageLocked, true);
  assert.equal(pb.leverageGrowthMultiplier, 1.5);
  assert.equal(pb.leadMultiplier, 1);
  pb.heat = 80;
  assert.equal(pb.leadMultiplier, 0.75);
});

test('weekly decay: 1 + 1 per Communications level, floored at Notoriety by company tier', () => {
  const pb = fresh({ comms: 2 });
  pb.heat = 50;
  pb.weekTick();
  assert.equal(pb.heat, 47);
  const tiered = fresh({ tier: 3 }); // Conglomerate: floor 20
  assert.equal(tiered.notoriety, 20);
  tiered.heat = 21;
  tiered.weekTick();
  assert.equal(tiered.heat, 20);
  tiered.weekTick();
  assert.equal(tiered.heat, 20); // never decays below the floor
  tiered.heat = 12;
  tiered.weekTick();
  assert.equal(tiered.heat, 12); // the floor stops decay; it doesn't raise heat
  assert.deepEqual([0, 1, 2, 3, 4].map((t) => fresh({ tier: t }).notoriety), [0, 5, 10, 20, 30]);
});

test('Investigation audits one site a quarter; Hearings hold one hearing a quarter (reputation -10, confidence -10)', () => {
  const pb = fresh();
  const audits = [], hearings = [];
  pb.on('audit', (e) => audits.push(e));
  pb.on('hearing', (e) => hearings.push(e));
  pb.heat = 85;
  for (let w = 0; w < 5; w++) { pb.heat = 85; pb.weekTick(); }
  assert.equal(audits.length, 1);
  assert.equal(hearings.length, 1);
  assert.deepEqual([hearings[0].reputation, hearings[0].boardConfidence], [-10, -10]);
  pb.quarter += 1; // a new quarter brings a new audit and hearing
  pb.heat = 85; pb.weekTick();
  assert.equal(audits.length, 2);
  assert.equal(hearings.length, 2);
});

test('heat 96 held for 4 weeks ends the campaign as Indicted; getting below 95 in time avoids it', () => {
  const pb = fresh();
  const watch = new EndingWatch();
  const weeksLeft = [];
  pb.on('indictment', (e) => weeksLeft.push(e.weeksLeft));
  let ending = null;
  for (let w = 1; w <= 4 && !ending; w++) {
    pb.heat = 96; // still scheming hard
    pb.weekTick();
    ending = watch.week({ heat: pb.heat, tracks: [] });
  }
  assert.equal(ending, 'indicted');
  assert.deepEqual(weeksLeft, [3, 2, 1, 0]);
  // Laying off: decay alone carries 96 below 95 inside the window
  const pb2 = fresh();
  const watch2 = new EndingWatch();
  pb2.heat = 96;
  let e2 = null;
  for (let w = 0; w < 6 && !e2; w++) { pb2.weekTick(); e2 = watch2.week({ heat: pb2.heat, tracks: [] }); }
  assert.equal(e2, null);
});

test('heat-band state survives save and load', () => {
  const pb = fresh();
  pb.heat = 96; pb.weekTick(); pb.heat = 96; pb.weekTick();
  const copy = Pushback.fromJSON(JSON.parse(JSON.stringify(pb)));
  assert.equal(copy.exposedWeeks, 2);
});
