// Room styles for the design layer (L0 placeholder: Brutalist and Gilded), redrawn at 32 px (#88).
// GDD: Art > "Shared room templates with tier trims and styles built as palette swaps";
// "The six styles re-skin materials and props, but the tier trim always stays."
//
// Every styled room is one shared 32 x 32 template: tier-trim beam, cornice, ceiling light, upper wall, dado,
// floor, side walls with ambient occlusion, and the room's machine standing on the floor with a contact
// shadow. A style supplies the materials (5-6 tone ramps from the palette), its texture and wear, how its
// light falls (sodium cone vs chandelier glow, dithered at the edges) and its wall details. The machine
// sprites themselves are palette-swapped per style. The tier trim is never touched by a style.
//
//   drawStyledRoom(ctx, { x, y, amenity: 'gold_taps', style: 'gilded', tier: 'status', frame, seed });

import { AMENITIES } from './sprites-shelter.js';
import { drawSprite } from './render.js';
import { HEX } from './palette.js';

export const ROOM_PX = 32;
export const ROOM_STYLES_DRAWN = Object.freeze(['brutalist', 'gilded']);

// Machine (amenity) material swaps. Outlines and accent colours stay, so each machine stays recognisable.
export const AMENITY_SWAPS = Object.freeze({
  neutral: {},
  brutalist: { k: 'a', M: 'h', m: 'i', w: 'j', W: 'l' }, // cast concrete housings
  gilded: { k: 'z', M: 'y', m: 't', w: 'L' }, // brass and gold leaf
});

// Needs-tier trim (GDD: Art > Tier colour language). A 3 px beam across the top of every room.
export const TIER_TRIM = Object.freeze({
  survive: { a: 'Y', b: 'K', pattern: 'hazard' }, // hazard yellow and stencil black
  comfort: { a: 'A', b: 'z', pattern: 'grain' }, // warm walnut
  status: { a: 't', b: 'g', pattern: 'inlay' }, // gold leaf and emerald
  delusion: { a: 'v', b: 'V', pattern: 'shimmer' }, // iridescent violet, slow dithered shimmer
});

const swapCache = new Map();

/** A copy of a sprite with every pixel key remapped through `map` (cached per sprite + map). */
export function swapSprite(sprite, map, cacheKey) {
  if (!map || !Object.keys(map).length) return sprite;
  const key = cacheKey ?? JSON.stringify(map);
  let per = swapCache.get(sprite);
  if (!per) swapCache.set(sprite, (per = new Map()));
  if (per.has(key)) return per.get(key);
  const remap = (rows) => rows.map((row) => [...row].map((ch) => map[ch] ?? ch).join(''));
  const out = { w: sprite.w, h: sprite.h, rows: remap(sprite.rows ?? sprite.frames[0]) };
  if (sprite.frames) out.frames = sprite.frames.map(remap);
  per.set(key, out);
  return out;
}

export function styledAmenity(id, style = 'neutral') {
  const s = AMENITIES[id];
  return s ? swapSprite(s, AMENITY_SWAPS[style] ?? {}, `amen:${style}`) : null;
}

// ---------------------------------------------------------------- pixel helpers
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const bayer = (x, y) => (BAYER[y & 3][x & 3] + 0.5) / 16;
/** Deterministic 0..1 noise per pixel (and room seed). */
function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * A tiny pixel canvas for one room: set(x, y, key) then paint at (ox, oy). Building the room in an array first
 * lets the lighting pass read and brighten what the material pass laid down.
 */
function roomBuffer() {
  const px = new Array(ROOM_PX * ROOM_PX).fill(null);
  return {
    get: (x, y) => (x < 0 || y < 0 || x >= ROOM_PX || y >= ROOM_PX ? null : px[y * ROOM_PX + x]),
    set: (x, y, k) => { if (x >= 0 && y >= 0 && x < ROOM_PX && y < ROOM_PX && k) px[y * ROOM_PX + x] = k; },
    paint(ctx, ox, oy) {
      for (let y = 0; y < ROOM_PX; y++) {
        for (let x = 0; x < ROOM_PX; x++) {
          const k = px[y * ROOM_PX + x];
          if (!k) continue;
          ctx.fillStyle = HEX[k];
          ctx.fillRect(ox + x, oy + y, 1, 1);
        }
      }
    },
  };
}

// 3x5 stencil glyphs (for the Brutalist wall number).
const GLYPHS = {
  B: ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'],
  '-': ['...', '...', 'XXX', '...', '...'],
  0: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
  1: ['.X.', 'XX.', '.X.', '.X.', 'XXX'],
  2: ['XX.', '..X', '.X.', 'X..', 'XXX'],
  3: ['XX.', '..X', '.X.', '..X', 'XX.'],
  4: ['X.X', 'X.X', 'XXX', '..X', '..X'],
  5: ['XXX', 'X..', 'XX.', '..X', 'XX.'],
  7: ['XXX', '..X', '.X.', '.X.', '.X.'],
};

