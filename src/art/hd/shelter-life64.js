// Shelter life visuals at the 64 px minimum (#122, art note D4; style guide: 1 m = 64 px).
//
// The pieces that show a shelter living, sealed or failing:
//   DOORS      door, airlock, blast_1..3 (1 x 3 m = 64 x 192), each in three states:
//                closed  - shut, lamp green
//                open    - swung or slid aside, the corridor beyond in shadow (a resident is in the doorway)
//                sealed  - the pressure test / lockdown: bolts thrown, wheel locked, lamp red with a red wash
//   RESIDENTS  64 x 128 (1 x 2 m) people about 1.75 m tall, lit from the top-left, outfit by wealth class;
//              poses: stand, walk (2 frames), sit, lie (128 x 64), reach, drink, read, admire
//   DAYS SEALED a 64 x 64 hatch-wheel emblem whose ring fills with the days the shelter can stay sealed
//
// Built on the 64 px raster core (#117): every pixel is a step on a material ramp. In the editor (still
// 16 px per metre until the director confirms the 64 rule) they draw as a level-of-detail reduction of the
// 64 px art, like the fixtures (#119) and amenities (#118).
//
//   doorRaster(kind, state, { frame })      residentRaster(look, pose, { frame })      daysSealedRaster(days, need)
//   drawDoor(ctx, kind, px, py, { state, frame, flip, tile })   drawResident64(ctx, look, pose, cx, by, { frame, flip, tile })

import { Raster, col, K, box, led, glowAt, cone, hash, bayer, text, textW } from './raster.js';
import { reduceRaster } from './amenities64.js';

export const LIFE_PX = 64;
const M = LIFE_PX;
export const DOOR_KINDS = Object.freeze(['door', 'airlock', 'blast_1', 'blast_2', 'blast_3']);
export const DOOR_STATES = Object.freeze(['closed', 'open', 'sealed']);
export const RESIDENT_POSES = Object.freeze(['stand', 'walk', 'sit', 'lie', 'reach', 'drink', 'read', 'admire']);

// ------------------------------------------------------------------------------------------ helpers
/** A 1 px dark outline around everything drawn so far (only on empty pixels next to art). */
function outlineAll(b) {
  const add = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (b.get(x, y)) continue;
    if (b.get(x + 1, y) || b.get(x - 1, y) || b.get(x, y + 1) || b.get(x, y - 1)) add.push([x, y]);
  }
  for (const [x, y] of add) b.set(x, y, K);
}
/** Lit block without an outline: top-left lit, bottom-right shaded (for limbs and cloth). */
function limb(b, x, y, w, h, ramp, base) {
  b.rect(x, y, w, h, col(ramp, base));
  b.rect(x, y, Math.max(1, Math.round(w * 0.3)), h, col(ramp, base + 1));
  b.rect(x + w - Math.max(1, Math.round(w * 0.25)), y, Math.max(1, Math.round(w * 0.25)), h, col(ramp, base - 1));
}
const bolt = (b, x, y, ramp = 'steel') => { b.rect(x, y, 4, 4, col(ramp, 5)); b.set(x, y, col(ramp, 7)); b.set(x + 3, y + 3, col(ramp, 2)); };

// ------------------------------------------------------------------------------------------ doors
const DOOR_LOOK = {
  door: { frame: 'walnut', slab: 'walnut', slabBase: 4, bolts: 0, hazard: false, window: false },
  airlock: { frame: 'steel', slab: 'steel', slabBase: 4, bolts: 4, hazard: true, window: true },
  blast_1: { frame: 'steel', slab: 'steel', slabBase: 3, bolts: 6, hazard: true, window: false, plates: 1 },
  blast_2: { frame: 'steel', slab: 'steel', slabBase: 3, bolts: 8, hazard: true, window: false, plates: 2 },
  blast_3: { frame: 'concrete', slab: 'steel', slabBase: 2, bolts: 10, hazard: true, window: false, plates: 3 },
};

