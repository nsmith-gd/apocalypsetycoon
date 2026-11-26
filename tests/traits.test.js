// #163: one test per client trait (GDD Clients and needs ladder > Client traits), plus rolling and the sale wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAITS, TRAIT_IDS, rollTraits, visibleTraits, consult, contractDemands, checkDemands, tunedSealed, salePriceFor, onSaleHooks, quarterHooks, fearWeight, referralMultiplier, daysRequirement, extraMouths, sharedSiloMorale } from '../src/clients/traits.js';
import { seededRng } from '../src/campaign/rng.js';
import { MapSales, leadTraits } from '../src/worldmap/sales.js';
import { LeadMarket } from '../src/demand/demand.js';
import { Pushback } from '../src/pushback/pushback.js';
import { ENCLOSED_ROOMS } from '../src/catalog/rooms.js';

const T = (...ids) => ids.map((id) => ({ id, hidden: false }));
// a sealed record like the tile bunker's: 4 people, 1,000 meals in store, grows 2 a day, needs 8 a day
const SEALED = { daysSealed: 166.6, occupants: 4, days: { air: Infinity, water: 400, food: 166.6, power: 300 }, flows: { food: { stock: 1000, production: 2, need: 8 }, power: { demand: 10, supply: 0 } }, ratings: { seal: 2 } };

test('there are sixteen traits, every demanded room exists in the catalog', () => {
  assert.equal(TRAIT_IDS.length, 16);
  const rooms = new Set(ENCLOSED_ROOMS.map((r) => r.id));
  for (const d of contractDemands(T(...TRAIT_IDS))) assert.ok(rooms.has(d.room), d.room);
});
test('rolling: 1-3 traits, no duplicates or clashes; some hidden until the consultation', () => {
  const rng = seededRng(5);
  let hidden = 0;
  for (let i = 0; i < 300; i++) {
    const t = rollTraits(rng);
    assert.ok(t.length >= 1 && t.length <= 3);
    assert.equal(new Set(t.map((x) => x.id)).size, t.length);
    assert.ok(!(t.some((x) => x.id === 'penny_pincher') && t.some((x) => x.id === 'philanthropist')));
    hidden += t.filter((x) => x.hidden).length;
  }
  assert.ok(hidden > 0);
  const t = [{ id: 'knows_too_much', hidden: true }, { id: 'gourmand', hidden: false }];
  assert.equal(visibleTraits(t)[0].name, '???');
  assert.equal(visibleTraits(consult(t))[0].name, 'Knows Too Much');
});