// Tone ramps: lighting shifts a pixel up its ramp.
const BRIGHTER = {
  a: 'f', f: 'h', h: 'i', i: 'j', j: 'l', l: 'l', // concrete
  q: 'V', V: 's', s: 's', r: 'V', // velvet
  z: 'A', A: 'b', y: 't', t: 'Y', Y: 'L', // walnut, gold
  x: 'u', u: 'W', // marble
};
const DARKER = { l: 'j', j: 'i', i: 'h', h: 'f', f: 'a', a: 'a', s: 'V', V: 'q', q: 'q', u: 'x', x: 'S', A: 'z', z: 'z', t: 'y', Y: 't', y: 'y' };

// ---------------------------------------------------------------- trim (shared, never styled)
function trim(b, tier, frame) {
  const t = TIER_TRIM[tier] ?? TIER_TRIM.survive;
  for (let x = 0; x < ROOM_PX; x++) {
    for (let y = 0; y < 3; y++) {
      let k;
      if (t.pattern === 'hazard') k = ((x + y) >> 2) % 2 ? t.b : t.a;
      else if (t.pattern === 'grain') k = y === 2 ? t.b : hash(x, y, 7) < 0.18 ? t.b : t.a;
      else if (t.pattern === 'inlay') k = y === 0 ? 'Y' : y === 2 ? 'y' : x % 6 === 2 || x % 6 === 3 ? t.b : t.a;
      else k = y === 2 ? 'q' : (x + frame + y) % 5 === 0 ? 'C' : (x + y + frame) % 2 ? t.a : t.b;
      b.set(x, y, k);
    }
  }
}

// ---------------------------------------------------------------- Brutalist
function brutalist(b, seed, frame) {
  // ceiling beam and its shadow
  for (let x = 0; x < ROOM_PX; x++) { b.set(x, 3, 'f'); b.set(x, 4, 'a'); }
  // board-formed concrete: base tone, grain, faint horizontal board lines
  for (let y = 5; y < 23; y++) {
    for (let x = 0; x < ROOM_PX; x++) {
      // mottling in 2x2 clusters (reads as cast texture, not noise), plus rare single specks
      const m = hash(x >> 1, y >> 1, seed);
      const n = hash(x, y, seed + 11);
      let k = 'h';
      if (m < 0.16) k = 'f';
      else if (m > 0.86) k = 'i';
      if (n > 0.97) k = 'j';
      if ((y - 5) % 4 === 3 && hash(x >> 3, y, seed + 3) < 0.6) k = 'f'; // board joints, broken in places
      b.set(x, y, k);
    }
  }
  // form seams: two vertical, one horizontal (dark line, lit lip)
  for (let y = 5; y < 23; y++) for (const sx of [10, 21]) { b.set(sx, y, 'f'); b.set(sx + 1, y, 'i'); }
  for (let x = 0; x < ROOM_PX; x++) { b.set(x, 13, 'f'); b.set(x, 14, 'i'); }
  // tie holes with rust-dark drips
  for (const [hx, hy] of [[5, 8], [15, 8], [26, 8], [5, 17], [15, 17], [26, 17]]) {
    b.set(hx, hy, 'a'); b.set(hx + 1, hy, 'a'); b.set(hx, hy + 1, 'a'); b.set(hx + 1, hy + 1, 'f');
    b.set(hx - 1, hy - 1, 'j'); b.set(hx + 2, hy + 2, 'f');
    const drip = 2 + Math.floor(hash(hx, hy, seed) * 4);
    for (let d = 2; d < 2 + drip; d++) b.set(hx + (d > 3 ? 1 : 0), hy + d, d === 1 + drip ? 'h' : 'f');
  }
  // stencilled bay number, chipped
  const num = `B-${1 + Math.floor(hash(1, 2, seed) * 7)}`;
  [...num].forEach((ch, i) => {
    const g = GLYPHS[ch] ?? GLYPHS['0'];
    g.forEach((row, gy) => [...row].forEach((c, gx) => { if (c === 'X' && hash(gx + i * 4, gy, seed + 9) > 0.12) b.set(3 + i * 4 + gx, 15 + gy, 'a'); }));
  });
  // conduit run along the wall
  for (let x = 0; x < ROOM_PX; x++) { b.set(x, 20, 'i'); b.set(x, 21, 'f'); }
  for (let x = 4; x < ROOM_PX; x += 9) { b.set(x, 19, 'a'); b.set(x, 20, 'a'); b.set(x, 21, 'a'); b.set(x, 22, 'a'); }
  // dado: darker cast band with a chamfer highlight and chips
  for (let y = 23; y < 28; y++) {
    for (let x = 0; x < ROOM_PX; x++) {
      let k = y === 23 ? 'j' : y === 24 ? 'i' : 'f';
      if (y > 24 && hash(x, y, seed + 5) < 0.08) k = 'a';
      if (y > 24 && hash(x, y, seed + 6) > 0.95) k = 'h';
      b.set(x, y, k);
    }
  }
  // polished floor with cracks
  for (let x = 0; x < ROOM_PX; x++) {
    b.set(x, 28, 'a');
    for (let y = 29; y < 32; y++) b.set(x, y, y === 31 ? 'f' : hash(x, y, seed + 8) < 0.06 ? 'f' : 'h');
  }
  // sodium lamp: housing, lens, and a cone of warm light down the wall and onto the floor
  for (let x = 12; x < 20; x++) { b.set(x, 4, 'f'); b.set(x, 5, x === 12 || x === 19 ? 'a' : 'h'); }
  const flicker = frame % 23 === 0;
  for (let x = 13; x < 19; x++) b.set(x, 6, flicker ? 'o' : 'p');
  light(b, 15.5, 6, (y) => 2 + (y - 6) * 0.62, 7, 27, 'o');
  // the sodium bloom right under the lamp, and its amber pool on the polished floor
  for (let x = 12; x < 20; x++) { b.set(x, 7, x === 12 || x === 19 ? 'o' : (x + 1) % 2 ? 'p' : 'o'); }
  for (let x = 13; x < 19; x++) if (x % 2) b.set(x, 8, 'o');
  for (let x = 9; x < 23; x++) {
    const d = Math.abs(x + 0.5 - 16) / 7;
    b.set(x, 29, d < 0.45 ? 'l' : d < 0.8 ? 'j' : bayer(x, 29) > d ? 'i' : b.get(x, 29));
    if (d < 0.6 && bayer(x, 30) > d) b.set(x, 30, d < 0.3 ? 'o' : 'i');
  }
}

