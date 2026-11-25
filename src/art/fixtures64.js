// Survival-grade fixtures (air, water, food) at the 64 px minimum (#119, art note D4; style guide: 1 m = 64 px).
//
// Every fixture is authored at native resolution, 64 px per metre (a 2 x 3 m water tank is 128 x 192), with a
// 1 px dark outline, light from the top-left, material ramps built from the piece's colour variant (a = body,
// b = trim), clustered grime and scratches, rivets, stencilled labels, gauges and small animations
// (fans, crank, bubbles, blinking LEDs). Only survival kit lives here: steel plus one accent colour per need
// (mint air, blue water, green food), so the player can read what Midnight will grade.
//
//   fixtureCanvas(kind, { a, b }, { on, frame })       -> native canvas (w*64 x h*64), cached
//   drawFixture(ctx, kind, px, py, { a, b }, { on, frame, flip, tile = 16 })
//       Draws at the destination tile size. At 64 px per tile it is 1:1. Below that (the editor is still 16 px
//       per metre until the director confirms the 64 rule) it draws a crisp level-of-detail reduction of the 64
//       art: each block is averaged, then snapped back to the nearest colour the art itself uses.
//   FIXTURE_KINDS, FIXTURE_PX = 64

import { HEX } from './palette.js';

export const FIXTURE_PX = 64;
const M = FIXTURE_PX;

// footprints in metres (mirrors bunker-catalog OBJECTS, kept here so the art module has no game imports)
export const FIXTURE_SIZE = Object.freeze({
  crank_scrubber: [1, 2], hepa: [2, 2], o2_rack: [1, 2],
  tank: [2, 3], recycler: [2, 2], aquifer: [2, 3], sump: [2, 2],
  shelf: [1, 3], fridge: [1, 2], hydro: [2, 2], grow_light: [1, 1], vat: [2, 3],
});
export const FIXTURE_KINDS = Object.freeze(Object.keys(FIXTURE_SIZE));

// ---------------------------------------------------------------- colour helpers
const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const clamp8 = (v) => Math.max(0, Math.min(255, Math.round(v)));
const mix = (c, d, t) => [0, 1, 2].map((i) => clamp8(c[i] + (d[i] - c[i]) * t));
/** Five-step ramp from a base colour: deep shadow, shadow, base, lit, highlight (warm light, cool shadow). */
function ramp(hex) {
  const c = rgbOf(hex);
  return [
    mix(c, [18, 16, 30], 0.72),
    mix(c, [30, 28, 46], 0.42),
    c,
    mix(c, [255, 246, 220], 0.28),
    mix(c, [255, 250, 235], 0.58),
  ];
}
const P = (k) => rgbOf(HEX[k]);
const OUT = P('K');
const ACCENT = {
  air: [P('T'), [150, 205, 175], [90, 150, 120]],
  water: [P('C'), P('c'), P('n'), P('N')],
  food: [P('G'), [92, 170, 60], P('g'), [28, 60, 22]],
  red: [P('R'), P('r')],
  amber: [P('O'), P('o')],
  gold: [P('Y'), P('y')],
  bone: [P('W'), P('S')],
  grow: [[230, 120, 255], P('v'), [120, 50, 160]],
};

