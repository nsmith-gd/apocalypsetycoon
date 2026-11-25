// Region borders, region states and demand heat at the terrain's own resolution (#123, art note D4).
//
// Since #138 the terrain is painted at one art pixel per screen pixel (960x576 on a 1440x900 screen), but the region
// and heat layers (#101, #103/#111) were drawn on the 320x192 overlay and blown up 3-4x: square 3-4 px steps that did
// not sit on the 1 px coasts. This draws the same looks on a region mask built at the terrain's size, from the same
// land the terrain paints and the same countries the clicks use, so every border, rim and tint lands on the painted
// coast, region for region.
//
// Everything is pre-rendered once per region and level into small canvases (heat recolours the real terrain pixels,
// like the 'color' blend of #111), so a frame only composites them: tipping's breath is an alpha on a cached glow,
// the selected region's marching glint is the only per-frame drawing.
//
//   const layers = createMapLayers({ base, regionAt, document })  // base = mapBaseAt(scale)
//   layers.draw(ctx, { levels, hover, selected, frame, strong, steady })

import { HEX, rgb } from './palette.js';
import { HEAT_STYLE } from './map-heat.js';
import { buildRegionMask } from './map-regions.js';

const PATTERN = {
  uneasy: (x, y) => x % 4 === 1 && y % 4 === ((x >> 2) % 2 ? 3 : 1),
  edge: (x, y) => (x + y) % 4 === 0,
  tipping: (x, y) => (x + y) % 4 === 0 || (x - y + 1024) % 4 === 0,
};