// ---------------------------------------------------------------- Gilded
function gilded(b, seed, frame) {
  // crown moulding: gold lip, highlight, dentils, shadow onto the wallpaper
  for (let x = 0; x < ROOM_PX; x++) {
    b.set(x, 3, 'y'); b.set(x, 4, x % 7 === 3 ? 'L' : 'Y'); b.set(x, 5, x % 2 ? 't' : 'y'); b.set(x, 6, 'q');
  }
  // velvet damask wallpaper with gold pinstripes
  for (let y = 7; y < 22; y++) {
    for (let x = 0; x < ROOM_PX; x++) {
      const px = ((x % 8) + 8) % 8;
      const py = (y - 7) % 10;
      const d = Math.abs(px - 4) + Math.abs(py - 5);
      let k = 'V';
      if (d === 3) k = 's';
      else if (d === 2 && (px + py) % 2) k = 'q';
      else if (d === 0) k = 's';
      if (px === 0) k = 't';
      if (hash(x, y, seed) < 0.04) k = DARKER[k] ?? k; // age in the pile
      b.set(x, y, k);
    }
  }
  // gilt-framed portrait (left)
  for (let y = 9; y < 20; y++) {
    for (let x = 3; x < 12; x++) {
      const edge = x === 3 || x === 11 || y === 9 || y === 19;
      const inner = x === 4 || x === 10 || y === 10 || y === 18;
      let k;
      if (edge) k = x === 3 || y === 9 ? 'Y' : 'y';
      else if (inner) k = 't';
      else k = 'r';
      b.set(x, y, k);
    }
  }
  // the sitter: dark coat, pale face, a glint of pearls
  for (let y = 15; y < 18; y++) for (let x = 5; x < 10; x++) b.set(x, y, 'z');
  b.set(7, 12, 'u'); b.set(6, 12, 'x'); b.set(7, 13, 'u'); b.set(6, 13, 'u'); b.set(8, 12, 'z'); b.set(8, 13, 'x'); b.set(7, 11, 'z'); b.set(6, 11, 'z');
  b.set(6, 15, 'W'); b.set(7, 15, 'W');
  for (let x = 5; x < 10; x++) b.set(x, 8, 'L'); // picture light
  // wall sconce (right)
  b.set(26, 15, 'y'); b.set(26, 14, 't'); b.set(25, 13, 't'); b.set(27, 13, 't'); b.set(25, 12, 'W'); b.set(27, 12, 'W');
  b.set(25, 11, frame % 2 ? 'L' : 'p'); b.set(27, 11, frame % 2 ? 'p' : 'L');
  // chair rail and walnut wainscot with raised panels
  for (let x = 0; x < ROOM_PX; x++) { b.set(x, 22, 'Y'); b.set(x, 23, 't'); b.set(x, 24, 'y'); }
  for (let y = 25; y < 28; y++) {
    for (let x = 0; x < ROOM_PX; x++) {
      const px = x % 10;
      let k = 'A';
      if (px === 0) k = 'z';
      else if (px === 1 || y === 25) k = 'b';
      else if (px === 9 || y === 27) k = 'z';
      else if (hash(x, y, seed + 4) < 0.12) k = 'z';
      b.set(x, y, k);
    }
  }
  // marble checkerboard floor with veins and the chandelier's reflection
  for (let x = 0; x < ROOM_PX; x++) {
    b.set(x, 28, 'z');
    for (let y = 29; y < 32; y++) {
      const pale = ((x >> 2) + (y >> 1)) % 2 === 0;
      let k = pale ? 'u' : 'x';
      if (pale && hash(x, y, seed + 2) < 0.12) k = 'x';
      if (y === 31) k = DARKER[k];
      b.set(x, y, k);
    }
  }
  for (let x = 13; x < 19; x++) b.set(x, 29, 'W');
  // chandelier: chain, gold arms, candle flames, crystal drops that glint in turn
  b.set(15, 7, 'y'); b.set(16, 7, 'y'); b.set(15, 8, 't'); b.set(16, 8, 't');
  for (let x = 10; x < 22; x++) b.set(x, 10, x === 10 || x === 21 ? 'Y' : 't');
  for (const cx of [10, 13, 18, 21]) { b.set(cx, 9, 'W'); b.set(cx, 8, frame % 3 === cx % 3 ? 'L' : 'p'); }
  for (const [cx, cy] of [[12, 11], [15, 12], [16, 12], [19, 11], [14, 11], [17, 11]]) b.set(cx, cy, (frame + cx) % 4 === 0 ? 'W' : 'C');
  light(b, 15.5, 10, (y) => 3 + (y - 10) * 0.9, 7, 21, null);
}

