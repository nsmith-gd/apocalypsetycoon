// World map base layer (#100, art note D3): land, coasts, ocean and terrain painted PER PIXEL to the
// style guide's world map rules (docs/art/style-guide.md "World map"; target: docs/art/world-map-target.md).
//
// Deterministic and DOM-free: the same layout always gives the same picture, in the browser and in Node.
// It follows WORLD_LAYOUT (the 40x24 cell layout the regions and their hit areas use), so the region layout
// and click areas stay exactly where they were; only the painting changes:
//   - organic coasts: the cell layout, smoothed and roughened with value noise, never more than a few
//     pixels off the old cell edges;
//   - biomes as nested blobs from MAP_PALETTE ramps, darkest inland; jittered biome borders;
//   - a 1px K outline on the land side of every coast, with ~25% deliberate gaps;
//   - flat deep ocean, a shelf of 2-4px (wider off big landmasses), a few calm trench shapes;
//   - mountain ridges lit from the top-left; ragged polar caps with a shadow edge; a few 1px rivers.
//
//   const base = paintMapBase();        // { w, h, rgba: Uint8ClampedArray, land: Uint8Array, biome }
//   base.isLandPx(x, y)                 // for the region borders (#101)
//   drawMapBase(ctx)                    // blits it (cached) at 0,0

import { MAP_PALETTE } from './palette.js';
import { WORLD_LAYOUT } from './worldmap.js';

const CELL = 8;
const COLS = 40;
const ROWS = 24;
export const BASE_W = COLS * CELL;
export const BASE_H = ROWS * CELL;

const P = MAP_PALETTE;
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ---------- deterministic value noise ----------
function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, scale, s) {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = smooth(fx - x0), ty = smooth(fy - y0);
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
}
const fbm = (x, y, s) => vnoise(x, y, 9, s) * 0.6 + vnoise(x, y, 4, s + 7) * 0.3 + vnoise(x, y, 2, s + 13) * 0.1;

const cellAt = (c, r) => WORLD_LAYOUT[Math.max(0, Math.min(ROWS - 1, r))]?.[Math.max(0, Math.min(COLS - 1, c))] ?? '~';
const cellLand = (c, r) => (c < 0 || c >= COLS ? 0 : cellAt(c, r) === '~' ? 0 : 1);

