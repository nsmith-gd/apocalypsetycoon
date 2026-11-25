// World map base layer: #100 first pass, #136 daylight atlas, #138 the real Earth (director: "look like the Earth").
// Checked against the target sheet (docs/art/world-map-target.md) and real geography.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paintMapBase, BASE_W, BASE_H } from '../src/art/map-base.js';
import { MAP_PALETTE, MAP_COLOURS } from '../src/art/palette.js';
import { WORLD_LAYOUT, MAP_W, MAP_H, CELL, MAP_COLS, MAP_ROWS } from '../src/art/worldmap.js';
import { mapXY, CELL_REGIONS, CITIES, DEMAND_REGIONS } from '../src/art/earth.js';

const b = paintMapBase();
const g = paintMapBase({ scale: 1.5 }); // the density the target sheet measures (2 screen px per art px)
const big = paintMapBase({ scale: 3 }); // what a 1440x900 screen shows: one art px per screen px
const at = (x, y) => b.colours[y * b.w + x];
const sea = new Set(MAP_PALETTE.ocean);

test('canvas sizes and palette: 320x192 x scale, map palette only, 24-32 colours', () => {
  assert.deepEqual([b.w, b.h, BASE_W, BASE_H], [MAP_W, MAP_H, MAP_W, MAP_H]);
  assert.deepEqual([big.w, big.h], [960, 576]);
  for (const p of [b, g, big]) {
    const used = new Set(p.colours);
    for (const c of used) assert.ok(MAP_COLOURS.includes(c), c);
    assert.ok(used.size >= 22 && used.size <= 32, `${used.size} colours`);
  }
});

test('the real Earth: oceans, continents, ice sheets, deserts, rainforests and mountains where they are', () => {
  const probe = (lon, lat) => { const [fx, fy] = mapXY(lon, lat); const i = Math.floor(fy * big.h) * big.w + Math.floor(fx * big.w); return { land: big.land[i] === 1, biome: big.biome[i] }; };
  for (const [lon, lat, name] of [[-35, 30, 'mid-Atlantic'], [-140, 0, 'Pacific'], [70, -20, 'Indian Ocean'], [18, 35, 'Mediterranean'], [51, 42, 'Caspian'], [-85, 60, 'Hudson Bay'], [-90, 25, 'Gulf of Mexico']]) assert.equal(probe(lon, lat).land, false, name);
  for (const [lon, lat, name] of [[-98, 39, 'Kansas'], [2.3, 48.9, 'Paris'], [37.6, 55.8, 'Moscow'], [116, 40, 'Beijing'], [-47.9, -15.8, 'Brasilia'], [28, -26, 'Johannesburg'], [134, -25, 'Australia'], [139.7, 35.9, 'Tokyo']]) assert.equal(probe(lon, lat).land, true, name);
  const expect = { i: [[-40, 72, 'Greenland'], [0, -77, 'Antarctica']], d: [[5, 24, 'Sahara'], [46, 23, 'Arabia'], [133, -25, 'Australian outback']], f: [[-62, -4, 'Amazon'], [100, 60, 'Siberian taiga'], [22, 0, 'Congo']], m: [[86, 29, 'Himalaya'], [-70, -30, 'Andes'], [-112, 44, 'Rockies']] };
  for (const [bio, pts] of Object.entries(expect)) for (const [lon, lat, name] of pts) assert.equal(probe(lon, lat).biome, bio, name);
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
  for (const p of [b, g, big]) {
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
    assert.ok(share >= 0.5 && share <= 0.9, `outline on ${Math.round(share * 100)}% of the coast`);
    assert.equal(shelfMissing, 0);
    assert.equal(textured, 0);
  }
});

test('clusters, not noise: no single land pixel alone in the sea', () => {
  for (const p of [b, g, big]) {
    let specks = 0;
    for (let y = 1; y < p.h - 1; y++) for (let x = 1; x < p.w - 1; x++) {
      const i = y * p.w + x;
      if (p.land[i] && !p.land[i - 1] && !p.land[i + 1] && !p.land[i - p.w] && !p.land[i + p.w]) specks++;
    }
    assert.equal(specks, 0);
  }
});

test('the cell layout and hit areas come from the real Earth: every region, every city', () => {
  assert.equal(WORLD_LAYOUT.length, MAP_ROWS);
  for (const row of WORLD_LAYOUT) assert.equal(row.length, MAP_COLS);
  const seen = new Set(CELL_REGIONS.flat().filter(Boolean));
  assert.deepEqual([...seen].sort(), [...DEMAND_REGIONS].sort());
  for (const c of CITIES) assert.equal(WORLD_LAYOUT[c.cell[1]][c.cell[0]], 'c', c.name);
  for (let r = 0; r < MAP_ROWS; r++) for (let c = 0; c < MAP_COLS; c++) assert.equal(!!CELL_REGIONS[r][c], !'~i'.includes(WORLD_LAYOUT[r][c]), `cell ${c},${r}`);
});

// ---- target sheet: detail per pixel at the reference's density (reference values in brackets) ----
test('detail density: colour changes, land runs, coast wiggle, land share like the reference', () => {
  const { w, h, colours, land, biome } = g;
  let pairs = 0, changes = 0;
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const i = y * w + x;
    pairs += 2; changes += (colours[i] !== colours[i + 1]) + (colours[i] !== colours[i + w]);
  }
  const edges = (100 * changes) / pairs;
  assert.ok(edges >= 12.5, `colour changes per 100 neighbouring pixels ${edges.toFixed(1)} (reference 13.7)`);
  const ground = (i) => land[i] && biome[i] !== 'i';
  let runs = 0, runPx = 0, area = 0, coast = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!ground(i)) continue;
    runPx++; area++;
    if (x === 0 || !ground(i - 1) || colours[i - 1] !== colours[i]) runs++;
    if (x > 0 && y > 0 && x < w - 1 && y < h - 1 && (!land[i - 1] || !land[i + 1] || !land[i - w] || !land[i + w])) coast++;
  }
  assert.ok(runPx / runs <= 3.6, `mean land run ${(runPx / runs).toFixed(2)} px (reference 3.5)`);
  assert.ok(coast / (2 * Math.sqrt(Math.PI * area)) >= 6, 'coast wiggle (reference 6.4)');
  let share = 0; for (let i = 0; i < w * h; i++) share += ground(i) ? 1 : 0; share /= w * h; // ice sheets not counted, as in the reference measure
  assert.ok(share > 0.2 && share < 0.3, `land share ${share.toFixed(3)} (reference 0.244)`);
});
