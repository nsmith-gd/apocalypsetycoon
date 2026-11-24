import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LeadInventory, LEADS, tierFor, GDD_TO_SALES_REGION, CLASS_TO_SALES_WEALTH, validateLead } from '../src/leads/leads.js';
import { MapSales } from '../src/worldmap/sales.js';
import { LeadMarket } from '../src/demand/demand.js';
import { Ledger } from '../src/ledger/ledger.js';
import { GDD_REGIONS } from '../src/world/tracks.js';

const guest = (over = {}) => ({ id: 'g1', name: 'Honoria Ashcombe', wealthClass: 'C3', region: 'coastal', fears: ['bloom'], venueId: 'gala_coastal', ...over });

test('a lead records its source event, guest, region, wealth class, quality and expiry quarter', () => {
  const inv = new LeadInventory({ getQuarter: () => 3 });
  const l = inv.fromDialogue({ guest: guest(), outcome: { interest: 60, traits: ['Collector'], note: 'Loved the wine cellar' } });
  assert.deepEqual(l.source, { type: 'event', venueId: 'gala_coastal', quarter: 3, guestId: 'g1', note: 'Loved the wine cellar' });
  assert.deepEqual(l.guest, { id: 'g1', name: 'Honoria Ashcombe' });
  assert.equal(l.region, 'coastal');
  assert.equal(l.wealthClass, 'C3');
  assert.equal(l.quality, 60);
  assert.equal(l.tier, 'warm');
  assert.equal(l.createdQuarter, 3);
  assert.equal(l.expiresQuarter, 4); // warm: this quarter and the next
  assert.deepEqual(l.fears, ['bloom']);
  assert.deepEqual(l.traits, ['Collector']);
  assert.equal(l.status, 'open');
});

test('tiers and lifetimes: cold expires with its quarter, warm one later, hot two later', () => {
  assert.deepEqual([tierFor(10), tierFor(40), tierFor(74), tierFor(75)], ['cold', 'warm', 'warm', 'hot']);
  const inv = new LeadInventory({ getQuarter: () => 5 });
  const make = (q, id) => inv.fromDialogue({ guest: guest({ id }), outcome: { interest: q } });
  assert.deepEqual([make(20, 'a').expiresQuarter, make(50, 'b').expiresQuarter, make(90, 'c').expiresQuarter], [5, 6, 7]);
});

test('dialogue outcomes that are not leads create nothing; a guest is only in the pipeline once', () => {
  const inv = new LeadInventory();
  assert.equal(inv.fromDialogue({ guest: guest(), outcome: { interest: 0 } }), null);
  assert.equal(inv.fromDialogue({ guest: guest(), outcome: { interest: 70, lead: false } }), null);
  assert.ok(inv.fromDialogue({ guest: guest(), outcome: { interest: 70 } }));
  assert.equal(inv.fromDialogue({ guest: guest(), outcome: { interest: 90 } }), null);
  assert.equal(inv.open().length, 1);
});

test('leads expire at the start of the quarter after their expiry quarter', () => {
  let q = 2;
  const inv = new LeadInventory({ getQuarter: () => q });
  const warm = inv.fromDialogue({ guest: guest({ id: 'w' }), outcome: { interest: 50 } }); // expires Q3
  const hot = inv.fromDialogue({ guest: guest({ id: 'h' }), outcome: { interest: 80 } }); // expires Q4
  q = 3;
  assert.equal(inv.expire().length, 0);
  q = 4;
  assert.deepEqual(inv.expire().map((l) => l.id), [warm.id]);
  assert.equal(warm.status, 'expired');
  assert.equal(warm.closedQuarter, 4);
  assert.equal(hot.status, 'open');
  q = 5;
  inv.expire();
  assert.deepEqual(inv.counts(), { open: 0, consumed: 0, expired: 2, lost: 0 });
});

test('consume marks a lead used once; an expired lead cannot be consumed', () => {
  let q = 1;
  const inv = new LeadInventory({ getQuarter: () => q });
  const a = inv.fromDialogue({ guest: guest({ id: 'a' }), outcome: { interest: 50 } });
  assert.equal(inv.consume(a.id, { saleId: 's1' }).status, 'consumed');
  assert.equal(inv.consume(a.id), null);
  const b = inv.fromDialogue({ guest: guest({ id: 'b' }), outcome: { interest: 10 } }); // cold: expires Q1
  q = 2;
  assert.equal(inv.consume(b.id), null);
  assert.equal(b.status, 'expired');
});

