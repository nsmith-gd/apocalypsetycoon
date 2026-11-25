// #117: every room in the catalog has a finished tile at the 64 px minimum (art note D4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { renderRoomTile, roomTileSize, ROOM_TILE_IDS, TILE_PX_PER_M, MIN_ART_PX } from '../src/art/hd/room-tiles.js';
import { HD_COLOURS } from '../src/art/hd/raster.js';
import { GDD_ROOMS } from '../src/catalog/rooms.js';
import { EXTRA_ROOMS, STOREROOM, EMPTY_ROOM } from '../src/catalog/identify.js';

test('room tiles: every catalog room, fixture and grid identity has a tile', () => {
  for (const r of [...GDD_ROOMS, ...EXTRA_ROOMS, STOREROOM, EMPTY_ROOM]) assert.ok(ROOM_TILE_IDS.includes(r.id), `no tile for ${r.id}`);
  assert.equal(GDD_ROOMS.length, 73);
});

test('room tiles: 64 px per metre of the catalog size, never under the 64 px minimum', () => {
  for (const id of ROOM_TILE_IDS) {
    const t = renderRoomTile(id);
    const { w, h } = roomTileSize(id);
    assert.equal(t.w, w * TILE_PX_PER_M, `${id} width`);
    assert.equal(t.h, h * TILE_PX_PER_M, `${id} height`);
    assert.ok(t.w >= MIN_ART_PX && t.h >= MIN_ART_PX, `${id} is ${t.w}x${t.h}`);
  }
});

test('room tiles: palette-only, fully painted, detailed, and each one distinct', () => {
  const palette = new Set(HD_COLOURS.filter(Boolean));
  const seen = new Map();
  for (const id of ROOM_TILE_IDS) {
    for (const frame of [0, 1]) {
      const t = renderRoomTile(id, { frame });
      const cols = t.colours();
      for (const c of cols) assert.ok(palette.has(c), `${id}: ${c} is off-palette`);
      const opaque = t.c.reduce((n, v) => n + (v ? 1 : 0), 0) / t.c.length;
      assert.equal(opaque, 1, `${id}: ${Math.round((1 - opaque) * 100)}% unpainted`);
      if (id !== 'empty') assert.ok(cols.size >= 12, `${id}: only ${cols.size} colours`);
    }
    const sha = createHash('sha1').update(renderRoomTile(id).c).digest('hex');
    assert.ok(!seen.has(sha), `${id} is identical to ${seen.get(sha)}`);
    seen.set(sha, id);
  }
});

test('room tiles: in-world text is never under 8 px tall (style guide rule 3)', async () => {
  const { MIN_TEXT_SCALE } = await import('../src/art/hd/raster.js');
  assert.ok(MIN_TEXT_SCALE * 5 >= 8);
});
