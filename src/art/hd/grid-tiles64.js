// The shelter grid's ground and construction tiles at the 64 px minimum (#24, art note D4): the five strata
// (topsoil, clay, bedrock, deep rock, the abyss) and the three build stages (dig, shell, fit-out), 64 x 64 px per
// 1 m tile.
//
// Strata are painted from WORLD pixel coordinates (tile x * 64 + i), so any two neighbouring tiles join without a
// seam and no two tiles look alike, and there is no stamp to spot (style guide: terrain tiles must tile seamlessly).
// Light from the top-left lands on every rock edge; texture is clusters, never single-pixel noise.
//
//   strataRaster('clay', x, y)          -> Raster 64 x 64 (headless)
//   digRaster('clay', t, x, y)          t = 0..1: the hole opens from the top, rubble piles up, a bucket waits
//   shellRaster(t, 'wall' | 'spine')    formwork and rebar, then concrete poured bottom-up
//   fitoutRaster(wTiles, hTiles, t, frame)  scaffold and dust sheet around a piece being fitted
//   drawStrata64 / drawDig64 / drawShell64 / drawFitout64(ctx, ..., { tile = 16 })  cached, reduced to the grid
//       (16 px per metre until the director confirms the 64 px grid; at tile = 64 they draw 1:1)

import { Raster, col, K, box, hash, bayer, rampFromHex } from './raster.js';
import { reduceRaster } from './amenities64.js';
import { STRATUM_ART } from '../bunker-tiles.js';

export const GRID_PX = 64;
const P = GRID_PX;

// a ramp per stratum, built from the stratum's base colour (the same browns and greys the grid already uses)
const RAMP = Object.fromEntries(Object.entries(STRATUM_ART).map(([id, a]) => [id, rampFromHex(a.base)]));
const ACCENT = { topsoil: 'leaf', clay: 'rust', bedrock: 'concrete', deep: 'water', abyss: 'neon' };

