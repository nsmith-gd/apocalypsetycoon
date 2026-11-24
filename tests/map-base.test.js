// #100: the redone world map base layer, checked against the #98 target sheet's acceptance checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paintMapBase, BASE_W, BASE_H } from '../src/art/map-base.js';
import { MAP_PALETTE, MAP_COLOURS } from '../src/art/palette.js';
import { WORLD_LAYOUT, MAP_W, MAP_H, CELL, regionAt, MAP_REGIONS } from '../src/art/worldmap.js';

const b = paintMapBase();
const at = (x, y) => b.colours[y * b.w + x];
const sea = new Set(MAP_PALETTE.ocean);

test('same canvas the game expects, painted only from the map palette, 20-28 colours', () => {
  assert.deepEqual([b.w, b.h, BASE_W, BASE_H], [MAP_W, MAP_H, MAP_W, MAP_H]);
  const used = new Set(b.colours);
  for (const c of used) assert.ok(MAP_COLOURS.includes(c), c);
  assert.ok(used.size >= 20 && used.size <= 28, `${used.size} colours`);
  assert.ok(MAP_PALETTE.forest.every((c) => used.has(c)) && MAP_PALETTE.desert.filter((c) => used.has(c)).length >= 3);
});

test('no tile repeat: no two neighbouring 8x8 cells are identical', () => {
  const cell = (c, r) => { const px = []; for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) px.push(at(c * CELL + x, r * CELL + y)); return px.join(); };
  let same = 0;
  for (let r = 0; r < 24; r++) for (let c = 0; c < 40; c++) {
    const here = cell(c, r);
    const uniform = new Set(here.split(',')).size === 1; // open ocean / ice interior may be one flat colour
    if (uniform) continue;
    if (c < 39 && here === cell(c + 1, r)) same++;
    if (r < 23 && here === cell(c, r + 1)) same++;
  }
  assert.equal(same, 0);
});

test('coasts: a 1px K outline on the land side, deliberately broken; a shelf on every coast; flat deep ocean', () => {
  let coast = 0, outlined = 0, shelfMissing = 0, textured = 0;
  for (let y = 1; y < b.h - 1; y++) for (let x = 1; x < b.w - 1; x++) {
    const i = y * b.w + x;
    const nb = [i - 1, i + 1, i - b.w, i + b.w];
    if (b.land[i] && b.biome[i] !== 'i' && nb.some((j) => !b.land[j])) { coast++; if (b.colours[i] === MAP_PALETTE.outline) outlined++; }
    if (!b.land[i] && nb.some((j) => b.land[j] && b.biome[j] !== 'i') && b.colours[i] !== MAP_PALETTE.ocean[2] && b.colours[i] !== MAP_PALETTE.water[0]) shelfMissing++;
    if (!b.land[i] && !sea.has(b.colours[i])) textured++;
  }
  const share = outlined / coast;
  assert.ok(share >= 0.6 && share <= 0.9, `outline on ${Math.round(share * 100)}% of the coast`);
  assert.equal(shelfMissing, 0);
  assert.equal(textured, 0);
  // trenches are large calm shapes, never single pixels
  let specks = 0;
  for (let y = 1; y < b.h - 1; y++) for (let x = 1; x < b.w - 1; x++) if (at(x, y) === MAP_PALETTE.ocean[0] && [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].every((c) => c !== MAP_PALETTE.ocean[0])) specks++;
  assert.equal(specks, 0);
});

test("the layout and hit areas hold: every land cell's heart is land, every sea cell's heart is sea", () => {
  for (let r = 0; r < 24; r++) for (let c = 0; c < 40; c++) {
    const ch = WORLD_LAYOUT[r][c];
    if (ch === 'i') continue;
    for (let y = 3; y <= 4; y++) for (let x = 3; x <= 4; x++) assert.equal(b.land[(r * CELL + y) * b.w + c * CELL + x], ch === '~' ? 0 : 1, `cell ${c},${r}`);
  }
  // regions are still found where they were (the layout itself is untouched)
  for (const reg of MAP_REGIONS) assert.ok(WORLD_LAYOUT.some((row, r) => [...row].some((_, c) => regionAt(c, r)?.id === reg.id)), reg.id);
  assert.equal(b.isLandPx(-1, 0), false);
});

test('clusters, not noise: no single land pixel alone in the sea', () => {
  let specks = 0;
  for (let y = 1; y < b.h - 1; y++) for (let x = 1; x < b.w - 1; x++) {
    const i = y * b.w + x;
    if (b.land[i] && !b.land[i - 1] && !b.land[i + 1] && !b.land[i - b.w] && !b.land[i + b.w]) specks++;
  }
  assert.equal(specks, 0);
});
