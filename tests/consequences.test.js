import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CrisisSystem } from '../src/crisis/breach.js';
import { CrisisConsequences, CONSEQUENCES, exposureLevel, retainerFor } from '../src/crisis/consequences.js';
import { Board } from '../src/board/board.js';
import { Pushback } from '../src/pushback/pushback.js';
import { Ledger } from '../src/ledger/ledger.js';

const TIPS = { pandemic: 90, climate: 90, unrest: 90, markets: 90, war: 90 };

function world({ sites = [], seed = 3 } = {}) {
  const ledger = new Ledger({ startingCash: 100_000_000 });
  const pb = new Pushback({ ledger });
  const board = new Board({ ledger, seed: 1 });
  const crisis = new CrisisSystem({ tips: TIPS, pushback: pb, ledger, shelters: () => [] });
  const cons = new CrisisConsequences({ crisis, board, sites: () => sites, seed });
  return { ledger, pb, board, crisis, cons };
}

const collapse = (crisis, id) => { crisis.setTension(id, 95); while (crisis.tracks[id].state === 'breach') crisis.advanceWeek(); };
const site = (id, region, price = 1_000_000) => ({ id, name: `Shelter ${id}`, owner: `Client ${id}`, region, price, sold: true });

test('config: the GDD numbers', () => {
  assert.deepEqual(CONSEQUENCES.containedReactions, { sandoval: -10, vane: -5, kettering: 5 });
  assert.deepEqual(CONSEQUENCES.breachWeek, { heat: 2, boardConfidence: -2 });
  assert.ok(Object.isFrozen(CONSEQUENCES.ruin));
});

test('a contained breach: Priya -10, Cornelius -5, Bryce +5, the others unchanged; listed at the next meeting', () => {
  const { board, crisis, cons } = world();
  const before = { ...board.confidence };
  crisis.reputation = 60;
  crisis.setTension('war', 95);
  crisis.tracks.war.window.bar = 75;
  crisis.contribute('war', 'government'); // +25 -> contained
  assert.equal(crisis.tracks.war.state, 'locked');
  assert.equal(board.confidence.sandoval, before.sandoval - 10);
  assert.equal(board.confidence.vane, before.vane - 5);
  assert.equal(board.confidence.kettering, before.kettering + 5);
  assert.equal(board.confidence.faraday, before.faraday);
  assert.match(cons.drainNotes()[0], /Priya -10, Cornelius -5, Bryce \+5/);
  const review = board.review({ quarter: 1, revenue: 0 });
  assert.ok(review.reasons.some((r) => r.member === 'sandoval' && r.amount === -10 && /contained/.test(r.why)));
});

test('each breach week: heat +2 and board confidence -2, applied once (not doubled by this module)', () => {
  const { pb, crisis, cons } = world();
  pb.heat = 10;
  crisis.setTension('markets', 95);
  const conf = crisis.boardConfidence;
  crisis.advanceWeek();
  crisis.advanceWeek();
  assert.equal(pb.heat, 10 + 2 * CONSEQUENCES.breachWeek.heat);
  assert.equal(crisis.boardConfidence, conf + 2 * CONSEQUENCES.breachWeek.boardConfidence);
  assert.equal(cons.breachWeeks, 2);
});

test('collapse: sites in its hot regions are checked for damage, retainers stop, high-exposure clients demand evacuation', () => {
  // pandemic: Africa high, East Asia high, North America medium; Oceania low
  const sites = [site('a', 'afr'), site('b', 'nam'), site('c', 'oce'), { ...site('d', 'afr'), sold: false }];
  const { crisis, cons } = world({ sites });
  assert.equal(exposureLevel('afr', 'pandemic'), 'high');
  assert.equal(exposureLevel('oce', 'pandemic'), 'low');
  const evac = [];
  cons.on('evacuation', (e) => evac.push(e));
  collapse(crisis, 'pandemic');
  assert.equal(crisis.tracks.pandemic.state, 'collapsed');
  const [a, b, c, d] = sites;
  assert.equal(a.retainerStopped, true);
  assert.equal(retainerFor(a), 0);
  assert.equal(b.retainerStopped, true, 'medium exposure: retainers stop too');
  assert.equal(c.retainerStopped, undefined, 'low exposure: untouched');
  assert.equal(retainerFor(c), 40_000);
  assert.equal(d.retainerStopped, undefined, 'unsold stock is not a site');
  assert.deepEqual(evac.map((e) => e.site), ['a']);
  assert.equal(cons.evacuations[0].status, 'open');
  assert.equal(cons.ruins.length, 1);
  assert.equal(cons.ruins[0].sites.length, 2);
  assert.match(cons.drainNotes().at(-1), /Pandemic collapsed: \d site/);
});

test('damage checks are seeded: 60% in high-exposure regions, 30% in medium, same seed same damage', () => {
  const make = (seed) => {
    const sites = [...Array.from({ length: 200 }, (_, i) => site(`h${i}`, 'afr')), ...Array.from({ length: 200 }, (_, i) => site(`m${i}`, 'nam'))];
    const { crisis } = world({ sites, seed });
    collapse(crisis, 'pandemic');
    return sites;
  };
  const one = make(7);
  const two = make(7);
  assert.deepEqual(one.map((s) => !!s.damaged), two.map((s) => !!s.damaged));
  const high = one.slice(0, 200).filter((s) => s.damaged).length / 200;
  const med = one.slice(200).filter((s) => s.damaged).length / 200;
  assert.ok(high > 0.5 && high < 0.7, `high ${high}`);
  assert.ok(med > 0.2 && med < 0.4, `medium ${med}`);
  assert.deepEqual(one.find((s) => s.damaged).damage[0].track, 'pandemic');
});

test('save and load keep the queue and the dice', () => {
  const sites = [site('a', 'afr')];
  const { crisis, cons } = world({ sites });
  collapse(crisis, 'pandemic');
  const copy = new CrisisConsequences({ crisis: new CrisisSystem({ tips: TIPS }), sites: () => [] });
  copy.load(JSON.parse(JSON.stringify(cons.toJSON())));
  assert.equal(copy.evacuations.length, 1);
  assert.equal(copy.rng.state, cons.rng.state);
});
