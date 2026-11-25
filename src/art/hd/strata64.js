// Strata and construction-stage tiles at the 64 px minimum (R40, replaces the 16 px R32 tiles as the source art).
//
// One shelter grid cell (1 x 1 m) is 64 x 64 px (style guide, "the 64 rule"). The rock is drawn from WORLD pixel
// coordinates (cell x * 64 + i), so neighbouring cells join into one continuous face: bands, blocks, roots and
// veins run across cell edges instead of repeating a stamp. Light from the top-left; every colour is an HD ramp step.
//
//   stratumRaster(id, x, y)                  one undug cell of rock
//   digRaster(id, x, y, t)                   the cell being dug, t = 0..1: the hole opens, rubble piles up
//   shellRaster(t, kind)                     rebar cage in formwork, concrete poured bottom-up ('wall' | 'spine')
//   fitoutRaster(wM, hM, t, frame)           scaffold and a dust sheet over a piece being fitted (wM x hM metres)
//   drawStratum64 / drawDig64 / drawShell64 / drawFitout64(ctx, ..., { tile })   canvases at the editor's tile size
//
// Pure data apart from the draw* helpers; renders headless for tests and the capture.

import { Raster, col, K, box, glowAt, hash, bayer } from './raster.js';
import { reduceRaster } from './amenities64.js';

export const STRATA_PX = 64;
const M = STRATA_PX;
export const STRATA_IDS = ['topsoil', 'clay', 'bedrock', 'deep', 'abyss'];

