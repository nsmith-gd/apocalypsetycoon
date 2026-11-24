import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GDD_ROOMS, GDD_ROOM_BY_ID, TIER_COST, EXACT_COST, roomsForRoster } from '../src/catalog/rooms.js';
import { PRODUCT_LINES } from '../src/catalog/products.js';
import { UNLOCK_SCHEDULE, ALTERNATE_FOLLOW_UPS, NODES_OUTSIDE_SCHEDULE, nodeTargets, rowFor, lockedShelf } from '../src/catalog/unlocks.js';
import { COUNTER_ROOMS, CLASSIC_ROSTER, TRACK_BY_ID } from '../src/world/tracks.js';
import { OBJECTS, STRATA } from '../src/shelter/bunker-catalog.js';
import { ROOM_TYPES } from '../src/catalog/identify.js';
import { ROOM_CATALOG } from '../src/clients/rooms.js';
import { TREE_NODES } from '../src/research/tree-data.js';
import { GDD_UNLOCK_TARGETS, runHarness } from '../src/debug/sim.js';
import { PACING } from '../src/debug/pacing.js';

const count = (tier, alt) => GDD_ROOMS.filter((r) => r.tier === tier && r.alternate === alt).length;

test('73 rooms and fixtures: Survive 29, Comfort 10, Status 13, Delusion 9, plus 12 alternate-world rooms', () => {
  assert.equal(GDD_ROOMS.length, 73);
  assert.deepEqual([count('survive', false), count('comfort', false), count('status', false), count('delusion', false)], [29, 10, 13, 9]);
  assert.equal(GDD_ROOMS.filter((r) => r.alternate).length, 12);
  assert.equal(new Set(GDD_ROOMS.map((r) => r.id)).size, 73);
  assert.equal(roomsForRoster(CLASSIC_ROSTER).length, 61);
  assert.equal(roomsForRoster(['atomic', 'greygoo', 'superstorm', 'optimizer', 'hush', 'pitchforks']).length, 64);
});

test('every room has size, unlock time, provides, draws and a cost in its tier range', () => {
  for (const r of GDD_ROOMS) {
    assert.ok(r.size && r.provides && r.draws && Number.isFinite(r.unlockAt), r.id);
    if (!r.size.fixture && !r.size.fullHeight) assert.ok(r.size.w > 0 && r.size.h > 0, r.id);
    if (EXACT_COST[r.id]) assert.equal(r.cost, EXACT_COST[r.id]);
    else assert.ok(r.cost >= TIER_COST[r.tier].lo && r.cost <= TIER_COST[r.tier].hi, `${r.id} ${r.cost}`);
  }
  assert.equal(GDD_ROOM_BY_ID.micro_reactor.cost, 25_000_000);
  assert.equal(GDD_ROOM_BY_ID.airlock.cost, 200_000, 'starter rooms sit at the bottom of the range');
});

test('alternate rooms match the threat roster’s counter rooms (ids, tracks, unlock times)', () => {
  const alts = GDD_ROOMS.filter((r) => r.alternate);
  assert.deepEqual(alts.map((r) => r.id).sort(), Object.keys(COUNTER_ROOMS).sort());
  for (const r of alts) {
    assert.equal(r.track, COUNTER_ROOMS[r.id].track, r.id);
    assert.equal(r.unlockAt, COUNTER_ROOMS[r.id].unlockAt, r.id);
    assert.equal(TRACK_BY_ID[r.track].classic, false);
  }
});

test('links to the live tables point at real bunker objects, room types and client-package rooms', () => {
  for (const r of GDD_ROOMS) {
    for (const o of r.objects) assert.ok(OBJECTS[o], `${r.id}: object ${o}`);
    if (r.amenity) assert.ok(ROOM_CATALOG[r.amenity], `${r.id}: amenity ${r.amenity}`);
  }
  // every client-package room maps to a GDD room except the AI Butler, which the GDD does not have
  const mapped = new Set(GDD_ROOMS.map((r) => r.amenity).filter(Boolean));
  assert.deepEqual(Object.keys(ROOM_CATALOG).filter((id) => !mapped.has(id)), ['ai_butler']);
});

test('five product lines, Solo Pod to Ark, with plots and prices', () => {
  assert.deepEqual(PRODUCT_LINES.map((p) => p.id), ['solo_pod', 'family_vault', 'condo_silo', 'compound', 'ark']);
  assert.deepEqual(PRODUCT_LINES.map((p) => p.plot.width), [16, 24, 16, null, 64]);
  assert.equal(PRODUCT_LINES[0].price.min, 3_000_000);
  assert.equal(PRODUCT_LINES.at(-1).price.min, 500_000_000);
  for (const p of PRODUCT_LINES) assert.equal(rowFor(p.id)?.n, p.row, p.id);
});

