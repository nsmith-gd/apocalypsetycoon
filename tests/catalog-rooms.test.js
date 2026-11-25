// #140: every catalog room and fixture is buildable once unlocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BunkerSite } from '../src/shelter/bunker.js';
import { OBJECTS, CATALOG_OBJECT_IDS, layerOf } from '../src/shelter/bunker-catalog.js';
import { GDD_ROOMS } from '../src/catalog/rooms.js';
import { definingObject, ENTRY_OBJECTS } from '../src/catalog/room-objects.js';

const ALL_TRACKS = [...new Set(GDD_ROOMS.map((r) => r.track).filter(Boolean))];
const unlocked = () => new BunkerSite({ surveyed: true, catalog: { minutes: () => Infinity, roster: () => ['atomic', ...ALL_TRACKS] } });

/** The objects that make a room: every `all` entry (with its count) and one `anyOf`. */
function recipe(room) {
  const req = room.requires;
  const list = [];
  for (const [o, n] of Object.entries(req.all ?? {})) for (let i = 0; i < n; i++) list.push(o);
  if (req.anyOf) list.push(req.anyOf.find((o) => OBJECTS[o]));
  return list;
}

/** Dig a walled room reached by a spine from the surface, big enough for `objs`, at the depth they need. */
function buildRoom(site, objs) {
  const floorObjs = objs.filter((o) => layerOf(OBJECTS[o]) === 'floor');
  const span = (list) => list.reduce((s, o) => s + OBJECTS[o].w + 1, 1);
  const w = Math.max(3, span(floorObjs), span(objs.filter((o) => !floorObjs.includes(o))));
  const h = Math.max(3, ...objs.map((o) => OBJECTS[o].h));
  const bottom = Math.max(h, ...objs.map((o) => OBJECTS[o].minDepth ?? 0)) + 1;
  for (let y = 0; y <= bottom + 1; y++) { site.dig(0, y); site.dig(1, y); site.build('spine', 0, y); site.build('spine', 1, y); }
  const x0 = 2, x1 = x0 + w + 1, top = bottom - h;
  site.digRect(x0, top - 1, x1, bottom + 1);
  site.buildRect('wall', x0, top - 1, x1, top - 1); site.buildRect('wall', x0, bottom + 1, x1, bottom + 1); site.buildRect('wall', x1, top, x1, bottom);
  const at = { floor: x0 + 1, wall: x0 + 1 };
  for (const o of objs) {
    const lay = layerOf(OBJECTS[o]) === 'floor' ? 'floor' : 'wall';
    const r = site.place(o, at[lay], bottom);
    assert.ok(r.ok, `${o}: ${r.reason}`);
    at[lay] += OBJECTS[o].w + 1;
  }
  site.finishAll();
  return { x: x0 + 1, y: bottom };
}

test('every GDD catalog entry has an object or structure that builds it', () => {
  assert.equal(GDD_ROOMS.length, 73);
  for (const r of GDD_ROOMS) {
    if (r.kind === 'structure') continue;
    const id = definingObject(r) ?? r.objects?.[0];
    assert.ok(id && OBJECTS[id], `${r.id} has no buildable object`);
  }
  assert.equal(CATALOG_OBJECT_IDS.length, 36);
});

test('with everything unlocked, each enclosed room id is built and recognised as that room', () => {
  for (const room of GDD_ROOMS.filter((r) => r.kind === 'room')) {
    const site = unlocked();
    const at = buildRoom(site, recipe(room));
    const sim = site.simulate();
    const found = sim.rooms[sim.roomOf[site.idx(at.x, at.y)]];
    assert.equal(found?.type.id, room.id, `${room.id} built as ${found?.type.id}`);
  }
});

test('fixtures, surface builds and the spine can be placed', () => {
  for (const room of GDD_ROOMS.filter((r) => r.kind !== 'room')) {
    const site = unlocked();
    if (room.kind === 'structure') { site.dig(0, 0); assert.equal(site.build('spine', 0, 0).ok ?? true, true, room.id); continue; }
    const id = ENTRY_OBJECTS[room.id] ?? room.objects?.[0];
    const o = OBJECTS[id];
    if (o.surface) { const r = site.place(id, 2, -1); assert.ok(r.ok, `${room.id}: ${r.reason}`); continue; }
    site.digRect(2, 0, 8, 3);
    const r = site.place(id, 3, 3);
    assert.ok(r.ok, `${room.id}: ${r.reason}`);
    site.finishAll();
    assert.ok([...site.objects.values()].some((x) => x.kind === id), room.id);
  }
});

test('locked until their unlock time; alternate rooms only in their track\'s world', () => {
  let minutes = 0;
  const site = new BunkerSite({ surveyed: true, catalog: { minutes: () => minutes, roster: () => ['atomic', 'bloom'] } });
  site.digRect(2, 0, 12, 3);
  assert.match(site.place('throne', 3, 3).reason, /unlocks at 3:50/);
  minutes = 240;
  assert.equal(site.place('throne', 3, 3).ok, true);
  assert.match(site.place('boiler', 8, 3).reason, /only exists in worlds/);
  const longshade = new BunkerSite({ surveyed: true, catalog: { minutes: () => 240, roster: () => ['longshade'] } });
  longshade.digRect(2, 0, 12, 3);
  assert.equal(longshade.place('boiler', 3, 3).ok, true);
});

test('generated objects carry their room\'s GDD numbers', () => {
  assert.equal(OBJECTS.throne.prestige, 20);
  assert.equal(OBJECTS.throne.power, -5);
  assert.equal(OBJECTS.pool_basin.water, -400);
  assert.equal(OBJECTS.mansion_facade.h >= 4, true, 'double-height rooms need a double-height space');
  assert.equal(OBJECTS.fuel_bladder.track, 'longshade');
  assert.equal(OBJECTS.helipad_deck.surface, true);
});
