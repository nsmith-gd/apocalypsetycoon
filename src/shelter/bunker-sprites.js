// Pixel sprites for bunker objects and residents, drawn procedurally so every piece takes its colour
// variant (a = main colour, b = trim) and can be mirrored. 16 px = 1 m.

import { OBJECTS } from './bunker-catalog.js';
import { hasFixture, drawFixture } from '../art/fixtures64.js';
import { hasAmenity, drawAmenity } from '../art/hd/amenities64.js';

const T = 16;
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
};

/** Draw one object into its tile box (px, py = top-left). */
export function drawObjectSprite(ctx, kind, px, py, { a, b }, { on = true, frame = 0, flip = false } = {}) {
  // Air, water and food fixtures are authored at 64 px per metre (#119); here they draw at the editor's scale.
  if (hasFixture(kind)) { drawFixture(ctx, kind, px, py, { a, b }, { on, frame: Math.floor(frame / 6), flip, tile: T }); return; }
  // Luxury and comfort amenities are authored at 64 px per metre too (#118); same level-of-detail draw.
  if (hasAmenity(kind)) { drawAmenity(ctx, kind, px, py, { a, b }, { on, frame: Math.floor(frame / 30), flip, tile: T }); return; }
  const o = OBJECTS[kind];
  const w = o.w * T, h = o.h * T;
  ctx.save();
  if (flip) { ctx.translate(px + w, py); ctx.scale(-1, 1); } else ctx.translate(px, py);
  const R = (x, y, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, ww, hh); };
  const dark = shade(a, 0.65), light = shade(a, 1.25), trim = b, trimD = shade(b, 0.7);
  const legs = (y, n = 2) => { for (let i = 0; i < n; i++) R(i === 0 ? 2 : w - 4, y, 2, h - y, trimD); };
  const blink = Math.floor(frame / 12) % 2;
  const recipe = RECIPES[kind];
  if (recipe) recipe({ R, w, h, a, b, dark, light, trim, trimD, legs, on, frame, blink });
  else generic({ R, w, h, a, b, dark, light, trim, trimD, on, blink, o });
  ctx.restore();
}

function generic({ R, w, h, a, dark, light, trim, on, blink, o }) {
  // machines and cabinets: casing, a lit panel, vents
  R(1, 1, w - 2, h - 1, '#0a0807');
  R(2, 2, w - 4, h - 3, a);
  R(2, 2, w - 4, 2, light);
  R(2, h - 3, w - 4, 2, dark);
  for (let y = 6; y < h - 5; y += 4) R(4, y, w - 8, 1, dark);
  if (o.net) R(w - 6, 4, 3, 3, on ? (blink ? '#7ed957' : '#3a7a3a') : '#ff5a4f');
  if (o.waterStock || o.cat === 'water') for (let y = 8; y < h - 2; y += T) R(2, y, w - 4, 2, trim);
}

