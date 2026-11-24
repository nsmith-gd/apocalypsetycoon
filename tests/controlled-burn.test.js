// #93: the controlled burn — deliberately breach a track at its Brink.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CrisisSystem } from '../src/crisis/breach.js';
import { Pushback } from '../src/pushback/pushback.js';
import { LeadMarket } from '../src/demand/demand.js';
import { Ledger } from '../src/ledger/ledger.js';
import { MapSales } from '../src/worldmap/sales.js';

function world() {
  const pb = new Pushback({});
  const crisis = new CrisisSystem({ seed: 1, pushback: pb, tips: { pandemic: 90, climate: 90, unrest: 90, markets: 90, war: 90 } });
  const market = new LeadMarket({ seed: 1 });
  const sales = new MapSales({ market, ledger: new Ledger(), getTensions: () => Object.fromEntries(Object.values(crisis.tracks).map((t) => [t.id, t.tension])), getBreachMultiplier: () => crisis.panicMultiplier });
  return { pb, crisis, sales };
}
const contain = (crisis, id) => crisis._contain(crisis.tracks[id]); // fill the bar (sources are #64's business)

test('only a track at its Brink can be burned', () => {
  const { crisis } = world();
  crisis.setTension('pandemic', 50);
  assert.equal(crisis.controlledBurn('pandemic').ok, false);
  crisis.setTension('pandemic', 82);
  assert.equal(crisis.tracks.pandemic.state, 'brink');
  const r = crisis.controlledBurn('pandemic');
  assert.equal(r.ok, true);
  assert.equal(crisis.tracks.pandemic.state, 'breach');
  assert.equal(crisis.tracks.pandemic.window.controlled, true);
  assert.equal(r.weeks, 6);
  assert.equal(r.nextWindow, 4);
});

test('a burn doubles the panic premium on map prices until containment ends, and costs heat', () => {
  const { pb, crisis, sales } = world();
  crisis.setTension('pandemic', 82);
  const before = sales.overview().find((r) => r.id === 'lat').panicPremium;
  const heat0 = pb.heat;
  crisis.controlledBurn('pandemic');
  assert.equal(pb.heat, heat0 + 10);
  const during = sales.overview().find((r) => r.id === 'lat').panicPremium;
  assert.ok(during - 1 >= (before - 1) * 2 - 0.01, `${before} -> ${during}`);
  contain(crisis, 'pandemic');
  assert.equal(crisis.tracks.pandemic.state, 'locked');
  const after = sales.overview().find((r) => r.id === 'lat').panicPremium;
  assert.ok(after < during, 'premium back to normal once contained');
});

test('the price of a burn: a scar on containment and a shorter window the next time', () => {
  const { crisis } = world();
  crisis.setTension('pandemic', 82);
  const tip0 = crisis.tippingPoint('pandemic');
  crisis.controlledBurn('pandemic');
  contain(crisis, 'pandemic');
  assert.equal(crisis.tippingPoint('pandemic'), tip0 - 3);
  for (let i = 0; i < 3; i++) crisis.advanceWeek(); // recovery lock lifts
  crisis.setTension('pandemic', 100);
  assert.equal(crisis.tracks.pandemic.window.total, 4);
});
