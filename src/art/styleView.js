// Shelter cross-section with room styles (design layer), at 128 px per room cell (2 x 2 m at 64 px per metre, #120).
// Terrain, surface and the ladder shaft come from the 16 px shelter tiles (eight per cell edge); every styled
// room is drawn by styleArt.js with its needs-tier trim.
//
//   drawStyledShelter(ctx, { cols, rows, rooms: [{ col, row, amenity, style, tier? }], frame, highlight });
//   Canvas size: cols * CELL_PX by rows * CELL_PX.

import { drawShelter } from './shelterView.js';
import { drawStyledRoom, ROOM_PX } from './styleArt.js';
import { ROOM_TIERS } from '../shelter/styles.js';

export const CELL_PX = ROOM_PX;

export function drawStyledShelter(ctx, opts = {}) {
  const { cols = 10, rows = 6, frame = 0 } = opts;
  // Terrain on the 16 px grid: row 0 grass, the shaft hugging the room column.
  const k = CELL_PX / 16;
  drawShelter(ctx, { cols: cols * k, rows: rows * k, rooms: [], frame, shaftCol: k - 1 });
  for (const r of opts.rooms ?? []) {
    const style = r.style ?? 'brutalist';
    drawStyledRoom(ctx, { x: r.col * CELL_PX, y: r.row * CELL_PX, amenity: r.amenity, style, tier: r.tier ?? ROOM_TIERS[r.amenity] ?? 'survive', frame, seed: r.col * 7 + r.row * 13 + 1 });
  }
  const h = opts.highlight;
  if (h) {
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 4;
    ctx.strokeRect(h.col * CELL_PX + 2, h.row * CELL_PX + 2, CELL_PX - 4, CELL_PX - 4);
  }
}