/**
 * Light cone from (cx, cy): pixels inside the cone step one tone up their ramp, the core steps two; the edge
 * band is ordered-dithered so the light fades instead of ending in a hard line. `tint` sprinkles a warm key
 * in the core just under the lamp.
 */
function light(b, cx, cy, halfWidth, y0, y1, tint) {
  for (let y = y0; y <= y1; y++) {
    const hw = halfWidth(y);
    for (let x = 0; x < ROOM_PX; x++) {
      const dx = Math.abs(x + 0.5 - cx);
      if (dx > hw + 1.5) continue;
      const k = b.get(x, y);
      if (!k || !BRIGHTER[k]) continue;
      const fall = (y - y0) / Math.max(1, y1 - y0); // dimmer further from the lamp
      const edge = (hw + 1.5 - dx) / 3; // 0 at the outer edge -> 1 inside
      if (edge < 1 && bayer(x, y) > edge) continue;
      let out = BRIGHTER[k];
      if (dx < hw * 0.45 && fall < 0.55) out = BRIGHTER[out] ?? out;
      if (tint && dx < hw * 0.55 && y < y0 + 6 && bayer(x, y) < 0.55 - (y - y0) * 0.08) out = tint;
      b.set(x, y, out);
    }
  }
}

/** Side walls: dark joint at each edge and soft ambient occlusion beside it, top corners darkest. */
function sides(b) {
  for (let y = 3; y < ROOM_PX; y++) {
    for (const [x, inward] of [[0, 1], [31, -1]]) {
      b.set(x, y, 'K');
      const k = b.get(x + inward, y);
      if (k && DARKER[k]) b.set(x + inward, y, DARKER[k]);
      const k2 = b.get(x + inward * 2, y);
      if (k2 && DARKER[k2] && bayer(x + inward * 2, y) < 0.5) b.set(x + inward * 2, y, DARKER[k2]);
    }
  }
}

/** One styled room, 32 x 32 at (x, y): template + style materials and light + machine + tier trim on top. */
export function drawStyledRoom(ctx, { x, y, amenity = null, style = 'brutalist', tier = 'survive', frame = 0, seed = 1 }) {
  ctx.imageSmoothingEnabled = false;
  const b = roomBuffer();
  if (style === 'gilded') gilded(b, seed, frame);
  else brutalist(b, seed, frame);
  sides(b);
  // contact shadow where the machine stands
  if (amenity) for (let xx = 8; xx < 25; xx++) { b.set(xx, 30, style === 'gilded' ? 'S' : 'f'); if (xx > 9 && xx < 23) b.set(xx, 29, style === 'gilded' ? 'x' : 'f'); }
  trim(b, tier, frame);
  b.paint(ctx, x, y);
  const a = amenity ? styledAmenity(amenity, style) : null;
  if (a) drawSprite(ctx, a, x + 8, y + 16, { frame });
}
