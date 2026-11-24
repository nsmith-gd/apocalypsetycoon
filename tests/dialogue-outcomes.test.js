import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENDINGS, OUTCOME_RULES, scoreConversation, resolveOutcome, applyOutcome, slipChance } from '../src/dialogue/outcomes.js';
import { LeadInventory } from '../src/leads/leads.js';
import { Pushback } from '../src/pushback/pushback.js';
import { Press } from '../src/pushback/press.js';

const guest = { id: 'g1', name: 'Vera Holt', wealthClass: 'C2', region: 'coastal', fears: ['bloom'], traits: ['vain'], venueId: 'yacht_week' };
const always = () => 0; // every roll succeeds
const never = () => 0.999; // every roll fails

test('every ending type is defined and produces a result', () => {
  for (const ending of Object.keys(ENDINGS)) {
    const r = resolveOutcome({ ending, guest, effects: [], rng: never });
    assert.equal(r.ending, ending);
    assert.equal(!!r.lead, ENDINGS[ending].win, ending);
    assert.ok(r.lines.length >= 1);
  }
  assert.throws(() => resolveOutcome({ ending: 'nope', guest }));
});

test('playing to the guest\'s fear and traits builds trust; the wrong fear costs it', () => {
  const good = scoreConversation(guest, [{ fear: 'bloom' }, { trait: 'vain' }, { fear: 'bloom' }]);
  assert.equal(good.trust, OUTCOME_RULES.startTrust + 2 * OUTCOME_RULES.fearHit + OUTCOME_RULES.traitHit);
  assert.equal(good.fearPlay, 1);
  const bad = scoreConversation(guest, [{ fear: 'atomic' }, { trait: 'frugal' }]);
  assert.ok(bad.trust < OUTCOME_RULES.startTrust);
  assert.equal(bad.fearPlay, 0);
});

test('lead quality scales with trust and with how well you played to their fear', () => {
  const cold = resolveOutcome({ ending: 'sold_fear', guest, effects: [{ trust: -20 }, { fear: 'atomic' }], rng: never });
  const warm = resolveOutcome({ ending: 'sold_fear', guest, effects: [], rng: never });
  const hot = resolveOutcome({ ending: 'sold_fear', guest, effects: [{ trust: 15 }, { fear: 'bloom' }, { fear: 'bloom' }, { trait: 'vain' }], rng: never });
  assert.ok(cold.lead.interest < warm.lead.interest && warm.lead.interest < hot.lead.interest, `${cold.lead.interest} ${warm.lead.interest} ${hot.lead.interest}`);
  assert.ok(hot.lead.interest >= 75, 'playing them perfectly gives a hot lead');
  // the dream pitch rewards traits more than fears
  const dreamTrait = resolveOutcome({ ending: 'sold_dream', guest, effects: [{ trait: 'vain' }, { trait: 'vain' }], rng: never });
  const dreamFear = resolveOutcome({ ending: 'sold_dream', guest, effects: [{ fear: 'bloom' }, { fear: 'bloom' }], rng: never });
  assert.ok(dreamTrait.lead.interest > dreamFear.lead.interest);
});

test('clean wins carry no risk; promises turn into client leverage', () => {
  const r = resolveOutcome({ ending: 'sold_dream', guest, effects: [{ promise: 'gold_taps' }, { promise: 'cryo_pod' }], rng: always });
  assert.equal(r.heat, 0);
  assert.equal(r.reputation, 0);
  assert.equal(r.slips.length, 0);
  assert.equal(r.leverage, 2 * OUTCOME_RULES.promiseLeverage);
});

test('nothing is free: every aggressive ending carries a risk', () => {
  for (const [id, E] of Object.entries(ENDINGS)) {
    if (!E.aggressive) continue;
    const r = resolveOutcome({ ending: id, guest, effects: [{ aggressive: true }], rng: always });
    const risk = r.heat > 0 || r.reputation < 0 || r.leverage > 0 || r.slips.length > 0;
    assert.ok(risk, `${id} should cost something`);
  }
  const hard = resolveOutcome({ ending: 'hard_close', guest, effects: [{ aggressive: true }], rng: always });
  assert.equal(hard.leverage, ENDINGS.hard_close.leverage + OUTCOME_RULES.aggressionLeverage);
  assert.equal(hard.complained, true);
  assert.ok(hard.reputation < 0);
  const tip = resolveOutcome({ ending: 'insider_tip', guest, effects: [], rng: always });
  assert.ok(tip.lead.interest > resolveOutcome({ ending: 'sold_fear', guest, effects: [], rng: never }).lead.interest, 'the insider tip is the strongest pitch');
  assert.equal(tip.slips.length, 1);
  assert.ok(tip.heat > ENDINGS.insider_tip.heat);
});

