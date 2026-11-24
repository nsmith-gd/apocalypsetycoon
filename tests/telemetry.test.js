import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Telemetry, toCSV } from '../src/telemetry/telemetry.js';
import { CrisisSystem } from '../src/crisis/breach.js';
import { Pushback } from '../src/pushback/pushback.js';
import { Ledger } from '../src/ledger/ledger.js';
import { ResearchTree } from '../src/research/research.js';
import { LeadMarket } from '../src/demand/demand.js';
import { SchemeBoard } from '../src/schemes/schemes.js';

function world() {
  const ledger = new Ledger({ startingCash: 50_000_000 });
  const pb = new Pushback({ ledger, seed: 3 });
  const crisis = new CrisisSystem({ seed: 4, pushback: pb, ledger });
  const tree = new ResearchTree({ ledger });
  const market = new LeadMarket({ seed: 5 });
  const schemes = new SchemeBoard({ crisis, market, ledger, pushback: pb });
  const tm = new Telemetry({ getTime: () => ({ quarter: 1, week: crisis.week, minutes: crisis.week * 2 }) });
  tm.attach({ crisis, pushback: pb, ledger, tree, schemes });
  return { ledger, pb, crisis, tree, schemes, tm };
}

test('weekly rows: tension and momentum per track, heat, cash, RP, confidence, leverage per client', () => {
  const { crisis, pb, tm } = world();
  pb.onSale({ client: 'Lady Okafor', price: 300_000 });
  pb.onSale({ client: 'Mr. Vance', price: 200_000 });
  for (let i = 0; i < 3; i++) crisis.advanceWeek();
  assert.equal(tm.weeks.length, 3);
  const row = tm.weeks[2];
  for (const id of Object.keys(crisis.tracks)) { assert.ok(`tension_${id}` in row); assert.ok(`momentum_${id}` in row); }
  for (const k of ['heat', 'cash', 'rp_bank', 'board_confidence', 'leverage_max']) assert.ok(k in row, k);
  assert.match(row.leverage_by_client, /Lady Okafor:\d+; Mr\. Vance:\d+/);
  const csv = tm.csv('weekly');
  assert.ok(csv.split('\n')[0].includes('tension_pandemic'));
  assert.equal(csv.trim().split('\n').length, 4);
});

test('events: scheme, breach, containment, collapse, domino, unlock, quota, ending', () => {
  const { crisis, schemes, tree, tm } = world();
  schemes.run('podcast', 'nam');
  crisis.setTension('pandemic', 100); // breach
  crisis.contribute('pandemic', 'calming');
  crisis.setTension('war', 100); // another breach, left to collapse
  for (let i = 0; i < 8; i++) crisis.advanceWeek();
  tree.start('s1_clay');
  tm.quota(1, { met: false, target: 50_000, profit: 12_000, strikes: 1 });
  tm.event('directive', { member: 'Bryce Kettering', text: 'Push any track to Brink' });
  tm.ending({ type: 'failed', ending: { id: 'nobody', title: 'NOBODY LEFT TO BILL' }, grade: { name: 'The Gerald' }, survivalRate: 0.1 });
  const types = new Set(tm.events.map((e) => e.type));
  for (const t of ['scheme', 'breach', 'containment', 'collapse', 'domino', 'unlock', 'quota', 'directive', 'ending']) assert.ok(types.has(t), `missing ${t}`);
  const csv = tm.csv('events');
  assert.ok(csv.startsWith('quarter,week,minutes,type'));
  assert.ok(csv.includes('NOBODY LEFT TO BILL'));
});

test('CSV quoting', () => {
  assert.equal(toCSV([{ a: 'x,y', b: 'say "hi"', c: { n: 1 } }]), 'a,b,c\n"x,y","say ""hi""","{""n"":1}"\n');
});
