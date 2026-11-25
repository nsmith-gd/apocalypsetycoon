// Luxury and comfort amenities at the 64 px minimum (#118, art note D4): the client-facing furniture of the bunker
// (gold taps, cryo pods, king beds, chandeliers, pianos...). Each piece is authored at 64 px per metre of its
// footprint (a 3 x 2 m four-poster is 192 x 128), lit from the top-left, with a 1 px outline, and keeps the
// recolour choice: `a` (main colour) and `b` (trim) become tone ramps, so velvet, gold or ebony all shade properly.
// Survival kit is #119's (src/art/fixtures64.js); room tiles are #117's (room-tiles.js).
//
//   amenityRaster(kind, { a, b }, { on, frame })            -> Raster at native size (headless)
//   drawAmenity(ctx, kind, px, py, { a, b }, { on, frame, flip, tile = 16 })
//       At 64 px per tile it draws 1:1; below that (the grid is 16 px per metre until the director confirms the
//       64 rule) it draws a level-of-detail copy: each block's colours are averaged and snapped back to a colour
//       the piece already uses, with outlines kept, so it stays crisp.
//   AMENITY_KINDS, hasAmenity(kind)

import { Raster, col, K, box, cyl, hcyl, screen, led, glowAt, hash, bayer, text, rampFromHex, HD_COLOURS, drawRaster } from './raster.js';
import { OBJECTS } from '../../shelter/bunker-catalog.js';

export const AMENITY_PX = 64;
const M = AMENITY_PX;

// ------------------------------------------------------------------------------------------ helpers
const legs = (b, x, y, w, h, r, base = 3, t = 4) => { box(b, x, y, t, h, r, base, { bevel: false }); box(b, x + w - t, y, t, h, r, base, { bevel: false }); };
const turned = (b, x, y, h, r, base = 4) => { for (let j = 0; j < h; j++) { const bulge = (j % 16) < 4 ? 1 : 0; b.rect(x - bulge, y + j, 6 + bulge * 2, 1, col(r, base + (j % 16 < 2 ? 2 : 0))); b.set(x - bulge - 1, y + j, K); b.set(x + 6 + bulge, y + j, K); b.set(x + 1, y + j, col(r, base + 1)); } };
const tuft = (b, x, y, w, h, r, base, s = 0) => { for (let i = 6; i < w - 4; i += 12) for (let j = 6; j < h - 3; j += 10) { b.set(x + i + ((j / 10) % 2) * 6, y + j, col(r, base - 2)); b.set(x + i + 1 + ((j / 10) % 2) * 6, y + j + 1, col(r, base + 1)); } };
const sheen = (b, x, y, w, h) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) if (i + j < Math.min(w, h) * 0.6 && bayer(x + i, y + j) < 0.35) b.shift(x + i, y + j, 1); };
const foliage = (b, x, y, w, h, r, s = 0, accent = null) => {
  const n = Math.max(3, Math.round((w * h) / 240));
  const clumps = Array.from({ length: n }, (_, i) => { const rad = Math.max(5, Math.min(w, h) * (0.24 + hash(i, s, 7) * 0.16)); return { cx: x + rad + hash(i, s, 3) * Math.max(1, w - 2 * rad), cy: y + rad + hash(i, s, 5) * Math.max(1, h - 2 * rad), rad }; }).sort((p, q) => q.cy - p.cy);
  for (const c of clumps) for (let py = Math.floor(c.cy - c.rad - 1); py <= c.cy + c.rad + 1; py++) for (let px = Math.floor(c.cx - c.rad - 1); px <= c.cx + c.rad + 1; px++) {
    const dx = (px - c.cx) / c.rad, dy = (py - c.cy) / c.rad, d = Math.hypot(dx, dy), edge = 1 - hash(px >> 1, py >> 1, s + 9) * 0.22;
    if (d > edge + 0.12) continue;
    if (d > edge) { if (!b.get(px, py)) b.set(px, py, K); continue; }
    const lit = -dx * 0.8 - dy * 1.1 + (hash(px >> 1, py >> 1, s) - 0.5) * 0.9;
    b.set(px, py, col(r, 3 + Math.max(-2, Math.min(2, Math.round(lit * 1.4)))));
  }
  if (accent) for (let i = 0; i < n * 2; i++) { const px = x + 4 + Math.floor(hash(i, s, 21) * (w - 8)), py = y + 4 + Math.floor(hash(i, s, 22) * (h - 8)); if (b.get(px, py) && b.get(px, py) !== K) { b.rect(px, py, 3, 3, col(accent, 4)); b.set(px, py, col(accent, 6)); } }
};
const pot = (b, x, y, w, h, r) => { box(b, x, y, w, h, r, 4); b.rect(x, y + 3, w, 2, col(r, 2)); for (let j = 6; j < h - 1; j++) b.set(x + 2, y + j, col(r, 5)); };
const ring = (b, cx, cy, rad, ci, th = 1) => { for (let t = 0; t < 6.29; t += 0.5 / rad) for (let k = 0; k < th; k++) b.set(Math.round(cx + Math.cos(t) * (rad - k)), Math.round(cy + Math.sin(t) * (rad - k)), ci); };
const disc = (b, cx, cy, rad, r, base) => { for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) { const d = Math.hypot(x, y); if (d > rad) continue; b.set(cx + x, cy + y, d > rad - 1 ? K : col(r, base + Math.round((-x - y) / rad))); } };
const flame = (b, x, y, h, frame) => { for (let j = 0; j < h; j++) { const w = Math.max(1, Math.round((1 - j / h) * 3 + (frame && j > h / 2 ? 1 : 0))); b.rect(x - (w >> 1) + (frame && j < h / 2 ? 1 : 0), y + h - j, w, 1, col('amber', j > h * 0.6 ? 6 : 5), 1); } };