/** Paint the base layer. */
export function paintMapBase({ seed = 7 } = {}) {
  const W = BASE_W, H = BASE_H, N = W * H;
  const land = new Uint8Array(N);
  const biome = new Array(N).fill('~');

  // 1. Land mask: bilinear field over cell centres + noise. Pixels stay near the old cell edges.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = (x + 0.5) / CELL - 0.5, gy = (y + 0.5) / CELL - 0.5;
    const c0 = Math.floor(gx), r0 = Math.floor(gy), tx = gx - c0, ty = gy - r0;
    const v = cellLand(c0, r0) * (1 - tx) * (1 - ty) + cellLand(c0 + 1, r0) * tx * (1 - ty) + cellLand(c0, r0 + 1) * (1 - tx) * ty + cellLand(c0 + 1, r0 + 1) * tx * ty;
    const own = cellLand(Math.floor(x / CELL), Math.floor(y / CELL));
    const ownCh = cellAt(Math.floor(x / CELL), Math.floor(y / CELL));
    const icy = ownCh === 'i' || cellAt(Math.floor(x / CELL), Math.floor(y / CELL) + (y < H / 2 ? 1 : -1)) === 'i';
    const n = (fbm(x, y, seed) - 0.5) * (icy ? 1.3 : 0.55); // polar rims are more ragged
    let isLand = v + n > 0.5;
    // keep every land cell's heart land and every ocean cell's heart sea, so hit areas and layout hold
    const ix = x % CELL, iy = y % CELL;
    const heart = ix >= 2 && ix <= 5 && iy >= 2 && iy <= 5;
    if (heart && !icy) isLand = !!own;
    if (y <= 2 || y >= H - 3) isLand = ownCh === 'i' || isLand; // the caps touch the map edge
    land[y * W + x] = isLand ? 1 : 0;
  }
  // tidy: drop 1-pixel specks and fill 1-pixel holes (clusters, not noise)
  for (let pass = 0; pass < 2; pass++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const n4 = land[i - 1] + land[i + 1] + land[i - W] + land[i + W];
    if (land[i] && n4 <= 1) land[i] = 0;
    else if (!land[i] && n4 >= 3) land[i] = 1;
  }

  // 2. Biome per land pixel: the layout char at a noise-jittered position (organic biome borders).
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i]) continue;
    const jx = (vnoise(x, y, 5, seed + 21) - 0.5) * 9, jy = (vnoise(x, y, 5, seed + 22) - 0.5) * 9;
    let ch = cellAt(Math.floor((x + jx) / CELL), Math.floor((y + jy) / CELL));
    if (ch === '~') ch = cellAt(Math.floor(x / CELL), Math.floor(y / CELL));
    if (ch === '~') ch = '#';
    if (cellAt(Math.floor(x / CELL), Math.floor(y / CELL)) === 'i' || y <= 2 || y >= H - 3) ch = 'i'; // caps stay ice
    biome[i] = ch === 'c' ? '#' : ch; // cities read as land; markers draw on top
  }

  // 3. Distances (4-neighbour BFS): land -> nearest sea, sea -> nearest land.
  const dist = (target) => {
    const d = new Int16Array(N).fill(-1);
    const q = [];
    for (let i = 0; i < N; i++) if (land[i] === target) { d[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const j = Y * W + X;
        if (d[j] === -1) { d[j] = d[i] + 1; q.push(j); }
      }
    }
    return d;
  };
  const toSea = dist(0); // for land pixels: distance to the nearest sea
  const toLand = dist(1); // for sea pixels: distance to the nearest land

  // big landmass near a sea pixel? (land cells within 3 cells) -> a wider shelf
  const bigNear = (x, y) => {
    const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
    let n = 0;
    for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) { const ch = cellAt(c + dc, r + dr); if (ch !== '~' && ch !== 'i') n++; }
    return n >= 16;
  };

  const out = new Array(N);
  const ramp = (r, d, x, y, s, step = 3) => {
    const k = Math.floor((d + (vnoise(x, y, 6, seed + s) - 0.5) * 5) / step);
    return r[Math.max(0, Math.min(r.length - 1, r.length - 1 - k))]; // nested blobs: darker inland
  };

  // 4. Paint.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i]) {
      const d = toLand[i];
      const shelfW = (bigNear(x, y) ? 6 : 2) + Math.floor(vnoise(x, y, 7, seed + 3) * (bigNear(x, y) ? 5 : 3));
      if (d >= 0 && d <= shelfW) out[i] = P.ocean[2];
      else if (d > 22 && vnoise(x, y, 24, seed + 5) > 0.74) out[i] = P.ocean[0]; // a few large calm trenches
      else out[i] = P.ocean[1];
      continue;
    }
    const b = biome[i];
    const d = toSea[i];
    if (b === 'i') { out[i] = d <= 1 || (d <= 3 && vnoise(x, y, 4, seed + 9) > 0.55) ? P.snow[0] : P.snow[1]; continue; } // bright cap, ragged shadow rim
    if (b === 'd') out[i] = ramp([P.desert[0], P.desert[1], P.desert[2], P.desert[3], P.desert[4]].reverse().reverse(), d, x, y, 31, 3);
    else if (b === 'm') out[i] = P.rock[1];
    else if (b === 'f') out[i] = ramp(P.forest, d, x, y, 41, 2);
    else { const m = vnoise(x, y, 4, seed + 51); out[i] = m > 0.86 ? P.meadow[1] : m > 0.76 ? P.meadow[0] : ramp([P.forest[1], P.forest[2], P.forest[3]], d, x, y, 47, 3); } // open grass, sunny meadows
  }

  // 5. Mountains: ridges lit from the top-left, shadow bottom-right.
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (biome[i] !== 'm' || !land[i]) continue;
    const upLeftOpen = biome[i - W] !== 'm' || biome[i - 1] !== 'm';
    const downRightOpen = biome[i + W] !== 'm' || biome[i + 1] !== 'm';
    if (upLeftOpen) out[i] = P.rock[2];
    else if (downRightOpen) out[i] = P.rock[0];
    else if (toSea[i] > 6 && vnoise(x, y, 6, seed + 61) > 0.7) out[i] = P.snow[1]; // snowy peaks, inland only
  }

  // 6. Rivers: a few 1px lines in green land, walking downhill to the coast (stop short of it).
  for (let k = 0, tries = 0; k < 6 && tries < 400; tries++) {
    const x0 = Math.floor(hash(tries, 1, seed) * W), y0 = Math.floor(hash(tries, 2, seed) * H);
    const i0 = y0 * W + x0;
    if (!land[i0] || toSea[i0] < 8 || !['f', '#'].includes(biome[i0])) continue;
    let x = x0, y = y0;
    for (let s = 0; s < 40; s++) {
      const i = y * W + x;
      if (toSea[i] <= 2 || !['f', '#'].includes(biome[i])) break;
      out[i] = P.water[0];
      const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([X, Y]) => X >= 0 && Y >= 0 && X < W && Y < H);
      steps.sort((a, b) => toSea[a[1] * W + a[0]] - toSea[b[1] * W + b[0]] || hash(a[0], a[1], s) - hash(b[0], b[1], s));
      [x, y] = steps[0];
    }
    k++;
  }

  // 7. Coast outline: 1px K on the land side, ~25% left open in short runs. Ice gets its shadow edge instead.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i] || toSea[i] !== 1 || biome[i] === 'i') continue;
    if (vnoise(x, y, 3, seed + 71) > 0.66) continue; // deliberate gap
    out[i] = P.outline;
  }

  const rgba = new Uint8ClampedArray(N * 4);
  for (let i = 0; i < N; i++) { const [r, g, b] = hexRgb(out[i]); rgba.set([r, g, b, 255], i * 4); }
  return {
    w: W, h: H, rgba, land, biome, colours: out,
    isLandPx: (x, y) => x >= 0 && y >= 0 && x < W && y < H && land[y * W + x] === 1 && biome[y * W + x] !== 'i',
  };
}

let CACHE = null;
let CANVAS = null;
export function mapBase() { return (CACHE ??= paintMapBase()); }

/** Draw the base layer at 0,0 (browser). */
export function drawMapBase(ctx) {
  const b = mapBase();
  if (!CANVAS) {
    CANVAS = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(b.w, b.h) : Object.assign(document.createElement('canvas'), { width: b.w, height: b.h });
    CANVAS.getContext('2d').putImageData(new ImageData(b.rgba, b.w, b.h), 0, 0);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(CANVAS, 0, 0);
}