const RECIPES = {
  // ---------- beds ----------
  bunk: ({ R, w, a, b, trimD }) => {
    for (const y of [0, T]) { R(1, y + 10, w - 2, 4, trimD); R(2, y + 6, w - 4, 4, a); R(3, y + 4, 5, 3, b); }
    R(1, 4, 2, 2 * T - 4, trimD); R(w - 3, 4, 2, 2 * T - 4, trimD);
  },
  bed: ({ R, w, a, b, trimD }) => { R(1, 9, w - 2, 5, trimD); R(2, 6, w - 4, 4, a); R(3, 4, 6, 3, b); R(1, 2, 3, 12, trimD); R(1, 14, 2, 2, trimD); R(w - 3, 14, 2, 2, trimD); },
  king_bed: ({ R, w, h, a, b, trimD }) => {
    R(1, 0, 2, h, trimD); R(w - 3, 0, 2, h, trimD); R(1, 0, w - 2, 3, a); R(3, 3, w - 6, 3, shade(a, 0.8));
    R(1, h - 7, w - 2, 5, trimD); R(2, h - 10, w - 4, 4, a); R(4, h - 13, 7, 4, b); R(12, h - 13, 7, 4, b);
  },
  cryo_pod: ({ R, w, h, a, on, blink }) => { R(1, 0, w - 2, h, '#0a0807'); R(2, 1, w - 4, h - 2, '#8fd3ff'); R(3, 3, w - 6, h - 8, on ? '#bfe9ff' : '#5a7a8a'); R(5, 6, w - 10, 6, '#e0b090'); R(2, h - 4, w - 4, 3, a); if (on && blink) R(w / 2 - 1, h - 3, 2, 1, '#7ed957'); },
  // ---------- seating ----------
  sofa: ({ R, w, a, dark, trimD }) => { R(0, 4, 3, 10, dark); R(w - 3, 4, 3, 10, dark); R(2, 2, w - 4, 6, a); R(2, 8, w - 4, 5, shade(a, 1.1)); R(2, 13, 2, 3, trimD); R(w - 4, 13, 2, 3, trimD); },
  armchair: ({ R, w, a, dark, trimD }) => { R(1, 3, 3, 10, dark); R(w - 4, 3, 3, 10, dark); R(3, 1, w - 6, 8, a); R(3, 9, w - 6, 4, shade(a, 1.1)); R(3, 13, 2, 3, trimD); R(w - 5, 13, 2, 3, trimD); },
  dining_chair: ({ R, a, trimD }) => { R(3, 1, 2, 13, a); R(3, 8, 9, 2, a); R(10, 10, 2, 6, trimD); R(3, 14, 2, 2, trimD); },
  cinema_seats: ({ R, w, a, dark }) => { for (let x = 0; x < w; x += T) { R(x + 2, 2, 12, 7, a); R(x + 1, 9, 14, 4, dark); R(x + 1, 13, 2, 3, '#2a2a2a'); R(x + 13, 13, 2, 3, '#2a2a2a'); } },
  // ---------- tables and storage ----------
  coffee_table: ({ R, w, a, trim }) => { R(1, 8, w - 2, 3, a); R(3, 11, 2, 5, trim); R(w - 5, 11, 2, 5, trim); R(8, 6, 6, 2, '#c8a040'); },
  dining_table: ({ R, w, a, trim }) => { R(0, 5, w, 3, a); R(2, 8, 2, 8, trim); R(w - 4, 8, 2, 8, trim); R(w / 2 - 1, 8, 2, 8, trim); R(8, 2, 3, 3, '#f2e6c9'); R(w - 12, 3, 4, 2, '#c8a040'); },
  desk: ({ R, w, a, trim }) => { R(0, 6, w, 3, a); R(1, 9, 8, 7, shade(a, 0.8)); R(w - 3, 9, 2, 7, trim); R(w - 12, 2, 7, 4, '#2a2a2e'); R(w - 11, 3, 5, 2, '#6ab4ff'); },
  wardrobe: ({ R, w, h, a, trim }) => { R(1, 1, w - 2, h - 2, a); R(w / 2, 2, 1, h - 4, shade(a, 0.6)); R(w / 2 - 3, h / 2, 2, 4, trim); R(w / 2 + 2, h / 2, 2, 4, trim); R(1, 0, w - 2, 2, shade(a, 1.2)); },
  nightstand: ({ R, a, trim }) => { R(2, 7, 12, 9, a); R(3, 9, 10, 1, shade(a, 0.7)); R(7, 11, 2, 1, trim); R(5, 2, 6, 5, '#f5e6a0'); R(7, 1, 2, 1, trim); },
  bookshelf: ({ R, h, a }) => { R(1, 0, 14, h, a); for (let y = 4; y < h - 2; y += 10) { R(2, y, 12, 1, shade(a, 0.6)); const books = ['#8a2a2a', '#2a5a8a', '#c8a040', '#3a7a3a', '#6a3a7a']; for (let i = 0; i < 5; i++) R(3 + i * 2, y - 6, 2, 6, books[(i + y) % 5]); } },
  shelf: ({ R, h, a }) => { R(1, 0, 14, h, shade(a, 0.5)); for (let y = 3; y < h; y += 8) { R(2, y + 4, 12, 1, '#8a7a6a'); R(3, y, 4, 4, '#c8743a'); R(8, y + 1, 5, 3, '#e0c080'); } },
  // ---------- kitchen and bath ----------
  fridge: ({ R, h, a, on }) => { R(1, 0, 14, h, a); R(1, 10, 14, 1, shade(a, 0.6)); R(11, 3, 1, 5, '#2a2a2a'); R(11, 13, 1, 8, '#2a2a2a'); if (!on) R(4, 4, 3, 3, '#ff5a4f'); },
  stove: ({ R, w, a, b, on, frame }) => { R(0, 4, w, 12, a); R(1, 3, w - 2, 2, '#2a2a2a'); R(3, 8, w - 6, 6, shade(a, 0.7)); if (on && Math.floor(frame / 6) % 2) { R(6, 0, 2, 3, '#e8e8e8'); R(w - 9, 1, 2, 2, '#e8e8e8'); } R(4, 2, 6, 2, b); },
  chef_range: ({ R, w, a, b, on, frame }) => { R(0, 3, w, 13, a); R(0, 2, w, 2, b); for (let x = 4; x < w - 4; x += 10) R(x, 7, 8, 6, shade(a, 0.7)); if (on && Math.floor(frame / 6) % 2) R(w / 2, 0, 2, 2, '#e8e8e8'); },
  espresso: ({ R, a, b }) => { R(3, 5, 10, 10, a); R(4, 3, 8, 2, b); R(6, 12, 4, 3, '#2a1a10'); R(5, 7, 6, 2, '#e8e8e8'); },
  toilet: ({ R, a }) => { R(4, 2, 5, 7, a); R(3, 9, 10, 3, a); R(5, 12, 6, 4, shade(a, 0.85)); R(4, 9, 8, 1, '#c8c8c8'); },
  sink: ({ R, a }) => { R(2, 6, 12, 3, a); R(5, 9, 6, 7, shade(a, 0.8)); R(7, 2, 2, 4, '#a8acb0'); R(6, 2, 4, 1, '#a8acb0'); },
  shower: ({ R, h, a, on, frame }) => { R(1, 0, 14, 2, a); R(12, 0, 2, h, a); R(3, 2, 6, 2, '#a8acb0'); R(1, h - 2, 14, 2, shade(a, 0.7)); if (on) for (let i = 0; i < 4; i++) R(3 + i * 2, 5 + ((frame / 2 + i * 5) % (h - 9)), 1, 2, '#8ad8ff'); R(1, 2, 1, h - 4, 'rgba(180,220,255,.35)'); },
  bathtub: ({ R, w, a, b }) => { R(1, 5, w - 2, 7, a); R(0, 4, w, 2, shade(a, 1.15)); R(3, 6, w - 6, 3, '#8ad8ff'); R(2, 12, 3, 4, b); R(w - 5, 12, 3, 4, b); R(w - 6, 0, 2, 5, b); },
  gold_taps: ({ R, a }) => { R(1, 7, 14, 3, '#ece8e0'); R(3, 10, 10, 6, '#d8d0c0'); R(7, 2, 2, 5, a); R(5, 2, 6, 2, a); R(4, 5, 2, 2, a); },
  vanity: ({ R, a, b }) => { R(2, 0, 12, 12, b); R(3, 1, 10, 10, '#bfe3ff'); R(5, 3, 3, 3, 'rgba(255,255,255,.6)'); R(1, 12, 14, 4, a); },
  // ---------- play and status ----------
  tv: ({ R, w, on, frame }) => { R(0, 1, w, 13, '#1a1a1e'); R(1, 2, w - 2, 11, on ? ['#3a6ab0', '#b0503a', '#3ab07a'][Math.floor(frame / 30) % 3] : '#2a2a30'); R(w / 2 - 2, 14, 4, 2, '#1a1a1e'); },
  cinema_screen: ({ R, w, h, on, frame }) => { R(0, 0, w, h - 2, '#0a0a0e'); R(2, 2, w - 4, h - 6, on ? ['#2a3a6a', '#6a2a2a', '#c8a040'][Math.floor(frame / 40) % 3] : '#1a1a20'); R(0, h - 2, w, 2, '#5a1e2a'); },
  piano: ({ R, w, h, a, b }) => { R(0, 3, w, 12, a); R(2, 0, w - 10, 5, a); R(3, 9, w - 6, 3, '#f2f2f2'); for (let x = 4; x < w - 4; x += 3) R(x, 9, 1, 2, '#1a1a1a'); R(2, 15, 2, h - 15, b); R(w - 4, 15, 2, h - 15, b); },
  pool_table: ({ R, w, a, b }) => { R(0, 4, w, 3, b); R(1, 3, w - 2, 3, '#1e6a3a'); R(2, 7, 4, 9, a); R(w - 6, 7, 4, 9, a); R(8, 2, 2, 2, '#f2f2f2'); R(20, 2, 2, 2, '#c02a2a'); },
  arcade: ({ R, h, a, on, frame }) => { R(1, 0, 14, h, a); R(3, 3, 10, 9, '#0a0a0e'); if (on) R(4 + (frame / 4) % 6, 6, 3, 3, '#7ed957'); R(2, 14, 12, 3, shade(a, 0.7)); R(5, 15, 2, 2, '#ff5a4f'); },
  bar_counter: ({ R, w, h, a, b }) => { R(0, h - 12, w, 12, a); R(0, h - 14, w, 3, b); for (let x = 3; x < w - 2; x += 5) R(x, 2, 3, 8, ['#3a7a3a', '#c8a040', '#8a2a2a', '#5a8ab0'][x % 4]); R(0, 10, w, 1, shade(a, 0.6)); },
  gym_rig: ({ R, w, h, a }) => { R(1, 0, 2, h, a); R(w - 3, 0, 2, h, a); R(1, 1, w - 2, 2, a); R(6, 14, w - 12, 3, '#2a2a2a'); R(4, 20, 4, 6, '#1a1a1a'); R(w - 8, 20, 4, 6, '#1a1a1a'); },
  aquarium: ({ R, w, h, b, frame }) => { R(0, 0, w, h - 6, b); R(1, 1, w - 2, h - 8, '#3a8ad8'); R(1, h - 10, w - 2, 3, '#d8c890'); const fx = (frame / 3) % (w - 6); R(2 + fx, 8, 4, 2, '#ff9f1c'); R(w - 6 - fx / 2, 14, 3, 2, '#f5c542'); R(3, h - 6, w - 6, 6, shade(b, 0.7)); },
  fireplace: ({ R, w, h, a, frame }) => { R(0, 0, w, h, a); R(4, 10, w - 8, h - 12, '#1a1010'); const f = Math.floor(frame / 5) % 3; R(7, h - 6 - f, 4, 4 + f, '#ff9f1c'); R(14 + f, h - 7, 4, 5, '#ff5a3a'); R(10, h - 4, 10, 2, '#f5c542'); R(0, 0, w, 3, shade(a, 1.2)); },
  plant: ({ R, a, b }) => { R(5, 10, 6, 6, b); R(4, 3, 8, 7, a); R(6, 1, 4, 3, shade(a, 1.2)); },
  plant_tall: ({ R, h, a, b }) => { R(5, h - 6, 6, 6, b); R(7, 8, 2, h - 14, '#5a3a20'); R(2, 1, 12, 10, a); R(4, 0, 8, 4, shade(a, 1.2)); R(9, 12, 5, 5, a); },
  lamp: ({ R, h, a, b, on }) => { R(3, 0, 10, 6, on ? '#f5e6a0' : a); R(7, 6, 2, h - 8, b); R(4, h - 2, 8, 2, b); },
  statue: ({ R, h, a }) => { R(3, h - 4, 10, 4, '#8a8680'); R(5, 3, 6, h - 8, '#ece8e0'); R(6, 0, 4, 4, '#ece8e0'); R(4, 8, 2, 6, '#d8d0c0'); },
  wine_rack: ({ R, h, a }) => { R(1, 0, 14, h, a); for (let y = 2; y < h - 2; y += 4) for (let x = 3; x < 13; x += 4) R(x, y, 3, 3, ['#5a1e2a', '#2a4a2a', '#7a2a3a'][(x + y) % 3]); },
  // ---------- rugs ----------
  rug: ({ R, w, a, b }) => { R(0, 13, w, 3, a); R(1, 14, w - 2, 1, b); },
  rug_persian: ({ R, w, a, b }) => { R(0, 12, w, 4, a); R(1, 13, w - 2, 2, b); for (let x = 4; x < w - 4; x += 6) R(x, 13, 2, 2, a); R(0, 12, 1, 4, '#f2e6c9'); R(w - 1, 12, 1, 4, '#f2e6c9'); },
  // ---------- back wall ----------
  painting: ({ R, w, b, a }) => { R(0, 1, w, 13, b); R(2, 3, w - 4, 9, '#3a5a7a'); R(2, 8, w - 4, 4, '#5a7a3a'); R(18, 4, 5, 4, '#f5c542'); R(6, 6, 6, 3, '#8a9a7a'); },
  mirror: ({ R, h, a }) => { R(2, 0, 12, h - 2, a); R(4, 2, 8, h - 6, '#bfe3ff'); R(5, 3, 2, 5, 'rgba(255,255,255,.7)'); },
  sconce: ({ R, a, on }) => { R(6, 6, 4, 6, a); R(5, 2, 6, 5, on ? '#f5e6a0' : '#8a8a7a'); },
  wall_shelf: ({ R, w, a }) => { R(0, 9, w, 2, a); R(3, 4, 3, 5, '#3a7a3a'); R(10, 5, 6, 4, '#8a2a2a'); R(20, 3, 4, 6, '#c8a040'); },
  neon_sign: ({ R, w, a, b, on, blink }) => { R(1, 3, w - 2, 9, '#1a1a1e'); const c = on ? (blink ? b : a) : '#3a3a3a'; R(4, 5, w - 8, 1, c); R(4, 9, w - 8, 1, c); R(4, 5, 1, 5, c); R(w - 5, 5, 1, 5, c); R(10, 7, 12, 1, c); },
  faux_window: ({ R, w, h, a, b }) => { R(0, 0, w, h, b); R(3, 3, w - 6, h - 6, '#8ac8ff'); R(3, h - 9, w - 6, 6, '#5a8a4a'); R(w / 2, 3, 1, h - 6, b); R(0, 0, 5, h, a); R(w - 5, 0, 5, h, a); },
  trophy: ({ R, a }) => { R(3, 2, 10, 10, '#5a3a20'); R(5, 4, 6, 6, a); R(4, 1, 2, 4, '#e8dcc4'); R(10, 1, 2, 4, '#e8dcc4'); },
  led_sky: ({ R, w, on }) => { R(0, 0, w, 16, '#1a1a1e'); R(1, 1, w - 2, 14, on ? '#8ac8ff' : '#2a2a30'); if (on) R(6, 4, 8, 3, '#f2f2f2'); },
  // ---------- ceiling ----------
  chandelier: ({ R, w, a, on, blink }) => { R(w / 2 - 1, 0, 2, 4, a); R(2, 4, w - 4, 2, a); for (let x = 3; x < w - 2; x += 4) { R(x, 6, 2, 4, '#e8f4ff'); if (on) R(x, 10, 2, 1, blink ? '#f5e6a0' : '#fff6d0'); } },
  pendant: ({ R, a, on }) => { R(7, 0, 2, 6, '#2a2a2a'); R(4, 6, 8, 5, a); if (on) R(6, 11, 4, 2, '#f5e6a0'); },
  // ---------- doors ----------
  door: ({ R, h, a, b }) => { R(3, 0, 10, h, a); R(3, 0, 10, 2, shade(a, 1.2)); R(10, h / 2, 2, 3, b); },
  airlock: ({ R, h }) => { R(2, 0, 12, h, '#7a8a9a'); R(4, 4, 8, 8, '#bfe3ff'); R(2, h / 2, 12, 2, '#f5c542'); },
};
for (const k of ['blast_1', 'blast_2', 'blast_3']) {
  const n = Number(k.slice(-1));
  RECIPES[k] = ({ R, h }) => { R(2, 0, 12, h, '#5a5a66'); for (let i = 0; i < n; i++) R(3, 6 + i * 9, 10, 3, '#f5c542'); R(3, 0, 10, 2, '#8a8a96'); };
}

