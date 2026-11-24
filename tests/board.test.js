import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board, BOARD, MEMBERS, DIRECTIVES, quotaFor, quarterRevenue, stateOf, INVESTMENT_LABEL } from '../src/board/board.js';
import { Ledger } from '../src/ledger/ledger.js';
import { Pushback } from '../src/pushback/pushback.js';
import { MONEY } from '../src/config/tuning.js';

const gdd = { ...BOARD, quotaScale: 1 };

test('quota follows the GDD curve: $6M Q1, ~$13M Q4, ~$38M Q8, ~$108M Q12, +30% a quarter', () => {
  assert.equal(quotaFor(1, gdd), 6_000_000);
  assert.ok(Math.abs(quotaFor(4, gdd) - 13_000_000) < 300_000);
  assert.ok(Math.abs(quotaFor(8, gdd) - 38_000_000) < 600_000);
  assert.ok(Math.abs(quotaFor(12, gdd) - 108_000_000) < 1_000_000);
  for (let q = 2; q <= 14; q++) assert.ok(Math.abs(quotaFor(q, gdd) / quotaFor(q - 1, gdd) - 1.3) < 0.001, `Q${q}`);
  assert.equal(BOARD.quotaScale, 1, '#91: the economy runs on the GDD $M scale');
  assert.equal(quotaFor(1), MONEY.quotaQ1, 'the default board uses the GDD curve unscaled');
  assert.equal(quotaFor(5), quotaFor(5, gdd));
});

test('revenue counts income only and never investment rounds', () => {
  const ledger = new Ledger({ startingCash: 0 });
  ledger.record('sales', 'Bunker', 200_000);
  ledger.record('builds', 'Dig', -50_000);
  ledger.record('other', INVESTMENT_LABEL, 999_000);
  assert.equal(quarterRevenue(ledger, 1), 200_000);
});

test('hit quota: +5 with every member; beaten by 25%: +10; missed: -15', () => {
  const mk = () => new Board({ supports: [] }); // no directives, so only the quota moves confidence
  const hit = mk(); hit.review({ revenue: quotaFor(1) });
  const beat = mk(); beat.review({ revenue: quotaFor(1) * 1.25 });
  const miss = mk(); const r = miss.review({ revenue: 0 });
  for (const m of MEMBERS.filter((x) => x.id !== 'gray')) {
    assert.equal(hit.confidence[m.id], 65);
    assert.equal(beat.confidence[m.id], 70);
    assert.equal(miss.confidence[m.id], 45);
  }
  assert.equal(r.met, false);
  assert.equal(r.state, 'scrutiny');
  assert.equal(miss.schemeHeatMultiplier, 1.2);
  assert.equal(r.nextQuota, quotaFor(2));
  assert.match(r.lines[0], /MISSED/);
});

test('two directives from different members each meeting; fulfilled +8 and a Favour, failed -5', () => {
  const b = new Board({ seed: 3 });
  assert.equal(b.directives.length, 2);
  assert.notEqual(b.directives[0].member, b.directives[1].member);
  assert.ok(b.directives.every((d) => d.member !== 'gray'), 'Mr. Gray is silent before 4:30');
  // Facts that fulfil every directive
  const all = { revenue: quotaFor(1) * 2, heat: 10, tensions: { atomic: 80 }, openTracks: ['atomic'], brinkTracks: 1, breaches: 0, handovers: 2, schemesRun: 5, arkStarted: true };
  const [d1, d2] = b.directives;
  const r = b.review(all);
  assert.deepEqual(r.directives.map((d) => d.result), ['fulfilled', 'fulfilled']);
  assert.equal(b.confidence[d1.member], 60 + 10 + 8);
  assert.equal(b.favours[d2.member], 1);
  // Facts that fail every directive
  const b2 = new Board({ seed: 3 });
  const m = b2.directives[0].member;
  const r2 = b2.review({ revenue: quotaFor(1), heat: 90, tensions: {}, openTracks: [], brinkTracks: 0, breaches: 0, handovers: 0, schemesRun: 0 });
  assert.ok(r2.directives.some((d) => d.result === 'failed'));
  if (r2.directives[0].result === 'failed') assert.equal(b2.confidence[m], 60 + 5 - 5);
});

test('directives the game cannot track are never issued', () => {
  for (let seed = 1; seed < 30; seed++) {
    const b = new Board({ seed, supports: ['heat'] });
    assert.ok(b.directives.every((d) => DIRECTIVES.find((x) => x.id === d.id).needs.every((n) => n === 'heat')));
  }
});

