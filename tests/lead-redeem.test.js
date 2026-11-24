import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LeadMarket } from '../src/demand/demand.js';
import { MapSales } from '../src/worldmap/sales.js';
import { LeadInventory } from '../src/leads/leads.js';
import { quoteLead, redeemLead, leadBonus, REDEMPTION } from '../src/leads/redeem.js';
import { Ledger } from '../src/ledger/ledger.js';

// A small world: one shelter in stock, a calm-ish market, and a lead inventory on a settable quarter.
function setup({ walkIns = 1, tensions = { pandemic: 60 } } = {}) {
  let quarter = 2;
  const market = new LeadMarket({ seed: 3 });
  const ledger = new Ledger({ startingCash: 0 });
  const sales = new MapSales({ market, ledger, getTensions: () => tensions, getQuarter: () => quarter });
  if (walkIns) market.addLeads('afr', walkIns); // Africa: walk-ins are 'comfortable'
  const inv = new LeadInventory({ getQuarter: () => quarter });
  const shelter = sales.addFinished({ name: 'Test bunker', rooms: ['bunk', 'air_vent', 'water_tank', 'pantry', 'gold_taps'], occupants: 6 });
  return { market, ledger, sales, inv, shelter, setQuarter: (q) => { quarter = q; } };
}
// Equatorial Belt sells in the map's Africa region.
const guest = (over = {}) => ({ id: 'g1', name: 'Lady Okafor', region: 'equator', wealthClass: 'C2', fears: ['bloom'], ...over });

test('redeeming a hot lead pays measurably more than the walk-in buyer in the same region', () => {
  const { sales, inv, shelter, ledger } = setup();
  const lead = inv.create({ guest: guest(), region: 'equator', wealthClass: 'C2', quality: 90, fears: ['bloom'] });
  assert.equal(lead.tier, 'hot');
  const q = quoteLead(sales, inv, lead.id, shelter.id);
  // hot +10%, rapport 90 -> +9%, pandemic is the worst crisis here and The Bloom is their fear -> +10%
  assert.equal(q.bonus.total, 0.29);
  assert.ok(q.price > q.walkIn.price, `${q.price} > ${q.walkIn.price}`);
  const { record } = redeemLead(sales, inv, lead.id, shelter.id);
  assert.equal(record.price, q.price);
  assert.equal(ledger.cash, q.price);
  assert.equal(record.viaLead, true);
  assert.equal(inv.get(lead.id).status, 'consumed');
});

test('a cold lead with no matching fear gets no price bonus but still buys', () => {
  const { sales, inv, shelter } = setup();
  const lead = inv.create({ guest: guest({ fears: ['optimizer'] }), region: 'equator', wealthClass: 'C1', quality: 0, fears: ['optimizer'] });
  const q = quoteLead(sales, inv, lead.id, shelter.id);
  assert.equal(lead.tier, 'cold');
  assert.equal(q.bonus.total, 0);
  assert.equal(q.price, q.base);
});

test('leads give access to higher client tiers than the region\'s walk-ins', () => {
  const { sales, inv, shelter } = setup();
  const apex = inv.create({ guest: guest(), region: 'equator', wealthClass: 'C4', quality: 50 });
  const q = quoteLead(sales, inv, apex.id, shelter.id);
  assert.equal(q.walkIn.wealth, 'comfortable');
  assert.equal(apex.salesWealth, 'apex');
  assert.equal(q.tierUp, 3);
  assert.ok(q.price >= q.walkIn.price * 2, 'an apex buyer pays over twice a comfortable walk-in');
});

test('a lead can sell where no walk-in buyer exists', () => {
  const { sales, inv, shelter } = setup({ walkIns: 0 });
  assert.equal(sales.canSell('afr', shelter.id), false);
  const lead = inv.create({ guest: guest(), region: 'equator', wealthClass: 'C2', quality: 50 });
  const q = quoteLead(sales, inv, lead.id, shelter.id);
  assert.equal(q.onlyBuyer, true);
  assert.ok(redeemLead(sales, inv, lead.id, shelter.id).record.price > 0);
});

test('hot and warm leads bring referrals: demand in the region rises', () => {
  const { sales, inv, market } = setup({ walkIns: 0 });
  const hot = inv.create({ guest: guest({ id: 'a' }), region: 'equator', wealthClass: 'C2', quality: 80 });
  const before = market.leads.filter((l) => l.region === 'afr').length;
  const s1 = sales.addFinished({ name: 'A', rooms: ['bunk'], occupants: 4 });
  const r = redeemLead(sales, inv, hot.id, s1.id);
  assert.equal(r.referrals, 1);
  assert.equal(market.leads.filter((l) => l.region === 'afr').length, before + 1);
  // two warm sales make one referral
  for (const id of ['b', 'c']) {
    const w = inv.create({ guest: guest({ id }), region: 'equator', wealthClass: 'C2', quality: 50 });
    const s = sales.addFinished({ name: id, rooms: ['bunk'], occupants: 4 });
    redeemLead(sales, inv, w.id, s.id);
  }
  assert.equal(market.leads.filter((l) => l.region === 'afr').length, before + 2);
  assert.equal(REDEMPTION.referrals.cold, 0);
});

test('unused leads expire per the lead model and can no longer be redeemed', () => {
  const { sales, inv, shelter, setQuarter } = setup();
  const cold = inv.create({ guest: guest({ id: 'c' }), region: 'equator', wealthClass: 'C2', quality: 10 }); // expires end of Q2
  const hot = inv.create({ guest: guest({ id: 'h' }), region: 'equator', wealthClass: 'C2', quality: 90 }); // expires end of Q4
  setQuarter(3);
  assert.match(quoteLead(sales, inv, cold.id, shelter.id).error, /expired/);
  inv.expire(3);
  assert.equal(inv.get(cold.id).status, 'expired');
  assert.ok(!quoteLead(sales, inv, hot.id, shelter.id).error, 'hot lead still good in Q3');
  setQuarter(5);
  inv.expire(5);
  assert.throws(() => redeemLead(sales, inv, hot.id, shelter.id), /no longer open/);
  assert.equal(sales.stock.length, 1, 'nothing sold');
});

test('leadBonus itemises its lines', () => {
  const b = leadBonus({ tier: 'warm', quality: 50, fears: ['atomic'] }, 'war');
  assert.deepEqual(b.lines.map((l) => l.label), ['warm lead', 'rapport 50/100', 'already scared of this crisis']);
  assert.equal(b.total, 0.2);
});
