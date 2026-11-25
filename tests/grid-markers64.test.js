// #24: the placeholder tileset's grid ground, build stages and map markers at the 64 px minimum.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strataRaster, digRaster, shellRaster, fitoutRaster, GRID_PX } from '../src/art/hd/grid-tiles64.js';
import { markerRaster, MARKER64_KINDS } from '../src/art/hd/markers64.js';
import { STRATUM_ART } from '../src/art/bunker-tiles.js';

const full = (r) => r.c.every(Boolean);
test('grid: every stratum is a fully painted 64 x 64 tile that joins its neighbours without a seam', () => {
  for (const id of Object.keys(STRATUM_ART)) {
    const a = strataRaster(id, 3, 5), b = strataRaster(id, 4, 5), below = strataRaster(id, 3, 6);
    assert.equal(a.w, GRID_PX); assert.equal(a.h, GRID_PX); assert.ok(full(a), id);
    assert.notDeepEqual(a.c, b.c, `${id}: neighbouring tiles are identical stamps`);
    // seam: the colour step across the tile edge is no bigger than steps inside the tile
    const diff = (x1, y1, r1, x2, y2, r2) => (r1.c[y1 * 64 + x1] === r2.c[y2 * 64 + x2] ? 0 : 1);
    let edge = 0, inner = 0;
    for (let j = 0; j < 64; j++) { edge += diff(63, j, a, 0, j, b); inner += diff(31, j, a, 32, j, a); }
    for (let i = 0; i < 64; i++) { edge += diff(i, 63, a, i, 0, below); inner += diff(i, 31, a, i, 32, a); }
    assert.ok(edge <= inner * 1.6 + 12, `${id}: seam (${edge} changes at the edges vs ${inner} inside)`);
  }
});
test('grid: build stages are 64 px per metre and progress with t', () => {
  assert.notDeepEqual(digRaster('clay', 0.2, 1, 1).c, digRaster('clay', 0.9, 1, 1).c);
  assert.notDeepEqual(shellRaster(0).c, shellRaster(1).c);
  const f = fitoutRaster(3, 2, 0.5, 1); assert.equal(f.w, 192); assert.equal(f.h, 128);
});
test('map markers: five icons authored at 64 x 64 with 2 frames', () => {
  assert.deepEqual([...MARKER64_KINDS].sort(), ['bunker', 'city', 'client', 'hq', 'site']);
  for (const id of MARKER64_KINDS) { const r = markerRaster(id); assert.equal(r.w, 64); assert.equal(r.h, 64); assert.ok(r.colours().size >= 8, id); }
});
