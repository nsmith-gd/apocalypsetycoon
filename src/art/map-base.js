// World map base layer (#138): the real Earth, painted per pixel as a pixel-art atlas.
// #100 first pass and #136's daylight palette; #138 redraws the land from real geography (director: "look like the
// Earth"): coastlines and countries from Natural Earth (src/art/earth-data.js, built by tools/build-earth.mjs), and
// biomes from physical geography (src/art/earth.js): the real deserts, rainforests, boreal belt, tundra, ice sheets,
// mountain chains and great lakes, with pixel-art texture on top. More pixels: the game paints it at one art pixel per
// screen pixel (960x576 on a 1440x900 screen, 1280x768 at 1920x1080).
//
// Deterministic and DOM-free: the same scale always gives the same picture, in the browser and in Node.
//
//   const base = paintMapBase({ scale });  // { w, h, rgba, land, biome, colours, isLandPx }; 320x192 x scale
//   mapBaseAt(scale) / mapBaseCanvas(scale) // cached per scale
//   drawMapBase(ctx)                        // the 320x192 painting at 0,0

import { MAP_PALETTE } from './palette.js';
import { earthGrid, EARTH_W, EARTH_H, lonLatAt, mapXY, DESERTS, RAINFORESTS, RIDGES, geoScore } from './earth.js';
import { EARTH } from './earth-data.js';

export const BASE_W = 320;
export const BASE_H = 192;

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

// Great lakes and inland seas the coastline data leaves as land: [lon, lat, rx, ry] in degrees.
const LAKES = [
  [-88, 47.6, 2.7, 0.55], [-86.9, 44, 0.45, 1.8], [-82.3, 44.8, 1.1, 0.85], [-81, 42.2, 1.8, 0.35], [-77.8, 43.6, 1.1, 0.3],
  [-97.6, 52.4, 0.45, 1.5], [-121, 66, 2.2, 0.7], [-114.5, 61.6, 2.1, 0.45], [-111, 59.2, 1.2, 0.3], [-102, 57, 0.8, 0.4],
  [33, -1, 1.4, 1.3], [29.6, -6.3, 0.3, 3], [34.6, -11.8, 0.3, 2.6], [36, 3.5, 0.25, 1.3], [37.4, -2.3, 0.6, 0.3],
  [107.3, 52.4, 0.55, 1.1], [109, 54.4, 0.5, 1], [75.5, 46.4, 2.4, 0.4], [31.5, 61, 0.7, 0.7], [35, 61.5, 0.6, 0.6], [-69.4, -15.8, 0.6, 0.35],
  [59.5, 45, 1.4, 1.2], [14.5, 13, 0.9, 0.8], [99.5, 36.9, 0.6, 0.3], [-112.5, 41.2, 0.5, 0.5],
];

/**
 * Paint the base layer. `scale` = art pixels per map pixel: 1 = 320x192, 3 = 960x576 (a 1440x900 screen at one art
 * pixel per screen pixel), 4 = 1280x768 (1920x1080; the source data's own resolution).
 */