function doorFrame(b, L, W, H) {
  box(b, 0, 0, 8, H, L.frame, 4); box(b, W - 8, 0, 8, H, L.frame, 3); box(b, 0, 0, W, 10, L.frame, 4);
  b.shade(W - 8, 10, 8, H - 10, -0.6);
}
function doorway(b, W, H) {
  // the corridor beyond the door, in shadow, with a sliver of floor light
  b.rect(8, 10, W - 16, H - 10, col('concrete', 0));
  for (let y = 10; y < H; y++) if (bayer(20, y) < (y - 10) / (H - 10) * 0.5) b.set(20, y, col('concrete', 1));
  b.rect(8, H - 6, W - 16, 6, col('concrete', 2));
  for (let x = 10; x < W - 10; x += 2) b.set(x, H - 6, col('concrete', 3));
}

function slab(b, kind, L, W, H, state, frame) {
  const sealed = state === 'sealed';
  if (kind === 'door') {
    box(b, 8, 10, W - 16, H - 10, L.slab, L.slabBase);
    // two recessed panels
    for (const [y, h] of [[20, 70], [100, H - 110]]) { box(b, 14, y, W - 28, h, L.slab, L.slabBase - 1, { outline: false }); b.rect(14, y, W - 28, 1, col(L.slab, 1)); b.rect(14, y + h - 1, W - 28, 1, col(L.slab, 6)); }
    // brass handle, a deadbolt thrown when sealed
    box(b, W - 22, 96, 6, 12, 'gold', 4); b.set(W - 21, 97, col('gold', 6));
    if (sealed) { box(b, W - 22, 84, 14, 5, 'steel', 5); }
    return;
  }
  // heavy steel slabs: airlock and blast doors
  box(b, 8, 10, W - 16, H - 10, L.slab, L.slabBase);
  for (let p = 0; p < (L.plates ?? 0); p++) { const y = 26 + p * 46; box(b, 12, y, W - 24, 30, L.slab, L.slabBase + 1, { outline: true }); b.rect(14, y + 2, W - 28, 1, col(L.slab, L.slabBase + 3)); }
  if (L.hazard) { // hazard band, chevrons
    const y0 = H - 40;
    for (let y = y0; y < y0 + 12; y++) for (let x = 10; x < W - 10; x++) b.set(x, y, ((x + y) >> 2) % 2 ? col('hazard', 4) : col('K', 0));
    b.rect(10, y0 - 1, W - 20, 1, col('steel', 1)); b.rect(10, y0 + 12, W - 20, 1, col('steel', 6));
  }
  if (L.window) { // porthole: lit corridor beyond, or dark if sealed
    const cx = W / 2, cy = 52;
    for (let y = -14; y <= 14; y++) for (let x = -14; x <= 14; x++) {
      const d = Math.hypot(x, y);
      if (d > 14) continue;
      if (d > 11) b.set(cx + x, cy + y, d > 13 ? K : col('steel', 6 - Math.round((x + y) / 10)));
      else b.set(cx + x, cy + y, sealed ? col('water', 1) : col('water', 3 + (x + y < -6 ? 2 : 0)));
    }
    if (!sealed) { b.set(cx - 5, cy - 6, col('water', 6)); b.set(cx - 4, cy - 7, col('water', 6)); }
  }
  // the locking wheel: spokes turn when the door is sealed
  const wy = L.window ? 104 : H / 2 + 6, wx = W / 2, rad = 12;
  for (let t = 0; t < 6.29; t += 0.05) { b.set(Math.round(wx + Math.cos(t) * rad), Math.round(wy + Math.sin(t) * rad), col('steel', 6)); b.set(Math.round(wx + Math.cos(t) * (rad + 1)), Math.round(wy + Math.sin(t) * (rad + 1)), K); }
  const turn = sealed ? Math.PI / 4 : 0;
  for (let s = 0; s < 4; s++) { const a = turn + (s * Math.PI) / 2; for (let r = 0; r < rad; r++) b.set(Math.round(wx + Math.cos(a) * r), Math.round(wy + Math.sin(a) * r), col('steel', 5)); }
  box(b, wx - 3, wy - 3, 7, 7, 'gold', 4);
  // bolts along both edges; thrown into the frame when sealed
  for (let i = 0; i < L.bolts; i++) {
    const y = 22 + Math.round(i * ((H - 60) / Math.max(1, L.bolts - 1)) / 2) * 2;
    const left = i % 2 === 0;
    if (sealed) box(b, left ? 2 : W - 14, y, 12, 5, 'steel', 6);
    else bolt(b, left ? 12 : W - 16, y);
  }
  // grime that collects low on heavy doors
  for (let y = H - 30; y < H; y++) for (let x = 10; x < W - 10; x++) if (hash(x >> 1, y >> 1, 4) < (y - (H - 30)) / 60) b.shift(x, y, -1);
}

