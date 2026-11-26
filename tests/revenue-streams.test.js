// #161: revenue streams on the ledger, government contracts at the Brink, scheme kickbacks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ledger, STREAMS, inferStream } from '../src/ledger/ledger.js';
import { CrisisSystem } from '../src/crisis/breach.js';
import { LeadMarket } from '../src/demand/demand.js';
import { GovernmentContracts } from '../src/demand/government.js';
import { SchemeBoard } from '../src/schemes/schemes.js';
import { TUNING } from '../src/config/tuning.js';
import { INVESTMENT_LABEL } from '../src/board/board.js';

const TIPS = { pandemic: 88, climate: 90, unrest: 86, markets: 90, war: 92 };
function setup() {
  const ledger = new Ledger({ startingCash: 20_000_000 });
  const crisis = new CrisisSystem({ seed: 2, ledger, tips: TIPS });
  const market = new LeadMarket({ seed: 5 });
  const heat = [];
  const pushback = { onScheme() {}, addHeat: (n, why) => heat.push([n, why]) };
  const government = new GovernmentContracts({ crisis, regions: market.regions, ledger, pushback });
  const schemes = new SchemeBoard({ crisis, market, ledger, pushback });
  return { ledger, crisis, market, government, schemes, heat };
}

test('every income entry gets a revenue stream; the targets cover all six GDD streams and sum to 100%', () => {
  const l = new Ledger();
  l.record('sales', 'Oil heir shelter (Europe): X', 5_000_000);
  l.record('other', INVESTMENT_LABEL, 1_000_000);
  l.record('schemes', 'Arms Broker kickback (Europe)', 2_000_000);
  l.record('sales', 'Retainer: The Deep Vault', 200_000, { stream: 'retainers' });
  l.record('builds', 'Bunk bed', -15_000);
  assert.deepEqual(l.entries.map((e) => e.stream ?? null), ['contracts', 'investment', 'kickbacks', 'retainers', null]);
  const s = l.streamShares();
  assert.equal(s.total, 8_200_000);
  assert.equal(s.streams.contracts.share, Math.round((5 / 8.2) * 1000) / 1000);
  assert.deepEqual(Object.keys(TUNING.revenueMix).sort(), Object.keys(STREAMS).filter((k) => k !== 'other').sort());
  assert.equal(Math.round(Object.values(TUNING.revenueMix).reduce((a, b) => a + b, 0) * 100), 100);
  assert.equal(inferStream('sales', 'Government contract: 6 volume shelters (Europe)', 1), 'government');
});

test('a government contract appears in regions exposed to a track at its Brink, and signing pays and cools heat by 1', () => {
  const { ledger, crisis, government, heat } = setup();
  assert.equal(government.refresh().length, 0, 'calm world: no contracts');
  crisis.setTension('war', TIPS.war - 3);
  assert.equal(crisis.tracks.war.state, 'brink');
  const offers = government.refresh();
  assert.ok(offers.length >= 1 && offers.length <= TUNING.government.maxOpen);
  for (const o of offers) {
    const region = government.regions.find((r) => r.id === o.region);
    assert.ok(TUNING.government.exposures.includes(region.exposure.war), `${o.region} is exposed to war`);
    assert.equal(o.price, TUNING.government.shelters * TUNING.government.pricePerShelter);
  }
  const before = ledger.cash, o = offers[0];
  const r = government.sign(o.id);
  assert.ok(r.ok);
  assert.equal(ledger.cash, before + o.price);
  assert.equal(ledger.entries.at(-1).stream, 'government');
  assert.deepEqual(heat.at(-1)[0], -1);
  assert.equal(government.offersIn(o.region).length, 0);
  assert.equal(ledger.streamShares().streams.government.amount, o.price);
  assert.equal(government.sign(o.id).ok, false, 'a contract signs once');
});

test('unsigned government offers lapse, and one region holds at most one', () => {
  const { crisis, government } = setup();
  crisis.setTension('war', TIPS.war - 3);
  const first = government.refresh().map((o) => o.region);
  government.refresh();
  assert.deepEqual(government.offers.map((o) => o.region), first, 'no duplicates on refresh');
  crisis.setTension('war', 20);
  for (let w = 0; w <= TUNING.government.offerWeeks; w++) crisis.advanceWeek?.();
  assert.equal(government.offers.length, 0);
  const saved = JSON.parse(JSON.stringify(government.toJSON()));
  government.load(saved);
  assert.deepEqual(government.toJSON(), saved);
});

test('Arms Broker and Gentrify pay their kickback the following week, in the kickbacks stream', () => {
  const { ledger, crisis, schemes } = setup();
  const r = schemes.run('armsbroker', 'eur');
  assert.equal(r.cost, 1_000_000);
  assert.equal(ledger.streamShares().streams.kickbacks.amount, 0, 'not paid yet');
  crisis.advanceWeek();
  const k = ledger.entries.filter((e) => e.stream === 'kickbacks');
  assert.equal(k.length, 1);
  assert.equal(k[0].amount, 2_000_000);
  schemes.run('gentrify', 'nam');
  const saved = schemes.toJSON();
  assert.equal(saved.pendingKickbacks[0].amount, 3_000_000);
  crisis.advanceWeek();
  assert.equal(ledger.streamShares().streams.kickbacks.amount, 5_000_000);
});
