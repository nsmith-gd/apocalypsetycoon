// #130: lighting and atmosphere moods.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moodOf, gradeAt, PRESETS, MOODS, LIGHT_SOURCES } from '../src/art/atmosphere.js';
import { settings } from '../src/settings/settings.js';

test('three presets that can be forced, from calm luxury to runaway dread', () => {
  assert.deepEqual(MOODS, ['calm', 'edge', 'runaway']);
  for (const m of MOODS) assert.equal(moodOf({ force: m }).name, m);
  const [c, e, r] = MOODS.map((m) => moodOf({ force: m }).grade);
  for (const k of ['dark', 'vignette', 'desat']) assert.ok(c[k] < e[k] && e[k] < r[k], k);
  assert.ok(c.glow > r.glow, 'luxury glows dim as dread rises');
  assert.deepEqual(gradeAt(0), PRESETS.calm);
});

test('the mood follows tension, and Midnight drags it toward dread', () => {
  assert.equal(moodOf({ tension: 10, minutes: 15 }).name, 'calm');
  assert.equal(moodOf({ tension: 60, minutes: 15 }).name, 'edge');
  assert.equal(moodOf({ tension: 92, minutes: 15 }).name, 'runaway');
  assert.ok(moodOf({ tension: 10, minutes: 1 }).dread > moodOf({ tension: 10, minutes: 14 }).dread);
});

test('gold taps and cryo pods glow; Reduced lighting is a setting', () => {
  assert.ok(LIGHT_SOURCES.gold_taps && LIGHT_SOURCES.cryo_pod);
  assert.equal(settings.get('reducedLighting'), false);
});
