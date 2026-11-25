// Client Gaze overlay and photo mode visuals at the 64 px minimum (#121, art note D4).
// GDD: Shelter canvas > overlays ("Client Gaze highlights only what the current client will actually look at on a
// walkthrough, which is almost never the scrubbers") and "Photo mode: hides the UI and frames the cutaway".
// Clients inspect Status and Delusion rooms every time, Comfort rooms half the time, Survive rooms only with a
// trait or an Inspector (GDD Clients > Client Gaze walkthroughs).
//
// Built with the 64 px kit (raster.js): ramps, a 1 px outline, light from the top-left, 2 frames where it moves.
// Every frame is at least 64 x 64. Overlays that sit on the 16 px builder grid draw a reduced copy (reduceRaster),
// the way #118's amenities do until the director confirms the 64 px grid.
//
//   gazeRaster('look', { frame })   photoRaster('viewfinder')   GAZE_ASSETS / PHOTO_ASSETS: ids and sizes
//   gazeLevel(tier, { inspector })  -> 'look' | 'maybe' | 'skip'
//   drawGaze(ctx, id, x, y, { frame, tile })   drawPhoto(ctx, id, x, y, { frame, flipX, flipY })

import { Raster, col, K, box, glowAt, text, textW, hash, bayer } from './raster.js';
import { reduceRaster } from './amenities64.js';

export const GAZE_PX = 64;

// ------------------------------------------------------------------------------------------ eyes
/** An eye 64 x 64. open: 0 shut .. 1 wide; iris ramp; glance: pupil offset in px. */
function eye(b, { open = 1, iris = 'gold', glance = 0, lashes = true } = {}) {
  const cx = 32, cy = 34, rx = 26, ry = 15 * open;
  // soft backing plate so the eye reads on any room: a dark rounded tag
  for (let y = 4; y < 60; y++) for (let x = 2; x < 62; x++) {
    const dx = Math.max(0, Math.abs(x - 32) - 22), dy = Math.max(0, Math.abs(y - 32) - 20);
    const d = Math.hypot(dx, dy);
    if (d < 8) b.set(x, y, d > 6.6 ? K : col('cloth', 1 + (y < 12 ? 1 : 0)));
  }
  if (open <= 0.05) { // shut: a curved lid line with lashes
    for (let x = cx - rx; x <= cx + rx; x++) { const t = (x - cx) / rx; const y = Math.round(cy + (1 - t * t) * 6); b.rect(x, y, 1, 2, col('plaster', 5)); b.set(x, y + 2, K); }
    if (lashes) for (let k = -2; k <= 2; k++) { const x = cx + k * 9, y = cy + Math.round((1 - (k * 9 / rx) ** 2) * 6) + 3; for (let j = 0; j < 5; j++) b.set(x + Math.round(k * j * 0.35), y + j, col('plaster', 4)); }
    return;
  }
  // white of the eye, shaded at the corners and under the top lid
  for (let y = Math.floor(cy - ry) - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
    const t = (x - cx) / rx, half = ry * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.15 * Math.abs(t));
    const dy = y - cy;
    if (Math.abs(dy) > half + 1) continue;
    if (Math.abs(dy) > half) { b.set(x, y, K); continue; }
    const shade = (dy < -half + 3 ? 2 : 0) + (Math.abs(t) > 0.75 ? 1 : 0);
    b.set(x, y, col('marble', 6 - shade));
  }
  // iris and pupil, clipped by the lids
  const ix = cx + glance, ir = 11;
  for (let y = cy - ir; y <= cy + ir; y++) for (let x = ix - ir; x <= ix + ir; x++) {
    const d = Math.hypot(x - ix, y - cy);
    if (d > ir || b.get(x, y) === K || !b.get(x, y)) continue;
    const t = (x - cx) / rx, half = ry * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.15 * Math.abs(t));
    if (Math.abs(y - cy) >= half) continue;
    if (d < 4.5) b.set(x, y, K);
    else if (d > ir - 1.2) b.set(x, y, col(iris, 1));
    else { const spoke = (Math.atan2(y - cy, x - ix) * 6 / Math.PI + 12) % 2 < 0.6; b.set(x, y, col(iris, (d < 7 ? 5 : 4) - (spoke ? 1 : 0) - (y < cy - 4 ? 1 : 0))); }
  }
  b.rect(ix - 5, cy - 6, 3, 3, col('marble', 6), 1); b.set(ix + 4, cy + 3, col('marble', 6), 1); // glints
  // upper lid line and lashes
  for (let x = cx - rx; x <= cx + rx; x++) { const t = (x - cx) / rx; const y = Math.round(cy - ry * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.15 * Math.abs(t))) - 1; b.rect(x, y - 1, 1, 2, K); }
  if (lashes) for (let k = -2; k <= 2; k++) { const x = cx + k * 9, t = (k * 9) / rx; const y = Math.round(cy - ry * Math.sqrt(1 - t * t) * (1 - 0.15 * Math.abs(t))) - 2; for (let j = 0; j < 5; j++) b.set(x + Math.round(k * j * 0.3), y - j, K); }
}

