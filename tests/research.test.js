import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResearchTree, researchRate, TIPPING_POINT } from '../src/research/research.js';

test('research rate climbs with crisis, peaks below the tipping point, falls after', () => {
  assert.ok(researchRate(0) < researchRate(40));
  assert.ok(researchRate(40) < researchRate(80));
  assert.ok(researchRate(TIPPING_POINT - 1) > researchRate(100));
  const peak = Math.max(...Array.from({ length: 101 }, (_, c) => researchRate(c)));
  assert.ok(researchRate(TIPPING_POINT - 2) === peak);
});

test('higher crisis researches the same node faster', () => {
  const time = (crisis) => {
    const t = new ResearchTree();
    t.start('a_hydro');
    let s = 0;
    while (!t.done.has('a_hydro')) { t.tick(1, crisis); s++; }
    return s;
  };
  assert.ok(time(85) < time(20) / 3);
});

test('prerequisites gate nodes; unlock fires and amenity becomes available', () => {
  const t = new ResearchTree();
  assert.equal(t.status('a_cryo'), 'locked');
  assert.equal(t.start('a_cryo'), false);
  const unlocked = [];
  t.onUnlock((n) => unlocked.push(n.unlocks.id));
  t.start('a_hydro');
  t.tick(2000, 50);
  assert.deepEqual(unlocked, ['hydroponics']);
  assert.ok(t.isUnlocked('hydroponics'));
  assert.equal(t.status('a_cryo'), 'available');
  assert.ok(t.pool > 0, 'leftover RP is banked');
  t.start('a_cryo');
  assert.ok(t.isUnlocked('cryo_pod'), 'banked RP is spent immediately');
});

test('crew research adds build crews; save/load round-trips', () => {
  const t = new ResearchTree();
  t.start('c_crew2');
  t.tick(10_000, 60);
  assert.equal(t.crewCount, 2);
  const u = new ResearchTree();
  u.load(JSON.parse(JSON.stringify(t)));
  assert.equal(u.crewCount, 2);
  assert.equal(u.pool, t.pool);
});
