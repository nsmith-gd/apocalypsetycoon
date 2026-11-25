// 64 px props (#117, reused by #118's amenity sprites). 64 px = 1 m, so a bed is about 32 px tall and a person
// about 115. Every prop stands on the floor line `fy` (its bottom row is fy - 1) starting at x, and is lit from the
// top-left. `o.frame` (0 or 1) drives the 2-frame animation; `o.accent` names a ramp for the prop's main colour.
//
//   PROPS.bunk.draw(raster, x, fy, { frame: 0 })      PROPS.bunk.w = its width in px
//   WALL_PROPS.painting.draw(raster, x, y, o)         wall props hang at (x, y) = their top-left

import { col, K, box, cyl, hcyl, screen, led, glowAt, hash, bayer, text } from './raster.js';

const legs = (b, x, y, w, h, ramp = 'steel', base = 2) => { box(b, x, y, 3, h, ramp, base, { bevel: false }); box(b, x + w - 3, y, 3, h, ramp, base, { bevel: false }); };
/** Contact shadow on the floor under a prop. */
export const shadow = (b, x, fy, w) => { for (let i = -2; i < w + 2; i++) for (let j = 0; j < 3; j++) if (bayer(x + i, fy + j) < 0.7 - j * 0.2) b.shift(x + i, fy + j, -2); };
const vents = (b, x, y, w, h, ramp, base, gap = 3) => { for (let j = 0; j < h; j += gap) { b.rect(x, y + j, w, 1, col(ramp, base - 2)); b.rect(x, y + j + 1, w, 1, col(ramp, base + 1)); } };
const rivets = (b, x, y, w, h, ramp, base, step = 10) => { for (let i = 3; i < w - 2; i += step) { b.set(x + i, y + 2, col(ramp, base + 2)); b.set(x + i, y + h - 3, col(ramp, base + 2)); } };
const fan = (b, cx, cy, r, frame, ramp = 'steel') => {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y);
    if (d > r) continue;
    if (d > r - 1.5) { b.set(cx + x, cy + y, K); continue; }
    const a = Math.atan2(y, x) + (frame ? Math.PI / 4 : 0);
    const blade = Math.cos(a * 4) > 0.35 && d > 2;
    b.set(cx + x, cy + y, col(ramp, blade ? 4 + (x < 0 ? 1 : 0) : 1));
  }
  b.rect(cx - 1, cy - 1, 3, 3, col(ramp, 6));
};
const gauge = (b, cx, cy, r, ramp = 'marble') => {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y); if (d <= r) b.set(cx + x, cy + y, d > r - 1 ? K : col(ramp, 5)); }
  b.set(cx, cy, K); b.set(cx + 1, cy - 1, col('red', 4)); b.set(cx + 2, cy - 2, col('red', 4));
};
const plantTuft = (b, x, y, w, h, s = 0) => {
  // foliage as overlapping leaf clumps, each lit from the top-left, with 2 px leaf clusters for texture
  const n = Math.max(3, Math.round((w * h) / 260));
  const clumps = Array.from({ length: n }, (_, i) => { const r = Math.max(5, Math.min(w, h) * (0.22 + hash(i, s, 7) * 0.16)); return { cx: x + r + hash(i, s, 3) * Math.max(1, w - 2 * r), cy: y + r + hash(i, s, 5) * Math.max(1, h - 2 * r), r }; });
  clumps.sort((a, c) => c.cy - a.cy); // back clumps first, front (lower) ones on top... top ones last so they read lit
  clumps.reverse();
  for (const c of clumps) for (let py = Math.floor(c.cy - c.r); py <= c.cy + c.r; py++) for (let px = Math.floor(c.cx - c.r); px <= c.cx + c.r; px++) {
    const dx = (px - c.cx) / c.r, dy = (py - c.cy) / c.r, d = Math.hypot(dx, dy);
    const edge = 1 - hash(px >> 1, py >> 1, s + 9) * 0.22;
    if (d > edge) continue;
    const lit = -dx * 0.8 - dy * 1.1 + (hash(px >> 1, py >> 1, s) - 0.5) * 0.9;
    b.set(px, py, d > edge - 0.08 && dy > 0 ? col('leaf', 1) : col('leaf', 3 + Math.max(-1, Math.min(2, Math.round(lit * 1.4)))));
  }
};
const book = ['red', 'water', 'gold', 'leaf', 'velvet', 'cloth'];
const books = (b, x, y, w, h, s) => { let i = x; let n = 0; while (i < x + w - 2) { const bw = 3 + Math.floor(hash(n, s, 1) * 3); const bh = h - Math.floor(hash(n, s, 2) * 5); box(b, i, y + h - bh, bw, bh, book[(n + s) % book.length], 3, { outline: false }); b.rect(i + bw - 1, y + h - bh, 1, bh, K); i += bw + 1; n++; } };

