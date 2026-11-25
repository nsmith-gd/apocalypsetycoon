// World map base layer: #100 first pass, #136 full redo. Checked against the target sheet v2
// (docs/art/world-map-target.md): the old acceptance checks, plus the measured detail targets at the size the
// game paints for a 1440x900 screen (480x288 terrain pixels).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paintMapBase, BASE_W, BASE_H } from '../src/art/map-base.js';
import { MAP_PALETTE, MAP_COLOURS } from '../src/art/palette.js';
import { WORLD_LAYOUT, MAP_W, MAP_H, CELL, regionAt, MAP_REGIONS } from '../src/art/worldmap.js';

const b = paintMapBase();
const g = paintMapBase({ scale: 1.5 }); // what a 1440x900 screen shows
const at = (x, y) => b.colours[y * b.w + x];
const sea = new Set(MAP_PALETTE.ocean);

test('same canvas the game expects, painted only from the map palette, 24-32 colours', () => {
  assert.deepEqual([b.w, b.h, BASE_W, BASE_H], [MAP_W, MAP_H, MAP_W, MAP_H]);
  assert.deepEqual([g.w, g.h], [480, 288]);
  for (const p of [b, g]) {
    const used = new Set(p.colours);
    for (const c of used) assert.ok(MAP_COLOURS.includes(c), c);
    assert.ok(used.size >= 24 && used.size <= 32, `${used.size} colours`);
    assert.ok(MAP_PALETTE.forest.every((c) => used.has(c)) && MAP_PALETTE.desert.every((c) => used.has(c)));
  }
});

test('no tile repeat: no two neighbouring 8x8 cells are identical', () => {
  const cell = (c, r) => { const px = []; for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) px.push(at(c * CELL + x, r * CELL + y)); return px.join(); };
  let same = 0;
  for (let r = 0; r < 24; r++) for (let c = 0; c < 40; c++) {
    const here = cell(c, r);
    if (new Set(here.split(',')).size === 1) continue; // open ocean / ice interior may be one flat colour
    if (c < 39 && here === cell(c + 1, r)) same++;
    if (r < 23 && here === cell(c, r + 1)) same++;
  }
  assert.equal(same, 0);
});

test('coasts: a 1px K outline on the land side, deliberately broken; shallow water on every coast; flat sea', () => {
  for (const p of [b, g]) {
    let coast = 0, outlined = 0, shelfMissing = 0, textured = 0;
    const shallow = new Set([MAP_PALETTE.ocean[2], MAP_PALETTE.ocean[3]]);
    for (let y = 1; y < p.h - 1; y++) for (let x = 1; x < p.w - 1; x++) {
      const i = y * p.w + x;
      const nb = [i - 1, i + 1, i - p.w, i + p.w];
      if (p.land[i] && p.biome[i] !== 'i' && nb.some((j) => !p.land[j])) { coast++; if (p.colours[i] === MAP_PALETTE.outline) outlined++; }
      if (!p.land[i] && nb.some((j) => p.land[j] && p.biome[j] !== 'i') && !shallow.has(p.colours[i])) shelfMissing++;
      if (!p.land[i] && !sea.has(p.colours[i])) textured++;
    }
    const share = outlined / coast;
    assert.ok(share >= 0.6 && share <= 0.9, `outline on ${Math.round(share * 100)}% of the coast`);
    assert.equal(shelfMissing, 0);
    assert.equal(textured, 0);
  }
});

test("the layout and hit areas hold: every land cell's heart is land, every sea cell's heart is sea", () => {
  for (let r = 0; r < 24; r++) for (let c = 0; c < 40; c++) {
    const ch = WORLD_LAYOUT[r][c];
    if (ch === 'i') continue;
    for (let y = 3; y <= 4; y++) for (let x = 3; x <= 4; x++) assert.equal(b.land[(r * CELL + y) * b.w + c * CELL + x], ch === '~' ? 0 : 1, `cell ${c},${r}`);
  }
  for (const reg of MAP_REGIONS) assert.ok(WORLD_LAYOUT.some((row, r) => [...row].some((_, c) => regionAt(c, r)?.id === reg.id)), reg.id);
  assert.equal(b.isLandPx(-1, 0), false);
});

test('clusters, not noise: no single land pixel alone in the sea', () => {
  for (const p of [b, g]) {
    let specks = 0;
    for (let y = 1; y < p.h - 1; y++) for (let x = 1; x < p.w - 1; x++) {
      const i = y * p.w + x;
      if (p.land[i] && !p.land[i - 1] && !p.land[i + 1] && !p.land[i - p.w] && !p.land[i + p.w]) specks++;
    }
    assert.equal(specks, 0);
  }
});

// ---- target sheet v2: detail per pixel at the 1440x900 size (reference values in brackets) ----
test('v2 detail density: colour changes, land runs, coast wiggle, islands', () => {
  const { w, h, colours, land, biome } = g;
  let pairs = 0, changes = 0;
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const i = y * w + x;
    pairs += 2; changes += (colours[i] !== colours[i + 1]) + (colours[i] !== colours[i + w]);
  }
  const edges = (100 * changes) / pairs;
  assert.ok(edges >= 13.5, `colour changes per 100 neighbouring pixels ${edges.toFixed(1)} (reference 13.7)`);
  const ground = (i) => land[i] && biome[i] !== 'i';
  let runs = 0, runPx = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!ground(i)) continue;
    runPx++;
    if (x === 0 || !ground(i - 1) || colours[i - 1] !== colours[i]) runs++;
  }
  assert.ok(runPx / runs <= 3.5, `mean land run ${(runPx / runs).toFixed(2)} px (reference 3.5)`);
  let coast = 0, area = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (!ground(i)) continue;
    area++;
    if (!land[i - 1] || !land[i + 1] || !land[i - w] || !land[i + w]) coast++;
  }
  const wiggle = coast / (2 * Math.sqrt(Math.PI * area));
  assert.ok(wiggle >= 6, `coast wiggle ${wiggle.toFixed(2)} (reference 6.4)`);
  // islands: separate pieces of ground under 0.2% of the map
  const seen = new Uint8Array(w * h);
  let islands = 0;
  for (let s = 0; s < w * h; s++) {
    if (!ground(s) || seen[s]) continue;
    const q = [s]; seen[s] = 1;
    for (let k = 0; k < q.length; k++) {
      const i = q[k], x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < w * h && ground(j) && !seen[j]) { seen[j] = 1; q.push(j); }
    }
    if (q.length < 0.002 * w * h) islands++;
  }
  assert.ok((10000 * islands) / (w * h) >= 15, `${islands} islands, ${((10000 * islands) / (w * h)).toFixed(1)} per 10k px (reference 36)`);
});
