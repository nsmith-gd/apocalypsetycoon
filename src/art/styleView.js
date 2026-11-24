// Shelter cross-section with room styles (design layer), at 32 px per room cell (#88).
// Terrain, surface and the ladder shaft come from the 16 px shelter tiles (two per cell edge); every styled
// room is drawn by styleArt.js with its needs-tier trim.
//
//   drawStyledShelter(ctx, { cols, rows, rooms: [{ col, row, amenity, style, tier? }], frame, highlight });
//   Canvas size: cols * 32 by rows * 32.

import { drawShelter } from './shelterView.js';
import { drawStyledRoom, ROOM_PX } from './styleArt.js';
import { ROOM_TIERS } from '../shelter/styles.js';

export const CELL_PX = ROOM_PX;

export function drawStyledShelter(ctx, opts = {}) {
  const { cols = 10, rows = 6, frame = 0 } = opts;
  // Terrain on the 16 px grid: row 0 grass, the shaft hugging the room column.
  drawShelter(ctx, { cols: cols * 2, rows: rows * 2, rooms: [], frame, shaftCol: 1 });
  for (const r of opts.rooms ?? []) {
    const style = r.style ?? 'brutalist';
    drawStyledRoom(ctx, { x: r.col * CELL_PX, y: r.row * CELL_PX, amenity: r.amenity, style, tier: r.tier ?? ROOM_TIERS[r.amenity] ?? 'survive', frame, seed: r.col * 7 + r.row * 13 + 1 });
  }
  const h = opts.highlight;
  if (h) {
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 1;
    ctx.strokeRect(h.col * CELL_PX + 0.5, h.row * CELL_PX + 0.5, CELL_PX - 1, CELL_PX - 1);
  }
}