function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- pixel buffer
class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.px[y * this.w + x]; }
  set(x, y, c) { x |= 0; y |= 0; if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  hline(x, y, w, c) { this.rect(x, y, w, 1, c); }
  vline(x, y, h, c) { this.rect(x, y, 1, h, c); }
  /** Outlined, bevelled box (light top-left, shadow bottom-right). */
  box(x, y, w, h, r, { outline = true } = {}) {
    this.rect(x, y, w, h, r[2]);
    this.hline(x + 1, y + 1, w - 2, r[4]); this.hline(x + 1, y + 2, w - 2, r[3]);
    this.vline(x + 1, y + 1, h - 2, r[3]);
    this.hline(x + 1, y + h - 2, w - 2, r[1]); this.hline(x + 1, y + h - 3, w - 2, r[1]);
    this.vline(x + w - 2, y + 2, h - 3, r[1]);
    if (outline) this.frame(x, y, w, h, OUT);
  }
  frame(x, y, w, h, c) { this.hline(x, y, w, c); this.hline(x, y + h - 1, w, c); this.vline(x, y, h, c); this.vline(x + w - 1, y, h, c); }
  /** Vertical cylinder: per-column shading with a highlight band at ~30%. */
  cyl(x, y, w, h, r, { outline = true } = {}) {
    for (let i = 0; i < w; i++) {
      const t = i / (w - 1);
      const k = t < 0.08 ? 1 : t < 0.22 ? 3 : t < 0.34 ? 4 : t < 0.6 ? 2 : t < 0.86 ? 1 : 0;
      this.vline(x + i, y, h, r[k]);
    }
    if (outline) this.frame(x, y, w, h, OUT);
  }
  disc(cx, cy, rad, c, rim = null) {
    for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) {
      const d = Math.hypot(i, j);
      if (d <= rad + 0.3) this.set(cx + i, cy + j, rim && d > rad - 1 ? rim : c);
    }
  }
  rivets(x, y, w, h, r, step = 8) {
    for (let i = x + 3; i < x + w - 2; i += step) { this.set(i, y + 3, r[4]); this.set(i + 1, y + 4, r[0]); this.set(i, y + h - 4, r[4]); this.set(i + 1, y + h - 3, r[0]); }
  }
  /** Clustered grime and scratches over what is already drawn (darkens / lightens existing pixels). */
  wear(x, y, w, h, seed, amount = 0.12) {
    // Grime in soft 4x4 patches (dithered at their edges), a few short horizontal scratches, and dirt that
    // collects toward the bottom. No single-pixel noise.
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const X = x + i, Y = y + j;
      const c = this.get(X, Y);
      if (!c || c === OUT) continue;
      const m = hash(X >> 2, Y >> 2, seed);
      const edge = hash(X >> 1, Y >> 1, seed + 5);
      if (m < amount * 0.5 && edge < 0.75) this.set(X, Y, mix(c, [30, 24, 20], 0.22));
      const low = (Y - y) / h;
      if (low > 0.8 && ((X + Y) & 1) === 0 && hash(X >> 2, Y >> 1, seed + 2) < (low - 0.8) * 3) this.set(X, Y, mix(this.get(X, Y), [44, 32, 22], 0.25));
    }
    const n = Math.round((w * h) / 900 * amount * 10);
    for (let k = 0; k < n; k++) {
      const sx = x + 3 + Math.floor(hash(k, 1, seed + 7) * (w - 10));
      const sy = y + 3 + Math.floor(hash(k, 2, seed + 7) * (h - 6));
      const len = 3 + Math.floor(hash(k, 3, seed + 7) * 5);
      for (let i = 0; i < len; i++) { const c = this.get(sx + i, sy); if (c && c !== OUT) this.set(sx + i, sy, mix(c, [255, 250, 235], 0.25)); }
    }
  }
  slats(x, y, w, h, r, gap = 3) { for (let j = 0; j < h; j += gap) { this.hline(x, y + j, w, r[0]); this.hline(x, y + j + 1, w, r[3]); } }
  gauge(cx, cy, rad, value, r) {
    this.disc(cx, cy, rad, P('W'), OUT);
    this.disc(cx, cy, rad - 2, P('W'));
    for (let a = 0; a < 5; a++) { const t = Math.PI * (0.8 + a * 0.35); this.set(cx + Math.round(Math.cos(t) * (rad - 2)), cy + Math.round(Math.sin(t) * (rad - 2)), r[0]); }
    const t = Math.PI * (0.8 + value * 1.4);
    for (let s = 0; s < rad - 1; s += 0.5) this.set(cx + Math.round(Math.cos(t) * s), cy + Math.round(Math.sin(t) * s), ACCENT.red[0]);
    this.set(cx, cy, OUT);
  }
  text(x, y, str, c) {
    let cx = x;
    for (const ch of str) { const g = GLYPH[ch] ?? GLYPH[' ']; g.forEach((row, j) => [...row].forEach((v, i) => v === '#' && this.set(cx + i, y + j, c))); cx += 4; }
  }
  led(x, y, on, c) { this.rect(x, y, 2, 2, on ? c : mix(c, [20, 20, 20], 0.7)); if (on) this.set(x, y, mix(c, [255, 255, 255], 0.5)); }
}