const GAZE = {
  // Status / Delusion: they will look, every time. Wide eye, gold iris; it glances along the room.
  look: { w: 64, h: 64, frames: 2, draw: (b, f) => { eye(b, { open: 1, iris: 'gold', glance: f ? 5 : -3 }); sparkle(b, 54, 10, f); } },
  // Comfort: half the time. Heavy lid, amber iris.
  maybe: { w: 64, h: 64, frames: 2, draw: (b, f) => eye(b, { open: f ? 0.45 : 0.6, iris: 'amber', glance: 2 }) },
  // Survive: they won't look. Shut eye and a "z".
  skip: { w: 64, h: 64, frames: 2, draw: (b, f) => { eye(b, { open: 0 }); text(b, 'Z', 48, f ? 8 : 12, col('cloth', 5), 2); } },
  // A trait or an Inspector makes them look at Survive rooms too: eye behind a magnifying glass.
  inspect: { w: 64, h: 64, frames: 2, draw: (b, f) => { eye(b, { open: 0.85, iris: 'teal', glance: f ? 3 : 0 }); lens(b, 40, 36, 15); } },
  // spotlight bracket, top-left corner: the overlay flips it for the other three
  bracket: { w: 64, h: 64, frames: 2, draw: (b, f) => bracket(b, 'gold', f) },
  bracket_maybe: { w: 64, h: 64, frames: 1, draw: (b) => bracket(b, 'amber', 0, true) },
  // the dim veil over rooms they skip: a tileable dark dither, 64 x 64
  veil: { w: 64, h: 64, frames: 1, draw: (b) => { for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (bayer(x, y) < 0.5) b.set(x, y, col('cloth', (x + y) % 8 === 0 ? 1 : 0)); } },
  // walkthrough route: two footprints, 2 frames (left, right)
  steps: { w: 64, h: 64, frames: 2, draw: (b, f) => { foot(b, 20, f ? 24 : 38, false); foot(b, 44, f ? 38 : 24, true); } },
};
function sparkle(b, x, y, f) { const r = f ? 6 : 4; for (let i = -r; i <= r; i++) { b.set(x + i, y, col('gold', 6), 1); b.set(x, y + i, col('gold', 6), 1); } b.set(x, y, col('marble', 6), 1); }
function lens(b, cx, cy, r) {
  for (let y = cy - r - 2; y <= cy + r + 2; y++) for (let x = cx - r - 2; x <= cx + r + 2; x++) { const d = Math.hypot(x - cx, y - cy); if (d > r - 1 && d <= r + 1.5) b.set(x, y, d > r + 0.6 ? K : col('steel', x < cx ? 6 : 4)); else if (d <= r - 1 && (x + y) % 5 === 0 && x < cx) b.shift(x, y, 1); }
  for (let k = 0; k < 14; k++) { const x = cx + Math.round((r + k) * 0.7), y = cy + Math.round((r + k) * 0.7); b.rect(x - 2, y - 2, 5, 5, K); b.rect(x - 1, y - 1, 3, 3, col('walnut', k < 3 ? 2 : 4)); }
}
function bracket(b, ramp, f, dashed = false) {
  const L = 52, T = 7;
  for (let i = 0; i < L; i++) for (let j = 0; j < T; j++) {
    if (dashed && Math.floor(i / 8) % 2) continue;
    const shade = j === 0 ? 6 : j === T - 1 ? 2 : 4 + (i < 12 ? 1 : 0);
    b.set(4 + i, 4 + j, j === T - 1 && i > 0 ? K : col(ramp, shade), f && i < 10 ? 1 : 0);
    b.set(4 + j, 4 + i, j === T - 1 && i > 0 ? K : col(ramp, shade - (j === 0 ? 1 : 0)), f && i < 10 ? 1 : 0);
  }
  b.rect(3, 3, L + 2, 1, K); b.rect(3, 3, 1, L + 2, K); b.rect(3 + L + 1, 3, 1, T + 2, K); b.rect(3, 3 + L + 1, T + 2, 1, K);
  if (!dashed) { b.rect(10, 10, 6, 6, K); b.rect(11, 11, 4, 4, col(ramp, f ? 6 : 5), 1); } // a rivet that catches the light
}
function foot(b, cx, cy, right) { // a shoe print: an oval sole and a round heel, toe leaning outward
  const m = right ? 1 : -1;
  const inSole = (x, y) => { const lx = x - m * (y + 5) * -0.12; return (lx / 7) ** 2 + ((y + 5) / 10) ** 2 <= 1; };
  const inHeel = (x, y) => (x / 5.5) ** 2 + ((y - 11) / 4.5) ** 2 <= 1;
  const inside = (x, y) => inSole(x, y) || inHeel(x, y);
  for (let y = -16; y <= 16; y++) for (let x = -9; x <= 9; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    const tread = inSole(x, y) && (y + 16) % 4 === 0;
    b.set(cx + x, cy + y, edge ? K : col('gold', 4 + (y < -9 ? 1 : 0) + (x * m < -2 ? -1 : 0) - (tread ? 1 : 0)));
  }
}
// ------------------------------------------------------------------------------------------ photo mode
const PHOTO = {
  // viewfinder corner, top-left (flip for the others): white L with a black keyline, like a camera's frame marks
  viewfinder: { w: 64, h: 64, frames: 1, draw: (b) => { const L = 48, T = 5; b.rect(2, 2, L + 2, T + 2, K); b.rect(2, 2, T + 2, L + 2, K); b.rect(3, 3, L, T, col('marble', 6)); b.rect(3, 3, T, L, col('marble', 6)); b.rect(3, 3 + T - 1, L, 1, col('marble', 4)); b.rect(3 + T - 1, 3 + T, 1, L - T, col('marble', 4)); } },
  // "PHOTO" camera with a blinking record light
  camera: { w: 64, h: 64, frames: 2, draw: (b, f) => {
    box(b, 8, 20, 48, 32, 'steel', 2); box(b, 16, 13, 16, 8, 'steel', 3); box(b, 42, 15, 8, 5, 'marble', 5);
    for (let y = 22; y < 52; y++) for (let x = 18; x < 50; x++) { const d = Math.hypot(x - 33, y - 36); if (d <= 12) b.set(x, y, d > 11 ? K : d > 8 ? col('steel', d > 10 ? 5 : 3) : col('water', 2 + (x < 31 && y < 34 ? 3 : 0) + (d < 3 ? 1 : 0))); }
    b.rect(27, 30, 3, 3, col('water', 6), 1);
    b.rect(10, 22, 6, 4, f ? col('red', 5) : col('red', 2), f ? 1 : 0); if (f) glowAt(b, 13, 24, 5, 1);
    for (let x = 10; x < 54; x += 4) b.rect(x, 49, 2, 1, col('steel', 1)); // grip texture
  } },
  // flash burst, 2 frames (bloom and fade)
  flash: { w: 64, h: 64, frames: 2, draw: (b, f) => {
    const R = f ? 20 : 30;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const dx = x - 32, dy = y - 32, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const ray = Math.pow(Math.abs(Math.cos(a * 4)), 18) * R * 1.05 + Math.pow(Math.abs(Math.cos(a * 4 + 0.39)), 30) * R * 0.6;
      const lim = Math.max(R * 0.35, ray);
      if (d > lim) continue;
      const t = d / lim;
      b.set(x, y, t < 0.35 ? col('marble', 6) : t < 0.7 ? col('amber', 6) : col('amber', 5), 1);
    }
  } },
  // the shutter iris icon (the photo-mode button)
  iris: { w: 64, h: 64, frames: 2, draw: (b, f) => {
    const open = f ? 7 : 12;
    for (let y = 4; y < 60; y++) for (let x = 4; x < 60; x++) {
      const dx = x - 32, dy = y - 32, d = Math.hypot(dx, dy);
      if (d > 27) continue;
      if (d > 25.6) { b.set(x, y, K); continue; }
      if (d > 22) { b.set(x, y, col('steel', 4 + (dx + dy < 0 ? 2 : 0))); continue; }
      const a = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2) * 6;
      const blade = Math.floor(a), within = a - blade;
      if (d < open + within * 6) { b.set(x, y, col('water', d < 5 ? 5 : 2)); continue; }
      b.set(x, y, within < 0.07 ? K : col('steel', 2 + (blade % 2) + (within > 0.8 ? 1 : 0)));
    }
    b.rect(26, 26, 3, 3, col('water', 6), 1);
  } },
  // the PHOTO MODE plate shown while the UI is hidden
  label: { w: 192, h: 64, frames: 2, draw: (b, f) => {
    box(b, 2, 10, 188, 44, 'steel', 1);
    b.rect(4, 12, 184, 2, col('steel', 3));
    b.rect(12, 24, 10, 10, f ? col('red', 5) : col('red', 3), f ? 1 : 0); b.rect(13, 25, 3, 3, col('red', 6), 1);
    text(b, 'PHOTO MODE', 32, 22, col('marble', 6), 3);
    text(b, 'ESC TO EXIT', 32, 42, col('cloth', 4), 2);
  } },
  // the share card: a polaroid with tape and the company's name; the window (x 16..272, y 16..192) takes the shot
  card: { w: 288, h: 256, frames: 1, window: { x: 16, y: 16, w: 256, h: 176 }, draw: (b) => {
    for (let y = 6; y < 256; y++) for (let x = 6; x < 288; x++) if (x > 281 || y > 249) b.set(x, y, col('cloth', 0)); // drop shadow
    for (let y = 0; y < 250; y++) for (let x = 0; x < 282; x++) {
      if (x === 0 || y === 0 || x === 281 || y === 249) { b.set(x, y, K); continue; }
      if (x >= 16 && x < 272 && y >= 16 && y < 192) continue; // the photo window stays clear
      const paper = 5 + (hash(x >> 2, y >> 2, 5) < 0.12 ? -1 : 0) + (y < 4 || x < 3 ? 1 : 0) - (y > 244 || x > 276 ? 1 : 0);
      b.set(x, y, col('plaster', paper));
    }
    b.rect(15, 15, 258, 1, K); b.rect(15, 192, 258, 1, col('plaster', 3)); b.rect(15, 15, 1, 178, K); b.rect(272, 15, 1, 178, col('plaster', 3));
    for (let y = -6; y < 14; y++) for (let x = 106; x < 176; x++) { const sx = x + Math.round(y * 0.2); if (y > -6 && y < 12 && hash(sx, y, 9) > 0.03) b.set(sx, y + 4, (sx + y) % 11 === 0 ? col('amber', 5) : col('amber', 6)); } // tape
    const name = 'LAST RESORT HOLDINGS';
    text(b, name, Math.round((282 - textW(name, 2)) / 2), 204, col('walnut', 2), 2);
    const tag = 'YOUR SHELTER. YOUR TERMS.';
    text(b, tag, Math.round((282 - textW(tag, 2)) / 2), 224, col('plaster', 2), 2);
  } },
};