// ------------------------------------------------------------------------------------------ recipes
// Each: ({ b, W, H, A, B, on, frame }) where A/B are the variant ramps (step 4 = the chosen colour).
const R = {
  // ---------------- sleeping
  bed({ b, W, H, A, B }) { // 3 x 1: wooden bed, duvet in the bedding colour
    box(b, 2, H - 58, 12, 58, 'walnut', 4); box(b, 4, H - 64, 8, 6, 'walnut', 5);
    box(b, W - 12, H - 30, 10, 30, 'walnut', 4); box(b, 8, H - 22, W - 14, 12, 'walnut', 3); legs(b, 10, H - 10, W - 16, 10, 'walnut', 2);
    box(b, 14, H - 36, W - 24, 14, 'plaster', 6); box(b, 18, H - 48, 34, 14, B, 5); box(b, 22, H - 44, 30, 10, B, 4, { outline: false });
    box(b, 60, H - 42, W - 72, 22, A, 4); for (let i = 70; i < W - 16; i += 14) { b.rect(i, H - 40, 1, 18, col(A, 3)); b.rect(i + 1, H - 40, 1, 18, col(A, 5)); } b.rect(60, H - 42, W - 72, 3, col(A, 6)); sheen(b, 60, H - 42, 50, 20);
  },
  king_bed({ b, W, H, A, B }) { // 3 x 2: four-poster with a canopy
    for (const px of [2, W - 10]) { turned(b, px, 14, H - 14, 'gold', 4); box(b, px - 1, H - 8, 8, 8, 'gold', 3); }
    box(b, 0, 4, W, 12, B, 4); for (let i = 2; i < W - 2; i += 8) { b.rect(i, 16, 5, 4 + ((i / 8) % 2) * 3, col(B, 3)); b.set(i + 2, 19 + ((i / 8) % 2) * 3, col('gold', 5)); } b.rect(0, 4, W, 2, col('gold', 6));
    for (let j = 16; j < H - 50; j++) { b.set(12, j, col(B, 2 + (j % 6 < 3 ? 1 : 0))); b.set(13, j, col(B, 3)); b.set(W - 14, j, col(B, 2 + (j % 6 < 3 ? 1 : 0))); b.set(W - 13, j, col(B, 3)); }
    box(b, 14, H - 92, 30, 66, 'walnut', 4); for (let j = H - 84; j < H - 34; j += 16) { box(b, 18, j, 22, 11, 'gold', 4, { outline: false }); b.rect(20, j + 2, 18, 1, col('gold', 6)); }
    box(b, 12, H - 26, W - 22, 16, 'walnut', 3); legs(b, 16, H - 10, W - 30, 10, 'gold', 3, 5);
    box(b, 44, H - 42, W - 58, 16, 'plaster', 6);
    box(b, 86, H - 50, W - 98, 26, A, 4); b.rect(86, H - 50, W - 98, 3, col(A, 6)); b.rect(86, H - 32, W - 98, 2, col('gold', 5)); tuft(b, 88, H - 46, W - 102, 12, A, 4); sheen(b, 86, H - 50, 60, 24);
    box(b, 48, H - 58, 34, 16, B, 5); box(b, 50, H - 70, 30, 14, A, 5); b.rect(52, H - 68, 26, 1, col(A, 6));
  },
  wardrobe({ b, W, H, A, B }) { // 2 x 3, wood family
    box(b, 4, 12, W - 8, H - 18, A, 4); box(b, 0, 6, W, 8, A, 5); b.rect(0, 6, W, 2, col(A, 6)); legs(b, 8, H - 6, W - 16, 6, A, 2, 6);
    for (const x0 of [10, W / 2 + 2]) { box(b, x0, 20, W / 2 - 12, H - 40, A, 4); box(b, x0 + 6, 28, W / 2 - 24, 64, A, 3, { outline: false }); box(b, x0 + 6, 104, W / 2 - 24, H - 132, A, 3, { outline: false }); b.rect(x0 + 6, 28, W / 2 - 24, 1, col(A, 1)); b.rect(x0 + 6, 104, W / 2 - 24, 1, col(A, 1)); }
    box(b, W / 2 - 6, H / 2 - 10, 3, 20, B, 5); box(b, W / 2 + 4, H / 2 - 10, 3, 20, B, 5);
    for (let i = 0; i < 18; i++) { const x = 10 + Math.floor(hash(i, 3) * (W - 20)); for (let j = 0; j < 20; j++) b.set(x, 20 + Math.floor(hash(i, 4) * 120) + j, col(A, 3)); } // grain
  },
  // ---------------- kitchen and dining
  chef_range({ b, W, H, A, B, on, frame }) { // 3 x 1: a range in the wood colour with brass trim
    box(b, 0, H - 52, W, 52, A, 4); box(b, -1, H - 56, W + 2, 6, 'steel', 6); b.rect(0, H - 56, W, 1, col('steel', 7));
    for (let k = 0; k < 3; k++) { const x = 8 + k * 62; box(b, x, H - 42, 54, 32, 'steel', 2); b.rect(x + 4, H - 38, 46, 2, col(B, 5)); box(b, x + 18, H - 46, 18, 3, B, 5); b.rect(x + 4, H - 30, 46, 16, col('steel', 1)); if (on && k === 1) b.rect(x + 6, H - 24, 42, 6, col('amber', 4), 1); }
    for (let i = 0; i < 8; i++) disc(b, 14 + i * 23, H - 47, 3, B, 4);
    box(b, 0, H - 10, W, 10, B, 3);
    if (on) for (const x of [30, 90, 150]) { b.rect(x - 8, H - 58, 16, 2, col('steel', 2)); for (let i = -6; i <= 6; i += 4) flame(b, x + i, H - 64, 5, frame); }
  },
  espresso({ b, W, H, A, B, on, frame }) { // 1 x 1
    box(b, 10, H - 50, 44, 46, 'steel', 6); box(b, 8, H - 54, 48, 6, B, 5); box(b, 14, H - 44, 36, 14, 'steel', 4); for (const x of [18, 36]) disc(b, x + 4, H - 37, 4, 'gold', 4);
    box(b, 20, H - 28, 20, 6, 'steel', 3); box(b, 24, H - 16, 12, 10, 'plaster', 6); b.rect(26, H - 14, 8, 3, col('walnut', 2));
    if (on && frame) for (let j = 0; j < 8; j++) b.set(28 + (j % 3), H - 20 - j * 3, col('plaster', 5));
    box(b, 6, H - 4, 52, 4, A, 4);
  },
  dining_table({ b, W, H, A, B }) { // 3 x 1
    box(b, 0, H - 40, W, 8, A, 4); b.rect(0, H - 40, W, 2, col(A, 6)); box(b, 4, H - 32, W - 8, 4, B, 4);
    for (const x of [8, W / 2 - 4, W - 16]) turned(b, x, H - 28, 28, A, 3);
    box(b, 40, H - 44, W - 80, 4, 'plaster', 6); for (const x of [56, W / 2, W - 56]) { box(b, x - 3, H - 62, 6, 18, 'plaster', 6); box(b, x - 6, H - 46, 12, 3, B, 5); b.set(x, H - 66, col('amber', 6), 1); b.set(x, H - 65, col('amber', 5), 1); }
    box(b, 72, H - 50, 20, 6, 'gold', 4); box(b, 110, H - 52, 12, 8, 'water', 5);
  },
  dining_chair({ b, W, H, A, B }) { // 1 x 1
    box(b, 14, H - 62, 8, 62, A, 4); box(b, 16, H - 58, 4, 26, B, 4, { outline: false }); box(b, 14, H - 30, 38, 6, A, 4); box(b, 16, H - 34, 34, 5, B, 4); box(b, 44, H - 24, 6, 24, A, 3); box(b, 14, H - 24, 6, 24, A, 3);
  },
  // ---------------- bath
  gold_taps({ b, W, H, A, B, on, frame }) { // 1 x 1: marble basin and gold (or chosen metal) taps
    box(b, 2, H - 34, 60, 10, 'marble', 6); for (let i = 0; i < 60; i++) if (hash(i, 7) < 0.25) b.set(3 + i, H - 32 + Math.floor(hash(i, 8) * 7), col('marble', 3));
    box(b, 14, H - 24, 36, 24, 'marble', 5); b.rect(16, H - 22, 32, 2, col('marble', 3));
    box(b, 28, H - 58, 7, 24, A, 4); box(b, 28, H - 60, 22, 6, A, 5); box(b, 44, H - 56, 6, 8, A, 4); b.rect(29, H - 58, 2, 22, col(A, 6));
    for (const x of [16, 40]) { box(b, x, H - 44, 8, 6, A, 5); box(b, x + 2, H - 48, 4, 4, A, 6); }
    if (on) { for (let j = 0; j < 12; j++) b.set(46 + (frame && j > 6 ? 1 : 0), H - 48 + j, col('water', 5), 1); glowAt(b, 31, H - 52, 10, 1); }
  },
  bathtub({ b, W, H, A, B, on, frame }) { // 3 x 1: clawfoot tub, body in the metal colour
    for (let i = 0; i < W - 12; i++) { const t = i / (W - 12); const top = H - 44 - Math.round(Math.max(0, Math.sin(t * Math.PI) - 0.6) * 0) - (i < 14 ? 14 - i : 0) * 0.6; const bottom = H - 10 - Math.round(Math.sin(t * Math.PI) * 4); for (let j = Math.round(top); j < bottom; j++) b.set(6 + i, j, col('marble', j < top + 3 ? 6 : 5 - (j > bottom - 6 ? 1 : 0))); b.set(6 + i, Math.round(top) - 1, K); b.set(6 + i, bottom, K); }
    b.rect(10, H - 44, W - 20, 4, col(A, 5)); b.rect(10, H - 40, W - 20, 1, col(A, 3));
    if (on) { b.rect(14, H - 42, W - 28, 3, col('water', 5)); for (let i = 0; i < 9; i++) disc(b, 30 + i * 16 + (frame ? 2 : 0), H - 46 - (i % 2) * 3, 3 + (i % 2), 'cloth', 5); }
    for (const x of [16, W - 30]) { box(b, x, H - 10, 12, 10, A, 4); b.rect(x - 2, H - 3, 16, 3, col(A, 3)); }
    box(b, W - 24, H - 62, 6, 20, A, 4); box(b, W - 36, H - 64, 18, 5, A, 5);
  },
  vanity({ b, W, H, A, B }) { // 1 x 2: mirror in the metal colour over a marble counter
    box(b, 6, 4, 52, 70, A, 4); b.rect(10, 8, 44, 62, col('water', 5)); for (let i = 0; i < 20; i++) b.rect(14 + i, 14 + i, 3, 1, col('water', 6)); for (let k = 0; k < 4; k++) disc(b, 12 + k * 13, 4, 3, 'amber', 6);
    box(b, 2, H - 52, 60, 8, 'marble', 6); box(b, 6, H - 44, 52, 44, 'walnut', 4); b.rect(10, H - 36, 44, 1, col('walnut', 2)); box(b, 28, H - 32, 8, 3, A, 5);
    box(b, 12, H - 64, 6, 12, 'velvet', 5); box(b, 22, H - 60, 8, 8, 'gold', 5); box(b, 44, H - 66, 5, 14, 'water', 5);
  },
  // ---------------- comfort (upholstery family)
  sofa({ b, W, H, A, B }) { // 3 x 1: chesterfield
    box(b, 8, H - 56, W - 16, 26, A, 4); tuft(b, 10, H - 54, W - 20, 22, A, 4); b.rect(8, H - 56, W - 16, 2, col(A, 6));
    box(b, 0, H - 44, 18, 32, A, 5); box(b, W - 18, H - 44, 18, 32, A, 3); disc(b, 9, H - 44, 9, A, 5); disc(b, W - 9, H - 44, 9, A, 3);
    for (let k = 0; k < 3; k++) { const x = 18 + k * ((W - 36) / 3); box(b, x, H - 30, (W - 36) / 3 - 2, 16, A, 5); sheen(b, x, H - 30, 30, 10); }
    box(b, 4, H - 14, W - 8, 6, A, 3); for (const x of [8, W - 16]) box(b, x, H - 8, 8, 8, B, 4);
    box(b, 28, H - 50, 22, 18, 'gold', 4); box(b, W - 52, H - 50, 22, 18, B, 5);
  },
  armchair({ b, W, H, A, B }) { // 2 x 1: wingback
    box(b, 22, H - 62, W - 44, 36, A, 4); tuft(b, 24, H - 60, W - 48, 30, A, 4); box(b, 14, H - 58, 12, 24, A, 3); box(b, W - 26, H - 58, 12, 24, A, 3);
    box(b, 10, H - 38, 18, 28, A, 5); box(b, W - 28, H - 38, 18, 28, A, 3); box(b, 26, H - 28, W - 52, 14, A, 5); sheen(b, 26, H - 28, 30, 12);
    for (const x of [14, W - 22]) { box(b, x, H - 10, 6, 10, B, 4); }
  },
  tv({ b, W, H, A, B, on, frame }) { // 2 x 1: a slim screen on a low credenza
    box(b, 4, H - 22, W - 8, 22, A, 3); b.rect(8, H - 14, W - 16, 1, col(A, 1));
    screen(b, 8, H - 60, W - 16, 34, on ? 'water' : 'cloth', on ? frame : 0, { bars: false });
    if (on) for (let i = 0; i < W - 16; i++) { const h = 10 + Math.round(Math.sin(i * 0.12 + frame) * 4); b.rect(8 + i, H - 26 - h, 1, h, col('leaf', 4), 1); }
    box(b, W / 2 - 4, H - 26, 8, 4, 'steel', 2);
  },
  bookshelf({ b, W, H, A, B }) { // 1 x 3, wood
    box(b, 2, 4, W - 4, H - 4, A, 3); b.rect(2, 4, W - 4, 2, col(A, 5));
    const cols = ['red', 'water', 'gold', 'leaf', 'velvet', 'cloth', 'rust'];
    for (let k = 0; k < 5; k++) { const y = 10 + k * 36; b.rect(6, y, W - 12, 30, col(A, 1)); let x = 7, n = 0; while (x < W - 10) { const bw = 3 + Math.floor(hash(n, k) * 4), bh = 22 - Math.floor(hash(n, k, 2) * 8); if (hash(n, k, 3) < 0.1) { x += 4; n++; continue; } box(b, x, y + 30 - bh, bw, bh, cols[(n + k) % cols.length], 3, { outline: false }); b.rect(x, y + 32 - bh, bw, 1, col(cols[(n + k) % cols.length], 5)); b.rect(x + bw, y + 30 - bh, 1, bh, K); x += bw + 1; n++; } box(b, 4, y + 30, W - 8, 4, A, 4); }
  },
  led_sky({ b, W, H, A, on, frame }) { // 2 x 1 wall panel, framed in the upholstery colour
    box(b, 2, 4, W - 4, H - 10, A, 3);
    for (let j = 0; j < H - 14; j++) for (let i = 0; i < W - 8; i++) b.set(4 + i, 6 + j, on ? col('water', 4 + (j < 20 ? 1 : 0) + (bayer(i, j) < ((j % 20) / 40) ? 1 : 0)) : col('cloth', 1), on ? 1 : 0);
    if (on) { const cx = 20 + (frame ? 6 : 0); b.rect(cx, 14, 26, 6, col('plaster', 6), 1); b.rect(cx + 4, 10, 14, 5, col('plaster', 6), 1); b.rect(W - 30, 12, 10, 10, col('amber', 6), 1); }
  },
  gym_rig({ b, W, H, A, B }) { // 2 x 2
    box(b, 4, 4, 6, H - 4, 'steel', 4); box(b, W - 10, 4, 6, H - 4, 'steel', 3); box(b, 4, 4, W - 8, 6, 'steel', 5);
    box(b, 12, 46, W - 24, 4, 'steel', 6); for (const x of [16, W - 28]) box(b, x, 36, 12, 24, A, 4);
    box(b, 36, H - 30, 56, 10, A, 4); legs(b, 38, H - 20, 52, 20, 'steel', 3);
    for (let k = 0; k < 4; k++) box(b, 14 + k * 8, H - 14 - k * 2, 6, 14 + k * 2, 'cloth', 2);
  },
  desk({ b, W, H, A, B, on, frame }) { // 2 x 1, partners desk
    box(b, 0, H - 40, W, 6, A, 5); box(b, 2, H - 34, 40, 34, A, 4); b.rect(6, H - 24, 32, 1, col(A, 2)); box(b, 18, H - 30, 8, 3, B, 5); box(b, W - 10, H - 34, 8, 34, A, 3);
    screen(b, W - 58, H - 70, 40, 24, on ? 'water' : 'cloth', frame); box(b, W - 42, H - 44, 8, 4, 'steel', 3);
    box(b, 50, H - 46, 16, 6, 'gold', 4); box(b, 70, H - 48, 10, 8, 'plaster', 6);
  },
  pool_table({ b, W, H, A, B }) { // 3 x 1
    box(b, 0, H - 46, W, 14, A, 4); b.rect(4, H - 46, W - 8, 4, col('emerald', 4)); b.rect(4, H - 42, W - 8, 1, col('emerald', 2));
    for (const x of [6, W / 2 - 6, W - 18]) { box(b, x, H - 32, 12, 32, A, 3); b.rect(x + 2, H - 20, 8, 2, col(B, 5)); }
    for (const [x, r] of [[40, 'plaster'], [120, 'red'], [130, 'gold'], [138, 'water']]) disc(b, x, H - 50, 3, r, 5);
    for (let i = 0; i < 70; i++) b.set(50 + i, H - 56 - Math.round(i * 0.08), col('walnut', 5));
  },
  arcade({ b, W, H, A, B, on, frame }) { // 1 x 2
    box(b, 6, 6, W - 12, H - 6, A, 4); box(b, 4, 4, W - 8, 14, A, 5); text(b, 'PLAY', 15, 7, col('amber', on ? 6 : 3), 2, { glow: on ? 1 : 0 });
    screen(b, 12, 26, W - 24, 36, on ? 'leaf' : 'cloth', frame, { bars: false }); if (on) { b.rect(16 + (frame ? 14 : 4), 40, 6, 6, col('amber', 6), 1); b.rect(30, 52, 18, 2, col('leaf', 7), 1); }
    box(b, 8, 66, W - 16, 14, A, 3); disc(b, 22, 72, 4, 'red', 5); disc(b, 38, 72, 3, 'water', 5); disc(b, 46, 72, 3, 'gold', 5);
    box(b, 18, 90, W - 36, 14, 'cloth', 1); text(b, '25', 24, 92, col('gold', 5), 2);
  },
  fireplace({ b, W, H, A, B, on, frame }) { // 2 x 2, marble surround
    box(b, 0, 14, W, H - 14, 'marble', 5); box(b, -2, 8, W + 4, 8, 'marble', 6); b.rect(0, 8, W, 1, col('marble', 6));
    for (let j = 20; j < H - 4; j += 2) { b.set(6, j, col('marble', 3)); b.set(W - 7, j, col('marble', 3)); }
    box(b, 16, 40, W - 32, H - 44, 'K', 0);
    if (on) { // tongues of flame: each a tapering column, brightest at the base, swaying on the second frame
      for (let k = 0; k < 7; k++) { const cx = 24 + k * ((W - 48) / 6), fh = 18 + Math.round(hash(k, 3) * 18) + (frame && k % 2 ? 5 : 0); for (let j = 0; j < fh; j++) { const t = j / fh, w = Math.max(1, Math.round((1 - t) * 7)), sway = Math.round(Math.sin(t * 3 + k + frame * 2) * 2 * t); for (let i = -w; i <= w; i++) b.set(Math.round(cx + i + sway), H - 14 - j, col('amber', Math.abs(i) > w - 2 ? 3 : t < 0.35 ? 6 : t < 0.7 ? 5 : 4), 1); } }
      glowAt(b, W / 2, H - 20, 44, 1.4);
    }
    for (let i = 0; i < 4; i++) box(b, 24 + i * 20, H - 12, 18, 6, 'walnut', 3);
    box(b, 20, 0, 14, 8, 'gold', 4); box(b, W - 34, 0, 14, 8, B ?? 'gold', 4);
  },
  faux_window({ b, W, H, A, B, on, frame }) { // 2 x 2: window frame (wood) with curtains (upholstery-ish trim)
    box(b, 8, 8, W - 16, H - 20, A, 4);
    for (let j = 0; j < H - 28; j++) for (let i = 0; i < W - 24; i++) { const t = j / (H - 28); b.set(12 + i, 12 + j, on ? col('water', 6 - Math.floor(t * 2.4 + bayer(i, j) * 0.8)) : col('cloth', 2), on ? 1 : 0); }
    if (on) for (let i = 0; i < W - 24; i++) { const h = 16 + Math.round(Math.sin(i * 0.07 + 1) * 6); b.rect(12 + i, H - 16 - h, 1, h, col('leaf', 3 + (i % 9 < 2 ? 1 : 0)), 1); }
    b.rect(W / 2 - 1, 12, 3, H - 28, col(A, 3)); b.rect(12, H / 2 - 8, W - 24, 3, col(A, 3));
    for (const [x, d] of [[0, 1], [W - 22, -1]]) { box(b, x, 2, 22, H - 6, 'velvet', 4); for (let i = 3; i < 22; i += 5) b.rect(x + i, 4, 1, H - 10, col('velvet', 2)); }
    box(b, 0, 0, W, 5, 'gold', 4); box(b, 0, H - 10, W, 6, A, 5);
  },
  // ---------------- decor
  plant({ b, W, H, A, B }) { pot(b, 18, H - 24, 28, 24, 'rust'); b.rect(18, H - 24, 28, 2, col(B, 4)); foliage(b, 4, 6, W - 8, H - 30, A, 3, B && B !== 'rust' ? B : null); },
  plant_tall({ b, W, H, A, B }) { pot(b, 16, H - 28, 32, 28, 'rust'); for (let j = 40; j < H - 28; j++) b.set(31 + Math.round(Math.sin(j * 0.1) * 2), j, col('walnut', 3)); foliage(b, 2, 2, W - 4, 70, A, 5, B); foliage(b, 10, 60, W - 20, 30, A, 6, B); },
  painting({ b, W, H, A, B }) { // 2 x 1 wall: oil landscape in a frame (wood colour)
    box(b, 2, 2, W - 4, H - 6, A, 4); for (let i = 4; i < W - 6; i += 6) b.set(i, 4, col(A, 6)); b.rect(8, 8, W - 16, H - 18, K);
    const x0 = 9, y0 = 9, w = W - 18, h = H - 20;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const hill = h * 0.5 + Math.sin(i * 0.06 + 1) * 6 + Math.sin(i * 0.17) * 2; const sea = j > h * 0.72; b.set(x0 + i, y0 + j, j < hill ? col('water', 4 + (j < h * 0.25 ? 1 : 0) + (bayer(i, j) < 0.2 ? 1 : 0)) : sea ? col('water', 3) : col('leaf', 3 + (i < w * 0.4 ? 1 : 0) - (hash(i >> 2, j >> 2) < 0.2 ? 1 : 0))); }
    disc(b, x0 + w - 26, y0 + 10, 5, 'amber', 6); for (let i = 0; i < 3; i++) b.rect(x0 + 20 + i * 18, y0 + 12 + i * 3, 10, 2, col('plaster', 6));
  },
  statue({ b, W, H }) { // 1 x 2: marble bust on a plinth (always marble: it's a statue)
    box(b, 8, H - 50, 48, 50, 'marble', 4); box(b, 4, H - 54, 56, 6, 'marble', 5); b.rect(10, H - 30, 44, 2, col('gold', 5));
    box(b, 18, H - 96, 28, 42, 'marble', 5); box(b, 22, H - 120, 20, 26, 'marble', 5); b.rect(26, H - 110, 3, 2, col('marble', 2)); b.rect(35, H - 110, 3, 2, col('marble', 2)); box(b, 20, H - 124, 24, 8, 'gold', 5);
    for (let k = 0; k < 6; k++) b.set(20 + k * 4, H - 126, col('gold', 6)); sheen(b, 18, H - 96, 20, 30);
  },
  lamp({ b, W, H, A, B, on }) { // 1 x 2: floor lamp
    box(b, 14, 6, 36, 26, on ? 'amber' : 'plaster', on ? 5 : 4); b.rect(14, 6, 36, 3, col(on ? 'amber' : 'plaster', 6)); if (on) { b.rect(18, 30, 28, 3, col('amber', 6), 1); glowAt(b, 32, 28, 26, 1.6); }
    box(b, 30, 32, 4, H - 42, B, 4); box(b, 18, H - 10, 28, 10, B, 4); b.rect(20, H - 10, 24, 2, col(B, 6));
  },
  coffee_table({ b, W, H, A, B }) { box(b, 4, H - 28, W - 8, 8, A, 4); b.rect(4, H - 28, W - 8, 2, col(A, 6)); box(b, 10, H - 20, W - 20, 4, B, 4); legs(b, 10, H - 16, W - 20, 16, B, 3, 5); box(b, 30, H - 36, 26, 8, 'gold', 4); box(b, 70, H - 34, 12, 6, 'plaster', 6); },
  nightstand({ b, W, H, A, B, on }) { box(b, 8, H - 36, 48, 36, A, 4); b.rect(12, H - 22, 40, 1, col(A, 2)); box(b, 28, H - 30, 8, 3, B, 5); box(b, 28, H - 18, 8, 3, B, 5); box(b, 26, H - 44, 12, 8, B, 4); box(b, 18, H - 62, 28, 18, on ? 'amber' : 'plaster', on ? 5 : 4); if (on) glowAt(b, 32, H - 52, 18, 1.2); },
  aquarium({ b, W, H, A, B, frame }) { // 2 x 2
    box(b, 2, H - 34, W - 4, 34, A, 4); b.rect(8, H - 22, W - 16, 1, col(A, 2));
    box(b, 4, 8, W - 8, H - 44, 'water', 4); for (let j = 0; j < H - 48; j++) for (let i = 0; i < W - 12; i++) if (bayer(i, j) < 0.08 + (j < 6 ? 0.3 : 0)) b.shift(6 + i, 10 + j, 1);
    b.rect(6, H - 48, W - 12, 8, col('amber', 5)); foliage(b, 8, H - 86, 28, 40, 'leaf', 2); foliage(b, W - 40, H - 76, 30, 30, 'leaf', 4);
    for (let k = 0; k < 5; k++) { const fx = 20 + ((k * 27 + (frame ? 7 : 0)) % (W - 40)), fy = 22 + k * 11; box(b, fx, fy, 10, 5, ['amber', 'gold', 'red'][k % 3], 5, { outline: false }); b.rect(fx - 3, fy + 1, 3, 3, col(['amber', 'gold', 'red'][k % 3], 4)); b.set(fx + 7, fy + 1, K); }
    box(b, 0, 2, W, 8, A, 5);
  },
  rug({ b, W, H, A, B }) { box(b, 0, H - 8, W, 7, A, 4); b.rect(2, H - 6, W - 4, 1, col(B, 4)); b.rect(2, H - 3, W - 4, 1, col(B, 4)); for (let x = 0; x < W; x += 3) b.set(x, H - 1, col(B, 5)); },
  rug_persian({ b, W, H, A, B }) {
    box(b, 0, H - 10, W, 9, A, 4); b.rect(2, H - 8, W - 4, 5, col(B, 3)); for (let x = 4; x < W - 4; x += 8) { b.rect(x, H - 7, 3, 3, col(A, 6)); b.set(x + 5, H - 6, col('gold', 5)); }
    for (let x = 0; x < W; x += 2) b.set(x, H - 1, col('plaster', 6));
  },
  mirror({ b, W, H, A }) { // 1 x 2 wall: gilt mirror in the metal colour
    box(b, 4, 4, W - 8, H - 10, A, 4); for (let i = 6; i < W - 6; i += 5) { b.set(i, 5, col(A, 6)); b.set(i, H - 8, col(A, 2)); }
    for (let j = 0; j < H - 22; j++) for (let i = 0; i < W - 20; i++) b.set(10 + i, 10 + j, col('water', 5 + (i + j * 0.4 < 14 && i > 3 ? 1 : 0) - (j > H - 40 ? 1 : 0)));
    for (let i = 0; i < 18; i++) b.rect(16 + i, 16 + i * 2, 2, 1, col('water', 6)); disc(b, W / 2, 6, 5, A, 5);
  },
  sconce({ b, W, H, A, on }) { box(b, 28, 24, 8, 22, A, 4); box(b, 22, 44, 20, 6, A, 5); for (const x of [22, 40]) { box(b, x, 16, 4, 10, 'plaster', 6); if (on) { flame(b, x + 2, 6, 8, 0); } } if (on) glowAt(b, 32, 14, 24, 1.5); },
  wall_shelf({ b, W, H, A, B }) {
    box(b, 2, H - 20, W - 4, 6, A, 4); for (const x of [12, W - 18]) box(b, x, H - 14, 6, 10, B, 4);
    let x = 8; const cols = ['red', 'water', 'leaf', 'gold']; for (let k = 0; k < 7; k++) { const bh = 20 + (k % 3) * 4; box(b, x, H - 20 - bh, 5, bh, cols[k % 4], 3, { outline: false }); b.rect(x + 5, H - 20 - bh, 1, bh, K); x += 6; }
    box(b, 60, H - 40, 18, 20, 'water', 4); disc(b, 69, H - 44, 5, 'water', 5); box(b, 90, H - 46, 14, 26, 'gold', 5); box(b, 108, H - 34, 12, 14, 'marble', 6);
  },
  pendant({ b, W, H, A, on }) { b.rect(31, 0, 2, 28, K); box(b, 18, 28, 28, 14, A, 4); b.rect(18, 28, 28, 2, col(A, 6)); if (on) { b.rect(24, 42, 16, 3, col('amber', 6), 1); glowAt(b, 32, 46, 22, 1.5); } },
  // ---------------- status
  wine_rack({ b, W, H, A }) { // 1 x 3
    box(b, 2, 4, W - 4, H - 4, A, 3); b.rect(2, 4, W - 4, 2, col(A, 5));
    for (let r = 0; r < 10; r++) for (let c = 0; c < 3; c++) { const x = 8 + c * 17, y = 10 + r * 18; b.rect(x, y, 15, 15, col(A, 1)); if (hash(r, c, 3) < 0.82) { disc(b, x + 7, y + 7, 6, ['velvet', 'leaf', 'red'][(r + c) % 3], 2); b.rect(x + 6, y + 6, 3, 3, col('gold', 5)); } }
  },
  cinema_seats({ b, W, H, A, B }) { for (let k = 0; k < 3; k++) { const x = k * 64; box(b, x + 6, H - 58, 52, 30, A, 4); tuft(b, x + 8, H - 56, 48, 26, A, 4); box(b, x + 2, H - 36, 10, 26, A, 3); box(b, x + 52, H - 36, 10, 26, A, 3); box(b, x + 10, H - 28, 44, 14, A, 5); box(b, x + 4, H - 10, 56, 10, B, 2); disc(b, x + 7, H - 38, 3, 'gold', 5); } },
  cinema_screen({ b, W, H, on, frame }) { // 3 x 2
    box(b, 0, 0, W, H - 16, 'cloth', 1); for (let j = 0; j < H - 28; j++) for (let i = 0; i < W - 16; i++) { const sc = frame ? 'velvet' : 'water'; b.set(8 + i, 6 + j, on ? col(sc, 3 + (j < (H - 28) * 0.5 ? 1 : 0) + (bayer(i, j) < 0.15 ? 1 : 0)) : col('cloth', 2), on ? 1 : 0); }
    if (on) { disc(b, W / 2 + (frame ? 20 : -20), H / 2 - 16, 12, 'amber', 5); text(b, 'THE END', W / 2 - 26, H - 40, col('plaster', 6), 2, { glow: 1 }); }
    for (const x of [0, W - 22]) { box(b, x, 0, 22, H - 8, 'velvet', 4); for (let i = 3; i < 22; i += 5) b.rect(x + i, 2, 1, H - 12, col('velvet', 2)); }
    box(b, 0, H - 16, W, 16, 'velvet', 3); b.rect(0, H - 16, W, 2, col('gold', 5));
  },
  cryo_pod({ b, W, H, A, on, frame }) { // 1 x 3: the Delusion signature piece; frame in the wood colour (status family)
    box(b, 2, H - 26, W - 4, 26, 'steel', 3); for (let j = H - 22; j < H - 6; j += 3) b.rect(8, j, 26, 1, col('steel', 1)); led(b, 44, H - 18, on ? 'water' : 'red', frame, on, 3); b.rect(4, H - 26, W - 8, 2, col(A, 5));
    box(b, 4, 2, W - 8, 16, 'steel', 4); b.rect(8, 12, W - 16, 3, col(on ? 'water' : 'cloth', 6), on ? 1 : 0);
    cyl(b, 6, 20, W - 12, H - 48, on ? 'water' : 'cloth', 3);
    box(b, 22, 34, 20, 18, 'skin', 3, { outline: false }); b.rect(22, 34, 20, 4, col('walnut', 2)); box(b, 18, 52, 28, H - 110, 'cloth', 5, { outline: false });
    for (let j = 22; j < H - 30; j++) for (let i = 8; i < W - 8; i++) if (bayer(i, j) < 0.3 + (j > H - 70 ? 0.3 : 0)) b.shift(i, j, on ? 2 : 1);
    for (let i = 0; i < 12; i++) b.rect(10 + Math.floor(hash(i, 4) * 42), 24 + Math.floor(hash(i, 8) * (H - 60)), 2, 1, col('water', 6), 1);
    if (on && frame % 2 === 0) glowAt(b, W / 2, H / 2, 40, 1.2);
    for (const x of [2, W - 8]) box(b, x, 18, 6, H - 44, A, 4);
  },
  bar_counter({ b, W, H, A, B }) { // 3 x 2: back bar with bottles, counter in front
    box(b, 0, 2, W, 6, A, 5); for (let k = 0; k < 2; k++) { box(b, 4, 28 + k * 30, W - 8, 4, B, 5); for (let i = 0; i < 16; i++) { const x = 8 + i * 11, h = 14 + (i * 7) % 8, r = ['leaf', 'amber', 'red', 'water', 'gold'][(i + k) % 5]; box(b, x, 28 + k * 30 - h, 6, h, r, 3); b.rect(x + 2, 28 + k * 30 - h - 4, 2, 4, col(r, 2)); b.set(x + 1, 30 + k * 30 - h, col(r, 6)); } }
    box(b, 0, H - 44, W, 44, A, 4); b.rect(0, H - 44, W, 4, col(B, 6)); for (let i = 8; i < W - 8; i += 32) box(b, i, H - 36, 26, 30, A, 3, { outline: false }); b.rect(0, H - 6, W, 2, col(B, 4));
    box(b, 40, H - 54, 8, 10, 'water', 6); box(b, 120, H - 56, 10, 12, 'amber', 5);
  },
  piano({ b, W, H, A, B }) { // 3 x 2: grand piano, lid raised
    for (let i = 0; i < 120; i++) { const y = H - 60 - Math.round(i * 0.45); b.rect(20 + i, y, 2, 3, col(A, 4)); b.set(20 + i, y - 1, K); }
    box(b, 140, H - 116, 4, 56, B, 5);
    box(b, 8, H - 62, W - 16, 22, A, 4); b.rect(8, H - 62, W - 16, 2, col(A, 6)); sheen(b, 8, H - 62, 80, 18);
    box(b, 12, H - 44, 60, 8, 'marble', 6); for (let i = 14; i < 70; i += 4) b.rect(i, H - 44, 2, 5, K);
    turned(b, 20, H - 40, 40, A, 3); turned(b, W - 30, H - 40, 40, A, 3); box(b, 90, H - 22, 24, 6, B, 4); for (const x of [94, 104]) b.rect(x, H - 16, 2, 8, col(B, 5));
    box(b, 30, H - 90, 22, 26, 'plaster', 6); for (let j = 0; j < 5; j++) b.rect(34, H - 86 + j * 4, 14, 1, col('cloth', 3));
  },
  neon_sign({ b, W, H, A, B, on, frame }) { // 2 x 1 wall
    box(b, 2, 8, W - 4, H - 20, 'cloth', 1);
    const ci = on ? col(frame ? 'red' : 'neon', frame ? 5 : 4) : col('cloth', 3);
    text(b, 'OPEN BAR', 12, 18, ci, 3, { glow: on ? 1 : 0 }); if (on) glowAt(b, W / 2, H / 2 - 2, 50, 1.2);
    b.rect(20, 2, 2, 8, K); b.rect(W - 22, 2, 2, 8, K);
  },
  trophy({ b, W, H, A, B }) { box(b, 12, H - 18, 40, 18, A, 3); box(b, 22, H - 26, 20, 10, 'gold', 4); box(b, 28, H - 34, 8, 10, 'gold', 4); for (let j = 0; j < 22; j++) { const w = 20 - Math.round((j / 22) ** 2 * 12); b.rect(32 - w / 2, H - 56 + j, w, 1, col('gold', 4 + (j < 4 ? 2 : 0))); b.set(32 - w / 2 - 1, H - 56 + j, K); b.set(32 + w / 2, H - 56 + j, K); } ring(b, 16, H - 50, 6, col('gold', 4), 2); ring(b, 48, H - 50, 6, col('gold', 4), 2); b.rect(26, H - 52, 3, 10, col('gold', 6)); },
  chandelier({ b, W, H, A, on, frame }) { // 2 x 1 ceiling: crystal chandelier in the metal colour
    b.rect(W / 2 - 1, 0, 3, 14, col(A, 3)); box(b, W / 2 - 8, 12, 16, 6, A, 5);
    for (let i = 0; i < W - 16; i++) { const y = 22 + Math.round(Math.sin((i / (W - 16)) * Math.PI) * 10); b.rect(8 + i, y, 1, 3, col(A, 4)); b.set(8 + i, y - 1, col(A, 6)); }
    for (let i = 12; i < W - 10; i += 8) { const y = 25 + Math.round(Math.sin(((i - 8) / (W - 16)) * Math.PI) * 10); for (let j = 0; j < 10; j++) b.set(i, y + j, col('water', 6 - (j % 3)), on ? 1 : 0); b.set(i, y + 10, col('plaster', 6), on ? 1 : 0); }
    for (const x of [14, 38, W - 40, W - 16]) { box(b, x - 2, 18, 4, 8, 'plaster', 6); if (on) flame(b, x, 8, 8, frame); }
    if (on) glowAt(b, W / 2, 26, 44, 1.6);
  },
};
// Every amenity uses the bunker catalog's footprint (w x h metres).
export const AMENITY_KINDS = Object.freeze(Object.keys(R).filter((k) => OBJECTS[k]));
export const hasAmenity = (kind) => !!R[kind] && !!OBJECTS[kind];
export const amenitySize = (kind) => ({ w: OBJECTS[kind].w * M, h: OBJECTS[kind].h * M });

