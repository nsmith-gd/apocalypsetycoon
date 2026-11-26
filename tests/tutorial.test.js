// #162: the first-hour prompts run in order, milestones are timed against the GDD pacing targets (also when
// skipped), and the state survives a save.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tutorial, STEPS, PACING_TARGETS } from '../src/tutorial/tutorial.js';

const base = () => ({ dug: 0, kinds: new Set(), nets: new Set(), rooms: 0, objects: 0, jobs: 0, occupants: 0, daysSealed: 0, handedOver: 0, handedOverAtStart: 0, marlaSold: false, sales: 0, schemes: 0 });
function rig(opts = {}) {
  let t = 0;
  const events = [];
  const tut = new Tutorial({ telemetry: { event: (type, data) => events.push({ type, ...data }) }, clock: () => t, ...opts });
  return { tut, events, at: (s) => { t = s; } };
}

test('the prompts run dig, airlock, bunk, sign, survive, hook-up, build, handover, sell, scheme', () => {
  assert.deepEqual(STEPS.map((s) => s.id), ['dig', 'airlock', 'bunk', 'sign', 'survive', 'hookup', 'build', 'handover', 'sell', 'scheme']);
  for (const s of STEPS) assert.ok(s.text.length <= 150, `${s.id}: keep it short (${s.text.length})`);
  assert.ok(STEPS.some((s) => /Survive/.test(s.title + s.text)) && STEPS.some((s) => /DAYS SEALED/.test(s.text)), 'teaches the Survive tier and Days Sealed');
});

test('handing over early completes the steps before it instead of getting stuck', () => {
  const { tut } = rig();
  const c = base();
  c.dug = 2; tut.update(c); tut.sign();
  c.handedOver = 1; // the plot resets: no objects any more
  assert.equal(tut.update(c).id, 'sell');
  c.sales = 1;
  assert.equal(tut.update(c).id, 'scheme');
  assert.ok(STEPS.some((s) => /Marla/.test(s.title)), 'Marla Quist is the capstone client');
});

test('a full first hour walks every step and logs the four milestones with their targets', () => {
  const { tut, events, at } = rig();
  const c = base();
  assert.equal(tut.update(c).id, 'dig');
  at(20); c.dug = 6; assert.equal(tut.update(c).id, 'airlock');
  c.kinds.add('airlock'); assert.equal(tut.update(c).id, 'bunk');
  at(55); c.kinds.add('bunk'); assert.equal(tut.update(c).id, 'sign');
  at(150); tut.sign(); assert.equal(tut.update(c).id, 'survive');
  c.occupants = 2; c.daysSealed = 12; c.jobs = 5; c.objects = 4; c.kinds.add('tank'); c.kinds.add('shelf'); assert.equal(tut.update(c).id, 'survive');
  c.kinds.add('crank_scrubber'); c.kinds.add('diesel'); assert.equal(tut.update(c).id, 'hookup');
  c.nets.add('air'); c.nets.add('water'); assert.equal(tut.update(c).id, 'hookup');
  c.nets.add('power'); assert.equal(tut.update(c).id, 'build');
  c.jobs = 0; assert.equal(tut.update(c).id, 'handover');
  at(600); c.handedOver = 1; assert.equal(tut.update(c).id, 'sell');
  c.marlaSold = true; c.sales = 1; assert.equal(tut.update(c).id, 'scheme');
  at(1400); c.schemes = 1; assert.equal(tut.update(c), null);
  assert.ok(tut.finished);
  const ms = Object.fromEntries(events.filter((e) => e.type === 'milestone').map((e) => [e.milestone, e]));
  assert.deepEqual(Object.keys(ms).sort(), Object.keys(PACING_TARGETS).sort());
  assert.equal(ms.firstRoom.seconds, 55); assert.equal(ms.firstRoom.met, true);
  assert.equal(ms.firstContract.seconds, 150); assert.equal(ms.firstHandover.target, 720);
  assert.equal(ms.firstScheme.met, true);
  assert.equal(events.filter((e) => e.type === 'tutorial_step').length, STEPS.length);
  assert.ok(events.some((e) => e.type === 'tutorial_done'));
});

test('skipping hides the prompts but milestones are still timed, and a slow room misses its target', () => {
  const { tut, events, at } = rig();
  const c = base();
  tut.update(c);
  tut.skip();
  assert.equal(tut.update(c), null);
  at(90); c.kinds.add('bunk');
  tut.update(c);
  const room = events.find((e) => e.type === 'milestone' && e.milestone === 'firstRoom');
  assert.equal(room.seconds, 90); assert.equal(room.met, false); assert.equal(room.tutorial, false);
  assert.ok(events.some((e) => e.type === 'tutorial_skipped'));
});

test('state and play time survive a save', () => {
  const a = rig(); a.at(100);
  const c = base(); c.dug = 3; a.tut.update(c); a.tut.sign();
  const saved = JSON.parse(JSON.stringify(a.tut.toJSON()));
  assert.equal(saved.elapsed, 100);
  const b = rig({ enabled: true }); b.at(5000);
  b.tut.load(saved);
  b.at(5030);
  assert.equal(Math.round(b.tut.now()), 130, 'play time continues from the save');
  assert.equal(b.tut.update(c).id, 'airlock');
  assert.equal(b.tut.signed, true);
});