test('open() lists the best leads first and filters by region', () => {
  const inv = new LeadInventory();
  inv.fromDialogue({ guest: guest({ id: 'x', wealthClass: 'C1', region: 'tech' }), outcome: { interest: 90 } });
  inv.fromDialogue({ guest: guest({ id: 'y', wealthClass: 'C4' }), outcome: { interest: 50 } });
  inv.fromDialogue({ guest: guest({ id: 'z', wealthClass: 'C2' }), outcome: { interest: 95 } });
  assert.deepEqual(inv.open().map((l) => l.guest.id), ['z', 'x', 'y']);
  assert.deepEqual(inv.open({ region: 'coastal' }).map((l) => l.guest.id), ['z', 'y']);
});

test('reputation and Showroom prestige above 40 raise quality in steps of 20', () => {
  const inv = new LeadInventory({ getReputation: () => 80, getShowroomPrestige: () => 60 });
  const l = inv.fromDialogue({ guest: guest(), outcome: { interest: 50 } });
  assert.equal(l.quality, 50 + (2 + 1) * 10);
  assert.equal(l.tier, 'hot');
});

test('the pipeline is capped: past the cap the oldest cold lead is lost', () => {
  const inv = new LeadInventory({ maxOpen: 2 });
  const a = inv.fromDialogue({ guest: guest({ id: 'a' }), outcome: { interest: 10 } });
  inv.fromDialogue({ guest: guest({ id: 'b' }), outcome: { interest: 90 } });
  inv.fromDialogue({ guest: guest({ id: 'c' }), outcome: { interest: 60 } });
  assert.equal(a.status, 'lost');
  assert.equal(inv.open().length, 2);
});

test('validation rejects a bad region or wealth class', () => {
  const inv = new LeadInventory();
  assert.throws(() => inv.create({ guest: { name: 'X' }, region: 'atlantis', wealthClass: 'C1', quality: 50 }), /region/);
  assert.throws(() => inv.create({ guest: { name: 'X' }, region: 'tech', wealthClass: 'C9', quality: 50 }), /wealthClass/);
  assert.deepEqual(validateLead({ guest: { name: 'X' }, region: 'tech', wealthClass: 'C1', quality: 1, createdQuarter: 1, expiresQuarter: 1 }), []);
});

test('every GDD region and class maps onto the world map for the sales hook', () => {
  for (const r of GDD_REGIONS) assert.ok(GDD_TO_SALES_REGION[r.id], r.id);
  assert.equal(new Set(Object.values(GDD_TO_SALES_REGION)).size, 8);
  for (const c of ['C1', 'C2', 'C3', 'C4', 'C5']) assert.ok(CLASS_TO_SALES_WEALTH[c]);
});

test('a shelter sale on the world map consumes the lead through the sales hook', () => {
  const ledger = new Ledger({ startingCash: 0 });
  const market = new LeadMarket({ seed: 1 }); // no waiting map buyers anywhere
  const sales = new MapSales({ market, ledger });
  const shelter = sales.addFinished({ name: 'Shelter #1', rooms: ['bunk', 'gold_taps', 'mil_scrubber'], occupants: 6 });
  const inv = new LeadInventory({ getQuarter: () => 2 });
  const l = inv.fromDialogue({ guest: guest(), outcome: { interest: 80 } });
  assert.throws(() => sales.sell('eur', shelter.id), /No buyers/); // without the lead, nobody buys
  const record = inv.sell(sales, shelter.id, l.id);
  assert.equal(record.owner, 'Honoria Ashcombe');
  assert.equal(record.region, 'eur');
  assert.equal(record.wealth, 'ultra');
  assert.ok(record.price > 0);
  assert.equal(ledger.cash, record.price);
  assert.equal(l.status, 'consumed');
  assert.equal(l.saleId, record.id);
  assert.equal(sales.stock.length, 0);
});

test('the sales hook refuses a lead from another region, and the lead stays open', () => {
  const sales = new MapSales({ market: new LeadMarket({ seed: 1 }), ledger: new Ledger() });
  const shelter = sales.addFinished({ name: 'S', rooms: ['bunk'], occupants: 2 });
  const inv = new LeadInventory();
  const l = inv.fromDialogue({ guest: guest({ region: 'tech' }), outcome: { interest: 80 } });
  assert.match(sales.quote('eur', shelter.id, { lead: inv.asBuyer(l) }).error, /another region/);
  assert.equal(l.status, 'open');
});

test('save and load', () => {
  const inv = new LeadInventory({ getQuarter: () => 4 });
  inv.fromDialogue({ guest: guest(), outcome: { interest: 66 } });
  const back = new LeadInventory();
  back.load(JSON.parse(JSON.stringify(inv)));
  assert.deepEqual(back.leads, inv.leads);
  assert.equal(back.create({ guest: { name: 'N' }, region: 'tech', wealthClass: 'C1', quality: 5, quarter: 4 }).id, 2);
});

test('lifetimes match the LEADS table', () => {
  assert.deepEqual(LEADS.tiers.map((t) => [t.id, t.lifetime]), [['hot', 2], ['warm', 1], ['cold', 0]]);
});