/** Native 64 px door art. state: 'closed' | 'open' | 'sealed'. */
export function doorRaster(kind, state = 'closed', { frame = 0 } = {}) {
  const L = DOOR_LOOK[kind] ?? DOOR_LOOK.door;
  const W = M, H = 3 * M;
  const b = new Raster(W, H);
  if (state === 'open') {
    doorway(b, W, H);
    // the slab swung (hinged) or slid (heavy doors) to the side: a thin lit edge
    if (kind === 'door') { box(b, 8, 10, 10, H - 10, L.slab, L.slabBase + 1); }
    else box(b, 8, 10, 8, H - 10, L.slab, L.slabBase + 2);
  } else slab(b, kind, L, W, H, state, frame);
  doorFrame(b, L, W, H);
  // status lamp over the door: green when it opens, red and glowing when sealed
  const lampOn = state !== 'sealed' || frame % 2 === 0;
  box(b, W / 2 - 6, 1, 12, 7, 'steel', 2);
  led(b, W / 2 - 3, 3, state === 'sealed' ? 'red' : 'leaf', 0, false, 6);
  if (state === 'sealed') {
    if (lampOn) glowAt(b, W / 2, 6, 14, 1.6);
    // a red wash over the slab, and a stencilled SEALED under the wheel
    for (let y = 10; y < H; y++) for (let x = 8; x < W - 8; x++) if (bayer(x, y) < 0.18) b.shift(x, y, -1);
    const label = 'SEALED';
    text(b, label, Math.round((W - textW(label, 2)) / 2), kind === 'door' ? 48 : H - 62, col('red', lampOn ? 5 : 4), 2, { worn: 0.08, glow: 1 });
  }
  return b;
}

// ------------------------------------------------------------------------------------------ residents
const OUTFIT = { C1: ['walnut', 'cloth', 'leaf'], C2: ['cloth', 'cloth', 'water'], C3: ['violet', 'cloth', 'gold'], C4: ['gold', 'marble', 'red'] };
const SKIN = [['skin', 4], ['skin', 3], ['skin', 2], ['walnut', 4]];
const HAIR = [['walnut', 1], ['walnut', 4], ['plaster', 5], ['marble', 5], ['red', 3]];

/** How a resident looks, from their record (stable per name). */
export function residentLook(r) {
  const n = r.name?.length ?? 5, h = hash(n, (r.name ?? '').charCodeAt(0) || 1, 3);
  return { cls: OUTFIT[r.cls] ? r.cls : 'C1', skin: SKIN[n % SKIN.length], hair: HAIR[(n * 3) % HAIR.length], long: h > 0.55 };
}

