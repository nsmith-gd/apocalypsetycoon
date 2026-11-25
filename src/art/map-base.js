// World map base layer: land, coasts, ocean and terrain painted per pixel. #100 first pass; #136 full redo to
// the measured targets in docs/art/world-map-target.md (v2): a brighter daylight atlas, coasts crinkled per art
// pixel, gulfs and peninsulas, island arcs, lake country, latitude bands (tundra, savanna) and snowy spines.
//
// Deterministic and DOM-free: the same layout always gives the same picture, in the browser and in Node.
// It follows WORLD_LAYOUT (the 40x24 cell layout the regions and their hit areas use): every land cell's heart
// stays land and every sea cell's heart stays sea, so regions and click areas stay where they are.
//
//   const base = paintMapBase({ scale });  // { w, h, rgba, land, biome, colours, isLandPx }
//   mapBaseAt(scale) / mapBaseCanvas(scale) // cached per scale; the game paints 2 screen px per art px
//   drawMapBase(ctx)                        // the 320x192 painting at 0,0

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
 * Paint the base layer (#136 full redo, to docs/art/world-map-target.md v2).
 * `scale` = art pixels per map pixel (1 = 320x192; 1.5 = 480x288, the 1440x900 game; 2 = 640x384).
 * Continents keep their shape at every scale (macro shapes in map units), but all DETAIL is sized in art
 * pixels: coast crinkle, islands, texture clumps and lakes are the same few pixels at every scale, so a bigger
 * map is a denser map, not a blown-up one.
 */
export function paintMapBase({ seed = 7, scale = 1 } = {}) {
  const S = Math.max(1, Math.round(scale * 2) / 2); // whole or half steps: 1, 1.5, 2...
  const C = CELL * S; // a map cell in art pixels
  const W = Math.round(BASE_W * S), H = Math.round(BASE_H * S), N = W * H;
  const land = new Uint8Array(N);
  const biome = new Array(N).fill('~');
  const cellOf = (x, y) => [Math.floor(x / C), Math.floor(y / C)];
  const heartOf = (x, y) => { const ix = Math.floor(x / S) % CELL, iy = Math.floor(y / S) % CELL; return ix >= 2 && ix <= 5 && iy >= 2 && iy <= 5; };
  const capRows = (y) => y <= 2 * S || y >= H - 3 * S;

  // ---------- 1. land: the cell layout, domain-warped (gulfs, peninsulas), crinkled per art pixel ----------
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const mx = (x + 0.5) / S - 0.5, my = (y + 0.5) / S - 0.5; // map coordinates
    const wx = mx + (vnoise(mx, my, 13, seed + 1) - 0.5) * 11 + (vnoise(mx, my, 6, seed + 5) - 0.5) * 4;
    const wy = my + (vnoise(mx, my, 13, seed + 2) - 0.5) * 9 + (vnoise(mx, my, 6, seed + 6) - 0.5) * 3;
    const gx = (wx + 0.5) / CELL - 0.5, gy = (wy + 0.5) / CELL - 0.5;
    const c0 = Math.floor(gx), r0 = Math.floor(gy), tx = gx - c0, ty = gy - r0;
    const v = cellLand(c0, r0) * (1 - tx) * (1 - ty) + cellLand(c0 + 1, r0) * tx * (1 - ty) + cellLand(c0, r0 + 1) * (1 - tx) * ty + cellLand(c0 + 1, r0 + 1) * tx * ty;
    const [c, r] = cellOf(x, y);
    const ownCh = cellAt(c, r);
    const icy = ownCh === 'i' || cellAt(c, r + (y < H / 2 ? 1 : -1)) === 'i';
    const macro = (fbm(wx, wy, seed) - 0.5) * (icy ? 1.3 : 0.5);
    const fine = (vnoise(x, y, 5, seed + 3) - 0.5) * 0.26 + (vnoise(x, y, 2.5, seed + 4) - 0.5) * 0.16; // art px
    let isLand = v + macro + fine * (icy ? 1.8 : 1) > 0.5;
    if (heartOf(x, y) && !icy) isLand = ownCh !== '~'; // layout + hit areas hold
    if (capRows(y)) isLand = ownCh === 'i' || isLand; // the caps touch the map edge
    land[y * W + x] = isLand ? 1 : 0;
  }

  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const dist = (target) => {
    const d = new Int16Array(N).fill(-1);
    const q = new Int32Array(N);
    let qt = 0;
    for (let i = 0; i < N; i++) if (land[i] === target) { d[i] = 0; q[qt++] = i; }
    for (let h = 0; h < qt; h++) {
      const i = q[h], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of N4) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const j = Y * W + X;
        if (d[j] === -1) { d[j] = d[i] + 1; q[qt++] = j; }
      }
    }
    return d;
  };
  const seaHeart = (x, y) => { const [c, r] = cellOf(x, y); return heartOf(x, y) && !cellLand(c, r); };
  const blob = (cx, cy, rad, k, fn) => {
    const R = Math.ceil(rad + 1);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const X = Math.round(cx) + dx, Y = Math.round(cy) + dy;
      if (X < 1 || Y < 1 || X >= W - 1 || Y >= H - 1) continue;
      const wob = 1 + (hash(X, Y, seed + k) - 0.5) * 0.6;
      if (dx * dx + dy * dy * 1.15 <= rad * rad * wob) fn(Y * W + X, X, Y);
    }
  };

  // ---------- 2. archipelagos: arcs of small islands (1-6 art px) off the coasts and along the Arctic ----------
  const floe = new Uint8Array(N);
  {
    const near = dist(1);
    let made = 0;
    for (let t = 0; t < 16000 && made < 66; t++) {
      const arctic = made >= 46; // the last ones: an Arctic archipelago along the northern coasts
      const x0 = hash(t, 11, seed) * W, y0 = arctic ? (1.6 + hash(t, 12, seed) * 2.4) * C : hash(t, 12, seed) * H;
      const i0 = Math.floor(y0) * W + Math.floor(x0), d0 = near[i0];
      if (land[i0] || d0 < 2 * S || d0 > 12 * S) continue;
      const polar = y0 < 4.5 * C || y0 > H - 3.5 * C;
      const ang = hash(t, 13, seed) * Math.PI * 2, bend = (hash(t, 14, seed) - 0.5) * 0.12;
      const count = arctic ? 20 + Math.floor(hash(t, 15, seed) * 30) : 8 + Math.floor(hash(t, 15, seed) * 30);
      let x = x0, y = y0, a = ang;
      for (let k = 0; k < count; k++) {
        const rad = 1.1 + Math.pow(hash(t, 100 + k, seed), 2.2) * (arctic ? 1.6 : 2.4); // mostly small, a few bigger
        blob(x + (hash(t, 200 + k, seed) - 0.5) * 3, y + (hash(t, 300 + k, seed) - 0.5) * 3, rad, t * 31 + k, (i, X, Y) => {
          if (!seaHeart(X, Y) && near[i] >= 2) { land[i] = 1; if (polar && !arctic && (Y < 2.5 * C || Y > H - 2.5 * C)) floe[i] = 1; }
        });
        a += bend + (hash(t, 600 + k, seed) - 0.5) * 0.9; const gap = arctic ? 1.8 : 1; x += Math.cos(a) * (1.6 + hash(t, 400 + k, seed) * 2.6) * gap; y += Math.sin(a) * (1.4 + hash(t, 500 + k, seed) * 2.2) * gap; // tight chains: islands nearly touch
        if (x < 2 || y < 2 || x > W - 3 || y > H - 3) break;
      }
      made++;
    }
  }
  // tidy: no lone pixels or 1px holes (clusters, not noise)
  for (let changed = true, pass = 0; changed && pass < 6; pass++) {
    changed = false;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const n4 = land[i - 1] + land[i + 1] + land[i - W] + land[i + W];
      if (land[i] && n4 <= 1) { land[i] = 0; floe[i] = 0; changed = true; }
      else if (!land[i] && n4 >= 4) { land[i] = 1; changed = true; }
    }
  }

  // ---------- 3. biome char per land pixel: the layout at a jittered position; caps and floes are ice ----------
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i]) continue;
    const jx = (vnoise(x / S, y / S, 5, seed + 21) - 0.5) * 9 * S + (vnoise(x, y, 3, seed + 23) - 0.5) * 3;
    const jy = (vnoise(x / S, y / S, 5, seed + 22) - 0.5) * 9 * S + (vnoise(x, y, 3, seed + 24) - 0.5) * 3;
    let [c, r] = cellOf(x + jx, y + jy);
    let ch = cellAt(c, r);
    if (ch === '~') { [c, r] = cellOf(x, y); ch = cellAt(c, r); }
    if (ch === '~') ch = '#';
    // the ice cap's edge wanders further than biome borders do: glaciers and tongues, never a straight line
    const ix = x + (vnoise(x / S, y / S, 7, seed + 25) - 0.5) * 22 * S, iy = y + (vnoise(x / S, y / S, 7, seed + 26) - 0.5) * 12 * S;
    const iceHere = cellAt(...cellOf(ix, iy)) === 'i';
    if (ch === 'i' && !iceHere) ch = cellAt(...cellOf(x, y + (y < H / 2 ? C : -C))) === '~' ? '#' : cellAt(...cellOf(x, y + (y < H / 2 ? C : -C)));
    if (iceHere || capRows(y) || floe[i]) ch = 'i';
    biome[i] = ch === 'c' ? '#' : ch;
  }

  const toSea = dist(0), toLand = dist(1);
  const lat = (y) => Math.abs((y + 0.5) / H - 0.5) * 2; // 0 equator .. 1 pole

  // ---------- 4. lakes: districts of small dark lakes in the cool green north, a few elsewhere ----------
  const lake = new Uint8Array(N);
  for (let t = 0, made = 0; t < 5000 && made < 15; t++) {
    const x0 = Math.floor(hash(t, 51, seed) * W), y0 = Math.floor(hash(t, 52, seed) * H);
    const i0 = y0 * W + x0;
    if (!land[i0] || toSea[i0] < 5 || !['f', '#'].includes(biome[i0])) continue;
    if (lat(y0) < 0.35 && hash(t, 59, seed) < 0.7) continue; // mostly northern lake country
    const n = 2 + Math.floor(hash(t, 53, seed) * 4), ang = hash(t, 54, seed) * Math.PI;
    for (let k = 0; k < n; k++) { // long, thin glacial lakes: blobs strung along a line
      const rad = 1.1 + hash(t, 60 + k, seed) * 1.1;
      blob(x0 + Math.cos(ang) * k * 2.2, y0 + Math.sin(ang) * k * 1.6, rad, t * 17 + k, (i) => { if (land[i] && toSea[i] >= 3 && biome[i] !== 'm' && biome[i] !== 'i') lake[i] = 1; });
    }
    made++;
  }

  // ---------- 5. paint ----------
  const out = new Array(N);
  const pick = (ramp, k) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(k)))];
  // big landmass near a sea pixel? -> a wider shelf (in art px: 5-10 off continents, 2-3 off islets)
  const bigNear = (x, y) => {
    const [c, r] = cellOf(x, y);
    let n = 0;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) { const ch = cellAt(c + dc, r + dr); if (ch !== '~' && ch !== 'i') n++; }
    return n >= 7;
  };
  const ridge = (x, y) => 1 - Math.abs(2 * vnoise(x / S, y / S, 7, seed + 63) - 1); // high along spines (map units)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i]) {
      const d = toLand[i];
      const big = bigNear(x, y);
      const shelf = big ? 4 + Math.floor(vnoise(x, y, 9, seed + 3) * 7) : 2 + Math.floor(vnoise(x, y, 6, seed + 4) * 2);
      if (d >= 0 && d <= shelf) {
        // lagoons: shallow water hemmed in by land on two sides
        let ln = 0;
        for (const [dx, dy] of N4) { const X = x + dx * 2, Y = y + dy * 2; if (X >= 0 && Y >= 0 && X < W && Y < H && land[Y * W + X]) ln++; }
        out[i] = ln >= 3 && d <= 2 ? P.ocean[3] : P.ocean[2];
      } else out[i] = P.ocean[1];
      continue;
    }
    const b = biome[i], d = toSea[i], la = lat(y);
    const clump = vnoise(x, y, 3, seed + 81), clump2 = vnoise(x, y, 2.5, seed + 83); // texture, 2-4 art px
    const moist = vnoise(x / S, y / S, 10, seed + 85) * 0.75 + vnoise(x, y, 7, seed + 86) * 0.25;
    if (b === 'i') {
      out[i] = d <= 1 || (d <= 3 && vnoise(x, y, 4, seed + 9) > 0.5) ? P.snow[0] : P.snow[1];
      if (out[i] === P.snow[1] && d > 4 && vnoise(x, y, 6, seed + 89) > 0.82) out[i] = P.snow[0]; // a few drifts
      continue;
    }
    if (b === 'd') {
      // nested: pale sand in the middle of the desert, rust toward its edges; dunes as clumps
      const inner = Math.min(d, 30) / 30;
      let k = 1 + inner * 3 + (moist - 0.5) * 2.2;
      if (clump > 0.7) k -= 1; else if (clump2 > 0.8) k += 1;
      out[i] = pick(P.desert, k);
      if (d <= 2 * S) out[i] = clump > 0.5 ? P.savanna[1] : P.savanna[2]; // a scrubby rim
      continue;
    }
    const tl = 0.71 + (vnoise(x / S, y / S, 9, seed + 87) - 0.5) * 0.16 + (vnoise(x, y, 4, seed + 88) - 0.5) * 0.06; // ragged tree line
    if (la > tl && b !== 'm') { // tundra: cold moss and frost, mixed with dark boreal forest
      const k = (la - tl) * 9 + (clump - 0.5) * 2;
      out[i] = k > 1.5 ? P.tundra[1] : k > 0.7 ? P.tundra[0] : clump2 > 0.55 ? P.forest[3] : clump > 0.6 ? P.forest[1] : P.forest[2]; // boreal forest below the tree line
      continue;
    }
    if (b === 'f') { // dense forest: dark cores, mid-green clearings
      let k = 1.2 + (1 - Math.min(d, 18) / 18) * 2 + (moist - 0.5) * 1.5;
      if (clump > 0.72) k -= 1.2; else if (clump2 > 0.8) k += 1;
      out[i] = pick(P.forest, k);
      continue;
    }
    // open land ('#', and the ground under mountains): moisture bands; dry savanna near the tropics, lush north
    const dry = la < 0.5 && moist < 0.42;
    if (dry) {
      let k = moist * 6 - 0.4; if (clump > 0.75) k -= 1;
      out[i] = pick(P.savanna, k);
      if (clump2 > 0.84) out[i] = P.forest[3];
    } else {
      let k = 1 + moist * 3.4 + (d <= 2 ? 0.6 : 0); // 0..4 over forest[1..4] + meadow
      if (clump > 0.74) k -= 1.3; else if (clump2 > 0.82) k += 1.2;
      const ramp = [P.forest[1], P.forest[2], P.forest[3], P.forest[4], P.meadow[0], P.meadow[1]];
      out[i] = pick(ramp, k);
      if (out[i] === P.meadow[1] && clump2 > 0.9) out[i] = P.meadow[2]; // glints, sparingly
    }
  }

  // ---------- 6. mountains: ridged spines in rust and sand, lit top-left, snow along the high crests ----------
  const peak = new Uint8Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (!land[i] || biome[i] === 'i') continue;
    const rv = ridge(x, y);
    const inRange = biome[i] === 'm';
    if (inRange && rv > 0.3) peak[i] = rv > 0.88 ? 2 : 1;
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (!peak[i]) continue;
    const lit = !peak[i - W] || !peak[i - 1];
    const shade = !peak[i + W] || !peak[i + 1];
    const cl = vnoise(x, y, 2.5, seed + 67);
    if (peak[i] === 2) out[i] = cl > 0.55 ? P.snow[1] : cl > 0.3 ? P.rock[2] : P.rock[1]; // snowy crest
    else if (lit) out[i] = P.desert[3];
    else if (shade) out[i] = ridge(x, y) > 0.6 ? P.rock[0] : P.desert[0]; // high faces in cold rock shadow
    else out[i] = cl > 0.6 ? P.desert[2] : cl > 0.3 ? P.desert[1] : P.rock[1];
  }

  // ---------- 7. lakes on top ----------
  for (let i = 0; i < N; i++) if (lake[i]) out[i] = P.water[1];

  // ---------- 8. coast outline: 1px K on the land side, ~1/3 left open in short runs ----------
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i] || toSea[i] !== 1 || biome[i] === 'i') continue;
    if (vnoise(x, y, 4, seed + 71) > 0.76) continue;
    out[i] = P.outline;
  }

  // ---------- 9. rivers: a few 1px lines, meandering downhill and out through a gap in the coast ----------
  for (let k = 0, tries = 0; k < 5 * S && tries < 800; tries++) {
    let x = Math.floor(hash(tries, 1, seed) * W), y = Math.floor(hash(tries, 2, seed) * H);
    const i0 = y * W + x;
    if (!land[i0] || toSea[i0] < 9 || !['f', '#'].includes(biome[i0]) || peak[i0] || lake[i0]) continue;
    for (let s = 0; s < 60 * S; s++) {
      const i = y * W + x;
      if (!land[i] || lake[i] || biome[i] === 'i' || peak[i]) break;
      out[i] = P.water[0];
      if (toSea[i] <= 1) break;
      const steps = N4.map(([dx, dy]) => [x + dx, y + dy]).filter(([X, Y]) => X >= 0 && Y >= 0 && X < W && Y < H && out[Y * W + X] !== P.water[0]);
      const down = steps.filter(([X, Y]) => toSea[Y * W + X] < toSea[i]);
      const flat = steps.filter(([X, Y]) => toSea[Y * W + X] === toSea[i]);
      const pool = vnoise(x, y, 5, seed + s) < 0.4 && flat.length ? flat : down.length ? down : flat;
      if (!pool.length) break;
      [x, y] = pool[Math.floor(vnoise(x, y, 4, seed + 77) * pool.length * 0.999)];
    }
    k++;
  }

  const rgba = new Uint8ClampedArray(N * 4);
  for (let i = 0; i < N; i++) { const [r, g, b] = hexRgb(out[i]); rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = 255; }
  return {
    w: W, h: H, rgba, land, biome, colours: out, lake,
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