/** Native 64 px art for one piece (headless). */
export function amenityRaster(kind, { a = '#a8acb0', b: bHex = '#6a6e72' } = {}, { on = true, frame = 0 } = {}) {
  const { w, h } = amenitySize(kind);
  const r = new Raster(w, h);
  R[kind]({ b: r, W: w, H: h, A: rampFromHex(a), B: rampFromHex(bHex), on, frame: frame % 2 });
  return r;
}

/** Level of detail for the 16 px editor: average each f x f block, snap to a colour the piece uses, keep outlines. */
export function reduceRaster(src, f) {
  if (f <= 1) return src;
  const out = new Raster(Math.floor(src.w / f), Math.floor(src.h / f));
  const used = [...new Set(src.c)].filter(Boolean);
  const rgb = (ci) => { const n = parseInt(HD_COLOURS[ci].slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const usedRgb = used.map(rgb);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    let r = 0, g = 0, bl = 0, n = 0, dark = 0, glow = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) { const ci = src.get(x * f + i, y * f + j); if (!ci) continue; const c = rgb(ci); r += c[0]; g += c[1]; bl += c[2]; n++; if (ci === K) dark++; if (src.glow[(y * f + j) * src.w + x * f + i]) glow++; }
    if (n * 2 < f * f) continue;
    if (dark * 2 >= n) { out.set(x, y, K); continue; }
    let best = used[0], bd = Infinity;
    usedRgb.forEach((c, k) => { const d = (c[0] - r / n) ** 2 + (c[1] - g / n) ** 2 + (c[2] - bl / n) ** 2; if (d < bd) { bd = d; best = used[k]; } });
    out.set(x, y, best, glow * 2 >= n);
  }
  return out;
}