/** Value noise over world pixels with a given cell size (smooth, wraps nothing: world coordinates are unique). */
function vnoise(wx, wy, cell, s) {
  const gx = Math.floor(wx / cell), gy = Math.floor(wy / cell), fx = wx / cell - gx, fy = wy / cell - gy;
  const sm = (t) => t * t * (3 - 2 * t);
  const a = hash(gx, gy, s), b = hash(gx + 1, gy, s), c = hash(gx, gy + 1, s), d = hash(gx + 1, gy + 1, s);
  const u = sm(fx), v = sm(fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Nearest and second-nearest feature points (Voronoi) for rock blocks. */
function voronoi(wx, wy, cell, s) {
  const gx = Math.floor(wx / cell), gy = Math.floor(wy / cell);
  let d1 = 1e9, d2 = 1e9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j;
    const px = (cx + hash(cx, cy, s)) * cell, py = (cy + hash(cx, cy, s + 1) * 0.7 + 0.15) * cell;
    const d = Math.hypot((wx - px) * 0.55, wy - py);
    if (d < d1) { d2 = d1; d1 = d; id = hash(cx, cy, s + 2); } else if (d < d2) d2 = d;
  }
  return { d1, d2, id };
}

const PAINT = {
  topsoil(b, X, Y, r) {
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) {
      const wx = X + i, wy = Y + j; const n = vnoise(wx, wy, 12, 1) * 0.6 + vnoise(wx, wy, 5, 2) * 0.4;
      b.set(i, j, col(r, 3 + (n > 0.68 ? 1 : n < 0.3 ? -1 : 0)));
    }
    for (let k = 0; k < 14; k++) { const cx = Math.floor(hash(X + k, Y, 3) * 62), cy = Math.floor(hash(X, Y + k, 4) * 62), w = 2 + (k % 3); b.rect(cx, cy, w, 2, col(r, k % 4 ? 2 : 5)); if (k % 4 === 0) b.rect(cx, cy + 2, w, 1, col(r, 1)); } // crumbs
    if (hash(X, Y, 9) < 0.45) { let x = 8 + Math.floor(hash(X, Y, 10) * 48), y = 0; while (y < P) { b.set(x, y, col('walnut', 4)); b.set(x + 1, y, col('walnut', 2)); y++; if (hash(x, y, X) < 0.3) x += hash(y, x, Y) < 0.5 ? -1 : 1; if (hash(x, y, 11) < 0.04) { for (let k = 1; k < 6; k++) b.set(x + k, y + k, col('walnut', 3)); } } } // a root
    for (let k = 0; k < 3; k++) { const cx = 6 + Math.floor(hash(X, Y, 20 + k) * 50), cy = 6 + Math.floor(hash(X, Y, 30 + k) * 50); stone(b, cx, cy, 4 + (k % 2) * 2, 'concrete'); }
  },
  clay(b, X, Y, r) {
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) {
      const wx = X + i, wy = Y + j; const band = Math.sin((wy + vnoise(wx, wy, 32, 3) * 18) * 0.28);
      b.set(i, j, col(r, 3 + (band > 0.75 ? 1 : band < -0.8 ? -1 : 0) + (vnoise(wx, wy, 8, 4) > 0.8 ? 1 : 0)));
    }
    for (let k = 0; k < 4; k++) if (hash(X, Y, 40 + k) < 0.6) stone(b, 4 + Math.floor(hash(X, Y, 50 + k) * 54), 4 + Math.floor(hash(X, Y, 60 + k) * 54), 3 + (k % 3), rampFromHex(STRATUM_ART.clay.accent));
    for (let k = 0; k < 2; k++) if (hash(X, Y, 70 + k) < 0.5) { const y0 = 10 + Math.floor(hash(X, Y, 71 + k) * 44); for (let i = 0; i < P; i++) if (vnoise(X + i, Y + y0, 16, 5) > 0.45) b.set(i, y0, col(r, 1)); } // drying cracks
  },
  bedrock(b, X, Y, r) {
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) {
      const { d1, d2, id } = voronoi(X + i, Y + j, 30, 6);
      const edge = d2 - d1;
      let s = 3 + (id < 0.3 ? -1 : id > 0.75 ? 1 : 0);
      if (edge < 1.6) s = 0; // the crack
      else if (edge < 3.2) { // bevel: lit if the crack is below-right of us
        const { d1: dA, d2: dB } = voronoi(X + i + 2, Y + j + 2, 30, 6);
        s += dB - dA < edge ? 2 : -1;
      }
      if (vnoise(X + i, Y + j, 6, 7) > 0.82) s += 1;
      b.set(i, j, col(r, s));
    }
  },
  deep(b, X, Y, r) {
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) {
      const { d1, d2 } = voronoi(X + i, Y + j, 22, 8);
      const n = vnoise(X + i, Y + j, 10, 9);
      b.set(i, j, col(r, (d2 - d1 < 1.4 ? 0 : 2) + (n > 0.7 ? 1 : n < 0.25 ? -1 : 0)));
    }
    for (let k = 0; k < 2; k++) if (hash(X, Y, 80 + k) < 0.55) { // a crystal cluster, lit and glinting
      const cx = 8 + Math.floor(hash(X, Y, 81 + k) * 46), cy = 10 + Math.floor(hash(X, Y, 82 + k) * 44);
      for (let c = 0; c < 3; c++) { const h = 6 + c * 3, x0 = cx + c * 3 - 3; for (let j = 0; j < h; j++) { const w = Math.max(1, Math.round(2 * (1 - j / h)) + 1); b.rect(x0, cy - j, w, 1, col('water', j < 2 ? 6 : 4 + (c === 1 ? 1 : 0)), j < 3 ? 1 : 0); b.set(x0 - 1, cy - j, K); b.set(x0 + w, cy - j, K); } }
    }
  },
  abyss(b, X, Y, r) {
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) { const n = vnoise(X + i, Y + j, 14, 10); b.set(i, j, col(r, 3 + (n > 0.72 ? 1 : n < 0.3 ? -1 : 0))); }
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) { // violet veins: thin where the noise crosses a contour
      const v = vnoise(X + i, Y + j, 26, 11);
      if (Math.abs(v - 0.5) < 0.011) { b.set(i, j, col('neon', 3), 1); if (Math.abs(v - 0.5) < 0.004) b.set(i, j, col('neon', 4), 1); }
    }
  },
};
function stone(b, cx, cy, rad, ramp) {
  for (let y = -rad; y <= rad; y++) for (let x = -rad - 1; x <= rad + 1; x++) {
    const d = Math.hypot(x / 1.25, y); if (d > rad) continue;
    b.set(cx + x, cy + y, d > rad - 1 ? col(ramp, 1) : col(ramp, 3 + Math.round((-x - y) / rad)));
  }
}

