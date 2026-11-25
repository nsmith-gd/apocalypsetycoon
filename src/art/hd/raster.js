// 64 px art core (#117): a palette-indexed pixel buffer with ramp-aware lighting.
//
// The director's art note D4 sets a 64 px minimum: room tiles and amenity sprites are authored at 64 px per metre
// (four times the old 16 px grid). At that size, flat fills look like vector art, so this art is built the way the
// reference pieces are: every material is a tone ramp, shading picks a step on it, and lights shift steps up and
// down with ordered dithering at their edges. No colour outside HD_RAMPS can appear (the palette rule still holds).
//
// Pure data, no DOM: it renders headless (tests, the PNG export) and in the browser (toImageData / drawBuffer).

/** Material ramps, dark -> light. Every pixel of 64 px art is one of these colours. */
export const HD_RAMPS = Object.freeze({
  K: ['#0a0807'], // outline / void
  steel: ['#15181d', '#1f242b', '#2b3038', '#3a3f46', '#525862', '#6b7078', '#9aa3ad', '#dfe6ec'],
  teal: ['#0a1718', '#0f2628', '#153a3b', '#1c4f4d', '#256660', '#327f73', '#4fa391', '#8fd0b8'],
  concrete: ['#1a191a', '#262426', '#3a3738', '#524d4b', '#6c655f', '#8b8179', '#ab9f92'],
  walnut: ['#170d07', '#2a180d', '#3e2414', '#5a361f', '#6e4428', '#8f5f38', '#b07f52'],
  plaster: ['#3a3128', '#5a4c3d', '#7d6c58', '#a8977a', '#c9b998', '#e3d5b6', '#f2e6c9'],
  gold: ['#3a230a', '#5e3c10', '#8a5a1a', '#b07a22', '#c79430', '#f5c542', '#fff1a8'],
  velvet: ['#14060f', '#250a1c', '#3e1230', '#5a1c46', '#7a2a5a', '#a2407a', '#d070a8'],
  marble: ['#4e483f', '#6e665a', '#958a78', '#b3a68f', '#cbbfa8', '#ddd3c0', '#f2ead8'],
  emerald: ['#06150f', '#0c2a1e', '#123d2b', '#145236', '#1f7a4a', '#3aa866', '#7fd89a'],
  violet: ['#0e0718', '#1a0e2e', '#2a1648', '#3a1e5e', '#6a3aa0', '#a070e0', '#d0b0ff'],
  red: ['#1e0605', '#3a0e0c', '#6b1f1a', '#9a2a22', '#d8402f', '#ff5a4f', '#ffa090'],
  amber: ['#2e1704', '#5a2e08', '#8a4a10', '#b8742a', '#f0b052', '#ffd890', '#fff3d0'],
  hazard: ['#3a2a06', '#6a4e0a', '#b88a14', '#e8b020', '#f5c542', '#ffe07a'],
  leaf: ['#08170a', '#0f2a12', '#1d4420', '#2f5a24', '#4f8a30', '#7ed957', '#c0f090'],
  water: ['#06111c', '#0a1a2a', '#16324a', '#24507a', '#3f8fc8', '#8fd3ff', '#d8f4ff'],
  cloth: ['#1a1a22', '#2a2a36', '#3e3e50', '#585a70', '#7a7e96', '#a8acc0', '#d8dae6'],
  skin: ['#3a2016', '#6e4028', '#a8704a', '#d8a078', '#f0c8a0'],
  neon: ['#1a0828', '#3a1060', '#7a2ab0', '#c070ff', '#e8c0ff'],
  rust: ['#1e0e06', '#3a1c0c', '#5e2e14', '#8a4422', '#b0602e', '#d08a4a'],
});

// Flat colour table: index 0 = transparent; every ramp step gets an index.
export const HD_COLOURS = [null];
const STEP = [null]; // colour index -> [rampName, step]
const IDX = {};
for (const [name, ramp] of Object.entries(HD_RAMPS)) {
  IDX[name] = ramp.map((hex, s) => { HD_COLOURS.push(hex); STEP.push([name, s]); return HD_COLOURS.length - 1; });
}
/** Colour index for a ramp step (clamped to the ramp). */
export function col(ramp, step) {
  const r = IDX[ramp];
  if (!r) throw new Error(`unknown ramp ${ramp}`);
  return r[Math.max(0, Math.min(r.length - 1, Math.round(step)))];
}
export const K = col('K', 0);
export const rampLength = (ramp) => IDX[ramp].length;