const cache = new Map();
/** A canvas of the piece at `tile` px per metre (64 = native), cached. */
export function amenityCanvas(kind, v = {}, { on = true, frame = 0, tile = M } = {}) {
  const key = `${kind}|${v.a}|${v.b}|${on}|${frame % 2}|${tile}`;
  let cv = cache.get(key);
  if (!cv) {
    const r = reduceRaster(amenityRaster(kind, v, { on, frame }), Math.max(1, Math.round(M / tile)));
    cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(r.w, r.h) : Object.assign(document.createElement('canvas'), { width: r.w, height: r.h });
    const ctx = cv.getContext('2d');
    ctx.putImageData(new ImageData(r.rgba(), r.w, r.h), 0, 0);
    if (cache.size > 800) cache.clear();
    cache.set(key, cv);
  }
  return cv;
}
export function drawAmenity(ctx, kind, px, py, v, { on = true, frame = 0, flip = false, tile = 16 } = {}) {
  const cv = amenityCanvas(kind, v, { on, frame, tile });
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (flip) { ctx.translate(px + cv.width, py); ctx.scale(-1, 1); ctx.drawImage(cv, 0, 0); } else ctx.drawImage(cv, px, py);
  ctx.restore();
}
void cyl; void hcyl; void drawRaster;