function head(b, cx, top, look) {
  const [sr, ss] = look.skin, [hr, hs] = look.hair;
  const hi = Math.min(ss + 1, sr === 'skin' ? 4 : 6);
  b.rect(cx - 11, top, 22, 23, col(sr, ss)); // face, chunky like the references
  b.rect(cx - 11, top + 2, 5, 19, col(sr, hi)); // lit cheek (light from the top-left)
  b.rect(cx + 7, top + 3, 4, 20, col(sr, ss - 1)); // shaded jaw side
  b.rect(cx - 9, top + 21, 18, 2, col(sr, ss - 1)); // chin shadow
  b.rect(cx - 12, top - 4, 24, 8, col(hr, hs)); b.rect(cx - 12, top - 4, 24, 2, col(hr, Math.min(hs + 2, 6))); b.rect(cx - 6, top - 2, 8, 1, col(hr, Math.min(hs + 2, 6)));
  b.rect(cx - 12, top + 4, 5, look.long ? 26 : 10, col(hr, hs - 1));
  b.rect(cx + 3, top + 9, 4, 4, K); b.set(cx + 4, top + 9, col('plaster', 6)); // eye
  b.rect(cx + 2, top + 6, 6, 1, col(hr, hs - 1)); // brow
  b.rect(cx + 8, top + 12, 3, 4, col(sr, ss - 1)); // nose
  b.rect(cx + 2, top + 18, 6, 1, col(sr, ss - 2)); // mouth
  b.rect(cx - 5, top + 23, 10, 4, col(sr, ss - 1)); // neck
}
function torso(b, cx, top, h, look) {
  const [suit, shirt, accent] = OUTFIT[look.cls];
  limb(b, cx - 16, top + 2, 32, h - 2, suit, 3); // jacket with shoulders
  b.rect(cx - 15, top, 30, 3, col(suit, 4));
  b.rect(cx - 4, top, 9, 16, col(shirt === 'cloth' ? 'plaster' : shirt, 6)); // shirt front
  b.rect(cx - 6, top, 2, 22, col(suit, 1)); b.rect(cx + 5, top, 2, 22, col(suit, 1)); // lapels
  b.rect(cx - 1, top + 2, 3, 18, col(accent, 4)); b.set(cx, top + 2, col(accent, 6)); b.rect(cx - 2, top + 2, 5, 3, col(accent, 5)); // tie knot
  b.rect(cx - 16, top + h - 5, 32, 3, col(suit, 1)); // hem
  for (let y = top + 6; y < top + h - 6; y += 9) b.set(cx + 8, y, col(accent === 'gold' ? 'gold' : suit, 5)); // buttons
}
function arm(b, x, y, len, look, { across = false } = {}) {
  const [suit] = OUTFIT[look.cls];
  const [sr, ss] = look.skin;
  if (across) { limb(b, x, y, len, 9, suit, 3); b.rect(x + len, y + 1, 7, 7, col(sr, ss)); return; }
  limb(b, x, y, 9, len, suit, 3); b.rect(x + 1, y + len, 7, 7, col(sr, ss)); b.rect(x + 1, y + len + 5, 7, 2, col(sr, ss - 1));
}
function leg(b, x, top, len, tr, base, bend = 0) {
  // thigh then shin (shifted by `bend` for a stride), then a shoe
  const half = Math.round(len / 2);
  limb(b, x, top, 12, half, tr, base);
  limb(b, x + bend, top + half, 12, len - half, tr, base - (bend ? 1 : 0));
  b.rect(x + bend - 1, top + len, 15, 5, col('walnut', 1)); b.rect(x + bend - 1, top + len, 15, 1, col('walnut', 3)); b.rect(x + bend + 10, top + len + 1, 4, 3, col('walnut', 2));
}
function trousers(look) { const [, t] = OUTFIT[look.cls]; return t === 'marble' ? ['marble', 4] : ['cloth', 2]; }

