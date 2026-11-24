import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DialogueRunner, runHeadless, validateDialogue, compare } from '../src/dialogue/engine.js';
import { parseScript, parseCondition, parseEffects } from '../src/dialogue/script.js';
import { TREES } from '../src/dialogue/trees/index.js';
import { ENDINGS, resolveOutcome } from '../src/dialogue/outcomes.js';
import { TRACKS } from '../src/world/tracks.js';
import { mulberry32 } from '../src/pushback/pushback.js';

const ENDING_IDS = Object.keys(ENDINGS);
const script = () => parseScript(readFileSync(new URL('../data/dialogue/example.dlg', import.meta.url), 'utf8'));
const guest = (o = {}) => ({ name: 'Kip Quill', archetype: 'crypto_founder', wealthClass: 'C2', traits: ['vain'], hiddenTraits: [], fears: ['optimizer'], dominantFear: 'optimizer', ...o });

test('the example script compiles to a valid tree', () => {
  const t = script();
  assert.equal(t.id, 'crypto_tokens');
  assert.equal(t.start, 'hello');
  assert.deepEqual(validateDialogue(t, { endings: ENDING_IDS }), []);
  assert.deepEqual(t.nodes.hello.choices[2].when, { any: [{ trait: 'paranoid' }, { heat: { lt: 30 } }] });
  assert.deepEqual(t.nodes.keys.choices[0].effects, { promise: 'wine_cellar', trust: 5 });
  assert.equal(t.nodes.keys.choices[1].once, true);
  assert.equal(t.nodes.win.ending, 'sold_dream');
});

test('runs headlessly from start to an end node; different choices branch to different endings', () => {
  const t = script();
  const a = runHeadless(t, { guest: guest(), pick: [0, 1, 1] });
  assert.deepEqual(a.path, ['hello', 'keys', 'air', 'win_fear']);
  assert.equal(a.ending, 'sold_fear');
  const b = runHeadless(t, { guest: guest(), pick: [3] });
  assert.equal(b.ending, 'rebuffed');
  // results feed the #55 outcome rules unchanged
  const out = resolveOutcome({ ending: a.ending, guest: guest(), effects: a.effects, context: {}, rng: () => 0.99 });
  assert.ok(out.lead);
});

test('conditions gate choices: traits, reputation, heat, crisis level and variables', () => {
  const t = script();
  const offered = (g, context) => new DialogueRunner(t, { guest: g, context }).choices.map((c) => c.index);
  assert.deepEqual(offered(guest(), { reputation: 0, heat: 50 }), [0, 3]);
  assert.deepEqual(offered(guest(), { reputation: 40, heat: 50 }), [0, 1, 3], 'reputation 40 opens the trust line');
  assert.deepEqual(offered(guest(), { reputation: 0, heat: 10 }), [0, 2, 3], 'low heat opens the cash line');
  assert.deepEqual(offered(guest({ traits: ['paranoid'] }), { heat: 90 }), [0, 2, 3], 'or a paranoid guest');
  // var gate: trust >= 10 only after building trust
  const r = new DialogueRunner(t, { guest: guest(), context: { reputation: 0 } });
  r.choose(0); // trust +5
  assert.ok(!r.choices.some((c) => c.index === 0), 'trust 5 is not enough for the vault promise');
  assert.throws(() => r.choose(0), /not on offer/);
  const r2 = new DialogueRunner(t, { guest: guest(), context: { reputation: 40 } });
  r2.choose(1); // trust +10
  assert.ok(r2.choices.some((c) => c.index === 0));
  // crisis gate reads the guest's fear by default, and live values through functions
  let tension = 20;
  const r3 = new DialogueRunner(t, { guest: guest(), context: { tension: () => ({ optimizer: tension }) } });
  r3.choose(0);
  assert.ok(!r3.choices.some((c) => c.index === 2));
  tension = 50;
  assert.ok(r3.choices.some((c) => c.index === 2));
  // alt text by condition
  assert.match(new DialogueRunner(t, { guest: guest(), context: { tension: { optimizer: 80 } } }).text, /Be quick/);
  assert.match(new DialogueRunner(t, { guest: guest(), context: {} }).text, /^Kip Quill jingles/);
});

