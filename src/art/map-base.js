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

/**
 * Paint the base layer. `scale` = art pixels per map pixel (1 = the 320x192 map; 2 = 640x384, 3 = 960x576...).
 * The continents keep their shape at every scale (shapes come from noise in map units); higher scales add
 * finer coast detail, and every width (shelf, ramps, rivers) grows with the scale while outlines stay 1px.
 */
export function paintMapBase({ seed = 7, scale = 1 } = {}) {
  const S = Math.max(1, Math.round(scale * 2) / 2); // whole or half steps: 1, 1.5, 2...
  const C = CELL * S; // a map cell in art pixels
  const W = Math.round(BASE_W * S), H = Math.round(BASE_H * S), N = W * H;
  const land = new Uint8Array(N);
  const biome = new Array(N).fill('~');

  // 1. Land mask: bilinear field over cell centres + noise. Pixels stay near the old cell edges.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const lx = (x + 0.5) / S - 0.5, ly = (y + 0.5) / S - 0.5; // map coordinates
    const gx = (lx + 0.5) / CELL - 0.5, gy = (ly + 0.5) / CELL - 0.5;
    const c0 = Math.floor(gx), r0 = Math.floor(gy), tx = gx - c0, ty = gy - r0;
    const v = cellLand(c0, r0) * (1 - tx) * (1 - ty) + cellLand(c0 + 1, r0) * tx * (1 - ty) + cellLand(c0, r0 + 1) * (1 - tx) * ty + cellLand(c0 + 1, r0 + 1) * tx * ty;
    const own = cellLand(Math.floor(x / C), Math.floor(y / C));
    const ownCh = cellAt(Math.floor(x / C), Math.floor(y / C));
    const icy = ownCh === 'i' || cellAt(Math.floor(x / C), Math.floor(y / C) + (y < H / 2 ? 1 : -1)) === 'i';
    // macro shape in map units; at higher scales a fine octave in art pixels roughens the coast further
    const fine = (vnoise(x, y, 3, seed + 91) - 0.5) * 0.16 + (vnoise(x, y, 7, seed + 92) - 0.5) * 0.2 + (vnoise(lx, ly, 13, seed + 93) - 0.5) * 0.22;
    const n = (fbm(lx, ly, seed) - 0.5) * (icy ? 1.3 : 0.55) + fine; // polar rims are more ragged
    let isLand = v + n > 0.5;
    // keep every land cell's heart land and every ocean cell's heart sea, so hit areas and layout hold
    const ix = Math.floor(x / S) % CELL, iy = Math.floor(y / S) % CELL;
    const heart = ix >= 2 && ix <= 5 && iy >= 2 && iy <= 5;
    if (heart && !icy) isLand = !!own;
    if (y <= 2 * S || y >= H - 3 * S) isLand = ownCh === 'i' || isLand; // the caps touch the map edge
    land[y * W + x] = isLand ? 1 : 0;
  }
  // tidy: drop 1-pixel specks and fill 1-pixel holes (clusters, not noise)
  for (let pass = 0; pass < 2; pass++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const n4 = land[i - 1] + land[i + 1] + land[i - W] + land[i + W];
    if (land[i] && n4 <= 1) land[i] = 0;
    else if (!land[i] && n4 >= 3) land[i] = 1;
  }

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
  // heart of an ocean cell (in map units): never land, so the layout and hit areas hold
  const seaHeart = (x, y) => {
    const ix = Math.floor(x / S) % CELL, iy = Math.floor(y / S) % CELL;
    return ix >= 2 && ix <= 5 && iy >= 2 && iy <= 5 && !cellLand(Math.floor(x / C), Math.floor(y / C));
  };
  const blob = (cx, cy, rad, k, fn) => { // an organic blob of art pixels around cx,cy
    const R = Math.ceil(rad + 1);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const X = cx + dx, Y = cy + dy;
      if (X < 1 || Y < 1 || X >= W - 1 || Y >= H - 1) continue;
      const wob = 1 + (hash(X, Y, seed + k) - 0.5) * 0.5;
      if (dx * dx + dy * dy * 1.15 <= rad * rad * wob) fn(Y * W + X, X, Y);
    }
  };

  // 1b. Islands (#110): little archipelagos off the coasts, and ice floes off the caps. Blobs, never single pixels.
  const floe = new Uint8Array(N);
  {
    const near = dist(1);
    let made = 0;
    for (let t = 0; t < 4000 * S && made < 24 * S; t++) {
      const x0 = Math.floor(hash(t, 11, seed) * W), y0 = Math.floor(hash(t, 12, seed) * H);
      const i0 = y0 * W + x0, d0 = near[i0];
      if (land[i0] || d0 < 3 * S || d0 > 11 * S || seaHeart(x0, y0)) continue;
      const icy = y0 < 3 * C || y0 > H - 3 * C;
      // a short chain of 1-4 blobs, each 1.3-2.6 art px across (a bit bigger at higher scales)
      const n = 2 + Math.floor(hash(t, 13, seed) * 5); // archipelagos, not lone dots
      let x = x0, y = y0;
      for (let k = 0; k < n; k++) {
        const rad = (1.3 + hash(t, 20 + k, seed) * 1.3) * Math.sqrt(S);
        blob(x, y, rad, t * 7 + k, (i, X, Y) => { if (!seaHeart(X, Y) && near[i] >= 2 * S) { land[i] = 1; if (icy) floe[i] = 1; } });
        x += Math.round((hash(t, 30 + k, seed) - 0.5) * 6 * S); y += Math.round((hash(t, 40 + k, seed) - 0.5) * 4 * S);
      }
      made++;
    }
    // no lone pixels left where a blob was clipped
    for (let changed = true; changed;) {
      changed = false;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (land[i] && land[i - 1] + land[i + 1] + land[i - W] + land[i + W] <= 1) { land[i] = 0; floe[i] = 0; changed = true; }
      }
    }
  }

  // 2. Biome per land pixel: the layout char at a noise-jittered position (organic biome borders).
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i]) continue;
    const jx = (vnoise(x / S, y / S, 5, seed + 21) - 0.5) * 9 * S, jy = (vnoise(x / S, y / S, 5, seed + 22) - 0.5) * 9 * S;
    let ch = cellAt(Math.floor((x + jx) / C), Math.floor((y + jy) / C));
    if (ch === '~') ch = cellAt(Math.floor(x / C), Math.floor(y / C));
    if (ch === '~') ch = '#';
    if (cellAt(Math.floor(x / C), Math.floor(y / C)) === 'i' || y <= 2 * S || y >= H - 3 * S || floe[i]) ch = 'i'; // caps and floes stay ice
    biome[i] = ch === 'c' ? '#' : ch; // cities read as land; markers draw on top
  }

  // 3. Distances (4-neighbour BFS): land -> nearest sea, sea -> nearest land.
  const toSea = dist(0); // for land pixels: distance to the nearest sea
  const toLand = dist(1); // for sea pixels: distance to the nearest land

  // 3b. Lakes (#110): a few small inland waters in green country, well away from the sea.
  const lake = new Uint8Array(N);
  for (let t = 0, made = 0; t < 3000 * S && made < 5 * S; t++) {
    const x0 = Math.floor(hash(t, 51, seed) * W), y0 = Math.floor(hash(t, 52, seed) * H);
    const i0 = y0 * W + x0;
    if (!land[i0] || toSea[i0] < 7 * S || !['f', '#'].includes(biome[i0])) continue;
    const rad = (1.2 + hash(t, 53, seed) * 1.2) * Math.sqrt(S);
    for (let k = 0; k < 3; k++) blob(x0 + k * Math.round(rad), y0 + Math.round((hash(t, 54 + k, seed) - 0.5) * 2 * rad), rad, t * 13 + k, (i) => { if (land[i] && toSea[i] >= 4 * S && biome[i] !== 'm') lake[i] = 1; });
    made++;
  }

  // big landmass near a sea pixel? (land cells within 3 cells) -> a wider shelf
  const bigNear = (x, y) => {
    const c = Math.floor(x / C), r = Math.floor(y / C);
    let n = 0;
    for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) { const ch = cellAt(c + dc, r + dr); if (ch !== '~' && ch !== 'i') n++; }
    return n >= 16;
  };

  const out = new Array(N);
  const ramp = (r, d, x, y, s, step = 3) => {
    const k = Math.floor((d + (vnoise(x / S, y / S, 6, seed + s) - 0.5) * 5 * S) / (step * S));
    return r[Math.max(0, Math.min(r.length - 1, r.length - 1 - k))]; // nested blobs: darker inland
  };

  // 4. Paint.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i]) {
      const d = toLand[i];
      const big = bigNear(x, y);
      const shelfW = ((big ? 6 : 2) + Math.floor(vnoise(x / S, y / S, 7, seed + 3) * (big ? 5 : 3))) * S;
      if (d >= 0 && d <= shelfW) out[i] = P.ocean[2];
      else if (d > 22 * S && vnoise(x / S, y / S, 24, seed + 5) > 0.74) out[i] = P.ocean[0]; // a few large calm trenches
      else out[i] = P.ocean[1];
      continue;
    }
    const b = biome[i];
    const d = toSea[i];
    if (b === 'i') { out[i] = d <= S || (d <= 3 * S && vnoise(x / S, y / S, 4, seed + 9) > 0.55) ? P.snow[0] : P.snow[1]; continue; } // bright cap, ragged shadow rim
    // fine texture (#110): clumps a few art pixels across, so the land reads as painted, not flat-filled
    const clump = vnoise(x, y, 3, seed + 81), clump2 = vnoise(x, y, 4, seed + 83);
    if (b === 'd') {
      const DR = P.desert;
      out[i] = ramp(DR, d, x, y, 31, 3);
      // dunes and dry ridges: one tone darker in clumps, inland
      if (d > 3 * S && clump > 0.74) out[i] = DR[Math.max(0, DR.indexOf(out[i]) - 1)];
      else if (d > 2 * S && clump2 > 0.82) out[i] = DR[Math.min(DR.length - 1, DR.indexOf(out[i]) + 1)];
    } else if (b === 'm') out[i] = P.rock[1];
    else if (b === 'f') {
      out[i] = ramp(P.forest, d, x, y, 41, 2);
      if (clump > 0.76) out[i] = P.forest[Math.max(0, P.forest.indexOf(out[i]) - 1)]; // tree crowns
      else if (clump2 > 0.86 && d > 2) out[i] = P.forest[Math.min(3, P.forest.indexOf(out[i]) + 1)]; // clearings
    } else {
      const m = vnoise(x / S, y / S, 4, seed + 51);
      out[i] = m > 0.86 ? P.meadow[1] : m > 0.76 ? P.meadow[0] : ramp([P.forest[1], P.forest[2], P.forest[3]], d, x, y, 47, 3); // open grass, sunny meadows
      if (clump > 0.8) out[i] = out[i] === P.meadow[1] ? P.meadow[0] : out[i] === P.meadow[0] ? P.forest[3] : P.forest[Math.max(0, P.forest.indexOf(out[i]) - 1)]; // copses
      else if (clump2 > 0.88 && out[i] === P.forest[3]) out[i] = P.meadow[0];
    }
    if (lake[i]) out[i] = P.ocean[1];
  }

  // 5. Mountains (#110): ranges are ridged spines with foothills between them, not solid grey blocks.
  //    Ridges lit from the top-left, shadow bottom-right.
  const peak = new Uint8Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (biome[i] !== 'm' || !land[i]) continue;
    const rv = 1 - Math.abs(2 * vnoise(x / S, y / S, 5, seed + 63) - 1); // ridged noise: high along spines
    const core = toSea[i] > 3 * S && (biome[i - 4 * S] === 'm' || 0) && (biome[i + 4 * S] === 'm' || 0);
    if (rv > 0.82 || (core && rv > 0.7)) { peak[i] = 1; out[i] = P.rock[1]; }
    else out[i] = vnoise(x, y, 3, seed + 65) > 0.7 ? P.rock[0] : P.forest[0]; // foothills: dark wooded slopes, rocky outcrops
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (!peak[i]) continue;
    const upLeftOpen = !peak[i - W] || !peak[i - 1];
    const downRightOpen = !peak[i + W] || !peak[i + 1];
    if (upLeftOpen) out[i] = P.rock[2];
    else if (downRightOpen) out[i] = P.rock[0];
    else if (toSea[i] > 6 * S && vnoise(x / S, y / S, 6, seed + 61) > 0.7) out[i] = P.snow[1]; // snowy peaks, inland only
  }

  // 6. Coast outline: 1px K on the land side, ~25% left open in short runs. Ice gets its shadow edge instead.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i] || toSea[i] !== 1 || biome[i] === 'i') continue;
    if (vnoise(x / S, y / S, 3, seed + 71) > 0.66) continue; // deliberate gap
    out[i] = P.outline;
  }

  // 7. Rivers (#110): 1px lines in green land, meandering downhill and out through a gap in the coast.
  for (let k = 0, tries = 0; k < 12 * S && tries < 800 * S; tries++) {
    const x0 = Math.floor(hash(tries, 1, seed) * W), y0 = Math.floor(hash(tries, 2, seed) * H);
    const i0 = y0 * W + x0;
    if (!land[i0] || toSea[i0] < 6 * S || !['f', '#'].includes(biome[i0])) continue;
    let x = x0, y = y0;
    for (let s = 0; s < 40 * S; s++) {
      const i = y * W + x;
      if (!land[i] || lake[i] || biome[i] === 'i' || biome[i] === 'm' || peak[i]) break; // reached the sea, a lake or the hills
      out[i] = P.water[0];
      if (toSea[i] <= 1) break; // the mouth: a gap in the outline
      // meander: any step that doesn't climb, picked by a stable hash, with a pull toward the sea
      const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([X, Y]) => X >= 0 && Y >= 0 && X < W && Y < H && out[Y * W + X] !== P.water[0]);
      if (!steps.length) break;
      const here = toSea[i];
      const down = steps.filter(([X, Y]) => toSea[Y * W + X] < here);
      const flat = steps.filter(([X, Y]) => toSea[Y * W + X] === here);
      const pool = hash(x, y, seed + s) < 0.35 && flat.length ? flat : down.length ? down : flat;
      if (!pool.length) break;
      [x, y] = pool[Math.floor(hash(x * 3 + s, y * 5, seed + 77) * pool.length)];
    }
    k++;
  }

  const rgba = new Uint8ClampedArray(N * 4);
  for (let i = 0; i < N; i++) { const [r, g, b] = hexRgb(out[i]); rgba.set([r, g, b, 255], i * 4); }
  return {
    w: W, h: H, rgba, land, biome, colours: out,
    scale: S,
    isLandPx: (x, y) => x >= 0 && y >= 0 && x < W && y < H && land[y * W + x] === 1 && biome[y * W + x] !== 'i',
  };
}

let CACHE = null;
let CANVAS = null;
const SCALED = new Map();
export function mapBase() { return (CACHE ??= paintMapBase()); }
/** The base layer painted at `scale` art pixels per map pixel (cached per scale). */
export function mapBaseAt(scale = 1) {
  const S = Math.max(1, Math.round(scale * 2) / 2);
  if (S === 1) return mapBase();
  if (!SCALED.has(S)) SCALED.set(S, paintMapBase({ scale: S }));
  return SCALED.get(S);
}

/** The base layer at `scale` as a canvas the size of the painting (browser; cached per scale). */
const CANVASES = new Map();
export function mapBaseCanvas(scale = 1, doc = globalThis.document) {
  const b = mapBaseAt(scale);
  if (!CANVASES.has(b.scale)) {
    const cv = Object.assign(doc.createElement('canvas'), { width: b.w, height: b.h });
    cv.getContext('2d').putImageData(new ImageData(b.rgba, b.w, b.h), 0, 0);
    CANVASES.set(b.scale, cv);
  }
  return CANVASES.get(b.scale);
}

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
