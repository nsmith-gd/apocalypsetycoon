// Room styles for the design layer (#34 / #43), redrawn at the 64 px minimum (#120, art note D4).
// GDD: Art > "Shared room templates with tier trims and styles built as palette swaps";
// "The six styles re-skin materials and props, but the tier trim always stays."
//
// The old 32 px template (#88) is retired. A design-layer room is now a 2 x 2 m cut (128 x 128 px, 64 px per metre)
// of the matching 64 px room tile (src/art/hd/room-tiles.js), painted in one of the six styles: the style's own
// walls, floor, ceiling and lamps, the props re-skinned in its materials, and the needs-tier trim untouched.
//
//   drawStyledRoom(ctx, { x, y, amenity: 'gold_taps', style: 'gilded', tier: 'status', frame });

import { AMENITIES_SRC as AMENITIES } from './sprites-shelter.js';
import { renderRoomTile, DESIGN_STYLES } from './hd/room-tiles.js';
import { drawRaster } from './hd/raster.js';

export const ROOM_PX = 128; // 2 x 2 m at 64 px per metre
export const ROOM_STYLES_DRAWN = DESIGN_STYLES;

/** The 64 px room tile each design-layer amenity stands for. */
export const AMENITY_ROOMS = Object.freeze({
  bunk: 'bunk_room', air_vent: 'hand_crank_scrubber', water_tank: 'water_tank', pantry: 'pantry',
  hydroponics: 'hydroponics_bay', water_recycler: 'deep_water_recycler', mil_scrubber: 'hepa_scrubber_bay',
  gold_taps: 'spa_sauna', wine_cellar: 'wine_cellar', cryo_pod: 'cryo_pod_bay', ai_butler: 'biohacking_lab',
});

// Machine (amenity) material swaps for the old 16 px sprites (kept for code that still draws them).
export const AMENITY_SWAPS = Object.freeze({
  neutral: {},
  brutalist: { k: 'a', M: 'h', m: 'i', w: 'j', W: 'l' }, // cast concrete housings
  gilded: { k: 'z', M: 'y', m: 't', w: 'L' }, // brass and gold leaf
});

// Needs-tier trim (GDD: Art > Tier colour language). The 64 px trims are drawn by room-tiles.js.
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

/** The styled room as a Raster (headless; tests and exports). */
export function renderStyledRoom({ amenity = null, style = 'brutalist', tier = 'survive', frame = 0 } = {}) {
  const id = amenity ? AMENITY_ROOMS[amenity] ?? 'storeroom' : 'empty';
  return renderRoomTile(id, { frame, design: DESIGN_STYLES.includes(style) ? style : 'brutalist', size: { w: 2, h: 2 }, tier });
}

const cache = new Map();
/** Draw one styled design-layer room (ROOM_PX square) at x, y. */
export function drawStyledRoom(ctx, { x, y, amenity = null, style = 'brutalist', tier = 'survive', frame = 0 } = {}) {
  ctx.imageSmoothingEnabled = false;
  const key = `${amenity}:${style}:${tier}:${frame % 2}`;
  let cv = cache.get(key);
  if (!cv) {
    const r = renderStyledRoom({ amenity, style, tier, frame });
    cv = Object.assign(document.createElement('canvas'), { width: r.w, height: r.h });
    drawRaster(cv.getContext('2d'), r, 0, 0);
    cache.set(key, cv);
  }
  ctx.drawImage(cv, x, y);
}