test('every effect reaches the game through one sink; local ones change the conversation', () => {
  const t = script();
  const seen = [];
  const world = { heat: 10, reputation: 50 };
  const onEffect = (e) => { seen.push(e); if (e.heat) world.heat += e.heat; if (e.reputation) world.reputation += e.reputation; };
  const run = new DialogueRunner(t, { guest: guest(), context: { heat: () => world.heat }, onEffect });
  run.choose(2); // cash: flag + onEnter heat +1
  assert.equal(world.heat, 11);
  assert.ok(run.flags.has('cash_deal'));
  run.choose(0); // slip
  const res = run.result();
  assert.equal(res.ending, 'insider_tip');
  assert.deepEqual(seen.map((e) => Object.keys(e).join()), ['flag', 'heat', 'slip']);
  assert.deepEqual(res.effects, seen);
  assert.deepEqual(res.flags, ['cash_deal']);
});

test('once-only choices disappear after use, learned traits count for later conditions', () => {
  const t = script();
  const run = new DialogueRunner(t, { guest: guest(), context: {} });
  run.choose(0); // keys
  run.choose(1); // air (once)
  run.choose(0); // back to keys
  assert.ok(!run.choices.some((c) => c.index === 1), 'the air question was already asked');
  const r2 = new DialogueRunner(t, { guest: guest(), context: {} });
  r2.choose(0); r2.choose(1); r2.choose(1); // learn paranoid
  assert.ok(r2.traits().has('paranoid'));
  assert.equal(r2.result().effects.at(-1).fear, 'optimizer', '$guest resolves to the guest’s fear');
});

test('all authored archetype trees validate and run through the engine to an ending', () => {
  for (const tree of TREES) {
    assert.deepEqual(validateDialogue(tree, { endings: ENDING_IDS, tracks: TRACKS.map((t) => t.id) }), [], tree.id);
    const endings = new Set();
    for (let seed = 1; seed <= 40; seed++) {
      const rng = mulberry32(seed);
      const res = runHeadless(tree, { guest: guest({ archetype: tree.archetype }), pick: (choices) => choices[Math.floor(rng() * choices.length)].index });
      assert.ok(ENDING_IDS.includes(res.ending));
      endings.add(res.ending);
    }
    assert.ok(endings.size >= 2, `${tree.id} branches`);
  }
});

test('the validator catches broken trees', () => {
  const t = script();
  const broken = structuredClone(t);
  broken.nodes.keys.choices[1].next = 'nowhere';
  broken.nodes.orphan = { speaker: 'guest', text: 'hi', choices: [{ text: 'x', next: 'win' }] };
  broken.nodes.loop1 = { speaker: 'guest', text: 'a', choices: [{ text: 'x', next: 'loop2' }] };
  broken.nodes.loop2 = { speaker: 'guest', text: 'b', choices: [{ text: 'y', next: 'loop1' }] };
  broken.nodes.hello.choices.push({ text: 'z', next: 'loop1', when: { mood: 'happy' }, effects: { gold: 5 } });
  broken.nodes.air.choices.forEach((c) => { c.when = { heat: 10 }; });
  broken.nodes.win.ending = 'tea_party';
  const errs = validateDialogue(broken, { endings: ENDING_IDS }).join('\n');
  for (const s of ['next "nowhere" missing', 'orphan: unreachable', 'loop1: no ending can be reached', 'unknown condition "mood"', 'unknown effect "gold"', 'every choice is gated', 'unknown ending "tea_party"']) assert.match(errs, new RegExp(s), s);
});

test('script parser: conditions, effects and line-numbered errors', () => {
  assert.deepEqual(parseCondition('trait vain, rep>=40, !flag met'), { all: [{ trait: 'vain' }, { reputation: { gte: 40 } }, { notFlag: 'met' }] });
  assert.deepEqual(parseCondition('crisis atomic>45'), { crisis: { track: 'atomic', gt: 45 } });
  assert.deepEqual(parseCondition('band boil'), { band: 'boil' });
  assert.deepEqual(parseEffects('trust -4, heat +2, set mood=3, flag a, flag b, aggressive'), { trust: -4, heat: 2, set: { mood: 3 }, flag: ['a', 'b'], aggressive: true });
  assert.throws(() => parseScript('tree x\n= a guest\nhi\n* go nowhere'), /line 4/);
  assert.throws(() => parseScript('tree x\n= a guest\nhi\n* [mood happy] ok -> a'), /line 4: unknown condition "mood"/);
  assert.equal(compare(5, { gt: 4, lt: 6 }), true);
  assert.equal(compare(5, 6), false);
});
