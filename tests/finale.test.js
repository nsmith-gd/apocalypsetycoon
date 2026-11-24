import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrivingApocalypse, worldAtMidnight, finaleArgs } from '../src/midnight/finale.js';
import { computeMidnight } from '../src/midnight/midnight.js';

const T = (id, tension, state = 'calm', extra = {}) => ({ id, name: id, open: true, tension, state, breaches: 0, ...extra });
// A tile-built HQ: 800 days sealed, blast 4, seal 3 (as BunkerSite.toShelter() reports it).
const hq = { id: 'hq', name: 'HQ', owner: 'board', occupants: 6, rooms: [], sold: false, sealed: { daysSealed: 800, ratings: { seal: 3, blast: 4, security: 1, morale: 3 } } };

test('the arriving apocalypse: collapsed beats breached beats brink beats hottest', () => {
  assert.equal(arrivingApocalypse([T('atomic', 60), T('bloom', 40)]).id, 'atomic');
  assert.equal(arrivingApocalypse([T('atomic', 60), T('bloom', 72, 'brink')]).id, 'bloom');
  assert.equal(arrivingApocalypse([T('atomic', 88, 'brink'), T('hush', 50, 'locked')]).id, 'hush');
  const a = arrivingApocalypse([T('atomic', 88, 'breach'), T('pitchforks', 100, 'collapsed')]);
  assert.equal(a.id, 'pitchforks');
  assert.equal(a.days, 365);
  assert.match(a.reason, /collapsed/);
  assert.equal(arrivingApocalypse([T('bloom', 99, 'calm', { open: false }), T('superstorm', 30)]).id, 'superstorm', 'unopened tracks are ignored');
  assert.equal(arrivingApocalypse([T('pandemic', 50)]).id, 'bloom', 'old track ids still map');
});

test('the same shelter fares differently against different apocalypses', () => {
  const atomic = computeMidnight({ shelters: [hq], world: { tension: 60 }, apocalypse: arrivingApocalypse([T('atomic', 60)]) });
  const hush = computeMidnight({ shelters: [hq], world: { tension: 60 }, apocalypse: arrivingApocalypse([T('hush', 60)]) });
  assert.equal(atomic.apocalypse.name, 'Atomic Standoff');
  assert.equal(atomic.shelters[0].survivors, 6, '800 days sealed beats Atomic Standoff (730)');
  assert.ok(hush.shelters[0].survivors < 6, 'but not four years of The Hush');
});

test('the world state decides engineered vs failed to contain, and the grade', () => {
  const calm = finaleArgs({ crisis: { tracks: { atomic: T('atomic', 60) } }, pushback: { tension: 40, heat: 20, runaways: 0 }, shelters: [hq] });
  const wrecked = finaleArgs({ crisis: { tracks: { atomic: T('atomic', 100, 'collapsed', { breaches: 2 }), bloom: T('bloom', 95, 'breach', { breaches: 1 }) } }, pushback: { tension: 40, heat: 80, runaways: 0 }, shelters: [hq] });
  assert.deepEqual(worldAtMidnight({ tracks: Object.values({ a: T('a', 100, 'collapsed', { breaches: 2 }), b: T('b', 95, 'breach', { breaches: 1 }) }), pushback: { heat: 80 } }), { tension: 100, heat: 80, runaways: 3, collapses: 1 });
  const r1 = computeMidnight(calm);
  const r2 = computeMidnight(wrecked);
  assert.equal(r1.type, 'engineered');
  assert.equal(r2.type, 'failed');
  assert.ok(r2.needMultiplier > 1, 'failed to contain: shelters need more');
  assert.ok(r1.survivalRate >= r2.survivalRate);
  assert.ok(r1.grade && r2.grade);
});