test('48 unlocks: 39 research nodes and 9 free story, board and tier unlocks, in time order', () => {
  assert.equal(UNLOCK_SCHEDULE.length, 48);
  assert.deepEqual(UNLOCK_SCHEDULE.map((r) => r.n), Array.from({ length: 48 }, (_, i) => i + 1));
  assert.equal(UNLOCK_SCHEDULE.filter((r) => r.research).length, 39);
  assert.deepEqual(UNLOCK_SCHEDULE.filter((r) => !r.research).map((r) => r.n), [1, 6, 11, 12, 13, 28, 40, 47, 48]);
  for (let i = 1; i < 48; i++) assert.ok(UNLOCK_SCHEDULE[i].at > UNLOCK_SCHEDULE[i - 1].at, `row ${i + 1}`);
  // GDD Research costs: tier 1 is cash only ($0.5-2M); tiers 2-5 cost RP in their bands
  const band = { 2: [40, 60], 3: [120, 220], 4: [250, 350], 5: [200, 400] };
  for (const r of UNLOCK_SCHEDULE.filter((x) => x.research && x.gate.tier)) {
    if (r.gate.tier === 1) assert.ok(r.rp === 0 && r.cash >= 500_000 && r.cash <= 2_000_000, `row ${r.n}`);
    else assert.ok(r.rp >= band[r.gate.tier][0] && r.rp <= band[r.gate.tier][1], `row ${r.n} rp ${r.rp}`);
  }
  for (const r of UNLOCK_SCHEDULE) for (const s of r.strata) assert.ok(STRATA.some((x) => x.id === s), s);
  assert.deepEqual(lockedShelf(0).map((r) => r.n), [2, 3, 4]);
});

test('every room unlocks in exactly one row, at that row’s time', () => {
  for (const r of GDD_ROOMS) {
    const follow = ALTERNATE_FOLLOW_UPS.find((f) => f.room === r.id);
    if (follow) { assert.equal(r.unlockAt, follow.at, r.id); assert.equal(rowFor(r.id), null); continue; }
    const rows = UNLOCK_SCHEDULE.filter((u) => u.rooms.includes(r.id) || Object.values(u.alternateRooms).some((l) => l.includes(r.id)));
    assert.equal(rows.length, 1, r.id);
    assert.equal(rows[0].at, r.unlockAt, r.id);
  }
  for (const u of UNLOCK_SCHEDULE) for (const id of u.rooms) assert.ok(GDD_ROOM_BY_ID[id], `row ${u.n}: ${id}`);
  // alternates open with their track's Classic row (11, 21, 26, 31)
  for (const u of UNLOCK_SCHEDULE.filter((x) => Object.keys(x.alternateRooms).length)) {
    for (const t of Object.keys(u.alternateRooms)) assert.equal(TRACK_BY_ID[t].replaces, u.opensTrack, `row ${u.n}`);
  }
});

test('every live research node is on the schedule (or listed as a pre-GDD stand-in)', () => {
  const targets = nodeTargets();
  for (const nd of TREE_NODES) assert.ok(targets[nd.id] != null || NODES_OUTSIDE_SCHEDULE.includes(nd.id), nd.id);
  for (const id of NODES_OUTSIDE_SCHEDULE) assert.ok(TREE_NODES.some((n) => n.id === id), id);
});

test('pacing: unlock times fit the 12-quarter campaign and chapters, and drive the #12 harness targets', () => {
  const Q = PACING.quarterMinutes;
  const quarterOf = (m) => Math.floor(m / Q) + 1;
  // GDD times are real time at mixed speed (pauses included), so the last row lands inside the 5-6.5 h campaign
  const [lo, hi] = PACING.targetHours;
  assert.ok(UNLOCK_SCHEDULE.at(-1).at >= lo * 60 && UNLOCK_SCHEDULE.at(-1).at <= hi * 60, 'the Overtime offer comes as the campaign ends');
  // tier-ups land in the quarter that opens their chapter (GDD Pacing: chapters 2-5 start at Q3, Q5, Q8, Q11)
  const tier = (name) => UNLOCK_SCHEDULE.find((r) => r.features.includes(name)).at;
  assert.deepEqual(['Boutique tier', 'Firm tier', 'Conglomerate tier', 'The Last Resort tier'].map((t) => quarterOf(tier(t))), [3, 5, 8, 11]);
  // the threat tracks open when the roster says they do
  for (const r of UNLOCK_SCHEDULE.filter((x) => x.opensTrack)) assert.equal(TRACK_BY_ID[r.opensTrack].opensAt, r.at, r.opensTrack);
  // the harness checks research against these same targets
  const targets = nodeTargets();
  for (const [id, at] of Object.entries(GDD_UNLOCK_TARGETS)) {
    const [h, m] = at.split(':').map(Number);
    assert.equal(targets[id], h * 60 + m, id);
  }
  const h = runHarness({ bots: ['edge'], seeds: [1] });
  const check = h.gdd.find((c) => c.name.startsWith('Research unlocks'));
  assert.ok(check.unlocks.length > 0, 'the harness measured some unlocks');
  for (const u of check.unlocks) assert.equal(u.target, targets[u.node], u.node);
});
