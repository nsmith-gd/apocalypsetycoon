// #141: product lines as plot templates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BunkerSite } from '../src/shelter/bunker.js';
import { plotOf, productFor, PLOT_PRODUCTS } from '../src/catalog/products.js';
import { ClientBook } from '../src/clients/clients.js';

const site = (minutes = Infinity) => new BunkerSite({ surveyed: true, catalog: { minutes: () => minutes, roster: () => [] } });

test('the three plot products: widths and floor caps from the GDD', () => {
  assert.deepEqual(PLOT_PRODUCTS.map((id) => { const p = plotOf(id); return [p.width, p.minFloors, p.maxFloors]; }), [[16, 1, 3], [24, 1, 5], [16, 8, 12]]);
});

test('the Solo Pod plot edge and its 3-floor cap stop digging, building and placing past the limit', () => {
  const s = site();
  assert.equal(s.setProduct('solo_pod').ok, true);
  assert.equal(s.dig(15, 0).ok, true);
  assert.match(s.dig(16, 0).reason, /plot edge \(16 m wide\)/);
  assert.equal(s.dig(5, 11).ok, true);
  assert.match(s.dig(5, 12).reason, /3-floor limit/);
  assert.match(s.build('wall', 16, 0).reason, /plot edge/);
  s.digRect(10, 0, 15, 3);
  assert.match(s.place('bed', 14, 3).reason, /plot edge/); // a 3-wide bed would stick out
  assert.equal(s.place('bed', 12, 3).ok, true);
});

test('the Family Vault goes 24 wide and 5 floors; the Condo Silo 16 wide and down to 12 floors', () => {
  const v = site();
  v.setProduct('family_vault');
  assert.equal(v.dig(23, 19).ok, true);
  assert.match(v.dig(5, 20).reason, /5-floor limit/);
  const c = site();
  c.setProduct('condo_silo');
  assert.equal(c.dig(5, 47).ok, true);
  assert.match(c.dig(5, 48).reason, /12-floor limit/);
  assert.match(c.dig(16, 3).reason, /plot edge/);
});

test('products unlock on schedule, and are chosen before breaking ground', () => {
  const s = site(10);
  assert.match(s.setProduct('family_vault').reason, /isn't unlocked/);
  assert.equal(s.setProduct('solo_pod').ok, true);
  s.dig(3, 0);
  assert.match(s.setProduct('solo_pod').reason, /before you break ground/);
  assert.equal(site(60).setProduct('family_vault').ok, true);
  assert.match(site(60).setProduct('condo_silo').reason, /isn't unlocked/);
  assert.equal(site(90).setProduct('condo_silo').ok, true);
});

test('a Condo Silo hands over only with 8+ floors and 4-8 household units (floors with beds)', () => {
  const s = site();
  s.setProduct('condo_silo');
  for (let y = 0; y < 34; y++) { s.dig(0, y); s.dig(1, y); s.build('spine', 0, y); s.build('spine', 1, y); }
  s.digRect(2, 1, 10, 3); s.place('bunk', 3, 3);
  s.finishAll();
  assert.match(s.handOver('Silo').reason, /at least 8 floors/);
  for (const f of [1, 2, 3, 4, 5, 6, 7]) { s.digRect(2, f * 4 + 1, 10, f * 4 + 3); if (f <= 3) s.place('bunk', 3, f * 4 + 3); }
  s.finishAll();
  assert.deepEqual([s.floorsUsed().deepest, s.floorsUsed().units], [8, 4]);
  const r = s.handOver('Silo');
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.shelter.product, 'condo_silo');
  assert.equal(r.shelter.units, 4);
  assert.equal(s.product, null, 'the next plot picks its own product');
});

test('contracts pick a product by size and what is unlocked', () => {
  assert.equal(productFor(3, { minutes: 0 }), 'solo_pod');
  assert.equal(productFor(6, { minutes: 0 }), 'solo_pod'); // the Vault isn't out yet
  assert.equal(productFor(6, { minutes: 60 }), 'family_vault');
  const book = new ClientBook();
  const o = book.generateOrder({ minutes: 60 });
  assert.ok(PLOT_PRODUCTS.includes(o.product));
});

test('the chosen product is saved with the site', () => {
  const s = site();
  s.setProduct('family_vault');
  const c = site();
  c.load(JSON.parse(JSON.stringify(s)));
  assert.equal(c.product, 'family_vault');
});
