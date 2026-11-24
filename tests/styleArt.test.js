import { test } from 'node:test';
import assert from 'node:assert/strict';
import { styledAmenity, AMENITY_SWAPS, TIER_TRIM, drawStyledRoom, ROOM_PX } from '../src/art/styleArt.js';
import { AMENITIES } from '../src/art/sprites-shelter.js';
import { validateSprite } from '../src/art/render.js';
import { HEX, PALETTE } from '../src/art/palette.js';

// A fake 2D context that records every pixel colour drawn.
function recorder() {
  const px = new Map();
  let fill = null;
  return {
    px,
    set fillStyle(v) { fill = v; }, get fillStyle() { return fill; },
    imageSmoothingEnabled: false,
    fillRect(x, y, w, h) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px.set(`${xx},${yy}`, fill); },
    drawImage() {},
  };
}

test('every machine swap yields valid palette sprites with the same frames', () => {
  for (const style of Object.keys(AMENITY_SWAPS)) {
    for (const id of Object.keys(AMENITIES)) {
      const s = styledAmenity(id, style);
      assert.deepEqual(validateSprite(`${id}:${style}`, s), []);
      assert.equal(s.frames?.length ?? 1, AMENITIES[id].frames?.length ?? 1);
    }
  }
});

test('a styled room fills all 32 x 32 pixels from the palette, with real tonal range', () => {
  const palette = new Set(Object.values(HEX));
  for (const style of ['brutalist', 'gilded']) {
    const ctx = recorder();
    drawStyledRoom(ctx, { x: 0, y: 0, amenity: null, style, tier: 'status', frame: 0, seed: 3 });
    assert.equal(ctx.px.size, ROOM_PX * ROOM_PX, style);
    const colours = new Set(ctx.px.values());
    for (const c of colours) assert.ok(palette.has(c), `${style}: ${c} not in palette`);
    assert.ok(colours.size >= 10, `${style} uses ${colours.size} colours`);
  }
});

test('Brutalist and Gilded differ; the tier trim is identical across styles', () => {
  const a = recorder();
  const b = recorder();
  drawStyledRoom(a, { x: 0, y: 0, style: 'brutalist', tier: 'survive' });
  drawStyledRoom(b, { x: 0, y: 0, style: 'gilded', tier: 'survive' });
  let wallDiff = 0;
  for (let y = 8; y < 20; y++) for (let x = 2; x < 30; x++) if (a.px.get(`${x},${y}`) !== b.px.get(`${x},${y}`)) wallDiff++;
  assert.ok(wallDiff > 250);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 32; x++) assert.equal(a.px.get(`${x},${y}`), b.px.get(`${x},${y}`));
});

test('tier trim and swap colours exist in the palette', () => {
  for (const t of Object.values(TIER_TRIM)) { assert.ok(HEX[t.a]); assert.ok(HEX[t.b]); }
  for (const m of Object.values(AMENITY_SWAPS)) for (const v of Object.values(m)) assert.ok(HEX[v]);
  assert.equal(new Set(Object.keys(PALETTE)).size, Object.keys(PALETTE).length);
});