/** Native 64 px art for a resident in a pose (facing right). 64 x 128, or 128 x 64 lying down. */
export function residentRaster(look, pose = 'stand', { frame = 0 } = {}) {
  if (pose === 'lie') {
    const b = new Raster(2 * M, M);
    const [suit] = OUTFIT[look.cls];
    const [tr, tb] = trousers(look);
    const [sr, ss] = look.skin, [hr, hs] = look.hair;
    // lying on their back, head left: hair, face in profile, jacket, trousers, shoes up
    b.rect(8, 30, 12, 22, col(hr, hs)); b.rect(18, 30, 20, 22, col(sr, ss)); b.rect(18, 30, 20, 4, col(sr, Math.min(ss + 1, sr === 'skin' ? 4 : 6)));
    b.rect(26, 36, 5, 2, K); b.rect(36, 40, 4, 4, col(sr, ss - 1)); // closed eye, nose
    limb(b, 40, 32, 42, 22, suit, 3); b.rect(40, 32, 42, 3, col(suit, 5));
    b.rect(58, 36, 8, 14, col('plaster', 6)); // shirt and hands folded
    b.rect(60, 38, 10, 6, col(sr, ss));
    limb(b, 82, 36, 34, 16, tr, tb);
    b.rect(116, 30, 6, 22, col('walnut', 1)); b.rect(116, 30, 2, 22, col('walnut', 3));
    outlineAll(b);
    if (frame % 2) { text(b, 'Z', 34, 8, col('plaster', 6), 2); text(b, 'Z', 46, 0, col('plaster', 5), 2); }
    return b;
  }
  const b = new Raster(M, 2 * M);
  const cx = 30, feet = 122;
  const sit = pose === 'sit';
  const [tr, tb] = trousers(look);
  const step = pose === 'walk' ? (frame % 2 ? 1 : -1) : 0;
  const legLen = 40;
  const top = sit ? feet - 5 - 22 - 40 - 27 : feet - 5 - legLen - 40 - 27; // shoes, shins/thighs, torso, head
  // back limbs first (darker), so the front ones overlap them
  if (sit) {
    limb(b, cx - 12, top + 66, 30, 12, tr, tb - 1); limb(b, cx + 14, top + 72, 12, feet - top - 77, tr, tb - 1);
    b.rect(cx + 13, feet - 5, 15, 5, col('walnut', 1));
  } else if (step) {
    leg(b, cx - 10 - 6 * step, top + 67, legLen, tr, tb - 1, -3 * step);
  } else leg(b, cx - 12, top + 67, legLen, tr, tb - 1);
  arm(b, cx - 18 - 3 * step, top + 30, 30, look); // back arm
  torso(b, cx, top + 27, 42, look);
  head(b, cx + 1, top + 4, look);
  if (sit) { limb(b, cx - 10, top + 64, 32, 12, tr, tb); limb(b, cx + 18, top + 70, 12, feet - top - 75, tr, tb); b.rect(cx + 17, feet - 5, 16, 5, col('walnut', 1)); b.rect(cx + 17, feet - 5, 16, 1, col('walnut', 3)); }
  else if (step) leg(b, cx + 0 + 6 * step, top + 67, legLen, tr, tb, 3 * step);
  else leg(b, cx + 0, top + 67, legLen, tr, tb);
  const sy = top + 30;
  if (pose === 'reach') arm(b, cx + 6, sy + 6, 20, look, { across: true });
  else if (pose === 'drink') { arm(b, cx + 7, sy - 2, 12, look); box(b, cx + 9, sy - 12, 8, 10, 'water', 5); b.rect(cx + 10, sy - 11, 2, 7, col('water', 6)); }
  else if (pose === 'read') { arm(b, cx + 4, sy + 12, 14, look, { across: true }); box(b, cx + 14, sy + 4, 14, 18, 'red', 3); b.rect(cx + 15, sy + 6, 1, 14, col('plaster', 6)); b.rect(cx + 17, sy + 6, 1, 14, col('red', 5)); }
  else if (pose === 'admire') arm(b, cx - 6, sy + 8, 14, look, { across: true });
  else arm(b, cx + 9 + 3 * step, sy, 30, look);
  outlineAll(b);
  // overhead light from the top-left: a dithered highlight across the shoulders and hair
  for (let y = top; y < top + 44; y++) for (let x = cx - 18; x < cx + 2; x++) if (b.get(x, y) && b.get(x, y) !== K && bayer(x, y) < 0.1) b.shift(x, y, 1);
  return b;
}

