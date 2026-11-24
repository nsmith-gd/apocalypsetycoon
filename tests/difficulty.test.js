// #92: difficulty settings feed the crisis, heat and board systems.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, DIFFICULTY_ORDER, DEFAULT_DIFFICULTY, difficultySettings } from '../src/config/difficulty.js';
import { CrisisSystem } from '../src/crisis/breach.js';
import { Pushback } from '../src/pushback/pushback.js';
import { Board, quotaFor, BOARD } from '../src/board/board.js';

const crisisWith = (id, seed) => new CrisisSystem({ seed, config: difficultySettings(id).crisis });

test('the three settings match the GDD table and Founder is the default', () => {
  assert.equal(DEFAULT_DIFFICULTY, 'founder');
  assert.deepEqual(DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id].tipRange), [[86, 94], [82, 94], [78, 92]]);
  assert.deepEqual(DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id].brinkDrift), [1, 1.5, 2]);
  assert.deepEqual(DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id].heatDecayPerWeek), [2, 1, 0.5]);
  assert.deepEqual(DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id].quotaGrowth), [0.2, 0.3, 0.35]);
  assert.equal(difficultySettings('nonsense').id, 'founder');
});

test('each setting gives its own tipping-point range: rolled tips and the range the player sees', () => {
  for (const id of DIFFICULTY_ORDER) {
    const [lo, hi] = DIFFICULTIES[id].tipRange;
    const rolls = [];
    for (let seed = 1; seed <= 40; seed++) for (const t of Object.values(crisisWith(id, seed).tracks)) rolls.push(t.tipRolled);
    assert.ok(Math.min(...rolls) >= lo && Math.max(...rolls) <= hi, `${id}: ${Math.min(...rolls)}-${Math.max(...rolls)}`);
    assert.ok(Math.min(...rolls) <= lo + 1 && Math.max(...rolls) >= hi - 1, `${id} uses its whole range`);
    const c = crisisWith(id, 3);
    assert.deepEqual(c.visibleTip(Object.keys(c.tracks)[0]).range, [lo, hi]);
  }
});

test('quota growth differs by setting', () => {
  const q3 = DIFFICULTY_ORDER.map((id) => new Board({ config: difficultySettings(id).board }).cfg.quotaGrowth);
  assert.deepEqual(q3, [0.2, 0.3, 0.35]);
  const quotas = DIFFICULTY_ORDER.map((id) => quotaFor(5, { ...BOARD, ...difficultySettings(id).board }));
  assert.ok(quotas[0] < quotas[1] && quotas[1] < quotas[2], String(quotas));
  assert.equal(quotas[1], quotaFor(5, { ...BOARD, quotaGrowth: 0.3 }));
});

test('Brink drift pushes a track at its Brink each week, harder on harder settings', () => {
  const gains = DIFFICULTY_ORDER.map((id) => {
    const c = new CrisisSystem({ seed: 1, tips: { pandemic: 90 }, config: difficultySettings(id).crisis });
    c.setTension('pandemic', 81);
    assert.equal(c.tracks.pandemic.state, 'brink');
    c.advanceWeek();
    return Math.round((c.tracks.pandemic.tension - 81) * 10) / 10;
  });
  assert.deepEqual(gains, [1, 1.5, 2]);
  const calm = new CrisisSystem({ seed: 1, tips: { pandemic: 90 }, config: difficultySettings('founder').crisis });
  calm.setTension('pandemic', 40);
  calm.advanceWeek();
  assert.equal(calm.tracks.pandemic.tension, 40, 'no drift below the Brink');
});

test('heat cools weekly by setting', () => {
  const after = DIFFICULTY_ORDER.map((id) => {
    const pb = new Pushback({ config: { heat: difficultySettings(id).pushback.heat } });
    pb.heat = 50;
    for (let i = 0; i < 4; i++) pb.weekTick();
    return pb.heat;
  });
  assert.deepEqual(after, [42, 46, 48]);
});