// 3x5 stencil glyphs for labels on the machines (8 px tall rule applies to UI text, not to stencils on props)
const GLYPH = {
  ' ': ['...', '...', '...', '...', '...'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'], L: ['#..', '#..', '#..', '#..', '###'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['###', '#.#', '#.#', '#.#', '###'], P: ['##.', '#.#', '##.', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], W: ['#.#', '#.#', '###', '###', '#.#'], 2: ['##.', '..#', '.#.', '#..', '###'],
  '-': ['...', '...', '###', '...', '...'],
  M: ['#.#', '###', '###', '#.#', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'], G: ['.##', '#..', '#.#', '#.#', '.##'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'], Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  1: ['.#.', '##.', '.#.', '.#.', '###'], 8: ['###', '#.#', '###', '#.#', '###'],
};

// ---------------------------------------------------------------- recipes (native px: 64 per metre)
const RECIPES = {
  // Hand-crank scrubber: a soda-lime canister on a wall bracket with a crank wheel and an intake grille.
  crank_scrubber({ b, r, t, on, frame }) {
    b.rect(28, 2, 8, 6, t[1]); b.frame(28, 2, 8, 6, OUT); // duct stub
    b.box(8, 8, 48, 14, r); b.slats(12, 12, 40, 8, r); // intake grille
    b.cyl(14, 22, 36, 82, r); // canister
    for (const y of [30, 52, 74, 96]) { b.hline(14, y, 36, t[0]); b.hline(14, y + 1, 36, t[3]); }
    b.rect(20, 40, 24, 10, ACCENT.air[2]); b.frame(20, 40, 24, 10, OUT); b.rect(22, 42, 20 * 0.7 | 0, 6, ACCENT.air[0]); // absorbent window
    b.text(24, 58, 'O2', ACCENT.bone[0]);
    // crank wheel, turning while it runs
    const cx = 54, cy = 66;
    b.disc(cx, cy, 8, t[2], OUT); b.disc(cx, cy, 3, t[0]);
    const a = (on ? frame * 0.35 : 0.6);
    for (let s = 0; s < 8; s++) b.set(cx + Math.round(Math.cos(a) * s), cy + Math.round(Math.sin(a) * s), t[4]);
    b.rect(cx + Math.round(Math.cos(a) * 8) - 1, cy + Math.round(Math.sin(a) * 8) - 1, 3, 3, ACCENT.red[0]);
    b.box(10, 104, 44, 10, r); // base plate
    b.rect(16, 114, 4, 12, t[0]); b.rect(44, 114, 4, 12, t[0]); // feet
    b.wear(8, 8, 50, 118, 11);
  },
  // HEPA scrubber unit: a cabinet with a pleated filter face, a turning fan, a control strip and ducts.
  hepa({ b, r, t, on, frame, blink }) {
    b.rect(18, 2, 14, 14, t[1]); b.frame(18, 2, 14, 14, OUT); b.rect(96, 2, 14, 14, t[1]); b.frame(96, 2, 14, 14, OUT);
    b.box(4, 14, 120, 106, r); b.rivets(4, 14, 120, 106, r, 10);
    // pleated filter
    b.rect(12, 26, 62, 82, ACCENT.air[2]); b.frame(12, 26, 62, 82, OUT);
    for (let x = 14; x < 72; x += 4) { b.vline(x, 28, 78, ACCENT.air[0]); b.vline(x + 1, 28, 78, ACCENT.air[1]); b.vline(x + 2, 28, 78, ACCENT.air[2]); }
    for (let y = 28; y < 106; y += 13) b.hline(13, y, 60, mix(ACCENT.air[2], [0, 0, 0], 0.3));
    // fan
    b.disc(98, 52, 18, t[0], OUT); b.disc(98, 52, 16, mix(t[0], [0, 0, 0], 0.3));
    const a0 = on ? frame * 0.5 : 0;
    for (let k = 0; k < 4; k++) { const a = a0 + k * Math.PI / 2; for (let s = 3; s < 15; s++) for (let w = -1; w <= 1; w++) b.set(98 + Math.round(Math.cos(a) * s - Math.sin(a) * w * (s / 6)), 52 + Math.round(Math.sin(a) * s + Math.cos(a) * w * (s / 6)), r[3]); }
    b.disc(98, 52, 3, t[3], OUT);
    // control strip
    b.rect(82, 78, 34, 30, r[0]); b.frame(82, 78, 34, 30, OUT);
    b.text(86, 81, 'HEPA', ACCENT.air[0]);
    b.led(86, 90, on, ACCENT.food[0]); b.led(92, 90, on && blink, ACCENT.amber[0]); b.led(98, 90, !on, ACCENT.red[0]);
    b.gauge(106, 99, 6, on ? 0.65 : 0.1, r);
    b.rect(10, 120, 10, 6, t[0]); b.rect(108, 120, 10, 6, t[0]);
    b.wear(4, 14, 120, 112, 12);
  },
  // Oxygen candle rack: a steel rack of chlorate canisters with red caps, one slot empty.
  o2_rack({ b, r, t }) {
    b.box(6, 4, 52, 120, r);
    b.rect(10, 10, 44, 108, r[0]);
    for (let row = 0; row < 4; row++) {
      const y = 12 + row * 26;
      b.hline(10, y + 22, 44, t[3]); b.hline(10, y + 23, 44, t[0]);
      for (let c = 0; c < 3; c++) {
        if (row === 1 && c === 2) continue; // used one
        const x = 12 + c * 14;
        b.cyl(x, y + 4, 12, 18, ramp('#c8c0a8'));
        b.rect(x, y, 12, 5, ACCENT.red[0]); b.frame(x, y, 12, 5, OUT); b.hline(x + 1, y + 1, 10, mix(ACCENT.red[0], [255, 255, 255], 0.3));
        b.hline(x + 2, y + 12, 8, ACCENT.amber[1]);
      }
    }
    b.text(16, 116, 'O2', ACCENT.air[0]);
    b.wear(6, 4, 52, 120, 13, 0.1);
  },
  // Water tank: a banded steel cylinder with a sight glass, rivets, a ladder and an outlet valve.
  tank({ b, r, t, frame }) {
    b.rect(30, 4, 68, 8, r[1]); b.frame(30, 4, 68, 8, OUT); // lid
    b.cyl(14, 10, 100, 162, r);
    for (const y of [24, 62, 100, 138]) { b.hline(14, y, 100, t[0]); b.hline(14, y + 1, 100, t[3]); b.rivets(14, y - 3, 100, 8, r, 9); }
    // sight glass with water level and a ripple
    b.rect(84, 30, 10, 120, P('K')); b.rect(85, 31, 8, 118, mix(ACCENT.water[3], [0, 0, 0], 0.2));
    const level = 64;
    b.rect(85, level, 8, 149 - level, ACCENT.water[1]); b.vline(86, level, 149 - level, ACCENT.water[0]);
    b.hline(85, level + (frame % 2), 8, ACCENT.water[0]);
    b.text(30, 76, 'POTABLE', ACCENT.water[0]);
    // ladder on the left
    b.vline(6, 20, 150, t[1]); b.vline(12, 20, 150, t[1]); for (let y = 24; y < 168; y += 10) b.hline(6, y, 7, t[3]);
    // base, outlet pipe and valve wheel
    b.box(10, 170, 108, 12, r);
    b.rect(110, 150, 16, 8, ACCENT.water[2]); b.frame(110, 150, 16, 8, OUT);
    b.disc(118, 144, 6, ACCENT.red[0], OUT); b.disc(118, 144, 2, ACCENT.red[1]);
    b.rect(18, 182, 8, 10, t[0]); b.rect(102, 182, 8, 10, t[0]);
    b.wear(6, 4, 120, 188, 14);
  },
  // Deep water recycler: membrane columns, a bubbling glass column, a pipe loop and a pressure gauge.
  recycler({ b, r, t, on, frame, blink }) {
    b.box(4, 20, 120, 100, r);
    b.cyl(12, 8, 22, 104, r); b.cyl(38, 8, 22, 104, r);
    for (const x of [12, 38]) for (const y of [20, 50, 80]) { b.hline(x, y, 22, t[0]); b.hline(x, y + 1, 22, t[3]); }
    // glass column of clean water
    b.rect(70, 14, 22, 92, OUT); b.rect(71, 15, 20, 90, ACCENT.water[1]); b.vline(73, 15, 90, ACCENT.water[0]); b.vline(88, 15, 90, ACCENT.water[2]);
    if (on) for (let k = 0; k < 6; k++) { const y = 100 - ((frame * 3 + k * 17) % 84); b.set(76 + (k * 5) % 12, y, ACCENT.bone[0]); b.set(77 + (k * 5) % 12, y - 1, ACCENT.water[0]); }
    // pipe loop
    b.rect(34, 4, 46, 6, ACCENT.water[2]); b.frame(34, 4, 46, 6, OUT); b.hline(35, 5, 44, ACCENT.water[1]);
    b.rect(96, 30, 22, 50, r[0]); b.frame(96, 30, 22, 50, OUT);
    b.gauge(107, 44, 8, on ? 0.7 : 0.05, r);
    b.led(100, 62, on, ACCENT.water[0]); b.led(106, 62, on && blink, ACCENT.food[0]); b.led(112, 62, !on, ACCENT.red[0]);
    b.text(98, 70, 'H2O', ACCENT.water[0]);
    b.rect(10, 120, 12, 8, t[0]); b.rect(106, 120, 12, 8, t[0]);
    b.wear(4, 4, 120, 124, 15);
  },
  // Aquifer well head: a concrete collar, a riser pipe, a pump motor and a pressure gauge.
  aquifer({ b, r, t, on, frame }) {
    const conc = ramp('#8b8179');
    b.box(8, 150, 112, 36, conc); b.wear(8, 150, 112, 36, 16, 0.2);
    for (let x = 10; x < 118; x += 9) { b.set(x, 160, conc[0]); b.set(x + 1, 161, conc[4]); }
    b.box(52, 70, 24, 82, r); for (let y = 80; y < 150; y += 18) { b.hline(52, y, 24, t[0]); b.hline(52, y + 1, 24, t[3]); }
    b.box(28, 16, 72, 56, r); b.slats(34, 24, 30, 30, r); // motor
    b.rect(70, 24, 24, 16, r[0]); b.frame(70, 24, 24, 16, OUT); b.text(73, 29, 'PUMP', ACCENT.amber[0]);
    b.gauge(84, 54, 9, on ? 0.6 : 0, r);
    b.rect(40, 6, 48, 10, r[1]); b.frame(40, 6, 48, 10, OUT);
    // hazard band and a drip
    for (let x = 30; x < 98; x++) b.set(x, 66, ((x >> 2) % 2) ? OUT : ACCENT.gold[0]);
    b.rect(76, 108, 30, 8, ACCENT.water[2]); b.frame(76, 108, 30, 8, OUT);
    if (on) b.set(104, 118 + (frame % 8) * 4, ACCENT.water[0]);
    b.wear(28, 6, 72, 146, 17);
  },
  // Sump pump: a squat motor on an impeller housing, discharge pipe, float switch and a wet floor.
  sump({ b, r, t, on, frame }) {
    b.rect(2, 116, 124, 10, mix(ACCENT.water[3], [20, 20, 20], 0.3)); for (let x = 4; x < 124; x += 7) b.set(x, 118 + (x % 3), ACCENT.water[2]);
    b.cyl(18, 70, 64, 48, r); b.hline(18, 84, 64, t[0]); b.hline(18, 85, 64, t[3]);
    b.box(26, 26, 48, 46, r); b.slats(32, 32, 36, 26, r);
    b.rect(36, 18, 28, 8, t[1]); b.frame(36, 18, 28, 8, OUT);
    b.rect(82, 80, 40, 10, ACCENT.water[2]); b.frame(82, 80, 40, 10, OUT); b.rect(112, 8, 10, 82, ACCENT.water[2]); b.frame(112, 8, 10, 82, OUT);
    b.vline(114, 9, 80, ACCENT.water[1]);
    b.rect(90, 96, 10, 14, ACCENT.amber[0]); b.frame(90, 96, 10, 14, OUT); // float
    b.led(30, 62, on, ACCENT.food[0]);
    b.text(34, 102, 'SUMP', ACCENT.bone[0]);
    if (on && frame % 2) b.hline(84, 82, 36, ACCENT.water[0]);
    b.wear(18, 18, 104, 102, 18);
  },
  // Pantry shelving: four steel shelves of tins, jars, rice sacks and boxes, labelled by row.
  shelf({ b, r, t }) {
    b.vline(4, 2, 188, OUT); b.vline(5, 2, 188, t[3]); b.vline(6, 2, 188, t[1]);
    b.vline(57, 2, 188, OUT); b.vline(58, 2, 188, t[1]); b.vline(59, 2, 188, OUT);
    const food = [ACCENT.food[0], ACCENT.amber[0], ACCENT.red[0], P('b'), ACCENT.gold[0], P('W')];
    for (let s = 0; s < 4; s++) {
      const y = 44 + s * 46;
      b.rect(4, y, 56, 4, r[2]); b.hline(4, y, 56, r[4]); b.hline(4, y + 3, 56, r[0]); b.frame(4, y, 56, 4, OUT);
      let x = 8;
      let k = s * 3;
      while (x < 54) {
        const kind = (k * 7 + s) % 4;
        const c = food[k % food.length];
        if (kind === 0) { b.cyl(x, y - 14, 9, 14, ramp('#a8acb0')); b.rect(x + 1, y - 10, 7, 5, c); x += 10; } // tin with label
        else if (kind === 1) { b.rect(x, y - 16, 9, 16, OUT); b.rect(x + 1, y - 15, 7, 14, mix(c, [255, 255, 255], 0.2)); b.rect(x + 1, y - 17, 7, 3, t[2]); x += 10; } // jar
        else if (kind === 2) { const sk = ramp('#c8b48a'); b.rect(x, y - 20, 14, 20, sk[2]); b.vline(x, y - 20, 20, OUT); b.vline(x + 13, y - 20, 20, OUT); b.hline(x + 2, y - 20, 10, OUT); b.hline(x + 1, y - 12, 12, sk[1]); b.text(x + 2, y - 9, 'R', sk[0]); x += 15; } // sack
        else { const bx = ramp('#a07850'); b.box(x, y - 13, 12, 13, bx); b.hline(x + 2, y - 7, 8, c); x += 13; } // box
        k++;
      }
    }
    b.rect(18, 4, 28, 10, OUT); b.text(20, 6, 'FOOD', ACCENT.food[0]);
    b.wear(4, 2, 56, 188, 19, 0.08);
  },
  // Cold store: a steel cabinet, two doors, a temperature readout, a compressor grille and frost.
  fridge({ b, r, t, on, blink }) {
    b.box(4, 2, 56, 124, r);
    b.hline(5, 44, 54, OUT); b.hline(5, 45, 54, r[3]);
    b.rect(48, 14, 3, 22, t[1]); b.frame(48, 14, 3, 22, OUT); b.rect(48, 56, 3, 40, t[1]); b.frame(48, 56, 3, 40, OUT);
    b.rect(10, 8, 30, 12, OUT); b.text(12, 11, on ? '-18' : 'ERR', on ? ACCENT.water[0] : (blink ? ACCENT.red[0] : ACCENT.red[1]));
    b.slats(10, 106, 44, 14, r);
    if (on) for (let j = 0; j < 40; j++) if (hash(j, 3, 9) < 0.5) { b.set(6, 48 + j, ACCENT.bone[0]); if (hash(j, 4, 9) < 0.3) b.set(7, 48 + j, P('C')); } // frost
    b.text(14, 60, 'COLD', ACCENT.water[0]);
    b.wear(4, 2, 56, 124, 20, 0.08);
  },
  // Hydroponic rack: two trays of greens under purple grow strips, with feed lines.
  hydro({ b, r, t, on, frame }) {
    b.vline(4, 4, 122, OUT); b.vline(5, 4, 122, t[3]); b.vline(122, 4, 122, OUT); b.vline(121, 4, 122, t[1]);
    for (let tier = 0; tier < 2; tier++) {
      const y = 8 + tier * 60;
      b.rect(8, y, 112, 5, OUT); b.rect(9, y + 1, 110, 3, on ? ACCENT.grow[0] : ACCENT.grow[2]); // grow strip
      if (on) for (let gy = 1; gy < 10; gy++) for (let x = 10; x < 118; x++) if (hash(x, gy + tier * 20, 21) < 0.08 / gy * 3) b.set(x, y + 5 + gy, ACCENT.grow[1]); // light falloff
      // plants: a row of leafy clumps
      for (let x = 12; x < 116; x += 12) {
        const h = 14 + Math.floor(hash(x, tier, 22) * 10) + (on ? (frame + x) % 2 : 0);
        for (let j = 0; j < h; j++) {
          const wdt = Math.max(1, Math.round((1 - Math.abs(j - h * 0.55) / (h * 0.6)) * 6));
          for (let i = -wdt; i <= wdt; i++) b.set(x + 5 + i, y + 46 - j, hash(x + i, j, 23) < 0.25 ? ACCENT.food[2] : i < 0 ? ACCENT.food[0] : ACCENT.food[1]);
        }
      }
      b.rect(8, y + 46, 112, 8, r[2]); b.hline(8, y + 46, 112, r[4]); b.hline(8, y + 53, 112, r[0]); b.frame(8, y + 46, 112, 8, OUT); // tray
      b.rect(10, y + 48, 108, 2, ACCENT.water[1]);
    }
    b.rect(118, 20, 6, 100, ACCENT.water[2]); b.frame(118, 20, 6, 100, OUT); // feed line
    b.wear(4, 4, 120, 122, 24, 0.06);
  },
  // Grow light: a hanging hood with a purple LED panel and its glow.
  grow_light({ b, r, t, on, blink }) {
    b.vline(31, 0, 14, OUT); b.vline(32, 0, 14, t[1]);
    b.box(10, 14, 44, 14, r);
    b.rect(14, 28, 36, 6, OUT); b.rect(15, 29, 34, 4, on ? ACCENT.grow[0] : ACCENT.grow[2]);
    if (on) for (let x = 15; x < 49; x += 3) b.set(x, 30, [255, 230, 255]);
    if (on) for (let j = 0; j < 26; j++) for (let x = 12 - j / 3; x < 52 + j / 3; x++) if (hash(x | 0, j, 25) < 0.22 - j * 0.008) b.set(x | 0, 36 + j, ACCENT.grow[j < 10 ? 1 : 2]);
    b.led(48, 18, on && blink, ACCENT.food[0]);
  },
  // Protein vat: a glass vat of beige-green culture with bubbles, a stirring motor and a feed pipe.
  vat({ b, r, t, on, frame }) {
    b.box(30, 2, 68, 22, r); b.slats(36, 8, 30, 12, r); b.text(70, 10, 'MIX', ACCENT.amber[0]);
    b.vline(63, 24, 30, t[0]); b.vline(64, 24, 30, t[3]);
    // glass vat
    b.rect(14, 28, 100, 134, OUT); b.rect(15, 29, 98, 132, mix(ACCENT.food[3], [0, 0, 0], 0.1));
    const cult = ramp('#a8b070');
    for (let y = 50; y < 161; y++) for (let x = 15; x < 113; x++) { const n = hash(x >> 1, y >> 1, 26); b.set(x, y, n < 0.2 ? cult[1] : n > 0.9 ? cult[3] : cult[2]); }
    b.hline(15, 50, 98, cult[4]);
    if (on) for (let k = 0; k < 10; k++) { const y = 156 - ((frame * 4 + k * 23) % 104); const x = 22 + (k * 37) % 84; b.set(x, y, cult[4]); b.set(x + 1, y, cult[4]); b.set(x, y - 1, cult[3]); }
    b.vline(18, 30, 130, [230, 240, 235]); b.vline(19, 30, 60, [200, 215, 210]); // glass glint
    for (const y of [28, 94, 160]) { b.rect(12, y, 104, 4, r[2]); b.hline(12, y, 104, r[4]); b.frame(12, y, 104, 4, OUT); }
    b.vline(12, 28, 136, OUT); b.vline(115, 28, 136, OUT);
    b.rect(114, 60, 12, 8, t[1]); b.frame(114, 60, 12, 8, OUT); // feed pipe
    b.rect(20, 120, 40, 12, OUT); b.text(22, 123, 'PROTEIN', ACCENT.food[0]);
    b.box(10, 164, 108, 14, r); b.rect(18, 178, 10, 14, t[0]); b.rect(100, 178, 10, 14, t[0]);
    b.gauge(100, 140, 8, on ? 0.55 : 0, r);
    b.wear(10, 2, 116, 190, 27, 0.08);
  },
};

// ---------------------------------------------------------------- rendering + cache
const cache = new Map();
const makeCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};

/** Build the pixel buffer for a fixture (no DOM needed; used by tests and the canvas cache). */
export function fixturePixels(kind, { a = '#a8acb0', b = '#6a6e72' } = {}, { on = true, frame = 0 } = {}) {
  const [mw, mh] = FIXTURE_SIZE[kind];
  const buf = new Buf(mw * M, mh * M);
  const blink = Math.floor(frame / 2) % 2 === 1;
  RECIPES[kind]({ b: buf, r: ramp(a), t: ramp(b), on, frame, blink });
  return buf;
}

function toCanvas(buf) {
  const cv = makeCanvas(buf.w, buf.h);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(buf.w, buf.h);
  buf.px.forEach((c, i) => { if (!c) return; img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255; });
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** Level of detail: average each f x f block, then snap to the nearest colour the art uses (stays crisp). */
export function reducePixels(buf, f) {
  const w = Math.floor(buf.w / f), h = Math.floor(buf.h / f);
  const used = [];
  const seen = new Set();
  for (const c of buf.px) if (c) { const k = c.join(); if (!seen.has(k)) { seen.add(k); used.push(c); } }
  const out = new Buf(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, bl = 0, n = 0, dark = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) {
      const c = buf.get(x * f + i, y * f + j);
      if (!c) continue;
      r += c[0]; g += c[1]; bl += c[2]; n++;
      if (c === OUT) dark++;
    }
    if (n * 2 < f * f) continue; // mostly transparent: leave it out
    if (dark * 2 >= n) { out.set(x, y, OUT); continue; } // keep outlines
    const avg = [r / n, g / n, bl / n];
    let best = used[0], bd = Infinity;
    for (const c of used) { const d = (c[0] - avg[0]) ** 2 + (c[1] - avg[1]) ** 2 + (c[2] - avg[2]) ** 2; if (d < bd) { bd = d; best = c; } }
    out.set(x, y, best);
  }
  return out;
}

export function fixtureCanvas(kind, v = {}, { on = true, frame = 0, tile = M } = {}) {
  const f2 = kind === 'grow_light' || kind === 'hepa' || kind === 'crank_scrubber' || kind === 'recycler' || kind === 'vat' || kind === 'tank' || kind === 'aquifer' || kind === 'sump' || kind === 'fridge' ? frame % 8 : 0;
  const key = `${kind}|${v.a}|${v.b}|${on}|${f2}|${tile}`;
  let cv = cache.get(key);
  if (!cv) {
    const buf = fixturePixels(kind, v, { on, frame: f2 });
    const f = Math.max(1, Math.round(M / tile));
    cv = toCanvas(f > 1 ? reducePixels(buf, f) : buf);
    if (cache.size > 600) cache.clear();
    cache.set(key, cv);
  }
  return cv;
}

export function drawFixture(ctx, kind, px, py, v, { on = true, frame = 0, flip = false, tile = 16 } = {}) {
  const cv = fixtureCanvas(kind, v, { on, frame, tile });
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (flip) { ctx.translate(px + cv.width, py); ctx.scale(-1, 1); ctx.drawImage(cv, 0, 0); } else ctx.drawImage(cv, px, py);
  ctx.restore();
}

export const hasFixture = (kind) => !!RECIPES[kind];