const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
/** Ordered-dither threshold in 0..1 for a pixel. */
export const bayer = (x, y) => (BAYER4[y & 3][x & 3] + 0.5) / 16;
/** Deterministic 0..1 noise. */
export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A palette-indexed pixel buffer. `glow` marks emissive pixels, which lighting never darkens. */
export class Raster {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.c = new Uint8Array(w * h);
    this.glow = new Uint8Array(w * h);
  }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inside(x, y) ? this.c[y * this.w + x] : 0; }
  set(x, y, ci, glow = 0) {
    x = Math.floor(x); y = Math.floor(y);
    if (!ci || !this.inside(x, y)) return;
    const i = y * this.w + x;
    this.c[i] = ci; this.glow[i] = glow ? 1 : 0;
  }
  rect(x, y, w, h, ci, glow = 0) {
    x = Math.floor(x); y = Math.floor(y);
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) this.set(xx, yy, ci, glow);
  }
  /** Move a pixel `d` steps along its ramp (lighting). Emissive pixels are only brightened. */
  shift(x, y, d) {
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    const ci = this.c[i];
    if (!ci || (d < 0 && this.glow[i])) return;
    const [ramp, s] = STEP[ci];
    this.c[i] = col(ramp, s + d);
  }
  /** Shift a rectangle by `amount` (fractional = dithered). */
  shade(x, y, w, h, amount) {
    const whole = Math.trunc(amount), frac = Math.abs(amount - whole), sign = Math.sign(amount);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const d = whole + (bayer(xx, yy) < frac ? sign : 0);
      if (d) this.shift(xx, yy, d);
    }
  }
  /** Colours used (for tests and the palette check). */
  colours() { return new Set([...this.c].filter(Boolean).map((i) => HD_COLOURS[i])); }
  /** RGBA bytes. */
  rgba() {
    const out = new Uint8ClampedArray(this.w * this.h * 4);
    for (let i = 0; i < this.c.length; i++) {
      const hex = HD_COLOURS[this.c[i]];
      if (!hex) continue;
      const n = parseInt(hex.slice(1), 16);
      out[i * 4] = n >> 16; out[i * 4 + 1] = (n >> 8) & 255; out[i * 4 + 2] = n & 255; out[i * 4 + 3] = 255;
    }
    return out;
  }
}