// --------------------------------------------------------------------------------------------- floor props
export const PROPS = {
  // ---------------- sleeping
  bunk: { w: 104, draw(b, x, fy, o) {
    const r = o.accent ?? 'cloth';
    shadow(b, x, fy, 104);
    for (const y of [fy - 46, fy - 112]) { box(b, x + 4, y + 18, 96, 8, 'steel', 3); box(b, x + 8, y + 6, 88, 12, r, 3); box(b, x + 10, y, 26, 10, 'plaster', 5); b.rect(x + 40, y + 9, 52, 2, col(r, 2)); }
    for (const px of [x, x + 100]) box(b, px, fy - 124, 4, 124, 'steel', 4);
    for (let y = fy - 100; y < fy - 50; y += 8) box(b, x + 96, y, 6, 2, 'steel', 5, { outline: false });
  } },
  bed: { w: 160, draw(b, x, fy, o) {
    const r = o.accent ?? 'cloth';
    shadow(b, x, fy, 160);
    box(b, x, fy - 70, 12, 70, 'walnut', 4); box(b, x + 148, fy - 34, 10, 34, 'walnut', 4);
    box(b, x + 6, fy - 26, 150, 16, 'walnut', 3); box(b, x + 12, fy - 40, 142, 16, 'plaster', 5);
    box(b, x + 50, fy - 44, 106, 22, r, 3); for (let i = 56; i < 150; i += 12) b.rect(x + i, fy - 40, 1, 16, col(r, 2));
    box(b, x + 16, fy - 52, 30, 14, 'plaster', 6);
  } },
  kingbed: { w: 200, draw(b, x, fy, o) {
    const r = o.accent ?? 'velvet';
    shadow(b, x, fy, 200);
    for (const px of [x + 2, x + 190]) { box(b, px, fy - 160, 8, 160, 'gold', 3); box(b, px - 2, fy - 166, 12, 8, 'gold', 5); }
    box(b, x, fy - 166, 200, 14, r, 4); for (let i = 4; i < 196; i += 10) { b.rect(x + i, fy - 152, 6, 3 + (i % 20 ? 0 : 3), col(r, 3)); }
    box(b, x + 12, fy - 100, 24, 100, 'walnut', 4); for (let j = fy - 92; j < fy - 20; j += 18) box(b, x + 16, j, 16, 12, 'gold', 4, { outline: false });
    box(b, x + 14, fy - 30, 176, 18, 'walnut', 4); box(b, x + 36, fy - 46, 150, 18, 'marble', 6);
    box(b, x + 80, fy - 50, 106, 26, r, 4); b.rect(x + 80, fy - 34, 106, 2, col('gold', 5));
    box(b, x + 40, fy - 60, 34, 16, 'marble', 6); box(b, x + 40, fy - 72, 30, 13, r, 5);
  } },
  medbed: { w: 160, draw(b, x, fy, o) {
    shadow(b, x, fy, 160);
    legs(b, x + 20, fy - 30, 120, 30); box(b, x + 14, fy - 38, 132, 8, 'steel', 5); box(b, x + 18, fy - 46, 124, 9, 'plaster', 6);
    box(b, x + 20, fy - 54, 26, 9, 'plaster', 6); box(b, x + 50, fy - 50, 88, 6, 'water', 5);
    box(b, x + 146, fy - 120, 3, 120, 'steel', 5); screen(b, x + 132, fy - 140, 26, 18, 'leaf', o.frame);
    for (let i = 0; i < 22; i++) b.set(x + 134 + i, fy - 132 + Math.round(Math.sin(i * 0.9 + (o.frame ? 1.5 : 0)) * (i % 7 === 3 ? 5 : 1)), col('leaf', 7), 1);
    box(b, x + 2, fy - 130, 3, 130, 'steel', 5); box(b, x - 4, fy - 132, 14, 22, 'water', 5);
  } },
  cryopod: { w: 80, draw(b, x, fy, o) {
    shadow(b, x, fy, 80);
    box(b, x, fy - 20, 80, 20, 'steel', 3); vents(b, x + 8, fy - 15, 30, 10, 'steel', 3); led(b, x + 60, fy - 12, 'water', o.frame, true, 3);
    box(b, x + 4, fy - 142, 72, 14, 'steel', 4); b.rect(x + 8, fy - 132, 64, 2, col('water', 6), 1);
    cyl(b, x + 8, fy - 128, 64, 108, 'water', 3, { outline: true });
    // the sleeper inside, frosted
    box(b, x + 30, fy - 120, 20, 16, 'skin', 3, { outline: false }); box(b, x + 26, fy - 104, 28, 64, 'cloth', 5, { outline: false });
    for (let j = fy - 124; j < fy - 26; j++) for (let i = x + 10; i < x + 70; i++) if (bayer(i, j) < 0.35 + (j > fy - 50 ? 0.3 : 0)) b.shift(i, j, 2);
    for (let i = 0; i < 14; i++) b.rect(x + 12 + Math.floor(hash(i, 4) * 54), fy - 124 + Math.floor(hash(i, 8) * 96), 2, 1, col('water', 6), 1);
    if (o.frame === 0) glowAt(b, x + 40, fy - 74, 40, 1.2);
    for (const px of [x + 2, x + 72]) box(b, px, fy - 130, 6, 110, 'steel', 5);
  } },
  // ---------------- storage, food, water
  shelf: { w: 96, draw(b, x, fy, o) {
    shadow(b, x, fy, 96);
    for (const px of [x, x + 92]) box(b, px, fy - 140, 4, 140, 'steel', 4);
    for (let k = 0; k < 4; k++) {
      const y = fy - 6 - k * 34; box(b, x + 4, y, 88, 4, 'steel', 5);
      for (let i = 6; i < 86;) { const t = (i * 7 + k * 3) % 5; const w = [14, 10, 18, 12, 16][t]; const h = [20, 14, 24, 18, 26][t]; const r = ['amber', 'red', 'cloth', 'leaf', 'plaster'][(t + k) % 5]; if (i + w > 88) break; if (t === 1 || t === 3) cyl(b, x + i, y - h, w, h, r, 3); else box(b, x + i, y - h, w, h, r === 'cloth' ? 'rust' : r, 3); i += w + 3; }
    }
  } },
  fridge: { w: 64, draw(b, x, fy, o) { shadow(b, x, fy, 64); box(b, x, fy - 130, 64, 130, 'steel', 5); b.rect(x + 2, fy - 86, 60, 2, K); box(b, x + 52, fy - 120, 4, 26, 'steel', 7); box(b, x + 52, fy - 76, 4, 40, 'steel', 7); led(b, x + 8, fy - 124, 'water', o.frame); } },
  tank: { w: 112, draw(b, x, fy, o) {
    shadow(b, x, fy, 112);
    legs(b, x + 10, fy - 16, 92, 16);
    cyl(b, x + 4, fy - 150, 104, 136, 'water', 2, { bands: 3 });
    box(b, x + 30, fy - 158, 52, 10, 'steel', 4); hcyl(b, x + 104, fy - 40, 10, 8, 'steel', 4);
    gauge(b, x + 76, fy - 110, 8); box(b, x + 18, fy - 120, 8, 80, 'steel', 2); b.rect(x + 20, fy - 84, 4, 42, col('water', 5), 1);
    text(b, 'H2O', x + 34, fy - 72, col('plaster', 5), 3, { worn: 0.15 });
  } },
  tanks: { w: 220, draw(b, x, fy, o) { PROPS.tank.draw(b, x, fy, o); PROPS.tank.draw(b, x + 108, fy, o); } },
  drum: { w: 40, draw(b, x, fy, o) { shadow(b, x, fy, 40); cyl(b, x, fy - 56, 40, 56, o.accent ?? 'red', 3, { bands: 2 }); text(b, '!', x + 17, fy - 36, col('hazard', 4)); } },
  drums: { w: 136, draw(b, x, fy, o) { for (let i = 0; i < 3; i++) PROPS.drum.draw(b, x + i * 46, fy, { ...o, accent: i === 1 ? 'hazard' : 'red' }); PROPS.drum.draw(b, x + 22, fy - 58, { ...o, accent: 'red' }); PROPS.drum.draw(b, x + 68, fy - 58, { ...o, accent: 'hazard' }); } },
  crates: { w: 120, draw(b, x, fy, o) {
    shadow(b, x, fy, 120);
    const c = (cx, cy, w, h) => { box(b, cx, cy, w, h, 'walnut', 4); b.rect(cx + 2, cy + 2, w - 4, 2, col('walnut', 3)); b.rect(cx + 2, cy + h - 4, w - 4, 2, col('walnut', 3)); for (let i = 0; i < w - 4; i++) b.set(cx + 2 + i, cy + 4 + Math.floor(((h - 8) * i) / (w - 4)), col('walnut', 2)); };
    c(x, fy - 44, 54, 44); c(x + 58, fy - 38, 46, 38); c(x + 12, fy - 84, 40, 40); text(b, 'MRE', x + 66, fy - 26, col('plaster', 3), 2, { worn: 0.2 });
  } },
  seedlocker: { w: 112, draw(b, x, fy, o) {
    shadow(b, x, fy, 112); box(b, x, fy - 140, 112, 140, 'steel', 4);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) { const px = x + 6 + c * 26, py = fy - 132 + r * 22; box(b, px, py, 22, 18, 'steel', 5); b.rect(px + 6, py + 12, 10, 2, col('steel', 2)); b.rect(px + 4, py + 3, 14, 5, col('plaster', 6)); b.set(px + 5 + ((r + c) % 10), py + 5, col('leaf', 4)); }
    led(b, x + 100, fy - 136, 'leaf', o.frame, true);
  } },
  winerack: { w: 112, draw(b, x, fy, o) {
    shadow(b, x, fy, 112); box(b, x, fy - 144, 112, 144, 'walnut', 3);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 6; c++) { const px = x + 6 + c * 17, py = fy - 138 + r * 17; b.rect(px, py, 15, 15, col('walnut', 1)); if (hash(r, c, 2) < 0.85) { b.rect(px + 3, py + 3, 9, 9, K); b.rect(px + 4, py + 4, 7, 7, col(['velvet', 'leaf', 'red'][(r + c) % 3], 2)); b.set(px + 5, py + 5, col('gold', 5)); } }
  } },
  barrel: { w: 64, draw(b, x, fy) { shadow(b, x, fy, 64); hcyl(b, x, fy - 56, 64, 56, 'walnut', 3); for (const i of [10, 50]) b.rect(x + i, fy - 56, 3, 56, col('steel', 3)); b.rect(x + 28, fy - 34, 8, 8, col('walnut', 1)); } },
  // ---------------- air, power and machines
  crank: { w: 80, draw(b, x, fy, o) {
    shadow(b, x, fy, 80); box(b, x, fy - 96, 64, 96, 'steel', 3); vents(b, x + 8, fy - 88, 48, 30, 'steel', 3); rivets(b, x, fy - 96, 64, 96, 'steel', 3);
    const a = o.frame ? 0.8 : 0; const cx = x + 66, cy = fy - 50;
    for (let t = 0; t < 6.28; t += 0.05) b.set(Math.round(cx + Math.cos(t) * 14), Math.round(cy + Math.sin(t) * 14), col('steel', 5));
    box(b, cx - 2, cy - 2, 4, 4, 'steel', 5); const hx = Math.round(cx + Math.cos(a) * 14), hy = Math.round(cy + Math.sin(a) * 14); box(b, hx, hy, 4, 10, 'red', 4);
    text(b, 'AIR', x + 14, fy - 46, col('hazard', 4), 3, { worn: 0.2 });
  } },
  hepa: { w: 128, draw(b, x, fy, o) {
    shadow(b, x, fy, 128); box(b, x, fy - 132, 128, 132, 'steel', 4); rivets(b, x, fy - 132, 128, 132, 'steel', 4);
    fan(b, x + 36, fy - 96, 22, o.frame); fan(b, x + 92, fy - 96, 22, o.frame);
    box(b, x + 10, fy - 58, 108, 44, 'steel', 3); vents(b, x + 14, fy - 54, 100, 36, 'teal', 5, 4);
    led(b, x + 112, fy - 126, 'leaf', o.frame, true); text(b, 'HEPA', x + 10, fy - 128, col('plaster', 5), 2);
  } },
  generator: { w: 160, draw(b, x, fy, o) {
    shadow(b, x, fy, 160); box(b, x, fy - 14, 160, 14, 'steel', 2);
    box(b, x + 6, fy - 92, 96, 78, 'hazard', 3); rivets(b, x + 6, fy - 92, 96, 78, 'hazard', 3); vents(b, x + 14, fy - 80, 60, 40, 'hazard', 3);
    box(b, x + 104, fy - 84, 52, 70, 'steel', 3); fan(b, x + 130, fy - 50, 22, o.frame);
    box(b, x + 24, fy - 132, 12, 40, 'steel', 3); box(b, x + 20, fy - 138, 20, 8, 'steel', 2);
    if (o.frame) for (let i = 0; i < 8; i++) b.rect(x + 24 + Math.floor(hash(i, 2) * 12), fy - 150 - i * 2, 3, 2, col('concrete', 4));
    screen(b, x + 72, fy - 74, 22, 12, 'amber', o.frame, { bars: false }); text(b, '12KW', x + 74, fy - 72, col('amber', 6), 1, { glow: 1 });
  } },
  battery: { w: 72, draw(b, x, fy, o) {
    shadow(b, x, fy, 72); box(b, x, fy - 140, 72, 140, 'steel', 2);
    for (let r = 0; r < 6; r++) { const py = fy - 134 + r * 22; box(b, x + 6, py, 60, 18, 'steel', 4); for (let k = 0; k < 4; k++) b.rect(x + 10 + k * 8, py + 6, 6, 6, col('leaf', k <= (r + o.frame) % 4 ? 5 : 2), k <= (r + o.frame) % 4 ? 1 : 0); led(b, x + 54, py + 7, 'water', o.frame + r, true); }
  } },
  recycler: { w: 160, draw(b, x, fy, o) {
    shadow(b, x, fy, 160); box(b, x, fy - 110, 96, 110, 'steel', 4); screen(b, x + 12, fy - 98, 40, 22, 'water', o.frame);
    cyl(b, x + 104, fy - 128, 52, 128, 'water', 3, { bands: 2 }); hcyl(b, x + 90, fy - 30, 18, 10, 'steel', 4); hcyl(b, x + 90, fy - 100, 18, 10, 'steel', 4);
    gauge(b, x + 76, fy - 50, 9); gauge(b, x + 30, fy - 50, 9); text(b, '90%', x + 14, fy - 26, col('water', 5), 2, { glow: 1 });
  } },
  sump: { w: 96, draw(b, x, fy, o) { shadow(b, x, fy, 96); box(b, x, fy - 30, 96, 30, 'steel', 2); cyl(b, x + 14, fy - 76, 40, 50, 'water', 3, { bands: 1 }); box(b, x + 58, fy - 60, 30, 34, 'steel', 4); fan(b, x + 73, fy - 44, 10, o.frame); hcyl(b, x + 22, fy - 96, 70, 10, 'steel', 4); box(b, x + 82, fy - 96, 10, 40, 'steel', 4); } },
  vat: { w: 88, draw(b, x, fy, o) {
    shadow(b, x, fy, 88); box(b, x, fy - 24, 88, 24, 'steel', 3); box(b, x + 4, fy - 144, 80, 12, 'steel', 4);
    cyl(b, x + 8, fy - 132, 72, 108, 'leaf', 3);
    for (let i = 0; i < 12; i++) { const bx = x + 14 + Math.floor(hash(i, 1) * 60), by = fy - 40 - ((Math.floor(hash(i, 3) * 90) + (o.frame ? 12 : 0)) % 90); b.rect(bx, by, 3, 3, col('leaf', 6), 1); }
    glowAt(b, x + 44, fy - 80, 40, 1.1); hcyl(b, x + 80, fy - 120, 14, 8, 'steel', 4);
  } },
  reactor: { w: 300, draw(b, x, fy, o) {
    shadow(b, x, fy, 300); box(b, x, fy - 30, 300, 30, 'concrete', 3);
    for (let i = 0; i < 300; i += 24) b.rect(x + i, fy - 30, 12, 6, col('hazard', 4));
    cyl(b, x + 70, fy - 300, 160, 270, 'steel', 3, { bands: 5 });
    box(b, x + 110, fy - 220, 80, 120, 'K', 0); for (let j = 0; j < 116; j++) for (let i = 0; i < 76; i++) b.set(x + 112 + i, fy - 218 + j, col('water', 4 + (bayer(i, j) < 0.3 + Math.sin((i + j + o.frame * 3) * 0.2) * 0.2 ? 2 : 0)), 1);
    for (let k = 0; k < 5; k++) box(b, x + 120 + k * 14, fy - 210, 6, 100, 'steel', 5);
    glowAt(b, x + 150, fy - 160, 110, 1.6);
    box(b, x + 6, fy - 130, 56, 100, 'steel', 3); screen(b, x + 12, fy - 120, 44, 26, 'leaf', o.frame); gauge(b, x + 22, fy - 70, 9); gauge(b, x + 46, fy - 70, 9);
    box(b, x + 238, fy - 130, 56, 100, 'steel', 3); for (let k = 0; k < 6; k++) led(b, x + 248 + (k % 3) * 14, fy - 116 + Math.floor(k / 3) * 14, k === 5 ? 'red' : 'leaf', o.frame + k, k === 5, 4);
    text(b, '500 KW', x + 108, fy - 286, col('hazard', 5), 3);
  } },
  geothermal: { w: 240, draw(b, x, fy, o) {
    shadow(b, x, fy, 240); hcyl(b, x + 20, fy - 120, 150, 90, 'steel', 3); for (let k = 1; k < 6; k++) b.rect(x + 20 + k * 25, fy - 120, 2, 90, col('steel', 1));
    box(b, x + 170, fy - 110, 64, 110, 'steel', 4); screen(b, x + 180, fy - 98, 44, 26, 'amber', o.frame); gauge(b, x + 192, fy - 50, 10); gauge(b, x + 216, fy - 50, 10);
    box(b, x + 40, fy - 30, 20, 30, 'rust', 3); box(b, x + 130, fy - 30, 20, 30, 'rust', 3); box(b, x, fy - 80, 20, 80, 'rust', 4);
    for (let i = 0; i < 10; i++) b.rect(x + 4 + Math.floor(hash(i, o.frame) * 12), fy - 100 - i * 5, 4, 3, col('plaster', 5 - (i >> 2)));
    glowAt(b, x + 95, fy - 4, 40, 1.4);
  } },
  boiler: { w: 136, draw(b, x, fy, o) {
    shadow(b, x, fy, 136); cyl(b, x + 6, fy - 140, 90, 140, 'rust', 3, { bands: 3 }); box(b, x + 36, fy - 50, 30, 24, 'K', 0);
    for (let j = 0; j < 20; j++) for (let i = 0; i < 26; i++) b.set(x + 38 + i, fy - 48 + j, col('amber', 3 + (bayer(i, j + o.frame) < 0.5 ? 2 : 1)), 1);
    glowAt(b, x + 51, fy - 38, 30, 1.5); gauge(b, x + 50, fy - 110, 10); box(b, x + 100, fy - 120, 30, 120, 'steel', 3); vents(b, x + 104, fy - 112, 22, 60, 'steel', 3);
  } },
  kiln: { w: 112, draw(b, x, fy, o) {
    shadow(b, x, fy, 112); box(b, x, fy - 112, 112, 112, 'concrete', 4); for (let j = 0; j < 112; j += 12) for (let i = (j / 12) % 2 ? 0 : 14; i < 112; i += 28) b.rect(x + i, fy - 112 + j, 1, 12, col('concrete', 2));
    box(b, x + 30, fy - 70, 52, 44, 'K', 0); for (let j = 0; j < 40; j++) for (let i = 0; i < 48; i++) b.set(x + 32 + i, fy - 68 + j, col('amber', 4 + (bayer(i + o.frame, j) < 0.4 ? 2 : 0)), 1);
    glowAt(b, x + 56, fy - 48, 44, 1.6); box(b, x + 40, fy - 140, 32, 28, 'concrete', 3);
  } },
  emp: { w: 112, draw(b, x, fy, o) {
    shadow(b, x, fy, 112); box(b, x + 16, fy - 24, 80, 24, 'steel', 3); cyl(b, x + 44, fy - 120, 24, 96, 'rust', 4, { bands: 10 }); box(b, x + 30, fy - 140, 52, 20, 'steel', 5);
    if (o.frame) for (let i = 0; i < 26; i++) { const a = hash(i, 9) * 6.28; b.rect(Math.round(x + 56 + Math.cos(a) * (20 + i)), Math.round(fy - 130 + Math.sin(a) * (10 + i / 2)), 2, 2, col('neon', 4), 1); }
    glowAt(b, x + 56, fy - 130, 40, o.frame ? 1.8 : 0.8);
  } },
  condenser: { w: 120, draw(b, x, fy, o) {
    shadow(b, x, fy, 120); box(b, x, fy - 120, 120, 120, 'steel', 4); for (let i = 8; i < 112; i += 6) box(b, x + i, fy - 112, 3, 70, 'steel', 6, { outline: false });
    fan(b, x + 34, fy - 22, 16, o.frame); cyl(b, x + 64, fy - 40, 48, 36, 'water', 3); text(b, '2000L', x + 64, fy - 36, col('water', 6), 1, { glow: 1 });
  } },
  // ---------------- kitchens, seating, rec
  stove: { w: 136, draw(b, x, fy, o) {
    shadow(b, x, fy, 136); box(b, x, fy - 56, 136, 56, 'steel', 5); box(b, x - 2, fy - 60, 140, 6, 'steel', 6);
    box(b, x + 10, fy - 44, 50, 34, 'steel', 2); b.rect(x + 14, fy - 40, 42, 2, col('amber', 4), 1);
    for (const i of [76, 106]) { box(b, x + i, fy - 72, 22, 12, 'steel', 3); if (o.frame === 0) b.rect(x + i + 8, fy - 84, 2, 8, col('plaster', 5)); }
    box(b, x + 6, fy - 154, 124, 24, 'steel', 5); b.rect(x + 20, fy - 132, 96, 2, col('steel', 2));
  } },
  range: { w: 200, draw(b, x, fy, o) { PROPS.stove.draw(b, x, fy, o); box(b, x + 138, fy - 56, 62, 56, 'marble', 5); box(b, x + 136, fy - 62, 66, 6, 'gold', 5); for (let i = 0; i < 4; i++) box(b, x + 146 + i * 12, fy - 92 + (i % 2) * 8, 8, 24 - (i % 2) * 8, ['steel', 'gold'][i % 2], 4); } },
  sofa: { w: 152, draw(b, x, fy, o) {
    const r = o.accent ?? 'cloth'; shadow(b, x, fy, 152);
    box(b, x + 8, fy - 64, 136, 30, r, 3); box(b, x, fy - 44, 18, 36, r, 4); box(b, x + 134, fy - 44, 18, 36, r, 2);
    box(b, x + 14, fy - 36, 124, 20, r, 4); b.rect(x + 76, fy - 36, 1, 20, col(r, 2)); legs(b, x + 6, fy - 8, 140, 8, 'walnut', 3);
    box(b, x + 26, fy - 56, 22, 18, 'gold', 4);
  } },
  armchair: { w: 72, draw(b, x, fy, o) { const r = o.accent ?? 'velvet'; shadow(b, x, fy, 72); box(b, x + 8, fy - 70, 56, 40, r, 3); box(b, x, fy - 44, 14, 36, r, 4); box(b, x + 58, fy - 44, 14, 36, r, 2); box(b, x + 12, fy - 32, 48, 18, r, 4); legs(b, x + 4, fy - 8, 64, 8, 'walnut', 3); for (let i = 16; i < 60; i += 10) b.set(x + i, fy - 56, col('gold', 5)); } },
  table: { w: 120, draw(b, x, fy, o) { shadow(b, x, fy, 120); box(b, x, fy - 48, 120, 8, o.accent ?? 'walnut', 4); legs(b, x + 6, fy - 40, 108, 40, o.accent ?? 'walnut', 3); } },
  desk: { w: 136, draw(b, x, fy, o) { PROPS.table.draw(b, x, fy, o); screen(b, x + 70, fy - 84, 44, 28, 'water', o.frame); box(b, x + 88, fy - 54, 8, 6, 'steel', 3); box(b, x + 6, fy - 40, 40, 36, o.accent ?? 'walnut', 3); } },
  washer: { w: 64, draw(b, x, fy, o) { shadow(b, x, fy, 64); box(b, x, fy - 72, 60, 72, 'plaster', 6); for (let t = 0; t < 6.28; t += 0.04) b.set(Math.round(x + 30 + Math.cos(t) * 18), Math.round(fy - 32 + Math.sin(t) * 18), col('steel', 4)); for (let j = -16; j < 17; j++) for (let i = -16; i < 17; i++) if (i * i + j * j < 256) b.set(x + 30 + i, fy - 32 + j, col('water', 3 + ((i + j + o.frame * 6) % 12 > 6 ? 1 : 0))); b.rect(x + 6, fy - 66, 16, 4, col('steel', 4)); led(b, x + 48, fy - 66, 'leaf', o.frame, true); } },
  gymrig: { w: 136, draw(b, x, fy, o) {
    shadow(b, x, fy, 136); box(b, x + 4, fy - 150, 6, 150, 'steel', 4); box(b, x + 126, fy - 150, 6, 150, 'steel', 3); box(b, x + 4, fy - 150, 128, 6, 'steel', 5);
    box(b, x + 16, fy - 92, 104, 4, 'steel', 6); for (const i of [20, 104]) box(b, x + i, fy - 102, 12, 24, 'red', 3);
    box(b, x + 50, fy - 24, 40, 10, 'cloth', 3); legs(b, x + 50, fy - 14, 40, 14);
  } },
  treadmill: { w: 112, draw(b, x, fy, o) { shadow(b, x, fy, 112); box(b, x, fy - 14, 112, 14, 'steel', 2); b.rect(x + 4, fy - 12, 104, 3, col('steel', o.frame ? 1 : 3)); box(b, x + 92, fy - 90, 6, 76, 'steel', 4); box(b, x + 76, fy - 96, 30, 14, 'steel', 3); screen(b, x + 80, fy - 94, 20, 8, 'leaf', o.frame, { bars: false }); } },
  bookshelf: { w: 96, draw(b, x, fy, o) { shadow(b, x, fy, 96); box(b, x, fy - 150, 96, 150, 'walnut', 3); for (let k = 0; k < 5; k++) { const y = fy - 144 + k * 29; books(b, x + 5, y, 86, 24, k + Math.floor(x)); b.rect(x + 4, y + 24, 88, 3, col('walnut', 4)); } } },
  pooltable: { w: 160, draw(b, x, fy, o) { shadow(b, x, fy, 160); box(b, x, fy - 52, 160, 14, 'walnut', 4); b.rect(x + 6, fy - 52, 148, 4, col('emerald', 4)); legs(b, x + 10, fy - 38, 140, 38, 'walnut', 3); box(b, x + 70, fy - 44, 24, 24, 'walnut', 3); b.rect(x + 40, fy - 56, 4, 4, col('plaster', 6)); b.rect(x + 100, fy - 56, 4, 4, col('red', 5)); b.rect(x + 108, fy - 56, 4, 4, col('gold', 5)); } },
  tv: { w: 140, draw(b, x, fy, o) { PROPS.table.draw(b, x + 10, fy, { accent: 'walnut' }); screen(b, x + 10, fy - 120, 120, 64, 'water', o.frame); box(b, x + 64, fy - 56, 12, 8, 'steel', 2); } },
  piano: { w: 176, draw(b, x, fy, o) { shadow(b, x, fy, 176); box(b, x, fy - 70, 176, 34, 'K', 0); box(b, x + 2, fy - 68, 172, 30, 'cloth', 1); for (let k = 0; k < 6; k++) b.rect(x + 20 + k * 22, fy - 66, 10, 1, col('cloth', 4)); for (let i = 0; i < 60; i++) b.set(x + 8 + i * 2, fy - 104 + Math.round(i * 0.55), col('cloth', 3)); box(b, x + 10, fy - 44, 60, 6, 'marble', 6); legs(b, x + 6, fy - 36, 164, 36, 'cloth', 2); box(b, x + 8, fy - 108, 3, 40, 'gold', 4); } },
  plant: { w: 48, draw(b, x, fy, o) { shadow(b, x, fy, 48); box(b, x + 10, fy - 30, 28, 30, o.accent ?? 'rust', 3); plantTuft(b, x, fy - 80, 48, 52, Math.floor(x)); } },
  tree: { w: 120, draw(b, x, fy, o) { box(b, x + 52, fy - 150, 16, 150, 'walnut', 3); plantTuft(b, x, fy - 250, 120, 120, Math.floor(x)); plantTuft(b, x + 16, fy - 280, 90, 70, Math.floor(x) + 1); } },
  bench: { w: 128, draw(b, x, fy, o) { shadow(b, x, fy, 128); box(b, x, fy - 34, 128, 8, o.accent ?? 'walnut', 5); legs(b, x + 8, fy - 26, 112, 26, o.accent ?? 'walnut', 3); } },
  // ---------------- labs, tech, security
  labbench: { w: 152, draw(b, x, fy, o) {
    shadow(b, x, fy, 152); box(b, x, fy - 52, 152, 8, 'steel', 6); box(b, x + 4, fy - 44, 144, 44, 'steel', 4); for (let i = 0; i < 3; i++) { b.rect(x + 8 + i * 48, fy - 40, 42, 36, col('steel', 3)); b.rect(x + 25 + i * 48, fy - 24, 8, 2, col('steel', 6)); }
    for (const [i, r] of [[10, 'leaf'], [30, 'neon'], [48, 'water']]) { box(b, x + i, fy - 72, 12, 20, 'water', 5); b.rect(x + i + 1, fy - 62, 10, 9, col(r, 5), 1); }
    box(b, x + 96, fy - 100, 10, 48, 'steel', 3); box(b, x + 86, fy - 104, 30, 10, 'steel', 4); box(b, x + 84, fy - 60, 34, 8, 'steel', 2);
    screen(b, x + 124, fy - 96, 22, 32, 'teal', o.frame);
  } },
  servers: { w: 104, draw(b, x, fy, o) { shadow(b, x, fy, 104); for (let k = 0; k < 2; k++) { box(b, x + k * 54, fy - 150, 50, 150, 'steel', 2); for (let r = 0; r < 12; r++) { const y = fy - 144 + r * 12; b.rect(x + k * 54 + 4, y, 42, 9, col('steel', 3)); led(b, x + k * 54 + 36, y + 3, (r + k) % 5 ? 'leaf' : 'amber', o.frame + r, (r * 3 + k) % 4 === 0, 2); b.rect(x + k * 54 + 6, y + 4, 20, 1, col('steel', 1)); } } } },
  tapes: { w: 96, draw(b, x, fy, o) { shadow(b, x, fy, 96); box(b, x, fy - 140, 96, 140, 'cloth', 3); for (const [cx, cy] of [[28, -110], [68, -110]]) { for (let t = 0; t < 6.28; t += 0.03) for (let r = 4; r < 16; r += 3) b.set(Math.round(x + cx + Math.cos(t + o.frame) * r), Math.round(fy + cy + Math.sin(t + o.frame) * r), col('cloth', r % 2 ? 1 : 2)); box(b, x + cx - 3, fy + cy - 3, 6, 6, 'steel', 6); } box(b, x + 10, fy - 76, 76, 40, 'cloth', 4); for (let i = 0; i < 6; i++) led(b, x + 16 + i * 11, fy - 64, i % 2 ? 'amber' : 'red', o.frame + i, i === 3, 3); } },
  gunlocker: { w: 96, draw(b, x, fy, o) {
    shadow(b, x, fy, 96); box(b, x, fy - 144, 96, 144, 'steel', 2);
    for (let i = 0; i < 5; i++) { const gx = x + 12 + i * 16; box(b, gx, fy - 130, 5, 90, 'cloth', 1); box(b, gx - 2, fy - 60, 9, 26, 'walnut', 3); }
    for (let j = fy - 138; j < fy - 30; j += 6) for (let i = x + 4; i < x + 92; i += 6) b.set(i, j, col('steel', 5));
    box(b, x + 4, fy - 24, 88, 18, 'steel', 3); text(b, 'ARMS', x + 32, fy - 20, col('hazard', 4), 2);
  } },
  guardpost: { w: 120, draw(b, x, fy, o) { PROPS.desk.draw(b, x, fy, { ...o, accent: 'steel' }); screen(b, x + 10, fy - 126, 40, 26, 'leaf', o.frame); screen(b, x + 56, fy - 126, 40, 26, 'leaf', o.frame + 1); } },
  camera: { w: 48, draw(b, x, fy, o) { for (const [dx, dy] of [[-14, 0], [0, 0], [14, 0]]) for (let j = 0; j < 70; j++) b.set(x + 22 + Math.round((dx * j) / 70), fy - 70 + j + dy, col('steel', 4)); box(b, x + 6, fy - 96, 36, 24, 'cloth', 2); box(b, x + 40, fy - 90, 8, 12, 'cloth', 4); led(b, x + 10, fy - 92, 'red', o.frame, true); } },
  console: { w: 144, draw(b, x, fy, o) {
    shadow(b, x, fy, 144); box(b, x, fy - 56, 144, 56, 'steel', 3); box(b, x + 4, fy - 64, 136, 10, 'steel', 5);
    for (let i = 0; i < 8; i++) { b.rect(x + 10 + i * 16, fy - 46, 10, 6, col(i % 3 ? 'steel' : 'amber', i % 3 ? 5 : 5), i % 3 ? 0 : 1); gauge(b, x + 15 + i * 16, fy - 24, 5); }
    screen(b, x + 20, fy - 110, 104, 40, o.accent ?? 'amber', o.frame);
  } },
  mic: { w: 40, draw(b, x, fy, o) { box(b, x + 18, fy - 100, 4, 100, 'steel', 4); box(b, x + 10, fy - 4, 20, 4, 'steel', 3); box(b, x + 12, fy - 118, 16, 22, 'cloth', 3); for (let j = fy - 114; j < fy - 100; j += 3) b.rect(x + 14, j, 12, 1, col('cloth', 5)); } },
  medkit: { w: 64, draw(b, x, fy, o) { shadow(b, x, fy, 64); box(b, x, fy - 110, 64, 110, 'plaster', 6); for (let j = 0; j < 3; j++) b.rect(x + 4, fy - 74 + j * 24, 56, 2, col('plaster', 4)); box(b, x + 22, fy - 100, 20, 20, 'red', 4); b.rect(x + 30, fy - 98, 4, 16, col('plaster', 6)); b.rect(x + 24, fy - 92, 16, 4, col('plaster', 6)); } },
  decon: { w: 96, draw(b, x, fy, o) {
    shadow(b, x, fy, 96); box(b, x, fy - 156, 96, 10, 'steel', 4); for (let i = 0; i < 6; i++) b.rect(x + 8 + i * 15, fy - 146, 6, 4, col('steel', 2));
    for (let j = fy - 146; j < fy - 6; j++) for (let i = x + 4; i < x + 92; i++) if (bayer(i, j) < 0.12) b.shift(i, j, 2);
    if (o.frame === 0) for (let k = 0; k < 40; k++) b.rect(x + 8 + Math.floor(hash(k, 1) * 80), fy - 140 + Math.floor(hash(k, 2) * 130), 1, 3, col('water', 5), 1);
    for (const px of [x, x + 92]) box(b, px, fy - 146, 4, 146, 'hazard', 4); box(b, x, fy - 8, 96, 8, 'steel', 3); for (let i = 0; i < 96; i += 12) b.rect(x + i, fy - 8, 6, 8, col('hazard', 4));
  } },
  // ---------------- status and delusion
  cinemaseats: { w: 240, draw(b, x, fy, o) { for (let i = 0; i < 3; i++) PROPS.armchair.draw(b, x + i * 82, fy, { ...o, accent: 'red' }); } },
  statue: { w: 64, draw(b, x, fy, o) { shadow(b, x, fy, 64); box(b, x + 6, fy - 40, 52, 40, 'marble', 4); box(b, x + 2, fy - 44, 60, 6, 'marble', 5); box(b, x + 22, fy - 108, 22, 64, 'marble', 5); box(b, x + 24, fy - 132, 18, 22, 'marble', 5); box(b, x + 14, fy - 100, 8, 34, 'marble', 4); box(b, x + 44, fy - 100, 8, 24, 'marble', 4); box(b, x + 26, fy - 138, 14, 6, 'gold', 5); } },
  pedestal: { w: 56, draw(b, x, fy, o) { shadow(b, x, fy, 56); box(b, x + 6, fy - 70, 44, 70, 'marble', 5); box(b, x + 2, fy - 74, 52, 6, 'gold', 4); for (let j = fy - 112; j < fy - 74; j++) for (let i = x + 8; i < x + 48; i++) if (bayer(i, j) < 0.15) b.shift(i, j, 2); b.rect(x + 8, fy - 112, 40, 1, col('steel', 6)); box(b, x + 20, fy - 98, 16, 22, o.accent ?? 'gold', 5); } },
  crib: { w: 104, draw(b, x, fy, o) { shadow(b, x, fy, 104); box(b, x, fy - 64, 104, 6, 'gold', 5); box(b, x, fy - 14, 104, 6, 'gold', 4); for (let i = 4; i < 104; i += 10) box(b, x + i, fy - 58, 3, 44, 'plaster', 6); legs(b, x + 2, fy - 8, 100, 8, 'gold', 4); box(b, x + 30, fy - 110, 3, 46, 'gold', 4); for (let k = 0; k < 4; k++) box(b, x + 18 + k * 10, fy - 104 + (k % 2) * 8, 6, 6, ['velvet', 'water', 'gold', 'leaf'][k], 5); } },
  car: { w: 256, draw(b, x, fy, o) {
    shadow(b, x, fy, 256); const r = o.accent ?? 'gold';
    for (let i = 0; i < 248; i++) { const t = i / 248; const top = Math.round(36 - Math.max(0, Math.sin(Math.min(1, Math.max(0, (t - 0.25) / 0.5)) * Math.PI)) * 30); for (let j = top; j < 62; j++) b.set(x + 4 + i, fy - 70 + j, col(r, j < top + 2 ? 6 : j < 44 ? 4 : 3)); b.set(x + 4 + i, fy - 70 + top - 1, K); }
    for (let i = 0; i < 90; i++) for (let j = 0; j < 18; j++) if (j > 18 - (i < 45 ? i : 90 - i)) b.set(x + 84 + i, fy - 58 + j, col('water', 2 + (i < 30 ? 2 : 0)));
    for (const wx of [56, 196]) { for (let j = -16; j <= 16; j++) for (let i = -16; i <= 16; i++) { const d = Math.hypot(i, j); if (d <= 16) b.set(x + wx + i, fy - 18 + j, d > 15 ? K : d > 9 ? col('cloth', 1) : col('steel', 6 - Math.round(d / 4))); } }
    b.rect(x + 238, fy - 40, 10, 6, col('amber', 6), 1); b.rect(x + 4, fy - 40, 8, 6, col('red', 5), 1);
  } },
  sarcophagus: { w: 168, draw(b, x, fy, o) { shadow(b, x, fy, 168); box(b, x, fy - 40, 168, 40, 'marble', 3); box(b, x + 8, fy - 70, 152, 32, 'gold', 4); for (let i = 16; i < 152; i += 14) b.rect(x + i, fy - 64, 6, 20, col('gold', 2)); box(b, x + 20, fy - 82, 50, 14, 'gold', 5); box(b, x + 26, fy - 92, 14, 12, 'gold', 5); text(b, 'ME', x + 112, fy - 26, col('gold', 5), 3); } },
  throne: { w: 168, draw(b, x, fy, o) {
    box(b, x, fy - 20, 168, 20, 'velvet', 4); box(b, x + 14, fy - 32, 140, 14, 'marble', 5); shadow(b, x + 20, fy - 32, 128);
    box(b, x + 48, fy - 176, 72, 144, 'gold', 4); box(b, x + 56, fy - 160, 56, 100, 'velvet', 4); for (let k = 0; k < 5; k++) box(b, x + 50 + k * 16, fy - 196 + (k % 2 ? 6 : 0), 8, 22, 'gold', 5);
    box(b, x + 40, fy - 80, 20, 48, 'gold', 4); box(b, x + 108, fy - 80, 20, 48, 'gold', 3); box(b, x + 58, fy - 64, 52, 18, 'velvet', 5); b.rect(x + 80, fy - 150, 8, 8, col('red', 5), 1);
  } },
  portrait: { w: 0, draw() {} },
  clonetube: { w: 64, draw(b, x, fy, o) {
    shadow(b, x, fy, 64); box(b, x, fy - 16, 64, 16, 'steel', 3); box(b, x + 4, fy - 128, 56, 10, 'steel', 4);
    cyl(b, x + 8, fy - 118, 48, 102, 'teal', 3); const dy = o.frame ? -2 : 0;
    box(b, x + 18, fy - 62 + dy, 28, 16, 'plaster', 4, { outline: false }); box(b, x + 40, fy - 72 + dy, 12, 12, 'plaster', 4, { outline: false }); b.rect(x + 44, fy - 76 + dy, 3, 5, col('plaster', 3)); for (const i of [20, 40]) b.rect(x + i, fy - 46 + dy, 3, 8, col('plaster', 3)); b.rect(x + 12, fy - 58 + dy, 6, 3, col('plaster', 3));
    glowAt(b, x + 32, fy - 66, 32, 1);
  } },
  vials: { w: 96, draw(b, x, fy, o) { shadow(b, x, fy, 96); box(b, x, fy - 150, 96, 150, 'steel', 2); for (let r = 0; r < 7; r++) for (let c = 0; c < 8; c++) { const px = x + 6 + c * 11, py = fy - 142 + r * 20; b.rect(px, py, 6, 16, K); const on = hash(r, c, o.frame) < 0.85; b.rect(px + 1, py + 6, 4, 9, col(['leaf', 'neon', 'water', 'red'][(r + c) % 4], on ? 5 : 3), on ? 1 : 0); } glowAt(b, x + 48, fy - 76, 50, 0.8); } },
  truck: { w: 256, draw(b, x, fy, o) {
    shadow(b, x, fy, 256); box(b, x, fy - 110, 170, 86, 'concrete', 4); for (let i = 10; i < 170; i += 20) b.rect(x + i, fy - 106, 2, 78, col('concrete', 2)); text(b, 'LAST RESORT', x + 40, fy - 80, col('gold', 4), 2, { worn: 0.1 });
    box(b, x + 172, fy - 96, 76, 72, 'hazard', 3); box(b, x + 200, fy - 90, 40, 26, 'water', 3); box(b, x + 172, fy - 30, 84, 8, 'steel', 2);
    for (const wx of [40, 130, 210]) for (let j = -18; j <= 18; j++) for (let i = -18; i <= 18; i++) { const d = Math.hypot(i, j); if (d <= 18) b.set(x + wx + i, fy - 18 + j, d > 17 ? K : d > 10 ? col('cloth', 1) : col('steel', 5 - Math.round(d / 4))); }
    b.rect(x + 246, fy - 50, 8, 8, col('amber', 6), 1);
  } },
  radiomast: { w: 64, draw(b, x, fy, o) { box(b, x + 28, fy - 250, 8, 250, 'steel', 4); for (let j = fy - 240; j < fy; j += 20) { for (let i = 0; i < 20; i++) b.set(x + 28 - i + 14, j + i, col('steel', 3)); } box(b, x + 8, fy - 260, 48, 10, 'steel', 5); led(b, x + 30, fy - 270, 'red', o.frame, true, 4); if (o.frame === 0) glowAt(b, x + 32, fy - 268, 20, 1.6); } },
  solar: { w: 96, draw(b, x, fy, o) { box(b, x + 44, fy - 200, 8, 200, 'steel', 4); for (let k = 0; k < 2; k++) { const y = fy - 220 + k * 60; box(b, x, y, 96, 40, 'water', 2); for (let i = 0; i < 96; i += 16) b.rect(x + i, y, 1, 40, col('water', 4)); b.rect(x, y + 20, 96, 1, col('water', 4)); b.rect(x + 4, y + 3, 40, 2, col('water', 6)); } } },
  helicopter: { w: 220, draw(b, x, fy, o) {
    shadow(b, x, fy, 220); box(b, x + 40, fy - 56, 90, 46, 'cloth', 2); box(b, x + 50, fy - 50, 36, 22, 'water', 4); box(b, x + 128, fy - 44, 80, 10, 'cloth', 2); box(b, x + 200, fy - 60, 10, 24, 'cloth', 2);
    box(b, x + 40, fy - 8, 100, 4, 'steel', 4); box(b, x + 80, fy - 66, 8, 10, 'steel', 3); b.rect(x + (o.frame ? 0 : 30), fy - 70, o.frame ? 170 : 110, 3, col('steel', 2)); b.rect(x + 98, fy - 6, 4, 4, col('gold', 5));
  } },
  pool: { w: 0, draw() {} },
  toilet: { w: 48, draw(b, x, fy, o) { shadow(b, x, fy, 48); box(b, x + 4, fy - 76, 26, 34, 'marble', 6); box(b, x, fy - 42, 44, 14, 'marble', 6); box(b, x + 8, fy - 28, 28, 28, 'marble', 5); } },
  sink: { w: 56, draw(b, x, fy, o) { shadow(b, x, fy, 56); box(b, x, fy - 52, 56, 12, 'marble', 6); box(b, x + 18, fy - 40, 20, 40, 'marble', 5); box(b, x + 24, fy - 70, 6, 18, o.accent ?? 'steel', 6); box(b, x + 24, fy - 70, 18, 5, o.accent ?? 'steel', 6); } },
  shower: { w: 72, draw(b, x, fy, o) { box(b, x, fy - 8, 72, 8, 'marble', 4); box(b, x + 60, fy - 150, 6, 142, 'steel', 5); box(b, x + 30, fy - 150, 36, 6, 'steel', 5); box(b, x + 26, fy - 146, 16, 6, 'steel', 6); if (o.frame === 0) for (let k = 0; k < 24; k++) b.rect(x + 26 + Math.floor(hash(k, 3) * 18), fy - 136 + Math.floor(hash(k, 5) * 126), 1, 3, col('water', 5), 1); } },
  fishtank: { w: 136, draw(b, x, fy, o) {
    shadow(b, x, fy, 136); legs(b, x + 4, fy - 30, 128, 30); box(b, x, fy - 110, 136, 80, 'water', 3);
    for (let j = 0; j < 78; j++) for (let i = 0; i < 134; i++) if (bayer(i, j) < 0.1) b.shift(x + 1 + i, fy - 109 + j, 1);
    plantTuft(b, x + 6, fy - 70, 26, 38, 4); plantTuft(b, x + 100, fy - 60, 28, 28, 8);
    for (let k = 0; k < 6; k++) { const fx = x + 20 + ((k * 23 + (o.frame ? 6 : 0)) % 96), fy2 = fy - 96 + k * 10; box(b, fx, fy2, 8, 4, k % 2 ? 'amber' : 'gold', 5, { outline: false }); b.set(fx - 1, fy2 + 1, col('amber', 4)); }
    b.rect(x, fy - 112, 136, 3, col('steel', 5));
  } },
  growrack: { w: 128, draw(b, x, fy, o) {
    shadow(b, x, fy, 128); for (const px of [x, x + 124]) box(b, px, fy - 150, 4, 150, 'steel', 4);
    for (let k = 0; k < 3; k++) { const y = fy - 10 - k * 48; box(b, x + 4, y, 120, 6, 'steel', 5); for (let i = 0; i < 6; i++) plantTuft(b, x + 8 + i * 19, y - 28, 16, 28, k * 10 + i); box(b, x + 8, y - 46, 112, 4, 'neon', 4); b.rect(x + 10, y - 42, 108, 1, col('neon', 4), 1); }
    for (let k = 0; k < 3; k++) for (let j = 0; j < 20; j++) for (let i = 0; i < 112; i++) if (bayer(x + i, j) < 0.25 - j * 0.012) b.set(x + 8 + i, fy - 52 - k * 48 + j, col('neon', 3), 1);
  } },
  chandelierFloor: { w: 0, draw() {} },
  grandstair: { w: 200, draw(b, x, fy, o) { for (let k = 0; k < 10; k++) { box(b, x + k * 20, fy - 14 - k * 14, 200 - k * 20, 14, 'marble', 5 - (k % 2)); b.rect(x + k * 20, fy - 14 - k * 14, 200 - k * 20, 3, col('velvet', 4)); } for (let k = 0; k < 10; k++) box(b, x + k * 20 + 4, fy - 50 - k * 14, 3, 36, 'gold', 5); } },
  column: { w: 40, draw(b, x, fy, o) { box(b, x, fy - 12, 40, 12, 'marble', 5); cyl(b, x + 6, fy - 280, 28, 268, 'marble', 4); box(b, x - 2, fy - 292, 44, 12, 'gold', 4); } },
};