test('slips are likelier with a reporter in the room and less likely when the guest trusts you', () => {
  const s = scoreConversation(guest, []);
  assert.ok(slipChance(s, { journalistPresent: true }) > slipChance(s, {}));
  const trusted = scoreConversation(guest, [{ trust: 60 }]);
  assert.ok(slipChance(trusted, {}) < slipChance(s, {}));
  const quiet = resolveOutcome({ ending: 'insider_tip', guest, effects: [], rng: never });
  assert.equal(quiet.slips.length, 0, 'a slip can go unnoticed');
  const present = resolveOutcome({ ending: 'insider_tip', guest, effects: [], context: { journalistPresent: true }, rng: always });
  assert.equal(present.slips[0].heard, 'reporter');
  assert.equal(present.slips[0].progress, OUTCOME_RULES.slip.story.present);
});

test('losing endings: polite exit is free, rebuffed costs a pushy player, backfire hurts', () => {
  const exit = resolveOutcome({ ending: 'polite_exit', guest, effects: [{ aggressive: true }], rng: always });
  assert.deepEqual([exit.heat, exit.reputation, exit.leverage], [0, 0, 0]);
  assert.equal(resolveOutcome({ ending: 'rebuffed', guest, effects: [], rng: always }).reputation, 0);
  assert.ok(resolveOutcome({ ending: 'rebuffed', guest, effects: [{ aggressive: true }], rng: always }).reputation < 0);
  const bf = resolveOutcome({ ending: 'backfire', guest, effects: [], rng: always });
  assert.equal(bf.lead, null);
  assert.ok(bf.reputation <= ENDINGS.backfire.reputation && bf.heat >= ENDINGS.backfire.heat);
  assert.equal(bf.slips.length, 1);
});

test('applyOutcome: lead into the pipeline, heat, reputation and a tip-off to the press', () => {
  const leads = new LeadInventory({ getQuarter: () => 2 });
  const pb = new Pushback({});
  const press = new Press({ pushback: pb });
  const heat0 = pb.heat;
  const r = resolveOutcome({ ending: 'insider_tip', guest, effects: [{ fear: 'bloom' }, { learn: 'vain' }, { aggressive: true }], context: { journalistPresent: true }, rng: always });
  const { lead, tipOffs } = applyOutcome(r, { leads, pushback: pb, press, guest, venueId: guest.venueId });
  assert.ok(lead);
  assert.equal(lead.source.ending, 'insider_tip');
  assert.deepEqual(lead.traits, ['vain']);
  assert.equal(lead.leverage, r.leverage);
  assert.equal(leads.open().length, 1);
  assert.equal(pb.heat, heat0 + r.heat);
  assert.equal(tipOffs.length, 1);
  assert.equal(press.journalists.iris.story.progress, OUTCOME_RULES.slip.story.present);
  // backfire: reputation falls
  const rep0 = press.reputation;
  applyOutcome(resolveOutcome({ ending: 'backfire', guest: { ...guest, id: 'g2' }, effects: [], rng: never }), { leads, pushback: pb, press, guest });
  assert.ok(press.reputation < rep0);
});

test('leverage earned in conversation follows the lead into the sale', () => {
  const pb = new Pushback({});
  const c = pb.onSale({ client: 'Vera Holt', price: 1, leverage: 11 });
  assert.equal(c.leverage, pb.cfg.leverage.perSale + 11);
  const leads = new LeadInventory();
  const lead = leads.create({ guest, region: 'coastal', wealthClass: 'C2', quality: 60 });
  lead.leverage = 7;
  assert.equal(leads.asBuyer(lead).leverage, 7);
});