// ----------------------------------------------------------------------------------- drawing kit
/** A bevelled block lit from the top-left, with a 1 px outline. */
export function box(b, x, y, w, h, ramp, base = 3, { outline = true, bevel = true } = {}) {
  x = Math.round(x); y = Math.round(y);
  if (outline) b.rect(x - 1, y - 1, w + 2, h + 2, K);
  b.rect(x, y, w, h, col(ramp, base));
  if (!bevel || w < 3 || h < 3) return;
  b.rect(x, y, w, 1, col(ramp, base + 2));
  b.rect(x, y + 1, 1, h - 1, col(ramp, base + 1));
  b.rect(x + w - 1, y + 1, 1, h - 1, col(ramp, base - 1));
  b.rect(x + 1, y + h - 1, w - 1, 1, col(ramp, base - 1));
}
/** A vertical cylinder: tone follows the curve, a highlight streak sits left of centre. */
export function cyl(b, x, y, w, h, ramp, base = 3, { outline = true, bands = 0 } = {}) {
  x = Math.round(x); y = Math.round(y);
  if (outline) b.rect(x - 1, y - 1, w + 2, h + 2, K);
  for (let i = 0; i < w; i++) {
    const t = (i + 0.5) / w; // 0..1 across
    const light = Math.cos((t - 0.32) * Math.PI) * 1.8 - 0.4; // brightest left of centre
    for (let j = 0; j < h; j++) {
      const d = light + (bayer(x + i, y + j) - 0.5) * 0.9;
      b.set(x + i, y + j, col(ramp, base + Math.round(d)));
    }
  }
  const hl = Math.round(x + w * 0.28);
  b.rect(hl, y + 2, Math.max(1, Math.round(w / 14)), h - 4, col(ramp, base + 3));
  for (let k = 1; k <= bands; k++) { const yy = Math.round(y + (h * k) / (bands + 1)); for (let i = 0; i < w; i++) b.shift(x + i, yy, -2); for (let i = 0; i < w; i++) b.shift(x + i, yy - 1, 1); }
}
/** A horizontal cylinder (pipes, tanks lying down). */
export function hcyl(b, x, y, w, h, ramp, base = 3, { outline = true } = {}) {
  x = Math.round(x); y = Math.round(y);
  if (outline) b.rect(x - 1, y - 1, w + 2, h + 2, K);
  for (let j = 0; j < h; j++) {
    const t = (j + 0.5) / h;
    const light = Math.cos((t - 0.3) * Math.PI) * 1.8 - 0.4;
    for (let i = 0; i < w; i++) b.set(x + i, y + j, col(ramp, base + Math.round(light + (bayer(x + i, y + j) - 0.5) * 0.9)));
  }
}
/** A glowing screen with scanlines and a little content. */
export function screen(b, x, y, w, h, ramp = 'teal', frame = 0, { bars = true } = {}) {
  box(b, x - 2, y - 2, w + 4, h + 4, 'steel', 1);
  b.rect(x, y, w, h, col(ramp, 3), 1);
  for (let j = 0; j < h; j += 2) b.rect(x, y + j, w, 1, col(ramp, 4), 1);
  if (bars) for (let i = 2; i < w - 3; i += 4) {
    const bh = Math.max(1, Math.round((h - 4) * hash(i, frame, x)));
    b.rect(x + i, y + h - 2 - bh, 2, bh, col(ramp, 6), 1);
  }
  b.rect(x + 1, y + 1, Math.max(1, w >> 3), 1, col(ramp, 7), 1);
}
/** A small status light; blinks on odd frames when `blink`. */
export function led(b, x, y, ramp = 'leaf', frame = 0, blink = false, size = 2) {
  const on = !blink || frame % 2 === 0;
  b.rect(x, y, size, size, col(ramp, on ? 5 : 2), on ? 1 : 0);
  if (on && size > 1) b.set(x, y, col(ramp, 6), 1);
}
/** Soft additive glow around a point (dithered falloff). */
export function glowAt(b, cx, cy, r, strength = 2) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const d = Math.hypot(x - cx, y - cy) / r;
    if (d > 1) continue;
    const a = (1 - d) * strength;
    const s = Math.floor(a) + (bayer(x, y) < a - Math.floor(a) ? 1 : 0);
    if (s > 0) b.shift(x, y, s);
  }
}
/** A light cone from a lamp at (cx, top) widening down to `bottom`. */
export function cone(b, cx, top, bottom, halfTop, halfBottom, strength = 1.6) {
  for (let y = top; y < bottom; y++) {
    const t = (y - top) / Math.max(1, bottom - top);
    const half = halfTop + (halfBottom - halfTop) * t;
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const edge = 1 - Math.abs(x - cx) / half; // 1 centre, 0 edge
      const a = Math.min(1, edge * 1.6) * strength * (1 - t * 0.45);
      const s = Math.floor(a) + (bayer(x, y) < a - Math.floor(a) ? 1 : 0);
      if (s > 0) b.shift(x, y, s);
    }
  }
}

// 3x5 glyphs (same shapes as src/art/font.js), drawn at any whole scale.
const G = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'], Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'], '-': ['...', '...', '###', '...', '...'], '.': ['...', '...', '...', '...', '.#.'],
  ' ': ['...', '...', '...', '...', '...'], "'": ['.#.', '.#.', '...', '...', '...'], '&': ['.#.', '#.#', '.#.', '#.#', '.##'],
};
export const textW = (s, scale = 1) => Math.max(0, String(s).length * 4 * scale - scale);
/** Stencil text. `worn` knocks out a few pixels so painted signs look old. */
export function text(b, s, x, y, ci, scale = 1, { worn = 0, glow = 0 } = {}) {
  [...String(s).toUpperCase()].forEach((ch, i) => {
    const g = G[ch] ?? G[' '];
    g.forEach((row, gy) => {
      for (let gx = 0; gx < 3; gx++) {
        if (row[gx] !== '#') continue;
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
          const px = x + (i * 4 + gx) * scale + sx, py = y + gy * scale + sy;
          if (worn && hash(px, py, 77) < worn) continue;
          b.set(px, py, ci, glow);
        }
      }
    });
  });
}

/** Paint a Raster onto a 2D canvas context at (ox, oy), 1 canvas pixel per art pixel. */
export function drawRaster(ctx, r, ox = 0, oy = 0) {
  const img = new ImageData(r.rgba(), r.w, r.h);
  if (!drawRaster.tmp) drawRaster.tmp = document.createElement('canvas');
  const t = drawRaster.tmp;
  t.width = r.w; t.height = r.h;
  t.getContext('2d').putImageData(img, 0, 0);
  ctx.drawImage(t, ox, oy);
}