// --------------------------------------------------------------------------------------------- wall props
export const WALL_PROPS = {
  painting: { w: 96, h: 64, draw(b, x, y, o) {
    box(b, x, y, 96, 64, 'gold', 4); b.rect(x + 6, y + 6, 84, 52, col('water', 3));
    for (let i = 0; i < 84; i++) { const h = 20 + Math.round(Math.sin(i * 0.08 + (o.seed ?? 0)) * 8); b.rect(x + 6 + i, y + 6 + h, 1, 52 - h, col('leaf', 3 + (i < 40 ? 1 : 0))); }
    b.rect(x + 60, y + 14, 10, 10, col('amber', 6)); for (let i = 0; i < 84; i++) if (hash(i, 3) < 0.2) b.set(x + 6 + i, y + 7 + Math.floor(hash(i, 4) * 10), col('water', 5));
  } },
  portrait: { w: 72, h: 96, draw(b, x, y, o) { box(b, x, y, 72, 96, 'gold', 4); b.rect(x + 6, y + 6, 60, 84, col('velvet', 2)); box(b, x + 22, y + 20, 28, 32, 'skin', 3, { outline: false }); b.rect(x + 22, y + 16, 28, 8, col('walnut', 2)); box(b, x + 14, y + 52, 44, 38, 'cloth', 1, { outline: false }); b.rect(x + 32, y + 54, 8, 20, col('plaster', 6)); b.rect(x + 34, y + 58, 4, 14, col('red', 4)); } },
  bigscreen: { w: 256, h: 112, draw(b, x, y, o) { screen(b, x, y, 256, 112, 'water', o.frame, { bars: false }); for (let j = 0; j < 112; j++) for (let i = 0; i < 256; i++) if (j > 60 + Math.sin(i * 0.05) * 12) b.set(x + i, y + j, col('leaf', 3 + (j % 2)), 1); b.rect(x + 180, y + 18, 24, 24, col('amber', 6), 1); } },
  ledsky: { w: 224, h: 96, draw(b, x, y, o) { box(b, x - 4, y - 4, 232, 104, 'steel', 3); for (let j = 0; j < 96; j++) for (let i = 0; i < 224; i++) b.set(x + i, y + j, col('water', 4 + (j < 40 ? 1 : 0) + (bayer(i, j) < (j % 40) / 80 ? 1 : 0)), 1); for (let k = 0; k < 3; k++) { const cx = x + 30 + k * 70 + (o.frame ? 4 : 0); b.rect(cx, y + 20 + k * 6, 34, 8, col('plaster', 6), 1); b.rect(cx + 6, y + 14 + k * 6, 20, 6, col('plaster', 6), 1); } for (let i = 0; i < 224; i++) { const h = 14 + Math.round(Math.sin(i * 0.06) * 6); b.rect(x + i, y + 96 - h, 1, h, col('leaf', 4), 1); } b.rect(x + 111, y, 2, 96, col('steel', 3)); } },
  vent: { w: 64, h: 40, draw(b, x, y, o) { box(b, x, y, 64, 40, 'steel', 3); for (let j = 4; j < 36; j += 5) b.rect(x + 4, y + j, 56, 2, col('steel', 1)); } },
  sign: { w: 0, h: 0, draw() {} },
  onair: { w: 72, h: 24, draw(b, x, y, o) { box(b, x, y, 72, 24, 'cloth', 1); text(b, 'ON AIR', x + 8, y + 4, col('red', o.frame ? 3 : 6), 3, { glow: o.frame ? 0 : 1 }); if (o.frame === 0) glowAt(b, x + 36, y + 12, 40, 1); } },
  rifle: { w: 96, h: 20, draw(b, x, y) { box(b, x, y + 6, 70, 6, 'cloth', 1); box(b, x + 60, y + 4, 34, 12, 'walnut', 3); box(b, x + 30, y + 12, 6, 8, 'cloth', 1); } },
  map: { w: 128, h: 80, draw(b, x, y, o) { box(b, x, y, 128, 80, 'walnut', 3); b.rect(x + 4, y + 4, 120, 72, col('water', 2)); for (let i = 0; i < 18; i++) { const cx = x + 10 + Math.floor(hash(i, 1) * 100), cy = y + 10 + Math.floor(hash(i, 2) * 56); b.rect(cx, cy, 8 + (i % 4) * 4, 6 + (i % 3) * 4, col('leaf', 3)); } for (let k = 0; k < 4; k++) b.rect(x + 20 + k * 26, y + 20 + (k % 2) * 30, 4, 4, col('red', 5), 1); } },
  shelfWall: { w: 120, h: 40, draw(b, x, y, o) { box(b, x, y + 30, 120, 6, 'walnut', 4); books(b, x + 4, y, 60, 30, 7); box(b, x + 76, y + 10, 20, 20, 'gold', 5); box(b, x + 100, y + 4, 12, 26, 'water', 4); } },
  mirror: { w: 64, h: 96, draw(b, x, y) { box(b, x, y, 64, 96, 'gold', 5); b.rect(x + 6, y + 6, 52, 84, col('water', 5)); for (let i = 0; i < 20; i++) b.rect(x + 12 + i, y + 12 + i, 3, 1, col('water', 6)); } },
  tiles: { w: 0, h: 0, draw() {} },
  pipes: { w: 0, h: 0, draw() {} },
  hazardSign: { w: 40, h: 36, draw(b, x, y) { for (let j = 0; j < 36; j++) { const half = Math.floor((j * 20) / 36); b.rect(x + 20 - half, y + j, half * 2 + 1, 1, j === 35 ? K : col('hazard', 4)); b.set(x + 20 - half - 1, y + j, K); b.set(x + 20 + half + 1, y + j, K); } b.rect(x + 19, y + 12, 3, 12, K); b.rect(x + 19, y + 27, 3, 3, K); } },
  dial: { w: 48, h: 48, draw(b, x, y) { box(b, x, y, 48, 48, 'steel', 3); gauge(b, x + 24, y + 24, 16); } },
  damask: { w: 0, h: 0, draw() {} },
};
