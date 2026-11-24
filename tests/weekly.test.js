import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WeeklyDeck, WEEKLY_CARDS, applyChoice, describeChoice } from '../src/events/weekly.js';

test('the L0 deck has 10 cards with 2-3 choices, including the GDD samples', () => {
  assert.equal(WEEKLY_CARDS.length, 10);
  for (const c of WEEKLY_CARDS) assert.ok(c.choices.length >= 2 && c.choices.length <= 3, c.id);
  const titles = WEEKLY_CARDS.map((c) => c.title);
  assert.ok(titles.includes('Senator Promises a Bunker in Every Backyard'));
  assert.ok(titles.includes('Sourdough Starters Glowing Faintly'));
  assert.equal(new Set(WEEKLY_CARDS.map((c) => c.id)).size, 10);
});

test('exactly one card per week, never a repeat of the last three', () => {
  const deck = new WeeklyDeck({ seed: 5 });
  const drawn = [];
  for (let week = 1; week <= 52; week++) {
    const c = deck.draw(week);
    assert.ok(c, `week ${week} has a card`);
    assert.equal(deck.draw(week), null, 'a second draw in the same week gives nothing');
    drawn.push(c.id);
  }
  for (let i = 3; i < drawn.length; i++) assert.ok(!drawn.slice(i - 3, i).includes(drawn[i]));
  assert.equal(deck.history.length, 52);
  assert.ok(new Set(drawn).size === 10, 'every card turns up in a year');
});

test('applying a choice nudges tension, heat, cash, reputation and research through the hooks', () => {
  const log = [];
  const hooks = {
    addTension: (t, n) => log.push(['tension', t, n]), addHeat: (n) => log.push(['heat', n]),
    addCash: (l, n) => log.push(['cash', n]), addReputation: (n) => log.push(['rep', n]),
    addResearch: (n) => log.push(['rp', n]), note: (t) => log.push(['note', t]),
  };
  const sourdough = WEEKLY_CARDS.find((c) => c.id === 'sourdough_glow');
  applyChoice(sourdough, 'study', hooks);
  assert.deepEqual(log, [['cash', -20_000], ['tension', 'bloom', 2], ['rp', 20]]);
  log.length = 0;
  const honey = WEEKLY_CARDS.find((c) => c.id === 'honeybee_funeral');
  const r = applyChoice(honey, 'futures', hooks);
  assert.deepEqual(log, [['cash', 100_000], ['tension', 'hush', 5], ['heat', 4]]);
  assert.deepEqual(r.applied, ['+$100K', 'hush +5', 'heat +4']);
  log.length = 0;
  applyChoice(WEEKLY_CARDS[0], 'lobby', hooks);
  assert.deepEqual(log.map((x) => x[0]), ['cash', 'heat', 'note']);
});

test('describeChoice names the track and the cost', () => {
  const senator = WEEKLY_CARDS[0];
  assert.deepEqual(describeChoice(senator.choices[0]), ['-$60K', 'heat +2']);
  assert.deepEqual(describeChoice(WEEKLY_CARDS[1].choices[1], () => 'The Bloom'), ['The Bloom +4']);
});

test('save and load keeps the no-repeat memory and the week', () => {
  const a = new WeeklyDeck({ seed: 2 });
  a.draw(1); a.draw(2);
  const b = new WeeklyDeck({ seed: 2 });
  b.load(JSON.parse(JSON.stringify(a)));
  assert.equal(b.draw(2), null);
  assert.deepEqual(b.recent, a.recent);
});
