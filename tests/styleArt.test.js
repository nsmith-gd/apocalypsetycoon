// The design-layer room (#34/#43), redrawn at the 64 px minimum (#120): a 2 x 2 m cut of the room's 64 px tile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { styledAmenity, AMENITY_SWAPS, TIER_TRIM, renderStyledRoom, ROOM_PX, ROOM_STYLES_DRAWN, AMENITY_ROOMS } from '../src/art/styleArt.js';
import { AMENITIES } from '../src/art/sprites-shelter.js';
import { validateSprite } from '../src/art/render.js';
import { HEX, PALETTE } from '../src/art/palette.js';
import { HD_COLOURS } from '../src/art/hd/raster.js';
import { ROOM_TILE_IDS } from '../src/art/hd/room-tiles.js';
import { ROOM_TIERS } from '../src/shelter/styles.js';

test('every machine swap yields valid palette sprites with the same frames', () => {
  for (const style of Object.keys(AMENITY_SWAPS)) {
    for (const id of Object.keys(AMENITIES)) {
      const s = styledAmenity(id, style);
      assert.deepEqual(validateSprite(`${id}:${style}`, s), []);
      assert.equal(s.frames?.length ?? 1, AMENITIES[id].frames?.length ?? 1);
    }
  }
});

test('a styled room is 128 x 128 (2 x 2 m at 64 px per metre), fully painted from the 64 px palette', () => {
  const palette = new Set(HD_COLOURS.filter(Boolean));
  assert.equal(ROOM_PX, 128);
  for (const style of ROOM_STYLES_DRAWN) for (const amenity of [null, ...Object.keys(AMENITY_ROOMS)]) {
    const r = renderStyledRoom({ amenity, style, tier: ROOM_TIERS[amenity] ?? 'survive' });
    assert.deepEqual([r.w, r.h], [ROOM_PX, ROOM_PX]);
    assert.ok(r.c.every(Boolean), `${amenity}/${style} unpainted`);
    for (const c of r.colours()) assert.ok(palette.has(c), c);
  }
});

test('every design-layer amenity has a 64 px room behind it', () => {
  for (const id of Object.keys(ROOM_TIERS)) assert.ok(ROOM_TILE_IDS.includes(AMENITY_ROOMS[id]), id);
});

test('all six styles differ; the tier trim is identical across styles', () => {
  const rs = ROOM_STYLES_DRAWN.map((style) => renderStyledRoom({ amenity: 'bunk', style, tier: 'survive' }));
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    let diff = 0; for (let k = 8 * ROOM_PX; k < rs[i].c.length; k++) if (rs[i].c[k] !== rs[j].c[k]) diff++;
    assert.ok(diff > 2000, `${ROOM_STYLES_DRAWN[i]} vs ${ROOM_STYLES_DRAWN[j]}: ${diff}`);
    assert.ok(rs[i].c.subarray(0, 8 * ROOM_PX).every((v, k) => v === rs[j].c[k]));
  }
});

test('tier trim and swap colours exist in the palette', () => {
  for (const t of Object.values(TIER_TRIM)) { assert.ok(HEX[t.a]); assert.ok(HEX[t.b]); }
  for (const m of Object.values(AMENITY_SWAPS)) for (const v of Object.values(m)) assert.ok(HEX[v]);
  assert.equal(new Set(Object.keys(PALETTE)).size, Object.keys(PALETTE).length);
});
