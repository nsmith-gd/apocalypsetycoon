// Shelter cross-section with room styles (design layer).
// Draws the normal shelter (terrain, surface, shaft), then every styled room as a palette swap
// (styleArt.js) with its needs-tier trim on the ceiling.
//
//   drawStyledShelter(ctx, { cols, rows, rooms: [{ col, row, amenity, style, tier? }], frame, highlight });

import { drawShelter, TILE } from './shelterView.js';
import { drawStyledRoom } from './styleArt.js';
import { ROOM_TIERS } from '../shelter/styles.js';

export function drawStyledShelter(ctx, opts = {}) {
  drawShelter(ctx, { ...opts, highlight: null });
  for (const r of opts.rooms ?? []) {
    if (!r.style) continue;
    drawStyledRoom(ctx, { x: r.col * TILE, y: r.row * TILE, amenity: r.amenity, style: r.style, tier: r.tier ?? ROOM_TIERS[r.amenity] ?? 'survive', frame: opts.frame ?? 0 });
  }
  const h = opts.highlight;
  if (h) {
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 1;
    ctx.strokeRect(h.col * TILE + 0.5, h.row * TILE + 0.5, TILE - 1, TILE - 1);
  }
}
