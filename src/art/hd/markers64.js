// World-map markers at the 64 px minimum (#24, art note D4): city skyline, waiting client, sold bunker, your site
// and HQ, each authored at 64 x 64 with a 1 px outline and top-left light.
//
// The map's marker layer is still drawn at the 320 x 192 map resolution (#127 owns rendering and scale), so the
// game shows a level-of-detail copy at each marker's old footprint: blocks averaged and snapped back to colours the
// icon uses, outlines kept. When the marker layer moves to the terrain's resolution, pass a bigger `size`.
//
//   markerRaster('city', { frame })                 -> Raster 64 x 64 (headless)
//   drawMarker64(ctx, 'city', x, y, { frame, size })   size = on-screen px (default: the old icon's width)

import { Raster, col, K, box, cyl, hash, bayer, glowAt } from './raster.js';
import { reduceRaster } from './amenities64.js';

export const MARKER_PX = 64;
const N = MARKER_PX;
const disc = (b, cx, cy, r, ramp, base) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y); if (d > r + 0.5) continue; b.set(cx + x, cy + y, d > r - 0.6 ? K : col(ramp, base + Math.round((-x - y) / r))); } };
const windows = (b, x, y, w, h, frame, s) => { for (let j = y + 3; j < y + h - 3; j += 5) for (let i = x + 2; i < x + w - 3; i += 4) { const lit = hash(i, j, s + frame) < 0.55; b.rect(i, j, 2, 3, col(lit ? 'amber' : 'steel', lit ? 5 : 1), lit ? 1 : 0); } };

