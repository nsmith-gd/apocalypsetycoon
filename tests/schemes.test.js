import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SchemeBoard, SCHEMES, SCHEME_RULES, researchCrisis } from '../src/schemes/schemes.js';
import { CrisisSystem } from '../src/crisis/breach.js';
import { LeadMarket, REGIONS } from '../src/demand/demand.js';
import { Ledger } from '../src/ledger/ledger.js';
import { MapSales } from '../src/worldmap/sales.js';
import { researchRate } from '../src/research/research.js';

const TIPS = { pandemic: 88, climate: 90, unrest: 86, markets: 90, war: 92 };

function setup({ unlocked = () => true, cash = 5_000_000 } = {}) {
  const ledger = new Ledger({ startingCash: cash });
  const crisis = new CrisisSystem({ seed: 2, ledger, tips: TIPS });
  const market = new LeadMarket({ seed: 5 });
  const calls = [];
  const pushback = { onScheme: (x) => calls.push(x) };
  const schemes = new SchemeBoard({ crisis, market, ledger, pushback, isUnlocked: unlocked });
  const tensions = () => Object.fromEntries(Object.values(crisis.tracks).map((t) => [t.id, t.tension]));
  const sales = new MapSales({ market, ledger, getTensions: tensions, getBreachMultiplier: () => crisis.panicMultiplier, getEdgeBonus: (id) => schemes.edgeBonus(id) });
  return { ledger, crisis, market, schemes, sales, calls };
}

test('a scheme costs cash, raises its crisis by its reach in that region, adds heat and local buyers', () => {
  const { ledger, crisis, market, schemes, calls } = setup();
  const memo = SCHEMES.find((s) => s.id === 'memo');
  // Latin America is highly exposed to pandemic, Middle East only a little.
  const r = schemes.run('memo', 'lat');
  assert.equal(r.gain, memo.tension * SCHEME_RULES.reach.high);
  assert.equal(crisis.tracks.pandemic.tension, memo.tension);
  assert.equal(ledger.cash, 5_000_000 - memo.cost);
  assert.equal(ledger.entries.at(-1).category, 'schemes');
  assert.equal(calls[0].heat, memo.heat);
  assert.ok(market.leads.some((l) => l.region === 'lat'));
  const low = schemes.run('memo', 'mea');
  assert.equal(low.gain, Math.round(memo.tension * SCHEME_RULES.reach.low * 10) / 10);
  assert.ok(low.cost > memo.cost, 'repeating a scheme in the same week costs more');
});

test('prices climb with crisis, with an edge bonus at the Brink just below the tipping point', () => {
  const { crisis, schemes, sales } = setup();
  const p0 = sales.overview().find((r) => r.id === 'lat').premium;
  crisis.setTension('pandemic', 50);
  const p50 = sales.overview().find((r) => r.id === 'lat').premium;
  crisis.setTension('pandemic', 80); // tip 88, brink from 78
  const pEdge = sales.overview().find((r) => r.id === 'lat');
  assert.ok(p50 > p0);
  assert.equal(crisis.tracks.pandemic.state, 'brink');
  assert.equal(pEdge.edgeBonus, SCHEME_RULES.edgeBonus); // high exposure: full bonus
  assert.ok(pEdge.premium > p50 + SCHEME_RULES.edgeBonus);
  assert.equal(schemes.edgeBonus('mea'), SCHEME_RULES.edgeBonus * 0.25); // low exposure: a quarter
});

test('research income rises with crisis and peaks just below each track\'s own tipping point', () => {
  const { crisis } = setup();
  const rate = () => researchRate(researchCrisis(crisis));
  crisis.setTension('pandemic', 30);
  const calm = rate();
  crisis.setTension('pandemic', 86); // tip 88
  const edge = rate();
  assert.ok(edge > calm * 3, `${edge} vs ${calm}`);
  crisis.setTension('pandemic', 95); // breached
  assert.ok(rate() < edge);
});

test('pushing past the tipping point triggers the runaway crisis: breach, pause, and buyers flee the region', () => {
  const { crisis, market, schemes } = setup();
  crisis.setTension('unrest', 80); // tip 86
  market.addLeads('nam', 6);
  const before = market.leads.filter((l) => l.region === 'nam').length;
  const r = schemes.run('memo', 'nam'); // wrong track: pandemic, no breach
  assert.equal(r.breached, false);
  const big = schemes.run('podcast', 'nam'); // unrest +7 (nam is high on unrest): 80 -> 87 >= 86
  assert.equal(big.breached, true);
  assert.equal(crisis.tracks.unrest.state, 'breach');
  assert.equal(crisis.paused, true);
  assert.ok(big.fled >= Math.floor(before / 2));
  assert.ok(market.leads.filter((l) => l.region === 'nam').length < before);
  // a breached track can't be pushed further
  const offer = schemes.available('nam').find((o) => o.scheme.id === 'podcast');
  assert.ok(offer.reason);
  assert.throws(() => schemes.run('podcast', 'nam'));
});

test('locked schemes need research, and the visible tip is a range until revealed', () => {
  const { schemes } = setup({ unlocked: (id) => id !== 'blackout' });
  const offer = schemes.available('eur').find((o) => o.scheme.id === 'blackout');
  assert.equal(offer.locked, true);
  assert.throws(() => schemes.run('blackout', 'eur'), /Research/);
  const tv = schemes.trackView('pandemic');
  assert.ok(tv.tipLow < 88 && tv.tipHigh > 88, 'the real tip sits somewhere inside the shown range');
  assert.equal(tv.exact, null);
  assert.equal(tv.edgeFrom, tv.tipLow - 10);
});

test('cannot fund a scheme without the cash', () => {
  const { schemes, ledger } = setup({ cash: 10_000 });
  assert.throws(() => schemes.run('memo', 'lat'), /cash/);
  assert.equal(ledger.cash, 10_000);
});
