import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CrisisSystem } from '../src/crisis/breach.js';
import { FirstBreachNudge, firstBreachTarget, FIRST_BREACH } from '../src/crisis/first-breach.js';
import { simulateFirstBreach, firstBreachHarness, WEEK_MINUTES } from '../src/debug/breach-sim.js';
import { applyChoice } from '../src/events/weekly.js';
import { TRACK_BY_ID } from '../src/world/tracks.js';

const ids = ['atomic', 'bloom', 'superstorm'];
const crisis = (tension) => {
  const c = new CrisisSystem({ seed: 2, tips: { atomic: 88, bloom: 88, superstorm: 88 }, tracks: ids.map((id) => ({ id, name: TRACK_BY_ID[id].name, open: true })) });
  for (const [id, v] of Object.entries(tension)) c.setTension(id, v);
  return c;
};

test('nothing before 2:30; at 2:30 a wildcard pushes the hottest Brink track over its tipping point', () => {
  let m = 149;
  const c = crisis({ atomic: 50, bloom: 79, superstorm: 60 });
  const n = new FirstBreachNudge({ crisis: c, minutes: () => m });
  assert.equal(n.check(), null);
  m = FIRST_BREACH.atMinutes;
  const card = n.check();
  assert.equal(card.type, 'wildcard');
  assert.equal(card.track, 'bloom');
  assert.equal(card.choices.length, 1);
  // played through the weekly-card hooks, as the campaign does
  applyChoice(card, 'brace', { addTension: (track, k, why) => c.addTension(track, k, why) });
  assert.equal(c.tracks.bloom.state, 'breach');
  assert.equal(c.tracks.bloom.window.total, 6); // a first breach: the generous window
  assert.equal(n.check(), null, 'only once per campaign');
});

test('a player who breached on their own never sees the wildcard', () => {
  let m = 100;
  const c = crisis({ atomic: 50 });
  const n = new FirstBreachNudge({ crisis: c, minutes: () => m });
  c.setTension('atomic', 95);
  n.check();
  m = 200;
  assert.equal(n.check(), null);
  assert.equal(n.natural, 100);
});

test('with no track at the Brink the hottest breachable track goes; breached or locked tracks are skipped', () => {
  const c = crisis({ atomic: 30, bloom: 45, superstorm: 20 });
  assert.equal(firstBreachTarget(c).id, 'bloom');
  c.tracks.bloom.state = 'locked';
  assert.equal(firstBreachTarget(c).id, 'atomic');
});

test('save and load keep it from firing twice', () => {
  const c = crisis({ bloom: 75 });
  const n = new FirstBreachNudge({ crisis: c, minutes: () => 160 });
  n.check();
  const back = new FirstBreachNudge({ crisis: crisis({ bloom: 75 }), minutes: () => 170 });
  back.load(JSON.parse(JSON.stringify(n)));
  assert.equal(back.check(), null);
});

test('cautious-bot harness: without the nudge a cautious player never breaches; with it, the first breach lands by 2:30', () => {
  for (const seed of [1, 2, 3]) {
    assert.equal(simulateFirstBreach({ bot: 'cautious', seed, nudge: false }).firstBreach, null);
    const r = simulateFirstBreach({ bot: 'cautious', seed });
    assert.equal(r.firstBreach.how, 'wildcard');
    assert.ok(r.firstBreach.minute >= FIRST_BREACH.atMinutes && r.firstBreach.minute <= FIRST_BREACH.atMinutes + WEEK_MINUTES, String(r.firstBreach.minute));
  }
  const h = firstBreachHarness({ seeds: [1, 2, 3, 4, 5] });
  assert.equal(h.checks.everyRunBreachesByDeadline, true);
  // With the real scheme list (#79), a natural edge-runner breach before the wildcard is rarer: check more seeds.
  const edge = firstBreachHarness({ bots: ['edge'], seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] });
  assert.ok(edge.runs.some((r) => r.firstBreach.how === 'natural'), 'an edge runner can still get there first');
});
