// #32: twelve endings, epilogue cards and The Ledger.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENDINGS, ENDING_IDS, EndingWatch, endingCard, DEFAULT_CLOSING } from '../src/midnight/endings.js';
import { epilogues, buildLedger } from '../src/midnight/epilogues.js';
import { HERO_CLIENTS } from '../src/world/tracks.js';

test('endings: all twelve exist, and forcing each trigger picks that ending', () => {
  assert.equal(ENDING_IDS.length, 12);
  for (const id of ['lights_out', 'off_the_rails', 'ousted', 'indicted', 'last_resort', 'overtime', 'regrettably_stable', 'under_new_management', 'seat_at_table', 'locked_out', 'somebody_else', 'clouds_won']) {
    assert.ok(ENDINGS[id], id);
    assert.equal(new EndingWatch().force(id), id, id);
  }
});

test('endings: weekly triggers count streaks, and stand-ins never fire on their own', () => {
  const w = new EndingWatch();
  const calmCh3 = { chapter: 3, heat: 40, boardConfidence: 55, tracks: [{ id: 'atomic', tension: 50, state: 'calm' }], roster: ['atomic'] };
  for (let i = 0; i < 60; i++) assert.equal(w.week(calmCh3), null);
  const hot = { ...calmCh3, heat: 96 };
  assert.equal(w.week(hot), null); assert.equal(w.week(hot), null); assert.equal(w.week(hot), null);
  assert.equal(w.week(hot), 'indicted'); // the 4th week at 95+
  const s = new EndingWatch();
  const stable = { chapter: 5, heat: 20, boardConfidence: 55, quotaOnTrack: true, midnightDateSet: true, tracks: [{ id: 'atomic', tension: 10 }], roster: ['atomic'] };
  for (let i = 0; i < 12; i++) assert.equal(s.week(stable), null);
  assert.equal(s.week(stable), 'regrettably_stable');
  assert.equal(new EndingWatch().week({ boardConfidence: 0 }), 'ousted');
  const m = new EndingWatch(); assert.equal(m.atMidnight({ road: 'engineered' }), 'lights_out');
  assert.equal(new EndingWatch().atMidnight({ road: 'uncontrolled' }), 'off_the_rails');
});

test('endings: save and load keep the streaks', () => {
  const w = new EndingWatch(); w.week({ heat: 99 }); w.week({ heat: 99 }); w.note('ruthLoyalty', 80);
  const r = new EndingWatch(); r.load(JSON.parse(JSON.stringify(w)));
  assert.equal(r.heatWeeks, 2); assert.equal(r.flags.ruthLoyalty, 80);
});

test('ending cards: grades and closing lines', () => {
  const result = { grade: { name: 'Silver' }, type: 'engineered' };
  assert.equal(endingCard('lights_out', { result }).grade, 'Silver');
  assert.equal(endingCard('somebody_else', { result }).grade, 'The Gerald'); // two down from Silver
  assert.equal(endingCard('last_resort').closing, 'Company value: $0. People sheltered: 41,000.');
  assert.equal(endingCard('lights_out', { result }).closing, DEFAULT_CLOSING);
  assert.match(endingCard('overtime', { quartersSurvived: 3 }).grade, /3 quarters/);
});

test('epilogues: one line per client, hero samples, Gerald last', () => {
  const sold = HERO_CLIENTS.map((h, i) => ({ id: i, owner: h.name })).concat([{ id: 99, owner: 'Nobody Special', clientType: 'politician' }]);
  const result = { shelters: sold.map((s) => ({ id: s.id, outcome: s.id % 3 === 0 ? 'lost' : 'survived', weakest: 'air' })) };
  const cards = epilogues({ sold, result });
  assert.equal(cards.length, sold.length);
  assert.equal(cards.at(-1).client, 'Gerald Pemberton-Wick');
  for (const c of cards) assert.ok(c.line.length > 10, c.client);
  assert.ok(cards.some((c) => /11 followers/.test(c.line)));
  const noGerald = epilogues({ sold: [{ id: 1, owner: 'Someone', clientType: 'prepper' }], result: { shelters: [] } });
  assert.match(noGerald.at(-1).line, /wine ran out/);
});

test('the Ledger: totals, scars and the closing line', () => {
  const L = buildLedger({ endingId: 'lights_out', result: { totals: { occupants: 40, survivors: 30 }, apocalypse: { id: 'atomic' }, grade: { name: 'Gold' } },
    ledger: { entries: [{ amount: 5e6 }, { amount: -2e6 }, { amount: 3e6 }] }, tree: { totalEarned: 900 }, pushback: { heat: 71 },
    crisis: { tracks: { atomic: { id: 'atomic', name: 'Atomic', breaches: 2 } } }, doom: { collapses: [{ track: 'bloom' }] }, company: { crewCap: 4 } });
  assert.equal(L.clientsSaved, 30); assert.equal(L.revenue, 8e6); assert.equal(L.rp, 900); assert.equal(L.heat, 71);
  assert.equal(L.staffSaved + L.staffOutside, 16);
  assert.equal(L.scars.length, 2);
  assert.equal(L.closing, 'Humanity: down 99.7%. Shareholder value: record high.');
  assert.equal(buildLedger({ endingId: 'last_resort' }).clientsSaved, 41000);
});