/** One undug metre of ground at grid tile (x, y). */
export function strataRaster(id, x, y) {
  const b = new Raster(P, P);
  (PAINT[id] ?? PAINT.topsoil)(b, x * P, y * P, RAMP[id] ?? RAMP.topsoil);
  return b;
}

/** A tile being dug, t = 0..1. */
export function digRaster(id, t, x = 0, y = 0) {
  const b = strataRaster(id, x, y);
  const r = RAMP[id] ?? RAMP.topsoil;
  const open = Math.round(t * 50);
  if (open > 0) { // the hole: dark, with a lit lip and a shadowed back wall
    for (let j = 0; j < open; j++) for (let i = 6; i < 58; i++) b.set(i, 2 + j, col('K', 0));
    for (let j = 0; j < open; j++) { b.set(6, 2 + j, col(r, 1)); b.set(57, 2 + j, col(r, 1)); for (let i = 7; i < 57; i++) if (bayer(i, j) < 0.25 - j / open * 0.2) b.set(i, 2 + j, col(r, 0)); }
    b.rect(6, 2 + open, 52, 1, col(r, 5));
  }
  for (let i = 0; i < 4; i++) { const yy = 6 + open + Math.floor(hash(x, y, 20 + i) * Math.max(1, 50 - open)); if (yy < 56) { const xx = 10 + Math.floor(hash(x, y, 30 + i) * 40); b.rect(xx, yy, 5, 1, col('hazard', 5)); b.rect(xx + 1, yy + 1, 3, 1, col('hazard', 3)); } } // pick marks
  const pile = 3 + Math.round(t * 12); // rubble
  for (let k = 0; k < 10; k++) { const cx = 6 + k * 5 + Math.floor(hash(x, y, k) * 3), h = Math.max(2, pile - Math.abs(k - 5) * 2); stone(b, cx, 62 - Math.ceil(h / 2), Math.ceil(h / 2), r); }
  box(b, 46, 44, 12, 12, 'steel', 4); b.rect(47, 44, 10, 2, col('steel', 6)); for (let i = 0; i < 8; i++) b.set(48 + i, 41 + Math.round(Math.abs(i - 3.5) / 1.5), col('steel', 5)); // bucket and handle
  for (let i = 0; i < P; i++) for (const [x0, y0] of [[i, 0], [i, 63], [0, i], [63, i]]) b.set(x0, y0, ((i >> 2) % 2) ? K : col('hazard', 4)); // work-order frame
  return b;
}

/** A wall or spine tile being built, t = 0..1. */
export function shellRaster(t, kind = 'wall') {
  const b = new Raster(P, P);
  b.rect(0, 0, P, P, col('concrete', 0));
  for (const x0 of [0, 56]) { box(b, x0 + 1, 1, 6, 62, 'walnut', 4); for (let j = 6; j < P; j += 14) b.rect(x0 + 1, j, 6, 1, col('walnut', 2)); } // formwork
  const rebar = kind === 'spine' ? 'hazard' : 'rust';
  for (const xx of [16, 31, 46]) { b.rect(xx, 2, 2, 60, col(rebar, 3)); b.rect(xx, 2, 1, 60, col(rebar, 5)); }
  for (const yy of [12, 31, 50]) { b.rect(8, yy, 48, 2, col(rebar, 3)); b.rect(8, yy, 48, 1, col(rebar, 5)); for (const xx of [16, 31, 46]) b.rect(xx - 1, yy - 1, 4, 4, col('steel', 2)); }
  const fill = Math.round(t * 60);
  if (fill > 0) { for (let j = 0; j < fill; j++) for (let i = 8; i < 56; i++) b.set(i, 62 - j, col('concrete', 4 + (j === fill - 1 ? 2 : 0) + (vnoise(i, j, 6, 12) > 0.75 ? 1 : 0) - (i < 10 ? 1 : 0))); for (let i = 8; i < 56; i += 6) if (fill < 60) b.set(i + 2, 61 - fill, col('concrete', 6)); }
  return b;
}