test('refusing a directive costs 3 with that member, once per meeting, and it is not judged', () => {
  const b = new Board({ seed: 5 });
  const [d] = b.directives;
  b.refuse(d.id);
  assert.equal(b.confidence[d.member], 57);
  assert.throws(() => b.refuse(b.directives[1].id), /only one/);
  const r = b.review({ revenue: 0, heat: 99, tensions: {}, openTracks: [], brinkTracks: 0, breaches: 3, handovers: 0, schemesRun: 0 });
  assert.equal(r.directives[0].result, 'refused');
});

test('breaches anger Vane and Priya; crisis fallout moves everyone', () => {
  const b = new Board({ supports: [] });
  b.review({ revenue: quotaFor(1), breaches: 2, confidenceShift: -4 });
  assert.equal(b.confidence.vane, 60 + 5 - 10 - 4);
  assert.equal(b.confidence.sandoval, 60 + 5 - 10 - 4);
  assert.equal(b.confidence.kettering, 60 + 5 - 4);
});

test('bullish pays an investment round worth 25% of the next quota, as cash not revenue', () => {
  const ledger = new Ledger({ startingCash: 0 });
  const b = new Board({ ledger, supports: [] });
  for (const m of MEMBERS) b.confidence[m.id] = 90;
  ledger.record('sales', 'Bunker', quotaFor(1));
  const r = b.review({});
  assert.equal(r.state, 'bullish');
  assert.equal(r.investment, Math.round(quotaFor(2) * 0.25 / 1000) * 1000);
  assert.equal(quarterRevenue(ledger, 1), quotaFor(1));
  assert.equal(ledger.cash, quotaFor(1) + r.investment);
});

test('repeated misses slide through Scrutiny and Probation to Ousted; the Minder vetoes once a quarter', () => {
  const b = new Board({ supports: [] });
  const states = [];
  for (let q = 1; q <= 4; q++) states.push(b.review({ quarter: q, revenue: 0 }).state);
  assert.deepEqual(states, ['scrutiny', 'scrutiny', 'probation', 'ousted']);
  assert.equal(b.ousted, true);
  assert.deepEqual(b.directives, []);
  const p = new Board({ supports: [] });
  for (const m of MEMBERS) p.confidence[m.id] = 10;
  assert.equal(p.state.id, 'probation');
  assert.equal(p.minderVeto(), true);
  assert.equal(p.minderVeto(), false);
  assert.equal(stateOf(0).id, 'ousted');
});

test('Mr. Gray votes with the others until Q11, then takes his seat and issues a directive every meeting', () => {
  const b = new Board({ seed: 2 });
  b.confidence.vane = 100;
  assert.equal(b.memberConfidence('gray'), (100 + 60 + 60 + 60) / 4);
  const r = b.review({ quarter: 10, revenue: quotaFor(10), heat: 10, tensions: {}, openTracks: [], brinkTracks: 0, breaches: 0, handovers: 1, schemesRun: 0, arkStarted: false });
  assert.ok(r.effects.some((e) => /Mr\. Gray takes/.test(e)));
  assert.ok(b.directives.some((d) => d.member === 'gray'));
});

test('votes need 3 of 5; a Favour secures a vote', () => {
  const b = new Board({ supports: [] });
  for (const m of MEMBERS) b.confidence[m.id] = 40;
  b.favours.vane = 1; b.favours.faraday = 1; b.favours.sandoval = 1;
  assert.equal(b.vote().passed, false);
  const v = b.vote(3, { spendFavours: ['vane', 'faraday', 'sandoval'] });
  assert.equal(v.passed, true);
  assert.equal(b.favours.vane, 0);
});

test('save and load round-trips the board', () => {
  const b = new Board({ seed: 4 });
  b.review({ revenue: 0, heat: 50, tensions: {}, openTracks: [], brinkTracks: 0, breaches: 1, handovers: 0, schemesRun: 0 });
  const c = new Board({ seed: 4 });
  c.load(JSON.parse(JSON.stringify(b.toJSON())));
  assert.deepEqual(c.toJSON(), b.toJSON());
  assert.equal(c.state.id, b.state.id);
});

test('pushback can hand the board over: no legacy target, and scheme heat follows the multiplier', () => {
  const pb = new Pushback({ config: { board: { enabled: false } } });
  pb.schemeHeatMultiplier = 1.2;
  const h0 = pb.heat;
  pb.onScheme({ heat: 10, tension: 0 });
  assert.equal(pb.heat, h0 + 12);
  const r = pb.endQuarter({ quarter: 1, profit: -1_000_000 });
  assert.equal(r.board, null);
  assert.equal(pb.board.strikes, 0);
});