test('Paranoid: demands 25% more Days Sealed and signs off slowly', () => {
  assert.equal(daysRequirement(400, T('paranoid')), 500);
  assert.equal(onSaleHooks(T('paranoid')).payWeeksLate, 2);
  assert.ok(TRAITS.paranoid.inspectsSurvive);
});
test('Engineer: a flawed shelter costs reputation with their peers', () => {
  assert.equal(onSaleHooks(T('engineer'), { grades: { air: 'A', water: 'F', food: 'B' } }).reputation, -2);
  assert.equal(onSaleHooks(T('engineer'), { grades: { air: 'A', water: 'A', food: 'B' } }).reputation, 0);
});
test('Germaphobe: demands Decon and a Med Bay, fears The Bloom twice as much, change orders', () => {
  assert.deepEqual(contractDemands(T('germaphobe')).map((d) => d.room), ['decon_shower', 'med_bay']);
  assert.equal(fearWeight(T('germaphobe'), 'bloom'), 2);
  assert.equal(fearWeight(T('germaphobe'), 'atomic'), 1);
  const c = checkDemands(['decon_shower', 'bunk_room'], T('germaphobe'));
  assert.deepEqual(c.missing.map((d) => d.room), ['med_bay']);
  assert.ok(onSaleHooks(T('germaphobe')).changeOrder > 0);
});
test('Gourmand: eats 1.5x the food, so Days Sealed food falls', () => {
  const s = tunedSealed(SEALED, T('gourmand'));
  // need 12/day, grows 2 -> 1000 / 10 = 100 days (was 166.6)
  assert.equal(s.days.food, 100);
  assert.equal(s.daysSealed, 100);
  assert.deepEqual(contractDemands(T('gourmand')).map((d) => d.room), ['chefs_kitchen', 'wine_cellar']);
});
test('Pet Parent: animals are extra mouths', () => {
  assert.equal(extraMouths(T('pet_parent')), 2);
  assert.ok(tunedSealed(SEALED, T('pet_parent')).days.food < SEALED.days.food);
});
test('Influencer: doubles referrals and leaks heat +3 a quarter unless under NDA', () => {
  assert.equal(referralMultiplier(T('influencer')), 2);
  assert.equal(quarterHooks({ traits: T('influencer') }).heat, 3);
  assert.equal(quarterHooks({ traits: T('influencer'), nda: true }).heat, 0);
});
test('Collector: wants an Art Vault and a Museum of Me; climate power cuts power days', () => {
  assert.deepEqual(contractDemands(T('collector')).map((d) => d.room), ['art_vault', 'museum_of_me']);
  assert.ok(tunedSealed(SEALED, T('collector')).days.power < SEALED.days.power);
});
test('Dynast: +2 occupants and longer Days Sealed requirements', () => {
  assert.equal(extraMouths(T('dynast')), 2);
  assert.equal(daysRequirement(500, T('dynast')), 600);
});
test('Health Optimizer: Biohacking Lab, then Cryo Pods', () => {
  assert.deepEqual(contractDemands(T('health_optimizer')).map((d) => d.room), ['biohacking_lab', 'cryo_pod_bay']);
  assert.ok(TRAITS.health_optimizer.wantsNewest);
});
test('Control Freak: leverage +10 at handover, a security risk', () => {
  const h = onSaleHooks(T('control_freak'));
  assert.equal(h.leverage, 10); assert.equal(h.securityRisk, 1);
});
test('Penny-Pincher: 15% off, pays late', () => {
  assert.equal(salePriceFor(10_000_000, T('penny_pincher')), 8_500_000);
  assert.equal(onSaleHooks(T('penny_pincher')).payWeeksLate, 4);
});
test('Secretly Broke: may default on retainers; you hold leverage over them', () => {
  const rng = seededRng(9);
  let d = 0; for (let i = 0; i < 400; i++) if (quarterHooks({ traits: T('secretly_broke') }, { rng }).defaulted) d++;
  assert.ok(d > 60 && d < 140, `${d} defaults in 400 quarters`);
  assert.equal(onSaleHooks(T('secretly_broke')).leverageOverThem, true);
});
test('Knows Too Much: starts with 30 leverage', () => assert.equal(onSaleHooks(T('knows_too_much')).leverage, 30));
test('Feuding: morale -20 when the enemy shares the silo', () => {
  const a = { name: 'Whitlock', traits: T('feuding'), feudsWith: 'Ashcombe' }, b = { name: 'Ashcombe', traits: [] };
  assert.equal(sharedSiloMorale([a, b]), -20);
  assert.equal(sharedSiloMorale([a]), 0);
});
test('Doomer Romantic: wants a Window Wall, small budget', () => {
  assert.deepEqual(contractDemands(T('doomer_romantic')).map((d) => d.room), ['window_wall']);
  assert.equal(salePriceFor(10_000_000, T('doomer_romantic')), 8_000_000);
});
test('Philanthropist: reputation +5, heat -3', () => {
  const h = onSaleHooks(T('philanthropist')); assert.equal(h.reputation, 5); assert.equal(h.heat, -3);
});
test('missing demands cost 10% each', () => assert.equal(salePriceFor(10_000_000, T('germaphobe'), { missing: 2 }), 8_000_000));

test('in a sale: the quote shows the demands, the record carries the Gourmand food and Knows Too Much leverage', () => {
  const market = new LeadMarket({ seed: 3 });
  const pb = new Pushback({ seed: 1 });
  const sales = new MapSales({ market, pushback: pb, getTensions: () => ({ pandemic: 80, climate: 80, unrest: 80, markets: 80, war: 80 }) });
  market.addLeads('eur', 1);
  const lead = market.leads.find((l) => l.region === 'eur');
  lead.traits = [{ id: 'gourmand', hidden: false }, { id: 'knows_too_much', hidden: true }];
  const sh = sales.addFinished({ name: 'Vault', rooms: ['bunk'], occupants: 4, sealed: SEALED, roomTypes: ['wine_cellar'] });
  const q = sales.quote('eur', sh.id, { lead });
  assert.deepEqual(q.demands.missing.map((d) => d.room), ['chefs_kitchen']);
  assert.equal(q.traits.every((t) => !t.hidden), true); // the consultation revealed Knows Too Much
  const rec = sales.sell('eur', sh.id, { lead });
  assert.equal(rec.sealed.days.food, 100);
  assert.ok(pb.clients.at(-1).leverage >= 30);
  assert.equal(leadTraits({ id: 7, region: 'eur' }).length >= 1, true);
});