// ------------------------------------------------------------------------------------------ API
export const GAZE_ASSETS = Object.freeze(Object.fromEntries(Object.entries(GAZE).map(([k, v]) => [k, { w: v.w, h: v.h, frames: v.frames }])));
export const PHOTO_ASSETS = Object.freeze(Object.fromEntries(Object.entries(PHOTO).map(([k, v]) => [k, { w: v.w, h: v.h, frames: v.frames, ...(v.window ? { window: v.window } : {}) }])));
export const PHOTO_CARD_WINDOW = PHOTO.card.window;

/** What a client does with a room on a walkthrough (GDD): Status and Delusion always, Comfort half the time,
 *  Survive only with a trait or an Inspector. */
export function gazeLevel(tier, { inspector = false } = {}) {
  if (tier === 'status' || tier === 'delusion') return 'look';
  if (tier === 'comfort') return 'maybe';
  return inspector ? 'inspect' : 'skip';
}

function render(table, id, frame) {
  const a = table[id];
  if (!a) throw new Error(`no asset ${id}`);
  const b = new Raster(a.w, a.h);
  a.draw(b, frame % a.frames);
  return b;
}
export const gazeRaster = (id, { frame = 0 } = {}) => render(GAZE, id, frame);
export const photoRaster = (id, { frame = 0 } = {}) => render(PHOTO, id, frame);

