import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CrisisSystem } from '../src/crisis/breach.js';
import { TRACK_BY_ID, CLASSIC_ROSTER } from '../src/world/tracks.js';
import { worldState, conditionHolds, crisisPitch, suspicionOf, QUIET_WORLD, CRISIS_TALK } from '../src/dialogue/world-state.js';
import { Conversation, validateTree } from '../src/dialogue/trees.js';
import { TREES } from '../src/dialogue/trees/index.js';
import { resolveOutcome, slipChance } from '../src/dialogue/outcomes.js';
import { createTreeDialogue } from '../src/social/tree-dialogue.js';
import { moodLine } from '../src/social/viewmodel.js';

// A live crisis system over the classic roster, every track open, with hand-set tension.
function liveCrisis(tension = {}) {
  const crisis = new CrisisSystem({ seed: 3, tips: Object.fromEntries(CLASSIC_ROSTER.map((id) => [id, 90])), tracks: CLASSIC_ROSTER.map((id) => ({ id, name: TRACK_BY_ID[id].name, open: true })) });
  for (const [id, v] of Object.entries(tension)) crisis.setTension(id, v, 'test');
  return crisis;
}
// The scheme board only needs a log and trackOf for dialogue.
const schemeLog = (runs) => ({ log: runs, trackOf: (s) => ({ id: { memo: 'bloom', podcast: 'superstorm', deepfake: 'atomic' }[s.id] }) });
const guest = (over = {}) => ({ id: 'g7', name: 'Dex Halloran', wealthClass: 'C2', fears: ['bloom'], archetype: 'prepper', ...over });
const tree = (id) => TREES.find((t) => t.id === id);

test('worldState reads live crisis levels, the crisis log as headlines and the player\'s schemes', () => {
  const crisis = liveCrisis({ bloom: 50, atomic: 75 });
  crisis.week = 5;
  crisis.setTension('superstorm', 100, 'test'); // past its tip: breach, which makes the papers
  const w = worldState({ crisis, schemes: schemeLog([{ week: 4, scheme: 'memo', region: 'eur' }]) });
  assert.equal(w.week, 5);
  assert.equal(w.tracks.bloom.band, 'boil');
  assert.equal(w.tracks.atomic.band, 'brink');
  assert.equal(w.tracks.superstorm.state, 'breach');
  assert.ok(w.headlines.some((h) => h.track === 'superstorm' && h.type === 'breach' && /BREACHES/.test(h.text)));
  assert.ok(w.headlines.some((h) => h.track === 'bloom' && h.type === 'scheme'), 'the press covers the leaked memo');
  assert.deepEqual(w.schemes.map((s) => [s.scheme, s.track]), [['memo', 'bloom']]);
  assert.equal(worldState({}), QUIET_WORLD);
});

test('conditions read the guest\'s fear in the live world', () => {
  const g = guest();
  const calm = worldState({ crisis: liveCrisis({ bloom: 5 }) });
  const hot = worldState({ crisis: liveCrisis({ bloom: 72 }) });
  assert.equal(conditionHolds({ band: 'boil' }, g, calm), false);
  assert.equal(conditionHolds({ band: 'boil' }, g, hot), true);
  assert.equal(conditionHolds({ bandBelow: 'simmer' }, g, calm), true);
  assert.equal(conditionHolds({ bandBelow: 'simmer' }, g, hot), false);
  assert.equal(conditionHolds({ band: 'brink', track: 'atomic' }, g, hot), false);
  assert.equal(conditionHolds({ headline: true }, g, hot), false);
  assert.equal(conditionHolds({ schemed: true }, g, hot), false);
  const crisis = liveCrisis({ bloom: 60 });
  crisis.week = 3;
  const schemed = worldState({ crisis, schemes: schemeLog([{ week: 3, scheme: 'memo', region: 'eur' }]) });
  assert.equal(conditionHolds({ schemed: true }, g, schemed), true);
  assert.equal(conditionHolds({ headline: true }, g, schemed), true);
  assert.equal(conditionHolds({ suspicious: true }, g, schemed), true);
  assert.equal(conditionHolds({ suspicious: false }, g, schemed), false);
});

test('high crisis makes a guest easier to sell; the same pitch in a calm world is worth less', () => {
  const g = { ...guest(), traits: ['practical'] };
  const effects = [{ trait: 'practical' }, { trust: 10, promise: 'mil_scrubber', learn: 'practical' }];
  const calm = resolveOutcome({ ending: 'sold_fear', guest: g, effects, context: { world: worldState({ crisis: liveCrisis({ bloom: 5 }) }) }, rng: () => 0.99 });
  const brink = resolveOutcome({ ending: 'sold_fear', guest: g, effects, context: { world: worldState({ crisis: liveCrisis({ bloom: 80 }) }) }, rng: () => 0.99 });
  assert.ok(brink.score.trust > calm.score.trust);
  assert.ok(brink.lead.interest >= calm.lead.interest + CRISIS_TALK.interestPerPressure);
  assert.ok(brink.lines.some((l) => /came ready to buy/.test(l)));
  // no world, no change: older callers keep their numbers
  const none = resolveOutcome({ ending: 'sold_fear', guest: g, effects, rng: () => 0.99 });
  assert.equal(none.crisis, null);
  assert.equal(none.lead.interest, calm.lead.interest);
});

