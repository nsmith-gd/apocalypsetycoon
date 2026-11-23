// Shelter cross-section renderer: 16px cells. Row 0 is the surface, a ladder shaft runs
// down column 0, and below that it's earth (deeper rows darker) until a room is dug.
//
//   drawShelter(ctx, { cols: 10, rows: 6, rooms: [{ col: 1, row: 1, amenity: 'gold_taps' }], frame });

import { TILES, AMENITIES } from './sprites-shelter.js';
import { drawSprite } from './render.js';

export const TILE = 16;

export function drawShelter(ctx, { cols = 10, rows = 6, rooms = [], frame = 0, shaftCol = 0, highlight = null } = {}) {
  ctx.imageSmoothingEnabled = false;
  const roomAt = new Map(rooms.map((r) => [`${r.col},${r.row}`, r]));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * TILE;
      const y = r * TILE;
      if (r === 0) { drawSprite(ctx, TILES.surface, x, y); continue; }
      if (c === shaftCol) { drawSprite(ctx, TILES.shaft, x, y); continue; }
      const room = roomAt.get(`${c},${r}`);
      if (room) {
        drawSprite(ctx, TILES.roomEmpty, x, y);
        const sprite = AMENITIES[room.amenity];
        if (sprite) drawSprite(ctx, sprite, x, y, { frame });
      } else {
        const deep = r >= Math.ceil(rows * 0.6);
        // a few boulders for texture, deterministic per cell
        const rock = (c * 7 + r * 13) % 11 === 0;
        drawSprite(ctx, rock ? TILES.rock : deep ? TILES.earthDeep : TILES.earth, x, y);
      }
    }
  }
  if (highlight) {
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 1;
    ctx.strokeRect(highlight.col * TILE + 0.5, highlight.row * TILE + 0.5, TILE - 1, TILE - 1);
  }
}

/** Next free slot left-to-right, top-to-bottom (skipping the surface and shaft). */
export function nextFreeSlot(rooms, { cols = 10, rows = 6, shaftCol = 0 } = {}) {
  const taken = new Set(rooms.map((r) => `${r.col},${r.row}`));
  for (let r = 1; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (c === shaftCol) continue;
    if (!taken.has(`${c},${r}`)) return { col: c, row: r };
  }
  return null;
}
