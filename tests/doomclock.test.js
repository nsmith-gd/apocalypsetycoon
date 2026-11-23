import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DoomClock } from '../src/doomclock/doomclock.js';

test('starts at 15 minutes to Midnight', () => {
  const c = new DoomClock();
  assert.equal(c.minutes, 15);
  assert.equal(c.floor, 15);
  assert.equal(c.timeString, '11:45');
});

test('M = min(F, 15 - sum(tension)/40)', () => {
  const c = new DoomClock();
  c.setTensions({ pandemic: 60, unrest: 100 }); // 160 / 40 = 4
  assert.equal(c.minutes, 11);
  c.floor = 9;
  assert.equal(c.minutes, 9); // floor is lower, so it wins
});

test('the floor only moves toward Midnight: tension falling does not wind the clock back past it', () => {
  const c = new DoomClock();
  c.collapse('pandemic'); // floor 11
  c.setTensions({ pandemic: 0, unrest: 0 });
  assert.equal(c.minutes, 11);
  c.setTensions({ unrest: 200 / 2 }); // 15 - 2.5 = 12.5, still above the floor
  assert.equal(c.minutes, 11);
});

test('floor drops: 0.25 first Brink per track, 0.5 per chapter, 1 per contained breach, 4 per collapse', () => {
  const c = new DoomClock();
  assert.equal(c.brink('unrest'), true);
  assert.equal(c.floor, 14.75);
  assert.equal(c.brink('unrest'), false); // only the first entry counts
  assert.equal(c.floor, 14.75);
  c.brink('climate');
  assert.equal(c.floor, 14.5);
  c.chapterStart(2);
  c.chapterStart(2); // the same chapter twice counts once
  assert.equal(c.floor, 14);
  c.breachContained('unrest');
  assert.equal(c.floor, 13);
  c.collapse('climate');
  assert.equal(c.floor, 9);
  assert.deepEqual(c.history.map((h) => h.reason), ['brink', 'brink', 'chapter', 'breachContained', 'collapse']);
});

test('fragility: every floor minute lowers tipping points by 1, never below 72', () => {
  const c = new DoomClock();
  assert.equal(c.tippingPoint(90), 90);
  c.breachContained('x'); // floor 14
  assert.equal(c.tippingPoint(90), 89);
  c.collapse('a'); // floor 10
  assert.equal(c.tippingPoint(90), 85);
  c.floor = 2; // 13 minutes lost
  assert.equal(c.tippingPoint(90), 77);
  c.floor = 0.5;
  assert.equal(c.tippingPoint(90), 75.5);
  assert.equal(c.tippingPoint(80), 72); // clamped
});

test('auto Brink detection uses the fragile tipping point', () => {
  const c = new DoomClock();
  c.setTensions({ unrest: 79 }, { tips: { unrest: 90 } });
  assert.equal(c.brinked.has('unrest'), false); // brink at 80
  c.setTensions({ unrest: 80 }, { tips: { unrest: 90 } });
  assert.equal(c.brinked.has('unrest'), true);
  assert.equal(c.floor, 14.75);
});

test('second collapse starts the Final Countdown; Midnight 4 weeks later, uncontrolled', () => {
  const c = new DoomClock();
  const seen = [];
  c.on('countdown', (e) => seen.push(e.weeks));
  c.on('midnight', (e) => seen.push(e.reason));
  c.collapse('a');
  assert.equal(c.finalCountdown, false);
  c.collapse('b'); // floor 7
  assert.equal(c.finalCountdown, true);
  assert.equal(c.countdownWeeks, 4);
  c.advanceWeeks(3);
  assert.equal(c.midnight, null);
  c.advanceWeeks(1);
  assert.deepEqual(c.midnight, { reason: 'countdown', week: 4, uncontrolled: true });
  assert.deepEqual(seen, [4, 3, 2, 1, 0, 'countdown']);
});

test('Midnight strikes, uncontrolled, the moment M reaches 0', () => {
  const c = new DoomClock();
  let hit = null;
  c.on('midnight', (e) => { hit = e; });
  c.setTensions({ a: 100, b: 100, c: 100, d: 100, e: 100, f: 100 }); // 600/40 = 15
  assert.equal(c.minutes, 0);
  assert.equal(hit.reason, 'clock');
  assert.equal(hit.uncontrolled, true);
  c.setTensions({ a: 0 }); // too late
  assert.equal(c.minutes, 0);
});

test('save and load', () => {
  const c = new DoomClock();
  c.brink('x');
  c.collapse('y');
  c.setTensions({ x: 70 });
  const back = DoomClock.fromJSON(JSON.parse(JSON.stringify(c)));
  assert.deepEqual(back.snapshot(), c.snapshot());
  assert.equal(back.brink('x'), false);
});

test('pushback bridge: world tension feeds the clock and a runaway is a contained breach', async () => {
  const { attachPushback } = await import('../src/doomclock/doomclock.js');
  const { Pushback } = await import('../src/pushback/pushback.js');
  const pb = new Pushback({ startingCash: 1e6 });
  const c = new DoomClock();
  attachPushback(c, pb);
  pb.onScheme({ label: 'x', tension: 40 }); // 20 + 40 = 60
  assert.equal(c.tensions.world, 60);
  assert.equal(c.minutes, 13.5);
  pb.onScheme({ label: 'y', tension: 50 }); // runaway, reset to 70
  assert.equal(c.breachesContained, 1);
  assert.equal(c.floor, 13.75); // brink -0.25, breach -1
});