// W3C 'color' blend: the hue and saturation of `c`, the luminosity of `b`
const lum = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b;
function setLum(c, l) {
  const d = l - lum(c);
  let [r, g, b] = c.map((v) => v + d);
  const L = lum([r, g, b]), n = Math.min(r, g, b), x = Math.max(r, g, b);
  if (n < 0) [r, g, b] = [r, g, b].map((v) => L + ((v - L) * L) / (L - n));
  if (x > 255) [r, g, b] = [r, g, b].map((v) => L + ((v - L) * (255 - L)) / (x - L));
  return [r, g, b];
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** The region mask at the terrain's size: painted land (not ice) takes the region of the country under it. */
export function artRegionMask(base, regionAt) {
  const { w: W, h: H } = base;
  return buildRegionMask({ w: W, h: H, cell: 1, regionAtCell: (x, y) => (base.isLandPx(x, y) ? regionAt((x + 0.5) / W, (y + 0.5) / H) : null) });
}

/**
 * The region art at the terrain's size, without a canvas (headless: tests and the PNG export use it too).
 * heatPixels(id, level, strong) -> { b: box, rgba, glow }: the region's terrain recoloured for that crisis level
 * (opaque inside the region, clear outside) and its inner glow (drawn with the tipping breath as alpha).
 */
export function regionArt(base, regionAt) {
  const { w: W, h: H } = base;
  const t = Math.max(1, Math.round(W / 480)); // line width: 1 px at 320-640, 2 px at 960-1280 (readable at 1x)
  const mask = artRegionMask(base, regionAt);
  const box = (id) => { const [x0, y0, x1, y1] = mask.edges[id].box; return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; };
  const k = (id) => mask.index.get(id);

  // distance inward from each region's edge (0 = edge), up to n rings: one breadth-first walk per region
  const ringCache = new Map();
  function rings(id, n) {
    const key = `${id}:${n}`;
    if (ringCache.has(key)) return ringCache.get(key);
    const K = k(id), d = new Map(); let front = [];
    for (const [x, y] of [...mask.edges[id].border, ...mask.edges[id].coast]) { const i = y * W + x; if (!d.has(i)) { d.set(i, 0); front.push(i); } }
    for (let r = 1; r <= n; r++) {
      const next = [];
      for (const i of front) { const x = i % W, y = (i - x) / W; for (const j of [x + 1 < W ? i + 1 : -1, x > 0 ? i - 1 : -1, y + 1 < H ? i + W : -1, y > 0 ? i - W : -1]) if (j >= 0 && mask.data[j] === K && !d.has(j)) { d.set(j, r); next.push(j); } }
      front = next;
    }
    const out = Array.from({ length: n + 1 }, () => []);
    for (const [i, r] of d) out[r].push(i);
    ringCache.set(key, out);
    return out;
  }

  function heatPixels(id, level, strong = false) {
    const st = HEAT_STYLE[level], K = k(id), b = box(id), wash = rgb(st.wash);
    const glowN = st.glow.length * t, rr = rings(id, glowN + t * st.rim);
    const ring = new Map(); rr.forEach((list, r) => { for (const i of list) ring.set(i, r); });
    const rgba = new Uint8ClampedArray(b.w * b.h * 4), glow = new Uint8ClampedArray(b.w * b.h * 4);
    for (let y = b.y0; y < b.y0 + b.h; y++) for (let x = b.x0; x < b.x0 + b.w; x++) {
      const i = y * W + x;
      if (mask.data[i] !== K) continue;
      const src = [base.rgba[i * 4], base.rgba[i * 4 + 1], base.rgba[i * 4 + 2]];
      let c = mix(src, setLum(wash, lum(src)), st.tintA);
      c = mix(c, wash, st.washA * (strong ? 1.3 : 1));
      c = mix(c, wash, Math.max(0, (lum(src) - 150) / 105) * 0.22); // pale ground (sand, ice-bright rock) takes a little more wash, or deserts barely heat up
      const r = ring.get(i);
      if (r !== undefined && r < t * st.rim && !(st.dash && ((x + y) >> (1 + (t >> 1))) % 2)) c = mix(c, wash, r < t ? st.rimA : st.rimA * 0.7); // the rim: dashed when uneasy, doubled at edge and tipping
      if (strong && PATTERN[level](Math.floor(x / t), Math.floor(y / t))) c = mix(c, wash, 0.6);
      const o = ((y - b.y0) * b.w + (x - b.x0)) * 4;
      rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = 255;
      if (r !== undefined && r >= t && r < t + glowN) { // inner glow, fading inward
        const a = st.glow[Math.min(st.glow.length - 1, Math.floor((r - t) / t))];
        glow[o] = wash[0]; glow[o + 1] = wash[1]; glow[o + 2] = wash[2]; glow[o + 3] = Math.round(255 * Math.min(1, a));
      }
    }
    return { b, rgba, glow };
  }
  return { W, H, t, mask, box, k, rings, heatPixels };
}

/**
 * @param base      a painted base layer (mapBaseAt(scale)): { w, h, rgba, isLandPx }
 * @param regionAt  (fx, fy) -> region id or null, fx/fy in 0..1 of the map (the real countries)
 */
export function createMapLayers({ base, regionAt, document: doc = globalThis.document }) {
  const art = regionArt(base, regionAt);
  const { W, H, t, mask, box, k, rings } = art;
  const canvas = (w, h) => Object.assign(doc.createElement('canvas'), { width: Math.max(1, w), height: Math.max(1, h) });

  // -------- heat: per region and level, cached as two small canvases (the recoloured region, and its glow)
  const heatCache = new Map();
  function heat(id, level, strong) {
    const key = `${id}:${level}:${strong ? 1 : 0}`;
    if (heatCache.has(key)) return heatCache.get(key);
    const { b, rgba, glow } = art.heatPixels(id, level, strong);
    const cv = canvas(b.w, b.h), gv = canvas(b.w, b.h);
    cv.getContext('2d').putImageData(new ImageData(rgba, b.w, b.h), 0, 0); gv.getContext('2d').putImageData(new ImageData(glow, b.w, b.h), 0, 0);
    const out = { cv, gv, b };
    heatCache.set(key, out);
    return out;
  }

  const bursts = [];
  // -------- region states
  const dot = (g, pts, color, alpha) => { g.globalAlpha = alpha; g.fillStyle = color; for (const [x, y] of pts) g.fillRect(x - (t >> 1), y - (t >> 1), t, t); g.globalAlpha = 1; };
  let idle = null;
  function idleCanvas() { // a quiet dark line where two regions meet
    if (idle) return idle;
    idle = canvas(W, H); const g = idle.getContext('2d');
    for (const id of mask.ids) dot(g, mask.edges[id].border, HEX.K, 0.35);
    return idle;
  }
  function tintInto(g, id, color, alpha) {
    const K = k(id), b = box(id);
    g.globalAlpha = alpha; g.fillStyle = color;
    for (let y = b.y0; y < b.y0 + b.h; y++) { let run = -1; for (let x = b.x0; x <= b.x0 + b.w; x++) { const inside = x < b.x0 + b.w && mask.data[y * W + x] === K; if (inside && run < 0) run = x; if (!inside && run >= 0) { g.fillRect(run, y, x - run, 1); run = -1; } } }
    g.globalAlpha = 1;
  }
  const stateCache = new Map();
  function state(id, kind) {
    const key = `${id}:${kind}`;
    if (stateCache.has(key)) return stateCache.get(key);
    const cv = canvas(W, H), g = cv.getContext('2d'), e = mask.edges[id], ring = [...e.border, ...e.coast];
    if (kind === 'hover') { tintInto(g, id, HEX.W, 0.14); dot(g, ring, HEX.W, 0.9); }
    else {
      tintInto(g, id, HEX.Y, 0.2);
      const rr = rings(id, 2 * t);
      g.globalAlpha = 0.8; g.fillStyle = HEX.y; for (const i of rr.slice(t, 2 * t).flat()) g.fillRect(i % W, (i / W) | 0, 1, 1); // old-gold shadow inside
      g.globalAlpha = 1; g.fillStyle = HEX.Y; for (const i of rr.slice(0, t).flat()) g.fillRect(i % W, (i / W) | 0, 1, 1); // the gold line
      g.globalAlpha = 0.85; g.fillStyle = HEX.K; const K = k(id);
      for (const [x, y] of ring) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && mask.data[ny * W + nx] !== K) g.fillRect(nx, ny, 1, 1); }
      g.globalAlpha = 1;
    }
    const out = { cv, ring };
    stateCache.set(key, out);
    return out;
  }

  // ---------------------------------------------------------------- animation helpers (#129), all from caches
  function st(level) { return HEAT_STYLE[level]; }
  const tintCache = new Map();
  function tinted(id, colour) { // the region's land in one flat colour (sheen and flash)
    const key = `${id}:${colour}`;
    if (tintCache.has(key)) return tintCache.get(key);
    const b = box(id), K = k(id), cv = canvas(b.w, b.h), g = cv.getContext('2d'), img = g.createImageData(b.w, b.h), c = rgb(colour);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (mask.data[(b.y0 + y) * W + b.x0 + x] === K) img.data.set([c[0], c[1], c[2], 255], (y * b.w + x) * 4);
    g.putImageData(img, 0, 0);
    tintCache.set(key, cv);
    return cv;
  }
  function sheen(ctx, id, b, ph, alpha) {
    const bw = Math.max(18, Math.round(b.w * 0.12)), x = b.x0 - bw * 2 + (b.w + bw * 4) * ph;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x, b.y0); ctx.lineTo(x + bw, b.y0); ctx.lineTo(x + bw - b.h * 0.6, b.y0 + b.h); ctx.lineTo(x - b.h * 0.6, b.y0 + b.h); ctx.closePath(); ctx.clip();
    ctx.globalAlpha = alpha; ctx.drawImage(tinted(id, '#fff1a8'), b.x0, b.y0);
    ctx.restore();
  }
  const WAVE_N = 10;
  const waveCache = new Map();
  function waveRing(id, d, colour) { // the band of pixels d rings in from the edge, in one colour
    const key = `${id}:${d}:${colour}`;
    if (waveCache.has(key)) return waveCache.get(key);
    const rr = rings(id, WAVE_N * t + t), b = box(id), cv = canvas(b.w, b.h), g = cv.getContext('2d'), img = g.createImageData(b.w, b.h), c = rgb(colour);
    for (let r = d * t; r < d * t + t; r++) for (const i of rr[r] ?? []) { const x = (i % W) - b.x0, y = ((i / W) | 0) - b.y0; img.data.set([c[0], c[1], c[2], 255], (y * b.w + x) * 4); }
    g.putImageData(img, 0, 0);
    waveCache.set(key, cv);
    return cv;
  }
  function wave(ctx, id, ph, colour, outward, alpha) {
    const d = Math.floor(ph * WAVE_N), dd = outward ? WAVE_N - 1 - d : d, b = box(id);
    ctx.globalAlpha = Math.max(0, alpha * (1 - ph * 0.7));
    ctx.drawImage(waveRing(id, dd, colour), b.x0, b.y0);
    if (dd + (outward ? 1 : -1) >= 0 && dd + (outward ? 1 : -1) < WAVE_N) { ctx.globalAlpha *= 0.45; ctx.drawImage(waveRing(id, dd + (outward ? 1 : -1), colour), b.x0, b.y0); }
    ctx.globalAlpha = 1;
  }
  const inner = new Map();
  function interior(id) { // sample points inside the region, away from the coast (for embers and sparks)
    if (inner.has(id)) return inner.get(id);
    const rr = rings(id, 3 * t), edge = new Set(rr.slice(0, 3 * t).flat()), K = k(id), b = box(id), pts = [];
    for (let y = b.y0; y < b.y0 + b.h; y += 2) for (let x = b.x0; x < b.x0 + b.w; x += 2) { const i = y * W + x; if (mask.data[i] === K && !edge.has(i)) pts.push([x, y]); }
    const cx = pts.reduce((s, p) => s + p[0], 0) / Math.max(1, pts.length), cy = pts.reduce((s, p) => s + p[1], 0) / Math.max(1, pts.length);
    const out = { pts, cx, cy };
    inner.set(id, out);
    return out;
  }
  const EMBER = [HEX.R, HEX.O, HEX.Y, '#fff1a8'];
  function embers(ctx, id, now, strength) {
    const { pts } = interior(id);
    if (!pts.length) return;
    const n = Math.min(60, Math.round(Math.sqrt(pts.length) * 0.9 * strength));
    for (let j = 0; j < n; j++) {
      const life = 1400 + (j % 5) * 180, ph = ((now + j * 397) % life) / life, cyc = Math.floor((now + j * 397) / life);
      const p = pts[Math.floor(rnd(id, j, cyc) * pts.length)];
      const x = Math.round(p[0] + Math.sin(ph * 6 + j) * 2 * t), y = Math.round(p[1] - ph * 22 * t);
      if (x < 0 || y < 0 || x + t > W || y + t > H || mask.data[y * W + x] !== k(id) || mask.data[(y + t - 1) * W + x + t - 1] !== k(id) || mask.data[y * W + x + t - 1] !== k(id) || mask.data[(y + t - 1) * W + x] !== k(id)) continue; // embers glint over the hot land, never the sea
      ctx.globalAlpha = (1 - ph) * 0.9; ctx.fillStyle = EMBER[Math.min(3, Math.floor(ph * 4))];
      ctx.fillRect(x, y, t, t);
    }
    ctx.globalAlpha = 1;
  }
  function sparks(ctx, id, q, colour) {
    const { cx, cy } = interior(id);
    ctx.fillStyle = colour;
    for (let j = 0; j < 28; j++) {
      const a = (j / 28) * Math.PI * 2 + rnd(id, j, 7) * 0.3, sp = (26 + rnd(id, j, 9) * 40) * t;
      ctx.globalAlpha = Math.max(0, 1 - q * 1.1);
      ctx.fillRect(Math.round(cx + Math.cos(a) * sp * q), Math.round(cy + Math.sin(a) * sp * q * 0.8), t + (q < 0.3 ? 1 : 0), t + (q < 0.3 ? 1 : 0));
    }
    ctx.globalAlpha = 1;
  }

  return {
    w: W, h: H, mask, lineWidth: t,
    /** Draw every layer for this frame onto ctx (a canvas the terrain's size, cleared by the caller). */
    /** A scheme just fired in a region (#129): flash, a shockwave out to its coast, sparks from its middle. */
    burst(id, { kind = 'stoke', time = performance.now() } = {}) { if (k(id)) bursts.push({ id, kind, t0: time }); },
    get bursting() { return bursts.length; },
    /**
     * Draw every layer for this frame onto ctx (a canvas the terrain's size, cleared by the caller).
     * time: ms clock for the animation (#129); crisis: { id: 0..100 } so regions nearer their tipping point move
     * faster and harder; steady (Reduced flashing): the heat holds still.
     */
    draw(ctx, { levels = {}, crisis = {}, hover = null, selected = null, frame = 0, time = null, strong = false, steady = false } = {}) {
      ctx.imageSmoothingEnabled = false;
      const now = time ?? frame * (1000 / 60) * 3;
      for (const id of mask.ids) {
        const level = levels[id];
        if (!HEAT_STYLE[level]) continue;
        const h = heat(id, level, strong);
        ctx.drawImage(h.cv, h.b.x0, h.b.y0);
        const c = crisis[id] ?? ({ uneasy: 50, edge: 78, tipping: 94 })[level];
        const i = Math.max(0, Math.min(1, (c - 40) / 55)); // 0 at uneasy's floor, 1 at the brink
        const A = ANIM[level];
        // 1. the glow breathes: slow and shallow when uneasy, fast and deep at tipping
        const period = A.pulse[0] - (A.pulse[0] - A.pulse[1]) * i;
        const amp = steady ? 0 : A.amp[0] + (A.amp[1] - A.amp[0]) * i;
        const phase = ((now + hashId(id) * 997) % period) / period;
        ctx.globalAlpha = Math.max(0, Math.min(1, 1 - amp + amp * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2)) * 2 - amp * 0.5));
        ctx.drawImage(h.gv, h.b.x0, h.b.y0);
        ctx.globalAlpha = 1;
        if (steady) continue;
        // 2. a soft sheen sweeps across the land (the demand heat "shimmer")
        const sp = A.sheen - 1500 * i, sph = ((now + hashId(id) * 431) % sp) / sp;
        sheen(ctx, id, h.b, sph, (A.sheenA + 0.1 * i));
        // 3. edge and tipping: a wave runs in from the coast, quicker as it nears the tipping point
        if (A.wave) { const wp = A.wave - 900 * i, wph = ((now + hashId(id) * 173) % wp) / wp; wave(ctx, id, wph, st(level).wash, false, 0.55 + 0.35 * i); }
        // 4. tipping: embers rise off the region
        if (level === 'tipping') embers(ctx, id, now, 0.6 + 0.4 * i);
      }
      ctx.drawImage(idleCanvas(), 0, 0);
      if (hover && hover !== selected && k(hover)) ctx.drawImage(state(hover, 'hover').cv, 0, 0);
      if (selected && k(selected)) {
        const s = state(selected, 'selected');
        ctx.drawImage(s.cv, 0, 0);
        ctx.fillStyle = HEX.L; // the marching glint walks the gold line
        for (const [x, y] of s.ring) if ((Math.floor(x / t) + Math.floor(y / t) + frame) % 6 === 0) ctx.fillRect(x - (t >> 1), y - (t >> 1), t, t);
      }
      // scheme bursts on top of everything
      for (let n = bursts.length - 1; n >= 0; n--) {
        const b = bursts[n], age = now - b.t0;
        if (age > 1100 || age < -50) { if (age > 1100) bursts.splice(n, 1); continue; }
        const col = { stoke: HEX.O, calm: '#3f8fc8', breach: HEX.R }[b.kind] ?? HEX.O;
        const q = Math.max(0, age) / 1100;
        ctx.globalAlpha = Math.max(0, 0.55 * (1 - q * 2.2)); ctx.drawImage(tinted(b.id, '#fff3d0'), box(b.id).x0, box(b.id).y0); ctx.globalAlpha = 1;
        wave(ctx, b.id, Math.min(0.999, q * 1.3), col, true, 1 - q);
        sparks(ctx, b.id, q, col);
      }
      ctx.globalAlpha = 1;
    },
  };

}
const ANIM = {
  uneasy: { pulse: [3400, 2400], amp: [0.18, 0.3], sheen: 5200, sheenA: 0.12, wave: 0 },
  edge: { pulse: [2200, 1500], amp: [0.3, 0.45], sheen: 4200, sheenA: 0.14, wave: 2600 },
  tipping: { pulse: [1200, 700], amp: [0.45, 0.6], sheen: 3200, sheenA: 0.16, wave: 1700 },
};
const hashId = (id) => [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 1000, 7) / 1000;
function rnd(id, j, s) { let h = (hashId(id) * 1e6 + j * 374761393 + s * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

// ------------------------------------------------------------------------------------------ region state images (#124)
export const REGION_STATE_IDS = Object.freeze(['calm', 'uneasy', 'edge', 'tipping', 'selected']);
/**
 * One region in one crisis state as a finished image (headless): the terrain around the region, the idle borders,
 * and the state on top: calm (just the terrain), uneasy / edge / tipping (the heat, glow at full breath), selected.
 * Cropped to the region with a margin. Returns { x0, y0, w, h, rgba }.
 */
export function renderRegionState(art, base, id, state, { margin = 12 } = {}) {
  const { W, H, t, mask } = art;
  const [bx0, by0, bx1, by1] = mask.edges[id].box;
  const x0 = Math.max(0, bx0 - margin), y0 = Math.max(0, by0 - margin), x1 = Math.min(W - 1, bx1 + margin), y1 = Math.min(H - 1, by1 + margin);
  const w = x1 - x0 + 1, h = y1 - y0 + 1, out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) out.set(base.rgba.subarray(((y0 + y) * W + x0) * 4, ((y0 + y) * W + x1 + 1) * 4), y * w * 4);
  const blend = (x, y, c, a) => { if (x < x0 || y < y0 || x > x1 || y > y1) return; const o = ((y - y0) * w + (x - x0)) * 4; for (let j = 0; j < 3; j++) out[o + j] = out[o + j] + (c[j] - out[o + j]) * a; };
  if (HEAT_STYLE[state]) {
    const { b, rgba, glow } = art.heatPixels(id, state);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      const o = (y * b.w + x) * 4;
      if (rgba[o + 3]) blend(b.x0 + x, b.y0 + y, [rgba[o], rgba[o + 1], rgba[o + 2]], 1);
      if (glow[o + 3]) blend(b.x0 + x, b.y0 + y, [glow[o], glow[o + 1], glow[o + 2]], glow[o + 3] / 255);
    }
  }
  const K = rgb(HEX.K);
  for (const rid of mask.ids) for (const [x, y] of mask.edges[rid].border) for (let j = 0; j < t; j++) for (let i = 0; i < t; i++) blend(x - (t >> 1) + i, y - (t >> 1) + j, K, 0.35);
  if (state === 'selected') {
    const kk = mask.index.get(id), rr = art.rings(id, 2 * t);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (mask.data[y * W + x] === kk) blend(x, y, rgb(HEX.Y), 0.2);
    for (const i of rr.slice(t, 2 * t).flat()) blend(i % W, (i / W) | 0, rgb(HEX.y), 0.8);
    for (const i of rr.slice(0, t).flat()) blend(i % W, (i / W) | 0, rgb(HEX.Y), 1);
    for (const i of rr[0]) { const x = i % W, y = (i / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && mask.data[ny * W + nx] !== kk) blend(nx, ny, K, 0.85); } }
  }
  return { x0, y0, w, h, rgba: out };
}
