import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_ROSTER, resolveTrack, resolveTracks, rosterLinks, rosterPicksFromParams, slotOf, rivalFavourites, heroFears, HERO_CLIENTS } from '../src/world/tracks.js';
import { simulateWorld } from '../src/debug/world-sim.js';
import { arrivingApocalypse } from '../src/midnight/finale.js';
import { loadVenueCatalog } from '../src/events/venues.js';
import { EventCircuit } from '../src/events/attend.js';

const GOO = CLASSIC_ROSTER.map((id) => (id === 'bloom' ? 'greygoo' : id));

test('the debug flag swaps The Bloom for The Grey Goo in slot 2', () => {
  const picks = rosterPicksFromParams(new URLSearchParams('greygoo'));
  assert.deepEqual(picks, { 2: 'greygoo' });
  assert.deepEqual(CLASSIC_ROSTER.map((id) => picks[slotOf(id)] ?? id), GOO);
  assert.deepEqual(rosterPicksFromParams(new URLSearchParams('slot3=longshade&slot4=nonsense')), { 3: 'longshade' });
});

test('names resolve by slot: links, hero fears, rival favourites, themes', () => {
  assert.equal(resolveTrack(GOO, 'bloom'), 'greygoo');
  assert.equal(resolveTrack(CLASSIC_ROSTER, 'greygoo'), 'bloom');
  assert.deepEqual(resolveTracks(GOO, ['atomic', 'bloom', 'bloom']), ['atomic', 'greygoo']);
  const classic = rosterLinks(CLASSIC_ROSTER).map((l) => [l.from, l.to].map((id) => (id === 'bloom' ? 'S2' : id)));
  const goo = rosterLinks(GOO).map((l) => [l.from, l.to].map((id) => (id === 'greygoo' ? 'S2' : id)));
  assert.deepEqual(goo, classic, 'Grey Goo inherits every slot-2 link');
  const lexi = HERO_CLIENTS.find((h) => h.id === 'lexi');
  assert.deepEqual(heroFears(lexi, GOO), ['greygoo']);
  assert.deepEqual(heroFears(lexi, CLASSIC_ROSTER), ['bloom']);
  assert.deepEqual(rivalFavourites('bunkr', CLASSIC_ROSTER.map((id) => (id === 'optimizer' ? 'kessler' : id))), ['kessler']);
});

test('guests at events fear the roster\'s tracks, never a track that is not in play', async () => {
  const catalog = await loadVenueCatalog();
  const fears = (roster) => {
    const c = new EventCircuit({ catalog, seed: 3, roster });
    return new Set(catalog.venues.flatMap((v) => c.pool(v).flatMap((g) => g.fears)));
  };
  const goo = fears(GOO);
  assert.ok(goo.has('greygoo'));
  assert.ok(!goo.has('bloom'));
  const classic = fears(CLASSIC_ROSTER);
  assert.ok(classic.has('bloom'));
  for (const f of classic) assert.ok(CLASSIC_ROSTER.includes(f), `${f} is not in the classic roster`);
});

test('the apocalypse table knows the alternates', () => {
  assert.equal(arrivingApocalypse([{ id: 'greygoo', open: true, tension: 80, state: 'brink' }]).name, 'The Grey Goo');
  assert.equal(arrivingApocalypse([{ id: 'cloudstrike', open: true, tension: 50 }]).days, 1200);
});

test('a world-harness run completes with The Grey Goo in slot 2, using its slot-2 links', () => {
  const r = simulateWorld({ roster: GOO, seed: 1 });
  assert.equal(r.completed, true);
  assert.equal(r.weeks, 156);
  assert.ok(r.opened.some((o) => o.track === 'greygoo'));
  assert.ok(r.dominoes.some((d) => d.from === 'greygoo'), 'its collapse shoves its slot-2 neighbours');
  assert.equal(r.apocalypse, 'The Grey Goo');
});