/** Smooth value noise in 0..1 over world pixels (cell = wavelength). */
function vnoise(X, Y, cell, seed) {
  const gx = Math.floor(X / cell), gy = Math.floor(Y / cell);
  const fx = X / cell - gx, fy = Y / cell - gy;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash(gx, gy, seed), b = hash(gx + 1, gy, seed), c = hash(gx, gy + 1, seed), d = hash(gx + 1, gy + 1, seed);
  const u = s(fx), v = s(fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (X, Y, cell, seed) => vnoise(X, Y, cell, seed) * 0.6 + vnoise(X, Y, cell / 2, seed + 1) * 0.3 + vnoise(X, Y, cell / 4, seed + 2) * 0.1;
/** Dithered ramp step from a 0..1 value spread across [lo, hi]. */
const stepOf = (v, lo, hi, x, y) => { const f = lo + v * (hi - lo); const w = Math.floor(f); return w + (bayer(x, y) < f - w ? 1 : 0); };

/** Pebbles / blocks are placed per world "site" on a coarse grid so they can straddle cell edges. */
function forSites(x, y, spacing, seed, fn) {
  const X0 = x * M, Y0 = y * M;
  for (let gy = Math.floor((Y0 - spacing) / spacing); gy <= Math.floor((Y0 + M + spacing) / spacing); gy++) {
    for (let gx = Math.floor((X0 - spacing) / spacing); gx <= Math.floor((X0 + M + spacing) / spacing); gx++) {
      const h = hash(gx, gy, seed);
      fn(gx * spacing + Math.floor(hash(gx, gy, seed + 1) * spacing) - X0, gy * spacing + Math.floor(hash(gx, gy, seed + 2) * spacing) - Y0, h, gx, gy);
    }
  }
}
/** A lit oval pebble/clod at (cx, cy) in cell pixels, clipped to the cell. */
function pebble(b, cx, cy, rx, ry, ramp, base) {
  for (let j = -ry - 1; j <= ry + 1; j++) for (let i = -rx - 1; i <= rx + 1; i++) {
    const d = (i * i) / ((rx + 0.5) ** 2) + (j * j) / ((ry + 0.5) ** 2);
    const x = cx + i, y = cy + j;
    if (!b.inside(x, y)) continue;
    if (d <= 1) {
      const lit = (-i / (rx + 1) - j / (ry + 1)) * 1.4; // top-left light
      b.set(x, y, col(ramp, base + Math.round(lit)));
    } else if (d <= 1.45 && (i > 0 || j > 0)) b.set(x, y, col(ramp, base - 2)); // contact shadow, bottom-right
  }
}

// ------------------------------------------------------------------------------------------ the five strata
const DRAW = {
  topsoil(b, x, y) {
    // loose dark loam in clumps, lighter crumbs, a few stones, roots hanging from the surface
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const X = x * M + i, Y = y * M + j;
      const n = fbm(X, Y, 14, 11);
      b.set(i, j, col('walnut', stepOf(n, 1.6, 4.4, X, Y)));
    }
    forSites(x, y, 9, 12, (cx, cy, h) => { if (h < 0.55) pebble(b, cx, cy, 1 + Math.floor(h * 4) % 2, 1, 'walnut', 4); });
    forSites(x, y, 23, 13, (cx, cy, h) => { if (h < 0.45) pebble(b, cx, cy, 3, 2, 'concrete', 4); });
    // roots: only in the top two rows of soil, wandering down from the surface and across cells
    if (y <= 1) forSites(x, y, 20, 14, (cx, cy, h, gx) => {
      if (h > 0.5) return;
      let rx = cx; const top = -y * M, len = 30 + Math.floor(h * 60);
      for (let k = 0; k < len; k++) {
        const ry = top + k; if (ry >= M) break;
        rx += hash(gx, k, 15) < 0.33 ? -1 : hash(gx, k, 15) > 0.66 ? 1 : 0;
        if (ry >= 0) { b.set(rx, ry, col('plaster', 3)); b.set(rx + 1, ry, col('walnut', 1)); }
        if (k > 8 && hash(gx, k, 16) < 0.05) for (let s = 1; s < 6; s++) b.set(rx - s, ry + s, col('plaster', 2)); // rootlet
      }
    });
  },
  clay(b, x, y) {
    // smooth sediment bands that waver, a few rounded pebbles bedded in them
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const X = x * M + i, Y = y * M + j;
      const wav = Y + (vnoise(X, 0, 40, 21) - 0.5) * 10;
      const band = (Math.sin(wav / 5.3) + Math.sin(wav / 13.1 + 1.7) * 0.6) * 0.5 + 0.5;
      b.set(i, j, col('rust', stepOf(band * 0.75 + fbm(X, Y, 18, 22) * 0.25, 2.3, 5.1, X, Y)));
    }
    forSites(x, y, 18, 23, (cx, cy, h) => { if (h < 0.4) pebble(b, cx, cy, 2 + Math.floor(h * 10) % 2, 2, 'marble', 3); });
    forSites(x, y, 31, 24, (cx, cy, h) => { if (h < 0.3) pebble(b, cx, cy, 4, 3, 'concrete', 4); });
  },
  bedrock(b, x, y) {
    // jointed blocks: courses 21 px high, joints offset per course, each block bevelled and cracked
    const course = 21;
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const X = x * M + i, Y = y * M + j;
      const row = Math.floor(Y / course), yin = Y - row * course;
      const len = 26 + Math.floor(hash(row, 0, 31) * 14);
      const off = Math.floor(hash(row, 1, 31) * len);
      const blk = Math.floor((X + off) / len), xin = X + off - blk * len;
      const tone = hash(blk, row, 32);
      let s = 2.4 + tone * 1.4 + (fbm(X, Y, 10, 33) - 0.5) * 1.2;
      if (yin === 0 || xin === 0) { b.set(i, j, col('concrete', 0)); continue; } // the joint
      if (yin === 1 || xin === 1) s += 1.6; // lit top/left edge
      if (yin === course - 1 || xin === len - 1) s -= 1.2; // shadowed bottom/right
      b.set(i, j, col('concrete', stepOf((s - 1) / 5, 1, 6, X, Y) - 0));
    }
    forSites(x, y, 27, 34, (cx, cy, h, gx, gy) => { // cracks
      if (h > 0.45) return;
      let px = cx, py = cy;
      for (let k = 0; k < 14; k++) { b.set(px, py, col('concrete', 0)); b.set(px + 1, py, col('concrete', 5)); px += hash(gx + k, gy, 35) < 0.5 ? 1 : 0; py += 1; }
    });
  },
  deep(b, x, y) {
    // dense dark granite: coarse grain, quartz seams and the odd glinting crystal
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const X = x * M + i, Y = y * M + j;
      const grain = hash(X >> 1, Y >> 1, 41);
      const n = fbm(X, Y, 16, 42) * 0.7 + grain * 0.3;
      b.set(i, j, col('cloth', stepOf(n, 0.6, 3.2, X, Y)));
      const seam = Math.abs(Math.sin((X * 0.6 + Y) / 9 + vnoise(X, Y, 30, 43) * 6));
      if (seam < 0.05) b.set(i, j, col('cloth', 4));
    }
    forSites(x, y, 21, 44, (cx, cy, h) => {
      if (h > 0.35) return;
      for (let k = -3; k <= 3; k++) { b.set(cx, cy + k, col('water', 4 + (k < 0 ? 1 : 0)), 1); b.set(cx + 1, cy + k, col('water', 3), 1); }
      for (let k = -1; k <= 1; k++) b.set(cx + k, cy, col('water', 6), 1);
      b.set(cx, cy - 3, col('water', 6), 1);
      glowAt(b, cx, cy, 5, 0.8);
    });
  },
  abyss(b, x, y) {
    // near-black, slick, threaded with faintly glowing violet veins
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const X = x * M + i, Y = y * M + j;
      b.set(i, j, col('violet', stepOf(fbm(X, Y, 20, 51), 0, 2.2, X, Y)));
      const v = Math.abs(fbm(X, Y, 26, 52) - 0.5);
      if (v < 0.012) b.set(i, j, col('neon', 3), 1);
      else if (v < 0.03) b.set(i, j, col('neon', 1));
    }
    forSites(x, y, 17, 53, (cx, cy, h) => { if (h < 0.5) { b.set(cx, cy, col('violet', 4)); b.set(cx + 1, cy, col('violet', 3)); } });
  },
};