// ---------------------------------------------------------------------------------------------
// Residents
// ---------------------------------------------------------------------------------------------
const OUTFITS = { C1: ['#7a6a4a', '#3a3a4a'], C2: ['#2a2a2e', '#5a8ab0'], C3: ['#1e2e5a', '#c8a040'], C4: ['#c8a040', '#ece8e0'] };
const SKIN = ['#f0c8a0', '#d8a078', '#a8704a', '#7a4a2a'];
const HAIR = ['#2a1a10', '#8a5a2a', '#d8c890', '#ece8e0', '#6a2a1a'];

/** Draw a resident; (px, py) is the bottom-centre of their tile in canvas pixels. */
export function drawResident(ctx, r, px, py, frame, { selected = false } = {}) {
  const n = r.name.length;
  const [suit, accent] = OUTFITS[r.cls] ?? OUTFITS.C1;
  const skin = SKIN[n % SKIN.length], hair = HAIR[(n * 3) % HAIR.length];
  const pose = r.action?.started ? (r.action.admire ? 'admire' : r.action.chat ? 'chat' : r.action.use?.pose) : r.walking ? 'walk' : 'stand';
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  ctx.save();
  if (r.facing < 0) { ctx.translate(px * 2, 0); ctx.scale(-1, 1); }
  const x = px - 4;
  if (pose === 'sleep' || pose === 'bath') {
    // lying down
    const y = py - (pose === 'bath' ? 10 : 9);
    R(x - 3, y, 5, 4, skin); R(x - 3, y - 1, 5, 2, hair);
    if (pose !== 'bath') R(x + 2, y, 10, 4, suit);
    if (pose === 'sleep' && Math.floor(frame / 20) % 2) { R(x + 6, y - 7, 3, 1, '#f2e6c9'); R(x + 8, y - 6, 1, 1, '#f2e6c9'); R(x + 6, y - 5, 3, 1, '#f2e6c9'); }
    ctx.restore();
    if (selected) outline(ctx, px - 8, py - 14, 16, 12);
    return;
  }
  const sit = ['sit', 'watch', 'drink', 'read'].includes(pose) && r.action?.kind && r.action.kind !== 'bookshelf';
  const bob = pose === 'walk' ? Math.floor(frame / 6) % 2 : pose === 'exercise' ? Math.floor(frame / 8) % 2 * 2 : 0;
  const top = py - 15 + (sit ? 3 : 0) - bob;
  R(x + 1, top, 6, 2, hair); // hair
  R(x + 1, top + 2, 6, 4, skin); // face
  R(x + 5, top + 3, 1, 1, '#1a1a1a'); // eye
  R(x, top + 6, 8, 5, suit); // torso
  R(x + 3, top + 6, 2, 3, accent); // tie / scarf
  // arms
  if (pose === 'cook' || pose === 'play' || pose === 'exercise') R(x + 7, top + 6 - (Math.floor(frame / 5) % 2), 3, 2, suit);
  else if (pose === 'drink') { R(x + 7, top + 6, 2, 3, suit); R(x + 8, top + 4, 2, 3, '#bfe3ff'); }
  else if (pose === 'read') { R(x + 6, top + 7, 4, 3, '#8a2a2a'); }
  else if (pose === 'admire') R(x - 1, top + 7, 2, 3, suit);
  else R(x + 7, top + 7, 2, 4, suit);
  // legs
  if (sit) { R(x + 1, top + 11, 7, 2, '#2a2a3a'); R(x + 6, top + 13, 2, 2, '#1a1a1a'); }
  else if (pose === 'walk') { const s = Math.floor(frame / 6) % 2; R(x + 1 + s, top + 11, 2, 4, '#2a2a3a'); R(x + 5 - s, top + 11, 2, 4, '#2a2a3a'); }
  else { R(x + 1, top + 11, 2, 4, '#2a2a3a'); R(x + 5, top + 11, 2, 4, '#2a2a3a'); }
  if (pose === 'shower') for (let i = 0; i < 3; i++) R(x + 1 + i * 3, top - 3 + ((frame + i * 4) % 8), 1, 2, '#8ad8ff');
  if (pose === 'cook' && Math.floor(frame / 8) % 2) R(x + 10, top + 2, 2, 2, '#e8e8e8');
  ctx.restore();
  // speech / thought bubbles (not mirrored)
  if (pose === 'chat' && Math.floor(frame / 30) % 2) bubble(ctx, px + 2, top - 10, ['#f2e6c9', '...']);
  if (pose === 'admire') heart(ctx, px - 2, top - 7);
  if (selected) outline(ctx, px - 6, top - 2, 13, 19);
}