const cache = new Map();
function canvasOf(kind, id, frame, f) {
  const key = `${kind}:${id}:${frame}:${f}`;
  let cv = cache.get(key);
  if (!cv) {
    const r0 = kind === 'gaze' ? gazeRaster(id, { frame }) : photoRaster(id, { frame });
    const r = f > 1 ? reduceRaster(r0, f) : r0;
    cv = Object.assign(document.createElement('canvas'), { width: r.w, height: r.h });
    cv.getContext('2d').putImageData(new ImageData(r.rgba(), r.w, r.h), 0, 0);
    cache.set(key, cv);
  }
  return cv;
}
function blit(ctx, cv, x, y, flipX, flipY) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x + (flipX ? cv.width : 0), y + (flipY ? cv.height : 0));
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.drawImage(cv, 0, 0);
  ctx.restore();
}
/** Draw a gaze asset. `tile` = px per metre of the grid it sits on (64 native; 16 draws the reduced copy). */
export function drawGaze(ctx, id, x, y, { frame = 0, tile = GAZE_PX, flipX = false, flipY = false } = {}) {
  const cv = canvasOf('gaze', id, frame % GAZE[id].frames, Math.max(1, Math.round(GAZE_PX / tile)));
  blit(ctx, cv, x, y, flipX, flipY);
  return cv;
}
/** Draw a photo-mode asset at native size (it sits on the screen, not the grid). */
export function drawPhoto(ctx, id, x, y, { frame = 0, flipX = false, flipY = false } = {}) {
  const cv = canvasOf('photo', id, frame % PHOTO[id].frames, 1);
  blit(ctx, cv, x, y, flipX, flipY);
  return cv;
}
