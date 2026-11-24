import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identifyRoom, ROOM_TYPES, buildable, missingFor } from '../src/catalog/identify.js';
import { GDD_ROOMS, ENCLOSED_ROOMS } from '../src/catalog/rooms.js';
import { OBJECTS } from '../src/shelter/bunker-catalog.js';

const id = (counts, opts) => identifyRoom(counts, opts).type.id;

test('rooms are enclosed spaces; fixtures, the spine and surface builds are not rooms', () => {
  const kinds = {};
  for (const r of GDD_ROOMS) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
  assert.deepEqual(kinds, { room: 59, fixture: 8, structure: 1, surface: 5 });
  for (const r of ENCLOSED_ROOMS) assert.ok(r.requires && (Object.keys(r.requires.all ?? {}).length || r.requires.anyOf?.length), `${r.id} has a definition`);
  for (const r of GDD_ROOMS.filter((x) => x.kind !== 'room')) assert.equal(r.requires, null, r.id);
});

test('the objects inside decide the room', () => {
  assert.equal(id({ bunk: 2 }), 'bunk_room');
  assert.equal(id({ shelf: 1 }), 'pantry');
  assert.equal(id({ fridge: 2 }), 'pantry');
  assert.equal(id({ med_bed: 1 }), 'med_bay');
  assert.equal(id({ wine_rack: 3 }), 'wine_cellar');
  assert.equal(id({ cryo_pod: 1 }), 'cryo_pod_bay');
  assert.equal(id({ toilet: 1, shower: 1 }), 'washroom');
  assert.equal(id({ plant: 1, lamp: 1 }), 'storeroom', 'objects that define no room make a storeroom');
  assert.equal(id({}), 'empty');
});

test('one identity at a time: most specific, then most defining objects, then most valuable', () => {
  assert.equal(id({ bunk: 1, king_bed: 1 }), 'master_suite', 'the four-poster is worth more than the bunk');
  assert.equal(id({ king_bed: 1, bed: 1 }), 'master_suite', 'not Guest Quarters');
  assert.equal(id({ bed: 2 }), 'guest_quarters');
  assert.equal(id({ fridge: 1, stove: 1 }), 'galley_kitchen', 'Comfort beats Survive');
  assert.equal(id({ bookshelf: 1, pool_table: 1 }), 'library_game_room', 'two requirements beat one (Lounge)');
  assert.equal(id({ bookshelf: 1 }), 'lounge');
  assert.equal(id({ tank: 1, recycler: 1 }), 'deep_water_recycler', 'the more advanced room');
  assert.equal(id({ painting: 2, bunk: 1 }), 'art_vault', 'two paintings outweigh one bunk');
  assert.equal(id({ painting: 1, bunk: 1 }), 'bunk_room', 'one painting does not make an Art Vault');
  assert.equal(id({ diesel: 2, fuel: 1, battery: 1, tank: 1, hepa: 1 }), 'diesel_generator', 'more of its defining objects');
  // every result is exactly one type
  const r = identifyRoom({ bunk: 1, wine_rack: 1, stove: 1, hydro: 1 });
  assert.equal(typeof r.type.id, 'string');
  assert.equal(r.type.id, 'wine_cellar');
});

test('a hint names the closest room the space is not yet, and what to add', () => {
  const r = identifyRoom({ painting: 1 });
  assert.equal(r.type.id, 'storeroom');
  assert.equal(r.hint.id, 'art_vault');
  assert.deepEqual(r.hint.missing, [{ object: 'painting', count: 1 }]);
  const lib = identifyRoom({ bookshelf: 1 }).hint;
  assert.equal(lib.id, 'library_game_room');
  assert.deepEqual(lib.missing[0].orAny, ['pool_table', 'arcade']);
  assert.equal(identifyRoom({}).hint, null);
});

test('rooms whose objects are not in the bunker yet exist as data but are never recognised', () => {
  const planned = ENCLOSED_ROOMS.filter((r) => !buildable(r.requires));
  assert.ok(planned.some((r) => r.id === 'throne_room'));
  assert.equal(id({ throne: 1 }), 'storeroom'); // not a real object yet
  const live = ENCLOSED_ROOMS.filter((r) => buildable(r.requires));
  for (const r of live) {
    const counts = {};
    for (const [o, n] of Object.entries(r.requires.all ?? {})) counts[o] = n;
    if (r.requires.anyOf) counts[r.requires.anyOf.find((o) => OBJECTS[o])] = 1;
    assert.deepEqual(missingFor(r.requires, counts), [], r.id);
    assert.equal(id(counts), r.id, `${r.id}'s own definition makes it that room`);
  }
});

test('alternate-world rooms count only in worlds running their track', () => {
  const alt = ROOM_TYPES.filter((t) => t.track);
  assert.equal(alt.length, 8, 'the 12 alternate entries minus 3 fixtures and the surface Cloud Embassy');
  // none are buildable yet (planned objects), so the roster filter is the only gate once they are
  assert.ok(alt.every((t) => !buildable(t.requires)));
});
