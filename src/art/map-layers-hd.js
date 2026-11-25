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
 * @param base      a painted base layer (mapBaseAt(scale)): { w, h, rgba, isLandPx }
 * @param regionAt  (fx, fy) -> region id or null, fx/fy in 0..1 of the map (the real countries)
 */
export function createMapLayers({ base, regionAt, document: doc = globalThis.document }) {
  const { w: W, h: H } = base;
  const t = Math.max(1, Math.round(W / 480)); // line width: 1 px at 320-640, 2 px at 960-1280 (readable at 1x)
  const mask = artRegionMask(base, regionAt);
  const canvas = (w, h) => Object.assign(doc.createElement('canvas'), { width: Math.max(1, w), height: Math.max(1, h) });
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

  // -------- heat: per region and level, the region's terrain recoloured (opaque) + a glow canvas for the breath
  const heatCache = new Map();
  function heat(id, level, strong) {
    const key = `${id}:${level}:${strong ? 1 : 0}`;
    if (heatCache.has(key)) return heatCache.get(key);
    const st = HEAT_STYLE[level], K = k(id), b = box(id), wash = rgb(st.wash);
    const glowN = st.glow.length * t, rr = rings(id, glowN + t * st.rim);
    const ring = new Map(); rr.forEach((list, r) => { for (const i of list) ring.set(i, r); });
    const img = new ImageData(b.w, b.h), gImg = new ImageData(b.w, b.h);
    for (let y = b.y0; y < b.y0 + b.h; y++) for (let x = b.x0; x < b.x0 + b.w; x++) {
      const i = y * W + x;
      if (mask.data[i] !== K) continue;
      const src = [base.rgba[i * 4], base.rgba[i * 4 + 1], base.rgba[i * 4 + 2]];
      let c = mix(src, setLum(wash, lum(src)), st.tintA);
      c = mix(c, wash, st.washA * (strong ? 1.3 : 1));
      const r = ring.get(i);
      if (r !== undefined && r < t * st.rim) c = mix(c, wash, r < t ? st.rimA : st.rimA * 0.7); // the rim (2 lines at tipping)
      if (strong && PATTERN[level](Math.floor(x / t), Math.floor(y / t))) c = mix(c, wash, 0.6);
      const o = ((y - b.y0) * b.w + (x - b.x0)) * 4;
      img.data.set([c[0], c[1], c[2], 255], o);
      if (r !== undefined && r >= t * (st.rim > 1 ? 1 : 1) && r < t + glowN) { // inner glow, fading inward
        const a = st.glow[Math.min(st.glow.length - 1, Math.floor((r - t) / t))];
        gImg.data.set([wash[0], wash[1], wash[2], Math.round(255 * Math.min(1, a))], o);
      }
    }
    const cv = canvas(b.w, b.h), gv = canvas(b.w, b.h);
    cv.getContext('2d').putImageData(img, 0, 0); gv.getContext('2d').putImageData(gImg, 0, 0);
    const out = { cv, gv, b };
    heatCache.set(key, out);
    return out;
  }

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

  return {
    w: W, h: H, mask, lineWidth: t,
    /** Draw every layer for this frame onto ctx (a canvas the terrain's size, cleared by the caller). */
    draw(ctx, { levels = {}, hover = null, selected = null, frame = 0, breath: bf = frame, strong = false, steady = false } = {}) {
      ctx.imageSmoothingEnabled = false;
      for (const id of mask.ids) {
        const level = levels[id];
        if (!HEAT_STYLE[level]) continue;
        const h = heat(id, level, strong);
        ctx.drawImage(h.cv, h.b.x0, h.b.y0);
        const breath = level === 'tipping' && !steady ? 0.75 + 0.5 * Math.abs(((bf % 8) / 4) - 1) : 1;
        ctx.globalAlpha = Math.min(1, breath); ctx.drawImage(h.gv, h.b.x0, h.b.y0); ctx.globalAlpha = 1;
      }
      ctx.drawImage(idleCanvas(), 0, 0);
      if (hover && hover !== selected && k(hover)) ctx.drawImage(state(hover, 'hover').cv, 0, 0);
      if (selected && k(selected)) {
        const s = state(selected, 'selected');
        ctx.drawImage(s.cv, 0, 0);
        ctx.fillStyle = HEX.L; // the marching glint walks the gold line
        for (const [x, y] of s.ring) if ((Math.floor(x / t) + Math.floor(y / t) + frame) % 6 === 0) ctx.fillRect(x - (t >> 1), y - (t >> 1), t, t);
      }
    },
  };
}
