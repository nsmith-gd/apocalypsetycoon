// Shelter cross-section with room styles (design layer).
// Greybox: draws the normal shelter, then marks each room's style with a floor band
// (concrete grey = Brutalist, gold = Gilded). The palette-swapped room art replaces this.
//
//   drawStyledShelter(ctx, { cols, rows, rooms: [{ col, row, amenity, style }], frame, highlight });

import { drawShelter, TILE } from './shelterView.js';

const BAND = { brutalist: ['#8a8680', '#5a5650'], gilded: ['#f5c542', '#b8862a'] };

export function drawStyledShelter(ctx, opts = {}) {
  drawShelter(ctx, opts);
  for (const r of opts.rooms ?? []) {
    const band = BAND[r.style];
    if (!band) continue;
    const x = r.col * TILE;
    const y = r.row * TILE;
    ctx.fillStyle = band[0];
    ctx.fillRect(x + 1, y + TILE - 2, TILE - 2, 1);
    ctx.fillStyle = band[1];
    ctx.fillRect(x + 1, y + TILE - 1, TILE - 2, 1);
  }
}