// ------------------------------------------------------------------------------------------ Days Sealed emblem
/** The Days Sealed emblem: a hatch wheel inside a ring that fills with days (red < need, amber < 2x, green). */
export function daysSealedRaster(days, need = 30) {
  const b = new Raster(M, M);
  const cx = 31.5, cy = 31.5;
  const frac = Number.isFinite(days) ? Math.max(0, Math.min(1, days / (need * 2))) : 1;
  const tone = !Number.isFinite(days) || days >= need * 2 ? 'leaf' : days >= need ? 'amber' : 'red';
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    const a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2);
    if (d > 31) continue;
    if (d > 30) b.set(x, y, K);
    else if (d > 24) b.set(x, y, a <= frac ? col(tone, 5 - (d > 28 ? 1 : 0)) : col('steel', 2), a <= frac ? 1 : 0);
    else if (d > 23) b.set(x, y, K);
    else b.set(x, y, col('steel', 3 + Math.round((-dx - dy) / 18)));
  }
  // the hatch wheel
  for (let t = 0; t < 6.29; t += 0.04) for (const r of [14, 15]) b.set(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), col('steel', r === 14 ? 6 : 1));
  for (let s = 0; s < 4; s++) { const a = Math.PI / 4 + (s * Math.PI) / 2; for (let r = 4; r < 14; r++) { b.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), col('steel', 6)); b.set(Math.round(cx + Math.cos(a) * r) + 1, Math.round(cy + Math.sin(a) * r), col('steel', 2)); } }
  box(b, 28, 28, 8, 8, 'gold', 4);
  if (tone !== 'leaf') glowAt(b, cx, 4, 6, 1.2);
  return b;
}

// ------------------------------------------------------------------------------------------ canvases
const cache = new Map();
function toCanvas(r) {
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(r.w, r.h) : Object.assign(document.createElement('canvas'), { width: r.w, height: r.h });
  cv.getContext('2d').putImageData(new ImageData(r.rgba(), r.w, r.h), 0, 0);
  return cv;
}
function cached(key, make, tile) {
  let cv = cache.get(key);
  if (!cv) { cv = toCanvas(reduceRaster(make(), Math.max(1, Math.round(M / tile)))); if (cache.size > 600) cache.clear(); cache.set(key, cv); }
  return cv;
}
function blit(ctx, cv, x, y, flip) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (flip) { ctx.translate(x + cv.width, y); ctx.scale(-1, 1); ctx.drawImage(cv, 0, 0); } else ctx.drawImage(cv, x, y);
  ctx.restore();
}

/** Draw a door at the destination tile size; (px, py) = top-left of its 1 x 3 m box. */
export function drawDoor(ctx, kind, px, py, { state = 'closed', frame = 0, flip = false, tile = 16 } = {}) {
  const f = state === 'sealed' ? Math.floor(frame / 30) % 2 : 0;
  blit(ctx, cached(`door|${kind}|${state}|${f}|${tile}`, () => doorRaster(kind, state, { frame: f }), tile), px, py, flip);
}
/** Draw a resident at the destination tile size; (cx, by) = bottom-centre of their tile. Returns the sprite's top y. */
export function drawResident64(ctx, look, pose, cx, by, { frame = 0, flip = false, tile = 16 } = {}) {
  const f = pose === 'walk' ? Math.floor(frame / 6) % 2 : pose === 'lie' ? Math.floor(frame / 20) % 2 : 0;
  const cv = cached(`res|${look.cls}|${look.skin}|${look.hair}|${look.long}|${pose}|${f}|${tile}`, () => residentRaster(look, pose, { frame: f }), tile);
  const x = Math.round(cx - cv.width / 2), y = by - cv.height;
  blit(ctx, cv, x, y, flip);
  return y;
}
/** The Days Sealed emblem as a canvas at native size (64 x 64). */
export function daysSealedCanvas(days, need = 30) {
  const key = `days|${Number.isFinite(days) ? Math.round(days) : 'inf'}|${need}`;
  return cached(key, () => daysSealedRaster(days, need), M);
}
void cone;