function outline(ctx, x, y, w, h) { ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w, h); }
function heart(ctx, x, y) { ctx.fillStyle = '#ff5a8a'; ctx.fillRect(x, y, 2, 2); ctx.fillRect(x + 3, y, 2, 2); ctx.fillRect(x, y + 1, 5, 2); ctx.fillRect(x + 1, y + 3, 3, 1); ctx.fillRect(x + 2, y + 4, 1, 1); }
function bubble(ctx, x, y) { ctx.fillStyle = '#f2e6c9'; ctx.fillRect(x, y, 10, 6); ctx.fillRect(x + 1, y + 6, 2, 2); ctx.fillStyle = '#2a2118'; for (let i = 0; i < 3; i++) ctx.fillRect(x + 2 + i * 3, y + 3, 1, 1); }

/** Need icon for thought bubbles. */
export function drawThought(ctx, x, y, good) {
  ctx.fillStyle = '#f2e6c9';
  ctx.fillRect(x, y, 9, 7);
  ctx.fillRect(x + 2, y + 7, 2, 1);
  ctx.fillRect(x + 1, y + 9, 1, 1);
  ctx.fillStyle = good ? '#3aa070' : '#d03a2a';
  if (good) { ctx.fillRect(x + 2, y + 2, 2, 2); ctx.fillRect(x + 5, y + 2, 2, 2); ctx.fillRect(x + 2, y + 4, 5, 1); }
  else { ctx.fillRect(x + 4, y + 1, 1, 3); ctx.fillRect(x + 4, y + 5, 1, 1); }
}

/** Whether a kind has a hand-drawn sprite (machines without one use the labelled block in the UI). */
export const hasSprite = (kind) => !!RECIPES[kind] || hasFixture(kind) || hasAmenity(kind);