/** One undug 1 x 1 m cell of rock at grid (x, y). */
export function stratumRaster(id, x = 0, y = 0) {
  const b = new Raster(M, M);
  (DRAW[id] ?? DRAW.topsoil)(b, x, y);
  return b;
}

// ------------------------------------------------------------------------------------------ construction stages
const hazardEdge = (b, w = 3) => { // yellow-black work-order tape around the cell
  for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) {
    if (i >= w && j >= w && i < b.w - w && j < b.h - w) continue;
    b.set(i, j, ((i + j) >> 2) % 2 ? col('hazard', 4) : K);
  }
};

/** A cell being dug: the hole opens from the top, pick marks on the face that's left, rubble and a bucket below. */
export function digRaster(id, x = 0, y = 0, t = 0) {
  const b = stratumRaster(id, x, y);
  const open = Math.round(Math.max(0, Math.min(1, t)) * 46);
  if (open > 0) {
    for (let j = 4; j < 4 + open; j++) for (let i = 8; i < 56; i++) {
      const edge = i < 10 || i > 53;
      b.set(i, j, edge ? K : col('K', 0));
      if (!edge) b.set(i, j, col('walnut', j < 4 + open - 2 ? 0 : 1));
    }
    b.shade(10, 4, 4, open, -1); // the hole's left wall in shade
    for (let i = 10; i < 54; i++) b.set(i, 4 + open, col('walnut', 2)); // the dig face's lip
  }
  // pick marks on the remaining face
  for (let k = 0; k < 6; k++) {
    const yy = 8 + open + Math.floor(hash(x, y, 60 + k) * Math.max(1, 40 - open));
    const xx = 12 + Math.floor(hash(x, y, 70 + k) * 38);
    if (yy < 50) { b.set(xx, yy, col('hazard', 5)); b.set(xx + 1, yy + 1, col('hazard', 3)); b.set(xx + 2, yy + 2, col('walnut', 1)); }
  }
  // rubble heaps up at the bottom as the hole opens
  const pile = 4 + Math.round(t * 8);
  for (let k = 0; k < 9; k++) pebble(b, 8 + k * 5 + Math.floor(hash(x, y, k + 80) * 3), 58 - Math.floor(hash(x, y, k + 90) * pile), 2, 2, k % 3 ? 'walnut' : 'concrete', 4);
  // the bucket
  box(b, 46, 46, 10, 9, 'steel', 4); b.rect(46, 46, 10, 1, col('steel', 7)); b.rect(48, 43, 6, 1, col('steel', 6));
  b.set(47, 44, col('steel', 6)); b.set(54, 44, col('steel', 6));
  hazardEdge(b);
  return b;
}