const R = {
  city(b, { frame }) { // three towers, lit windows, a mast with a blinking light
    box(b, 4, 30, 18, 32, 'steel', 3); windows(b, 4, 30, 18, 32, frame, 1);
    box(b, 22, 12, 20, 50, 'steel', 4); windows(b, 22, 12, 20, 50, frame, 2); box(b, 26, 6, 12, 7, 'steel', 5); box(b, 31, 0, 2, 7, 'steel', 6);
    b.rect(30, 0, 4, 2, col('red', frame ? 3 : 6), frame ? 0 : 1);
    box(b, 42, 22, 18, 40, 'steel', 2); windows(b, 42, 22, 18, 40, frame, 3); box(b, 46, 18, 10, 5, 'gold', 4);
    b.rect(2, 62, 60, 2, K);
  },
  client(b) { // a waiting buyer: head, dark suit, gold tie, a briefcase of money
    disc(b, 30, 16, 11, 'skin', 3); b.rect(20, 5, 21, 7, col('walnut', 2)); b.rect(22, 4, 16, 2, col('walnut', 3)); for (const x of [26, 33]) b.rect(x, 15, 3, 2, K); b.rect(27, 22, 7, 1, col('skin', 1));
    box(b, 14, 30, 33, 30, 'cloth', 1); b.rect(26, 30, 9, 8, col('plaster', 6)); for (let j = 0; j < 22; j++) { const w = j < 4 ? 3 : Math.max(1, 5 - Math.floor((j - 4) / 5)); b.rect(30 - (w >> 1), 31 + j, w, 1, col('gold', j < 3 ? 6 : 5)); }
    for (let j = 30; j < 46; j++) { b.set(22 + Math.floor((j - 30) / 3), j, col('cloth', 3)); b.set(38 - Math.floor((j - 30) / 3), j, col('cloth', 3)); }
    box(b, 44, 44, 16, 14, 'walnut', 4); b.rect(49, 41, 6, 3, K); b.rect(46, 50, 12, 1, col('gold', 5)); b.rect(48, 47, 3, 3, col('leaf', 5));
  },
  bunker(b, { frame }) { // a sold shelter: a blast hatch set in a mound, gold rim
    for (let y = 0; y < 28; y++) { const half = Math.round(Math.sqrt(Math.max(0, 1 - (y / 28) ** 2)) * 30); b.rect(32 - half, 62 - y, half * 2, 1, col('leaf', 3 + (y > 22 ? 1 : 0) - (bayer(32 - half, y) < 0.2 ? 1 : 0))); b.set(32 - half - 1, 62 - y, K); b.set(32 + half, 62 - y, K); }
    box(b, 14, 30, 36, 18, 'steel', 4); for (let i = 0; i < 36; i++) b.set(14 + i, 30, col('gold', 6)); for (let i = 16; i < 48; i += 8) b.rect(i, 33, 4, 12, col('steel', 2));
    disc(b, 32, 39, 7, 'gold', 4); b.rect(28, 38, 9, 2, col('gold', 2)); b.rect(31, 35, 2, 9, col('gold', 2));
    if (!frame) glowAt(b, 32, 39, 10, 1);
    box(b, 26, 16, 12, 14, 'steel', 3); b.rect(28, 18, 8, 3, col('water', 5), 1);
  },
  site(b, { frame }) { // your site: a flagpole with the company flag, a survey stake
    box(b, 12, 4, 4, 58, 'steel', 5); disc(b, 14, 4, 3, 'gold', 5);
    for (let j = 0; j < 26; j++) for (let i = 0; i < 38; i++) { const wave = Math.round(Math.sin(i * 0.25 + (frame ? 1.5 : 0)) * 2); b.set(16 + i, 8 + j + wave, j < 2 || j > 23 || i > 35 ? K : col('gold', 4 + (j < 8 ? 1 : 0) - (i > 26 ? 1 : 0))); }
    for (let j = 0; j < 12; j++) b.rect(26 + Math.abs(6 - j) * 0, 15 + j, 3, 1, col('gold', 1)); b.rect(26, 15, 12, 3, col('gold', 1)); b.rect(26, 24, 12, 3, col('gold', 1));
    b.rect(4, 60, 24, 3, col('walnut', 3)); b.rect(4, 63, 24, 1, K);
  },
  hq(b, { frame }) { // Last Resort HQ: a gold-topped tower with a beacon
    box(b, 18, 14, 28, 48, 'steel', 2); for (let j = 18; j < 58; j += 6) b.rect(21, j, 22, 3, col('amber', frame && j % 12 === 0 ? 4 : 5), 1);
    box(b, 22, 4, 20, 11, 'gold', 4); b.rect(22, 4, 20, 2, col('gold', 6)); box(b, 30, 0, 4, 5, 'gold', 5);
    box(b, 6, 40, 12, 22, 'steel', 3); box(b, 46, 34, 12, 28, 'steel', 3); for (const [x, y, h] of [[8, 44, 16], [48, 38, 22]]) for (let j = y; j < y + h; j += 5) b.rect(x + 2, j, 4, 2, col('amber', 4), 1);
    glowAt(b, 32, 2, 12, frame ? 0.6 : 1.6); b.rect(10, 62, 44, 2, K);
  },
};
export const MARKER64_KINDS = Object.freeze(Object.keys(R));
const OLD_SIZE = { city: 9, client: 8, bunker: 10, site: 9, hq: 12 };

export function markerRaster(id, { frame = 0 } = {}) {
  const b = new Raster(N, N);
  R[id](b, { frame: frame % 2 });
  return b;
}

const cache = new Map();
function canvases(id, frame, size) {
  const key = `${id}|${frame % 2}|${size}`;
  let c = cache.get(key);
  if (!c) {
    const r = reduceRaster(markerRaster(id, { frame }), Math.max(1, Math.round(N / size)));
    const mk = () => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(r.w, r.h) : Object.assign(document.createElement('canvas'), { width: r.w, height: r.h }));
    const art = mk(); art.getContext('2d').putImageData(new ImageData(r.rgba(), r.w, r.h), 0, 0);
    const sil = mk(); const px = r.rgba(); for (let i = 0; i < px.length; i += 4) if (px[i + 3]) { px[i] = 10; px[i + 1] = 8; px[i + 2] = 7; } sil.getContext('2d').putImageData(new ImageData(px, r.w, r.h), 0, 0);
    c = { art, sil };
    cache.set(key, c);
  }
  return c;
}
/** Draw a marker with its soft drop shadow, at `size` px (default: the old icon's width, so the map layout holds). */
export function drawMarker64(ctx, id, x, y, { frame = 0, size = OLD_SIZE[id] ?? 10 } = {}) {
  const { art, sil } = canvases(id, frame, size);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.45; ctx.drawImage(sil, x + 1, y + 1); ctx.globalAlpha = 1;
  ctx.drawImage(art, x, y);
}
void cyl;
