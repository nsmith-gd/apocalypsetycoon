import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StoryBeats, STORY_BEATS } from '../src/story/beats.js';

test('the two seed beats fire once, at 0:25 and 1:00', () => {
  const s = new StoryBeats();
  assert.deepEqual(s.due({ minutes: 24 }), []);
  assert.deepEqual(s.due({ minutes: 25 }).map((b) => b.id), ['first_board_meeting']);
  assert.deepEqual(s.due({ minutes: 59 }), []);
  assert.deepEqual(s.due({ minutes: 61 }).map((b) => b.id), ['iris_calls']);
  assert.deepEqual(s.due({ minutes: 200 }), []);
  assert.ok(STORY_BEATS[0].lines.some((l) => l.includes("Calm worlds don't buy bunkers")));
});

test('beats can be keyed to conditions; fired beats survive a save', () => {
  const s = new StoryBeats({ beats: [...STORY_BEATS, { id: 'first_breach', when: (c) => c.breaches > 0, title: 'x', lines: [] }] });
  assert.deepEqual(s.due({ minutes: 0, breaches: 0 }), []);
  assert.deepEqual(s.due({ minutes: 0, breaches: 1 }).map((b) => b.id), ['first_breach']);
  const t = new StoryBeats({ beats: s.beats });
  t.load(JSON.parse(JSON.stringify(s.toJSON())));
  assert.deepEqual(t.due({ minutes: 100, breaches: 1 }).map((b) => b.id), ['first_board_meeting', 'iris_calls'], 'the breach beat stays fired after loading');
});