/** Scaffold and a dust sheet around a piece being fitted (w x h tiles), t = 0..1. */
export function fitoutRaster(w, h, t, frame = 0) {
  const W = w * P, H = h * P;
  const b = new Raster(W, H);
  const covered = Math.round((1 - t) * (H - 8));
  if (covered > 0) for (let j = 0; j < covered; j++) for (let i = 4; i < W - 4; i++) { if (bayer(i, j) > 0.55) continue; const fold = Math.sin(i * 0.35 + j * 0.02) > 0.6; b.set(i, 4 + j, col('plaster', fold ? 3 : 5)); }
  for (const x0 of [0, W - 4]) box(b, x0 + 1, 1, 2, H - 2, 'steel', 5, { bevel: false });
  box(b, 1, 1, W - 2, 2, 'steel', 5, { bevel: false });
  for (let k = 1; k * 48 < H; k++) box(b, 2, k * 48, W - 4, 4, 'walnut', 4); // planks
  for (let j = 0; j < H - 4; j += 8) { b.set(2, j + 4, col('steel', 3)); b.set(W - 3, j + 4, col('steel', 3)); }
  if (t > 0 && frame % 2) { const cx = Math.floor(W / 2), cy = Math.floor(H / 2); for (let k = 0; k < 8; k++) b.rect(cx + Math.round(Math.cos(k) * (3 + k)), cy - Math.round(Math.abs(Math.sin(k)) * (3 + k)), 2, 2, col('amber', 6), 1); }
  return b;
}

// ------------------------------------------------------------------------------------------ cached drawing
const cache = new Map();
function canvasOf(key, make, tile) {
  let cv = cache.get(key);
  if (!cv) {
    const r = reduceRaster(make(), Math.max(1, Math.round(P / tile)));
    cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(r.w, r.h) : Object.assign(document.createElement('canvas'), { width: r.w, height: r.h });
    cv.getContext('2d').putImageData(new ImageData(r.rgba(), r.w, r.h), 0, 0);
    if (cache.size > 24000) cache.clear(); // an Ark plot is 64 x 135 tiles: the cap must hold a whole plot or every frame rebuilds (#143)
    cache.set(key, cv);
  }
  return cv;
}
const put = (ctx, cv, px, py) => { ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, px, py); };
// Ground repeats every STRATA_PERIOD metres, so a plot of any size needs at most PERIOD^2 textures per stratum
// (an Ark is 64 x 135 tiles; generating every tile froze the editor for ~13 s) (#143).
const STRATA_PERIOD = 16;
const wrap = (v) => ((v % STRATA_PERIOD) + STRATA_PERIOD) % STRATA_PERIOD;
export const drawStrata64 = (ctx, id, px, py, x, y, { tile = 16 } = {}) => { const wx = wrap(x), wy = wrap(y); put(ctx, canvasOf(`s|${id}|${wx}|${wy}|${tile}`, () => strataRaster(id, wx, wy), tile), px, py); };
export const drawDig64 = (ctx, px, py, t, id, x, y, { tile = 16 } = {}) => put(ctx, canvasOf(`d|${id}|${Math.round(t * 8)}|${x}|${y}|${tile}`, () => digRaster(id, Math.round(t * 8) / 8, x, y), tile), px, py);
export const drawShell64 = (ctx, px, py, t, kind = 'wall', { tile = 16 } = {}) => put(ctx, canvasOf(`h|${kind}|${Math.round(t * 8)}|${tile}`, () => shellRaster(Math.round(t * 8) / 8, kind), tile), px, py);
// the dust sheet reads as a sheet, not a crate: the fit-out stage is drawn see-through
export const drawFitout64 = (ctx, px, py, w, h, t, frame = 0, { tile = 16 } = {}) => { const a = ctx.globalAlpha; ctx.globalAlpha = a * 0.7; put(ctx, canvasOf(`f|${w}|${h}|${Math.round(t * 8)}|${frame % 2}|${tile}`, () => fitoutRaster(w, h, Math.round(t * 8) / 8, frame % 2), tile), px, py); ctx.globalAlpha = a; };