/** A wall or spine cell being built: formwork boards, a rebar cage, then concrete rising from the bottom. */
export function shellRaster(t = 0, kind = 'wall') {
  const b = new Raster(M, M);
  b.rect(0, 0, M, M, col('walnut', 0));
  // formwork boards (plywood with grain) on both sides
  for (const x0 of [0, M - 8]) {
    for (let j = 0; j < M; j++) for (let i = 0; i < 8; i++) b.set(x0 + i, j, col('walnut', 4 + ((i === 0 || i === 7) ? -2 : 0) + (hash(x0 + i, j >> 3, 61) < 0.2 ? -1 : 0)));
    for (const yy of [14, 46]) { b.rect(x0, yy, 8, 2, col('walnut', 2)); b.set(x0 + 3, yy, col('steel', 6)); } // battens and nails
  }
  // concrete pour, rising from the bottom
  const fill = Math.round(Math.max(0, Math.min(1, t)) * 60);
  for (let j = M - 2 - fill; j < M - 2; j++) for (let i = 8; i < M - 8; i++) {
    const wet = j < M - 2 - fill + 3;
    b.set(i, j, col('concrete', wet ? 5 : 3 + (bayer(i, j) < 0.25 ? 1 : 0) - (hash(i, j, 62) < 0.06 ? 1 : 0)));
  }
  // rebar cage (in front of the pour, so you see the bars going under)
  const rebar = kind === 'spine' ? 'hazard' : 'rust';
  for (const xx of [16, 28, 40, 52 - 4]) for (let j = 2; j < M - 2; j++) { b.set(xx, j, col(rebar, 4)); b.set(xx + 1, j, col(rebar, 2)); if (j % 4 === 0) b.set(xx, j, col(rebar, 5)); }
  for (const yy of [10, 26, 42, 56]) for (let i = 10; i < M - 10; i++) { b.set(i, yy, col(rebar, 4)); b.set(i, yy + 1, col(rebar, 2)); if (i % 4 === 0) b.set(i, yy, col(rebar, 5)); }
  for (const xx of [16, 28, 40, 48]) for (const yy of [10, 26, 42, 56]) { b.set(xx - 1, yy - 1, col('steel', 6)); b.set(xx + 2, yy + 2, col('steel', 6)); } // tie wire
  // bottom sill
  b.rect(0, M - 2, M, 2, K);
  return b;
}

