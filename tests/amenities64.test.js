// #118: client-facing luxury and comfort amenities at the 64 px minimum (art note D4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AMENITY_KINDS, amenityRaster, reduceRaster, AMENITY_PX } from '../src/art/hd/amenities64.js';
import { OBJECTS, variantsFor } from '../src/shelter/bunker-catalog.js';
import { hasSprite } from '../src/shelter/bunker-sprites.js';

// generated catalog-room objects (#140) await their art (R45)
const LUXURY = Object.values(OBJECTS).filter((o) => !o.generated && (o.luxury || o.prestige)).map((o) => o.id).filter((id) => !['med_bed', 'shower'].includes(id));

test('amenities: every luxury / prestige piece (gold taps, cryo pods...) is drawn at 64 px', () => {
  for (const id of ['gold_taps', 'cryo_pod', 'king_bed', 'chandelier', 'piano', 'wine_rack', ...LUXURY]) assert.ok(AMENITY_KINDS.includes(id), `${id} has no 64 px art`);
  for (const id of AMENITY_KINDS) assert.ok(hasSprite(id));
});

test('amenities: native size is the footprint at 64 px per metre, never under 64', () => {
  for (const id of AMENITY_KINDS) {
    const r = amenityRaster(id, variantsFor(id)[0]);
    assert.equal(r.w, OBJECTS[id].w * AMENITY_PX, id); assert.equal(r.h, OBJECTS[id].h * AMENITY_PX, id);
    assert.ok(Math.min(r.w, r.h) >= 64);
    const painted = r.c.reduce((n, v) => n + (v ? 1 : 0), 0) / r.c.length;
    assert.ok(painted > (id.startsWith('rug') ? 0.08 : 0.12), `${id}: only ${Math.round(painted * 100)}% painted`);
    assert.ok(r.colours().size >= 6, `${id}: ${r.colours().size} colours`);
  }
});

test('amenities: recolouring changes the piece, and the 16 px reduction keeps its size and colours', () => {
  for (const id of AMENITY_KINDS) {
    const vs = variantsFor(id);
    const a = amenityRaster(id, vs[0]), b = amenityRaster(id, vs[1]);
    if (!['statue', 'cinema_screen', 'neon_sign'].includes(id)) assert.notDeepEqual(a.c, b.c, `${id} ignores its colour variant`);
    const small = reduceRaster(a, 4);
    assert.equal(small.w, OBJECTS[id].w * 16); assert.equal(small.h, OBJECTS[id].h * 16);
    for (const c of small.colours()) assert.ok(a.colours().has(c), `${id}: reduction invented ${c}`);
  }
});