export function paintMapBase({ seed = 7, scale = 1 } = {}) {
  const S = Math.max(1, Math.round(scale * 2) / 2);
  const W = Math.round(BASE_W * S), H = Math.round(BASE_H * S), N = W * H;
  const k = W / 320; // detail sizes are set for the 320 map and grow with it
  const g = earthGrid();
  const ICE = EARTH.regions.indexOf('ice') + 1;

  // 1. land, ice and the geography of each pixel (sampled from the 1280x768 source)
  const val = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    const sy = Math.min(EARTH_H - 1, Math.floor(((y + 0.5) / H) * EARTH_H)) * EARTH_W;
    for (let x = 0; x < W; x++) val[y * W + x] = g[sy + Math.min(EARTH_W - 1, Math.floor(((x + 0.5) / W) * EARTH_W))];
  }
  const land = new Uint8Array(N);
  for (let i = 0; i < N; i++) land[i] = val[i] ? 1 : 0;
  // clusters, not noise: lone pixels go (tiny islands survive as 2+ pixel shapes)
  for (let pass = 0; pass < 2; pass++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, n4 = land[i - 1] + land[i + 1] + land[i - W] + land[i + W];
    if (land[i] && n4 === 0) { land[i] = 0; val[i] = 0; } else if (!land[i] && n4 === 4) { land[i] = 1; val[i] = val[i - 1]; }
  }
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // distance to the nearest `target` pixel: a two-pass chamfer transform (round halos, not BFS diamonds)
  const dist = (target) => {
    const d = new Float32Array(N).fill(1e6), D = 1.4142;
    for (let i = 0; i < N; i++) if (land[i] === target) d[i] = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) { v = Math.min(v, d[i - W] + 1); if (x > 0) v = Math.min(v, d[i - W - 1] + D); if (x < W - 1) v = Math.min(v, d[i - W + 1] + D); }
      d[i] = v;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x; let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) { v = Math.min(v, d[i + W] + 1); if (x < W - 1) v = Math.min(v, d[i + W + 1] + D); if (x > 0) v = Math.min(v, d[i + W - 1] + D); }
      d[i] = v;
    }
    return d;
  };
  const toSea = dist(0), toLand = dist(1);
  // how much land is around (coarse, blurred): big coasts get wide shelves, small islands narrow ones
  const CW = 80, CH = 48, frac = new Float32Array(CW * CH);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) frac[Math.floor((y / H) * CH) * CW + Math.floor((x / W) * CW)] += land[y * W + x] / ((W / CW) * (H / CH));
  const blur = (a) => { const o = new Float32Array(CW * CH); for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { let s = 0, n = 0; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const X = x + i, Y = y + j; if (X >= 0 && Y >= 0 && X < CW && Y < CH) { s += a[Y * CW + X]; n++; } } o[y * CW + x] = s / n; } return o; };
  const near = blur(frac);
  const landAround = (x, y) => near[Math.min(CH - 1, Math.floor((y / H) * CH)) * CW + Math.min(CW - 1, Math.floor((x / W) * CW))];
  const lonOf = new Float32Array(W), latOf = new Float32Array(H);
  for (let x = 0; x < W; x++) lonOf[x] = lonLatAt((x + 0.5) / W, 0.5)[0];
  for (let y = 0; y < H; y++) latOf[y] = lonLatAt(0.5, (y + 0.5) / H)[1];

  // mountain chains: distance to each spine, culled by bounding box (in degrees)
  const chains = RIDGES.map(({ w, pts }) => ({ w, pts, x0: Math.min(...pts.map((p) => p[0])) - w * 2, x1: Math.max(...pts.map((p) => p[0])) + w * 2, y0: Math.min(...pts.map((p) => p[1])) - w * 2, y1: Math.max(...pts.map((p) => p[1])) + w * 2 }));
  const ridgeAt = (lon, lat) => {
    let best = Infinity;
    for (const c of chains) {
      if (lon < c.x0 || lon > c.x1 || lat < c.y0 || lat > c.y1) continue;
      const kx = Math.cos(lat * Math.PI / 180);
      for (let i = 0; i + 1 < c.pts.length; i++) {
        const [ax, ay] = c.pts[i], [bx, by] = c.pts[i + 1];
        const dx = (bx - ax) * kx, dy = by - ay, px = (lon - ax) * kx, py = lat - ay;
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
        best = Math.min(best, Math.hypot(px - t * dx, py - t * dy) / c.w);
      }
    }
    return best;
  };

  // 2. paint
  const out = new Array(N);
  const biome = new Array(N).fill('~');
  const height = new Float32Array(N);
  const pick = (ramp, v) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(v)))];
  const lakeList = LAKES.map(([lo, la, rx, ry]) => { const [fx, fy] = mapXY(lo, la); const [fx2, fy2] = mapXY(lo + rx, la - ry); return [fx * W, fy * H, Math.max(1.2, Math.abs(fx2 - fx) * W), Math.max(1.2, Math.abs(fy2 - fy) * H)]; });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const mx = x / k, my = y / k; // map units (320 wide) for shapes that keep their size at every scale
    if (!land[i]) {
      // shelf: wide off the continents, narrow off small islands; deep ocean flat
      const d = toLand[i];
      const shelf = (1 + Math.min(1, landAround(x, y) * 2.2) * (1.5 + vnoise(mx, my, 10, seed + 3) * 5)) * k;
      out[i] = d <= shelf ? (d <= 1.5 * k && Math.abs(latOf[y]) < 24 && vnoise(x, y, 4, seed + 17) > 0.45 ? P.ocean[3] : P.ocean[2]) : P.ocean[1]; // reefs in the tropics
      continue;
    }
    const d = toSea[i];
    // geography is looked up at a noise-warped position, so deserts, forests and ranges get ragged natural edges
    const lon = lonOf[x] + (vnoise(mx, my, 7, seed + 31) - 0.5) * 7 + (vnoise(x, y, 5, seed + 33) - 0.5) * 1.6;
    const lat = latOf[y] + (vnoise(mx, my, 7, seed + 32) - 0.5) * 5 + (vnoise(x, y, 5, seed + 34) - 0.5) * 1.2;
    const fine = vnoise(x, y, 3, seed + 81), fine2 = vnoise(x, y, 2.5, seed + 83);
    const wob = (vnoise(mx, my, 6, seed + 11) - 0.5) * 0.35 + (vnoise(x, y, 4, seed + 12) - 0.5) * 0.12;
    if (val[i] === ICE || lat > 79 || (lat > 73 && fine < 0.35 && lon > -100 && lon < -10)) { // ice sheets
      biome[i] = 'i';
      out[i] = d <= Math.max(1, k * 0.5) || (d <= 2 * k && vnoise(x, y, 4, seed + 9) > 0.55) ? P.snow[0] : P.snow[1];
      if (out[i] === P.snow[1] && d > 3 * k && vnoise(x / k, y / k, 3, seed + 13) > 0.86) out[i] = P.snow[0]; // a few large drifts, not salt
      continue;
    }
    const ds = geoScore(DESERTS, lon, lat), rs = geoScore(RAINFORESTS, lon, lat);
    const desert = ds > 0 ? ds + wob * 0.4 : -1;
    const rain = rs > 0 ? rs + wob * 0.4 : -1;
    const ridge = ridgeAt(lon, lat) + wob * 0.8;
    const alat = Math.abs(lat);
    const moist = vnoise(mx, my, 9, seed + 85) * 0.7 + vnoise(x, y, 6, seed + 86) * 0.3;
    const rough = vnoise(mx, my, 3, seed + 41) * 0.55 + vnoise(x, y, 3, seed + 42) * 0.45; // broken, rocky ground
    if (ridge < 0.75 + rough * 0.6) { // mountains: rust and sand slopes, dark gullies, snow on the high crests
      biome[i] = 'm';
      height[i] = Math.max(0, 1.3 - ridge) + rough * 0.6;
      const cold = alat > 38 || ridge < 0.3;
      out[i] = ridge < 0.3 + rough * 0.15 && cold && rough > 0.45 ? P.snow[1] : ridge < 0.55 && cold ? pick(P.rock, rough * 3) : pick(P.desert, 0.6 + rough * 3.2);
      continue;
    }
    if (desert > 0.1) { // deserts: pale sand, mottled with darker ergs and rocky plateaus
      biome[i] = 'd';
      const mot = vnoise(mx, my, 4, seed + 43) * 0.6 + fine * 0.4;
      out[i] = mot > 0.68 ? P.desert[2] : mot > 0.6 ? P.desert[3] : mot < 0.22 ? P.desert[1] : desert > 0.3 ? P.desert[4] : P.desert[3];
      continue;
    }
    if (desert > 0) { biome[i] = '#'; out[i] = pick(P.savanna, 1.2 + fine * 1.8); continue; } // the dry fringe
    const tl = 64 + wob * 10; // tree line
    if (alat > tl + 4) { biome[i] = 't'; out[i] = pick(P.tundra, (alat - tl - 4) / 4 + (fine - 0.5) * 1.6); continue; }
    if (rain > 0.05) { biome[i] = 'f'; out[i] = pick(P.forest, 0.6 + (1 - Math.min(1, rain * 1.5)) * 2 + (fine - 0.5) * 1.6 + (fine2 > 0.85 ? 1 : 0)); continue; }
    if (alat > 49 + wob * 10 && alat <= tl + 4) { biome[i] = 'f'; out[i] = pick(P.forest, 1.4 + (fine - 0.5) * 1.8 + (alat > tl ? 1 : 0)); continue; } // boreal belt
    const dry = alat < 35 && moist < 0.3; // savanna near the dry belts
    if (dry) { biome[i] = '#'; out[i] = pick(P.savanna, moist * 4 + (fine - 0.5) * 1.6); if (fine2 > 0.86) out[i] = P.forest[3]; continue; }
    biome[i] = '#';
    const ramp = [P.forest[2], P.forest[3], P.forest[4], P.meadow[0], P.meadow[1]];
    out[i] = pick(ramp, moist * 3.4 + (d <= k ? 0.6 : 0) + (fine - 0.5) * 1.8 - (fine2 > 0.84 ? 1.2 : 0));
    if (out[i] === P.meadow[1] && fine2 < 0.06) out[i] = P.meadow[2];
  }
  // mountain light: lit edge top-left, shadow bottom-right
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (biome[i] !== 'm' || out[i] === P.snow[1]) continue;
    const slope = height[i] - height[i - W - 1]; // rising toward the bottom-right = facing the top-left light
    if (slope > 0.07) out[i] = P.desert[3];
    else if (slope < -0.09) out[i] = height[i] > 0.9 ? P.rock[0] : P.desert[0];
  }
  // lakes
  for (const [cx, cy, rx, ry] of lakeList) for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = y * W + x;
    if (land[i] && biome[i] !== 'i' && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + (vnoise(x, y, 2, seed + 15) - 0.5) * 0.5) out[i] = P.water[1];
  }
  // coast outline: 1px K on the land side, about a third left open
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i] || toSea[i] !== 1 || biome[i] === 'i') continue;
    if (vnoise(x, y, 4, seed + 71) > 0.64) continue; // about a quarter of the coast left open
    out[i] = P.outline;
  }

  const rgba = new Uint8ClampedArray(N * 4);
  const cache = new Map();
  for (let i = 0; i < N; i++) { let c = cache.get(out[i]); if (!c) cache.set(out[i], (c = hexRgb(out[i]))); rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = 255; }
  return {
    w: W, h: H, rgba, land, biome, colours: out, scale: S,
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