/** Scaffold and a dust sheet over a piece being fitted, wM x hM metres (64 px each). frame animates the sparks. */
export function fitoutRaster(wM = 1, hM = 1, t = 0, frame = 0) {
  const w = wM * M, h = hM * M;
  const b = new Raster(w, h);
  // the dust sheet covers the unfinished top part; dithered so the piece shows through it
  const covered = Math.round((1 - Math.max(0, Math.min(1, t))) * (h - 8));
  for (let j = 4; j < 4 + covered; j++) for (let i = 4; i < w - 4; i++) {
    if (bayer(i, j) > 0.55) continue;
    const fold = Math.sin(i / 6 + j / 40) > 0.6;
    b.set(i, j, col('plaster', fold ? 4 : 5 + (bayer(i, j) < 0.12 ? 1 : 0)));
  }
  for (let i = 4; i < w - 4; i++) if (covered > 0) b.set(i, 4 + covered, col('plaster', 3)); // the sheet's hem
  // scaffold: steel poles at the sides, a top rail, a plank at mid height, couplers where they cross
  const pole = (x) => { for (let j = 0; j < h; j++) { b.set(x, j, col('steel', 6)); b.set(x + 1, j, col('steel', 4)); b.set(x + 2, j, col('steel', 2)); } };
  pole(0); pole(w - 3);
  for (let i = 0; i < w; i++) { b.set(i, 0, col('steel', 6)); b.set(i, 1, col('steel', 4)); b.set(i, 2, col('steel', 2)); }
  const pk = Math.floor(h / 2);
  for (let i = 0; i < w; i++) for (let j = 0; j < 5; j++) b.set(i, pk + j, col('walnut', j === 0 ? 6 : j === 4 ? 2 : 4 + (hash(i >> 2, j, 63) < 0.15 ? -1 : 0)));
  for (const x of [0, w - 3]) for (const y of [0, pk]) box(b, x - 1, y - 1, 5, 5, 'steel', 5, { outline: false });
  // sparks from the welder while the crew is working
  if (t > 0 && Math.floor(frame / 4) % 2) {
    const sx = Math.floor(w / 2), sy = pk - 4;
    for (const [dx, dy, s] of [[0, 0, 6], [2, -2, 5], [-2, -3, 5], [4, -5, 4], [-3, -6, 4], [1, -8, 3]]) b.set(sx + dx, sy + dy, col('amber', s), 1);
    glowAt(b, sx, sy, 8, 1.2);
  }
  return b;
}

// ------------------------------------------------------------------------------------------ canvases
const cache = new Map();
function canvasOf(r) {
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(r.w, r.h) : Object.assign(document.createElement('canvas'), { width: r.w, height: r.h });
  cv.getContext('2d').putImageData(new ImageData(r.rgba(), r.w, r.h), 0, 0);
  return cv;
}
function cached(key, make, tile) {
  let cv = cache.get(key);
  if (!cv) { cv = canvasOf(reduceRaster(make(), Math.max(1, Math.round(M / tile)))); if (cache.size > 4000) cache.clear(); cache.set(key, cv); }
  return cv;
}
const blit = (ctx, cv, x, y) => { ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, Math.round(x), Math.round(y)); };
const q8 = (t) => Math.round(Math.max(0, Math.min(1, t)) * 8) / 8; // progress in eighths, so the cache stays small

export function drawStratum64(ctx, id, px, py, x, y, { tile = 16 } = {}) { blit(ctx, cached(`s|${id}|${x}|${y}|${tile}`, () => stratumRaster(id, x, y), tile), px, py); }
export function drawDig64(ctx, id, px, py, x, y, t, { tile = 16 } = {}) { const tt = q8(t); blit(ctx, cached(`d|${id}|${x}|${y}|${tt}|${tile}`, () => digRaster(id, x, y, tt), tile), px, py); }
export function drawShell64(ctx, px, py, t, kind = 'wall', { tile = 16 } = {}) { const tt = q8(t); blit(ctx, cached(`b|${kind}|${tt}|${tile}`, () => shellRaster(tt, kind), tile), px, py); }
export function drawFitout64(ctx, px, py, wM, hM, t, frame = 0, { tile = 16 } = {}) {
  const tt = q8(t), f = tt > 0 ? Math.floor(frame / 4) % 2 : 0;
  blit(ctx, cached(`f|${wM}|${hM}|${tt}|${f}|${tile}`, () => fitoutRaster(wM, hM, tt, f * 4), tile), px, py);
}