test('too-convenient timing: schemes on the guest\'s fear just before the party raise suspicion', () => {
  const crisis = liveCrisis({ bloom: 60 });
  crisis.week = 10;
  const fresh = worldState({ crisis, schemes: schemeLog([{ week: 10, scheme: 'memo' }, { week: 9, scheme: 'memo' }]) });
  const old = worldState({ crisis, schemes: schemeLog([{ week: 1, scheme: 'memo' }]) });
  const elsewhere = worldState({ crisis, schemes: schemeLog([{ week: 10, scheme: 'deepfake' }]) });
  const g = guest({ traits: ['practical'] });
  assert.ok(suspicionOf(g, fresh) >= CRISIS_TALK.suspicious);
  assert.equal(suspicionOf(g, old), 0);
  assert.equal(suspicionOf(g, elsewhere), 0);
  assert.ok(suspicionOf({ ...g, traits: ['skeptic'] }, worldState({ crisis, schemes: schemeLog([{ week: 9, scheme: 'memo' }]) })) > suspicionOf(g, worldState({ crisis, schemes: schemeLog([{ week: 9, scheme: 'memo' }]) })));
  const effects = [{ slip: true }];
  const clean = resolveOutcome({ ending: 'insider_tip', guest: g, effects, context: { world: old }, rng: () => 0.99 });
  const caught = resolveOutcome({ ending: 'insider_tip', guest: g, effects, context: { world: fresh }, rng: () => 0.99 });
  assert.ok(caught.score.trust < clean.score.trust, 'suspicion costs trust');
  assert.ok(caught.slipChance > clean.slipChance, 'and makes slips likelier');
  assert.ok(caught.slipChance > slipChance(caught.score));
  assert.ok(caught.lines.some((l) => /well-timed/.test(l)));
  assert.ok(crisisPitch(g, fresh).trustPenalty > 0);
});

test('at least five trees branch on the state of the world, and still validate', () => {
  const live = TREES.filter((t) => Object.values(t.nodes).some((n) => n.alt?.length || n.choices?.some((c) => c.when)));
  assert.ok(live.length >= 5, `${live.length} crisis-aware trees`);
  for (const t of live) assert.deepEqual(validateTree(t), []);
  assert.ok(validateTree({ ...tree('prepper_jerky'), nodes: { ...tree('prepper_jerky').nodes, open: { ...tree('prepper_jerky').nodes.open, choices: [{ when: { band: 'boil' }, text: 'x', next: 'won_fear' }] } } }).some((b) => /every choice is conditional/.test(b)));
  assert.ok(validateTree({ ...tree('prepper_jerky'), nodes: { ...tree('prepper_jerky').nodes, won_fear: tree('prepper_jerky').nodes.won_fear, open: { ...tree('prepper_jerky').nodes.open, alt: [{ when: { moon: 'full' }, text: 'x' }] } } }).some((b) => /unknown condition "moon"/.test(b)));
});

test('the prepper sees the news: a boiling fear changes the opening line and adds a choice', () => {
  const g = guest();
  const calm = new Conversation({ guest: g, tree: tree('prepper_jerky'), world: worldState({ crisis: liveCrisis({ bloom: 5 }) }) });
  const hot = new Conversation({ guest: g, tree: tree('prepper_jerky'), world: worldState({ crisis: liveCrisis({ bloom: 55 }) }) });
  assert.match(calm.text, /paper plate of jerky/);
  assert.match(hot.text, /The Bloom is boiling over/);
  assert.equal(calm.choices.length, 3);
  assert.equal(hot.choices.length, 4);
  const live = hot.choices.find((c) => c.live);
  assert.match(live.text, /crews digging/);
  assert.throws(() => calm.choose(live.index), /isn't on offer/);
  hot.choose(live.index);
  assert.equal(hot.done, true);
  assert.ok(hot.finish().lead.interest > 0);
});

test('a suspicious guest calls out the timing, using the latest headline', () => {
  const crisis = liveCrisis({ bloom: 50 });
  crisis.week = 6;
  const world = worldState({ crisis, schemes: schemeLog([{ week: 6, scheme: 'memo', region: 'eur' }]) });
  const conv = new Conversation({ guest: guest(), tree: tree('prepper_jerky'), world });
  assert.match(conv.text, /A LAB, A SNEEZE, A PDF/);
  assert.match(conv.text, /already at the party/);
  const hf = new Conversation({ guest: guest({ archetype: 'hedge_fund' }), tree: tree('hedge_fund_shortposition'), world });
  assert.match(hf.text, /correlation/);
  assert.ok(hf.choices.some((c) => c.live && /Correlation isn't causation/.test(c.text)));
});

test('a breach opens branches for the dowager, the general and the pharma executive', () => {
  const crisis = liveCrisis();
  crisis.setTension('bloom', 100, 'test');
  const world = worldState({ crisis });
  const of = (a) => TREES.find((t) => t.archetype === a);
  assert.match(new Conversation({ guest: guest({ archetype: 'dowager' }), tree: of('dowager'), world }).text, /In breach, they say/);
  assert.match(new Conversation({ guest: guest({ archetype: 'general', fears: ['atomic'] }), tree: of('general'), world }).text, /breach on/);
  const ph = new Conversation({ guest: guest({ archetype: 'pharma' }), tree: of('pharma'), world });
  assert.match(ph.text, /BREACHES/);
  ph.choose(1); // to the models node
  assert.ok(ph.choices.some((c) => c.live && /already in breach/.test(c.text)));
});

test('the social layer passes the live world through: NEWS choices and a mood line', () => {
  const world = worldState({ crisis: liveCrisis({ bloom: 75 }) });
  const g = guest();
  const session = createTreeDialogue(g, { rng: () => 0.5, world });
  assert.equal(session.world, world);
  const n = session.node();
  assert.ok(n.choices.some((c) => c.live));
  assert.match(moodLine(session.guest, world), /The Bloom is on the brink: they are rattled/);
  assert.equal(moodLine(session.guest, worldState({ crisis: liveCrisis({ bloom: 0 }) })), null);
});
