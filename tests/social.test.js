import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadVenueCatalog } from '../src/events/venues.js';
import { EventCircuit } from '../src/events/attend.js';
import { LeadInventory } from '../src/leads/leads.js';
import { Ledger } from '../src/ledger/ledger.js';
import { SocialSession, choiceTags } from '../src/social/viewmodel.js';
import { createStubDialogue, PLACEHOLDER_TREE } from '../src/social/dialogue-stub.js';
import { ENDINGS } from '../src/dialogue/outcomes.js';

async function setup({ stub = true } = {}) {
  const catalog = await loadVenueCatalog();
  const ledger = new Ledger({ startingCash: 5_000_000 });
  let heat = 0, rep = 40;
  const held = new Set();
  const clock = { hold: (w) => held.add(w), release: (w) => held.delete(w) };
  const circuit = new EventCircuit({ catalog, ledger, seed: 7, clock });
  const leads = new LeadInventory({ getQuarter: () => 1 });
  const social = new SocialSession({ circuit, leads, getQuarter: () => 1, addHeat: (n) => { heat += n; }, addReputation: (n) => { rep += n; }, rng: () => 0.99, ...(stub ? { dialogueFactory: (g) => createStubDialogue(g) } : {}) });
  return { social, circuit, leads, ledger, held, get heat() { return heat; }, get rep() { return rep; } };
}

test('a full text-only social session: event list -> guests -> dialogue -> result -> summary', async () => {
  const s = await setup();
  const { social } = s;
  assert.equal(social.screen, 'events');
  const ev = social.eventsView();
  const open = ev.events.find((e) => e.canAttend);
  assert.ok(open, 'at least one Q1 event is open');
  assert.ok(ev.events.every((e) => e.canAttend || e.reason));

  social.attend(open.id);
  assert.equal(social.screen, 'guests');
  assert.ok(s.held.has('event'), 'the clock holds while at the event');
  const gv = social.guestsView();
  assert.ok(gv.guests.length >= 1);
  const guest = gv.guests[0];
  assert.equal(guest.status, 'new');

  let d = social.talk(guest.id);
  assert.equal(social.screen, 'dialogue');
  assert.ok(d.line.text.includes(guest.name));
  assert.equal(d.choices.length, 4);
  // play to their fear twice: sold_fear
  social.choose(d.choices.find((c) => c.tags.includes('FEAR')).id);
  d = social.dialogueView();
  social.choose(d.choices[0].id);
  assert.equal(social.screen, 'result');
  const r = social.resultView();
  assert.equal(r.ending, 'sold_fear');
  assert.equal(r.win, true);
  assert.ok(r.lead, 'a lead was created');
  assert.equal(s.leads.open().length, 1);
  assert.ok(r.transcript.length >= 3);

  social.backToGuests();
  assert.equal(social.guestsView().guests[0].status, 'won');
  assert.throws(() => social.talk(guest.id), /already spoken/);

  const sum = social.leave();
  assert.equal(social.screen, 'summary');
  assert.equal(sum.talked, 1);
  assert.equal(sum.leads.length, 1);
  assert.ok(!s.held.has('event'), 'the clock runs again');
  social.close();
  assert.equal(social.screen, 'events');
  assert.equal(social.eventsView().events.find((e) => e.id === open.id).reason, 'already attended this quarter');
});

test('every placeholder path ends on a known ending', () => {
  const guest = { id: 'g', name: 'Test Guest', fears: ['atomic'] };
  const endings = new Set();
  const walk = (path) => {
    const sess = createStubDialogue(guest);
    for (const c of path) sess.choose(c);
    if (sess.done) { endings.add(sess.ending); return; }
    sess.node().choices.forEach((c) => walk([...path, c.id]));
  };
  walk([]);
  for (const e of endings) assert.ok(ENDINGS[e], e);
  assert.deepEqual([...endings].sort(), ['backfire', 'hard_close', 'insider_tip', 'polite_exit', 'rebuffed', 'sold_dream', 'sold_fear']);
  assert.equal(PLACEHOLDER_TREE.start, 'open');
});

test('a losing conversation gives no lead and risky lines are tagged', async () => {
  const s = await setup();
  const { social } = s;
  social.attend(social.eventsView().events.find((e) => e.canAttend).id);
  const g = social.guestsView().guests[0];
  const d = social.talk(g.id);
  const insider = d.choices.find((c) => c.tags.includes('RISKY'));
  assert.deepEqual(insider.tags, ['PUSHY', 'RISKY']);
  social.choose(d.choices.find((c) => c.tags.length === 0).id); // "just here for the canapés"
  assert.equal(social.resultView().ending, 'polite_exit');
  assert.equal(social.resultView().lead, null);
  assert.equal(s.leads.open().length, 0);
});

test('choiceTags', () => {
  assert.deepEqual(choiceTags({ fear: 'x', promise: 'gold_taps' }), ['FEAR', 'PROMISE']);
  assert.deepEqual(choiceTags(), []);
});

test('by default guests get their archetype\'s authored conversation (#56), played to an ending', async () => {
  const s = await setup({ stub: false });
  const { social } = s;
  social.attend(social.eventsView().events.find((e) => e.canAttend).id);
  const g = social.guestsView().guests[0];
  let d = social.talk(g.id);
  assert.ok(d.guest.archetype, 'archetype label shown');
  let guard = 0;
  while (social.screen === 'dialogue' && guard++ < 20) {
    d = social.dialogueView();
    assert.ok(d.choices.length >= 1);
    social.choose(d.choices[0].id);
  }
  assert.equal(social.screen, 'result');
  const r = social.resultView();
  assert.ok(ENDINGS[r.ending], r.ending);
  assert.ok(r.transcript.length >= 3);
  assert.equal(r.transcript.at(-1).speaker === 'you', false, 'the ending line is in the transcript');
});
