// Stylised world map renderer: a 320x192 native canvas. The base layer is painted per pixel from
// WORLD_LAYOUT (src/art/map-base.js, #100); regions are rectangles over the 40x24 grid of 8px cells. Crisis level per
// region (0..100) picks an overlay (uneasy / edge / tipping) and shows its icon.
//
//   drawWorldMap(ctx, { crisis: { na: 45, eu: 92 }, crisisType: { eu: 'pandemic' },
//                       frame, selected: 'eu', bunkers: [[9,4]] });

import { MAP_MARKERS, CRISIS_ICONS, CRISIS_OVERLAYS } from './sprites-map.js';
import { drawSprite } from './render.js';
import { drawText, textWidth } from './font.js';
import { HEX } from './palette.js';
import { drawMapBase } from './map-base.js';
import { WORLD_LAYOUT as EARTH_LAYOUT, CELL_REGIONS } from './earth.js';

export const CELL = 8;
export const MAP_COLS = 40;
export const MAP_ROWS = 24;
export const MAP_W = MAP_COLS * CELL;
export const MAP_H = MAP_ROWS * CELL;

// ~ ocean, # land, f forest, d desert, m mountain, c city, i ice. Since #138 the layout is derived from the real
// Earth (src/art/earth.js): each 8px cell is land when 30%+ of it is land, its letter is the biome there.
export const WORLD_LAYOUT = EARTH_LAYOUT;

// Regions (the six art regions of the old renderer; the game's eight demand regions are in worldmap-ui.js). Since
// #138 a cell's region comes from the real country under it (CELL_REGIONS); rect stays as the rough label area.
export const MAP_REGIONS = [
  { id: 'na', name: 'N.America', rect: [0, 2, 13, 8], label: [3, 9] },
  { id: 'sa', name: 'S.America', rect: [5, 9, 9, 10], label: [5, 19] },
  { id: 'eu', name: 'Europe', rect: [17, 3, 8, 5], label: [16, 1] },
  { id: 'af', name: 'Africa', rect: [16, 8, 9, 9], label: [15, 16] },
  { id: 'as', name: 'Asia', rect: [21, 2, 19, 13], label: [33, 1] },
  { id: 'oc', name: 'Oceania', rect: [30, 13, 10, 6], label: [31, 19] },
];
const ART_OF = { nam: 'na', lat: 'sa', eur: 'eu', afr: 'af', mea: 'as', sas: 'as', eas: 'as', oce: 'oc' };

export function regionAt(col, row) {
  const t = WORLD_LAYOUT[row]?.[col];
  if (!t || t === '~' || t === 'i') return null;
  const id = ART_OF[CELL_REGIONS[row]?.[col]];
  return MAP_REGIONS.find((r) => r.id === id) ?? null;
}

export function crisisOverlay(level) {
  if (level >= 90) return 'tipping';
  if (level >= 70) return 'edge';
  if (level >= 40) return 'uneasy';
  return null;
}


export function drawWorldMap(ctx, { crisis = {}, crisisType = {}, frame = 0, selected = null, bunkers = [], labels = true } = {}) {
  ctx.imageSmoothingEnabled = false;
  // 1-2. base layer: land, coasts, ocean and terrain painted per pixel (#100, style guide "World map")
  drawMapBase(ctx);
  // 3. crisis overlays per region
  for (let r = 0; r < MAP_ROWS; r++) for (let c = 0; c < MAP_COLS; c++) {
    const reg = regionAt(c, r);
    if (!reg) continue;
    const ov = crisisOverlay(crisis[reg.id] ?? 0);
    if (ov) drawSprite(ctx, CRISIS_OVERLAYS[ov], c * CELL, r * CELL, { frame });
    if (selected === reg.id && CRISIS_OVERLAYS.selected) drawSprite(ctx, CRISIS_OVERLAYS.selected, c * CELL, r * CELL, { frame });
  }
  // 4. bunkers we've sold
  for (const [c, r] of bunkers) drawSprite(ctx, MAP_MARKERS.bunker, c * CELL - 1, r * CELL - 1);
  // 5. labels + crisis icons
  if (!labels) return;
  for (const reg of MAP_REGIONS) {
    const [lc, lr] = reg.label;
    const level = Math.round(crisis[reg.id] ?? 0);
    const ov = crisisOverlay(level);
    const color = ov === 'tipping' ? HEX.R : ov === 'edge' ? HEX.O : ov === 'uneasy' ? HEX.Y : HEX.W;
    const x = lc * CELL;
    const y = lr * CELL + 1;
    drawText(ctx, reg.name, x, y, selected === reg.id ? HEX.L : HEX.W);
    drawText(ctx, String(level), x + textWidth(reg.name) + 4, y, color);
    const icon = CRISIS_ICONS[crisisType[reg.id]];
    if (icon && ov) drawSprite(ctx, icon, x + textWidth(reg.name) + 4 + textWidth(String(level)) + 3, y - 3, { frame });
  }
}
