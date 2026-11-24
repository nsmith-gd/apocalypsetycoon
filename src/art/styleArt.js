// Room styles as palette swaps (design layer art, L0 placeholder: Brutalist and Gilded).
// GDD: Art > "Shared room templates with tier trims and styles built as palette swaps";
// "The six styles re-skin materials and props, but the tier trim always stays."
//
// ROOM_SHELL is one 16px room template drawn with MATERIAL SLOT keys (they are ordinary palette keys,
// remapped per style). Amenity sprites are swapped through a smaller map (their metal and glints) so a
// Gilded air vent is brass and a Brutalist one is matte. The needs-tier trim (ceiling band) is drawn last
// and never swapped, so a Brutalist art vault still reads as Status.
//
//   drawStyledRoom(ctx, { x, y, amenity: 'gold_taps', style: 'gilded', tier: 'status', frame });

import { AMENITIES } from './sprites-shelter.js';
import { drawSprite } from './render.js';
import { HEX } from './palette.js';

// Slots: K beam/outline · D seam & shadow · d upper wall · T plaque/sconce · S light-cone dither · w lamp
//        B wainscot rail · b lower wall · e wear/vein · M floor · m floor glint
export const ROOM_SHELL = Object.freeze({
  w: 16, h: 16, rows: [
    'KKKKKKKKKKKKKKKK',
    'KKKKKKKKKKKKKKKK',
    'DDDDDDDwwDDDDDDD',
    'ddddddSddSdddDdd',
    'dTTddSdSSdSddDdd',
    'dTTdSdSddSdSdDdd',
    'ddddddSdSddddDdd',
    'deddddddddddeDdd',
    'BBBBBBBBBBBBBBBB',
    'bbbbbbbbbbbbbbbb',
    'bbbDbbbbbbbbDbbb',
    'bbbbbbbebbbbbbbb',
    'bebbbbbbbbbbbbeb',
    'DDDDDDDDDDDDDDDD',
    'MmMMMMMeMMMMmMMM',
    'KKKKKKKKKKKKKKKK',
  ],
});

// Shell slot -> palette key, per style.
export const SHELL_SWAPS = Object.freeze({
  // The bunker as it was: steel panels, dark wainscot.
  neutral: { K: 'k', D: 'D', d: 'd', T: 'd', S: 'd', w: 'S', B: 'D', b: 'd', e: 'D', M: 'M', m: 'm' },
  // Raw concrete, form-tie holes, a stencilled plaque and sodium light (amber dither on grey).
  brutalist: { K: 'K', D: 'd', d: 'S', T: 'K', S: 'O', w: 'O', B: 'd', b: 'b', e: 'B', M: 'd', m: 'S' },
  // Velvet wallpaper with gold seams, a gold-framed portrait, chandelier glint, marble wainscot and floor.
  gilded: { K: 'K', D: 'y', d: 'V', T: 'Y', S: 'r', w: 'L', B: 'Y', b: 'W', e: 'S', M: 'S', m: 'W' },
});

// Amenity material swaps (outline K and accent colours stay, so each machine is still recognisable).
export const AMENITY_SWAPS = Object.freeze({
  neutral: {},
  brutalist: { k: 'd', M: 'S', m: 'W', w: 'O' }, // cast concrete housings, sodium-lamp glints
  gilded: { M: 'y', m: 'Y', w: 'L' }, // brass and gold leaf
});

// Needs-tier trim (GDD: Art > Tier colour language). Never swapped by a style.
export const TIER_TRIM = Object.freeze({
  survive: { a: 'Y', b: 'K', pattern: 'hazard' }, // hazard yellow and stencil black
  comfort: { a: 'b', b: 'B', pattern: 'grain' }, // warm walnut
  status: { a: 'Y', b: 'g', pattern: 'inlay' }, // gold leaf and emerald
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

export function styledShell(style = 'neutral') {
  return swapSprite(ROOM_SHELL, SHELL_SWAPS[style] ?? SHELL_SWAPS.neutral, `shell:${style}`);
}

export function styledAmenity(id, style = 'neutral') {
  const s = AMENITIES[id];
  return s ? swapSprite(s, AMENITY_SWAPS[style] ?? {}, `amen:${style}`) : null;
}

/** The two-pixel ceiling band in the tier's colours. */
export function drawTierTrim(ctx, x, y, tier = 'survive', frame = 0) {
  const t = TIER_TRIM[tier] ?? TIER_TRIM.survive;
  for (let i = 0; i < 16; i++) {
    let top;
    let bot;
    if (t.pattern === 'hazard') { const on = ((i + 0) >> 1) % 2 === 0; top = on ? t.a : t.b; bot = ((i + 1) >> 1) % 2 === 0 ? t.a : t.b; }
    else if (t.pattern === 'grain') { top = t.a; bot = i % 5 === 2 ? t.a : t.b; }
    else if (t.pattern === 'inlay') { top = t.a; bot = i % 4 === 1 || i % 4 === 2 ? t.b : t.a; }
    else { const on = (i + frame) % 3 === 0; top = on ? 'C' : t.a; bot = (i + frame) % 2 ? t.b : t.a; }
    ctx.fillStyle = HEX[top];
    ctx.fillRect(x + i, y, 1, 1);
    ctx.fillStyle = HEX[bot];
    ctx.fillRect(x + i, y + 1, 1, 1);
  }
}

/** One styled room: shell, amenity, then the tier trim on top. */
export function drawStyledRoom(ctx, { x, y, amenity = null, style = 'neutral', tier = 'survive', frame = 0 }) {
  ctx.imageSmoothingEnabled = false;
  drawSprite(ctx, styledShell(style), x, y);
  const a = amenity ? styledAmenity(amenity, style) : null;
  if (a) drawSprite(ctx, a, x, y, { frame });
  drawTierTrim(ctx, x, y, tier, frame);
}
