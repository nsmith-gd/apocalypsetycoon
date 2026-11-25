// The real Earth for the world map (#138): decoded region raster (earth-data.js), the projection, and the game's
// 40x24 cell layout and hit areas derived from it. Pure data, no DOM.
//
//   earthRegionAt(fx, fy)          region id ('nam'...'oce', 'ice') or null for sea; fx, fy in 0..1 of the map
//   lonLatAt(fx, fy) / mapXY(lon, lat)  the Miller projection both ways (fractions of the map)
//   WORLD_LAYOUT, CELL_REGIONS     the 40x24 cell layout (~ # f d m c i) and the demand region of each cell
//   CITIES                         the cities with a skyline marker, and their cells

import { EARTH } from './earth-data.js';

export const MAP_COLS = 40;
export const MAP_ROWS = 24;
export const DEMAND_REGIONS = Object.freeze(['nam', 'lat', 'eur', 'afr', 'mea', 'sas', 'eas', 'oce']);

// ---------------------------------------------------------------- decode (once)
function b64bytes(s) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
let GRID = null;
export function earthGrid() {
  if (GRID) return GRID;
  const bytes = b64bytes(EARTH.rle), g = new Uint8Array(EARTH.w * EARTH.h);
  let i = 0, p = 0;
  while (p < bytes.length) {
    let word = 0, mul = 1, b;
    do { b = bytes[p++]; word += (b & 0x7f) * mul; mul *= 128; } while (b & 0x80);
    const v = word % 16, n = Math.floor(word / 16);
    g.fill(v, i, i + n); i += n;
  }
  return (GRID = g);
}
export const EARTH_W = EARTH.w, EARTH_H = EARTH.h;

/** Raw value (0 sea, k = EARTH.regions[k - 1]) at a fraction of the map. */
export function earthValueAt(fx, fy) {
  const x = Math.min(EARTH.w - 1, Math.max(0, Math.floor(fx * EARTH.w))), y = Math.min(EARTH.h - 1, Math.max(0, Math.floor(fy * EARTH.h)));
  return earthGrid()[y * EARTH.w + x];
}
export function earthRegionAt(fx, fy) { const v = earthValueAt(fx, fy); return v ? EARTH.regions[v - 1] : null; }

// ---------------------------------------------------------------- projection (Miller cylindrical)
const RAD = Math.PI / 180;
const miller = (lat) => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * RAD));
const Y0 = miller(EARTH.latTop), Y1 = miller(EARTH.latBottom);
/** Longitude and latitude (degrees) at a fraction of the map. */
export function lonLatAt(fx, fy) {
  const y = Y0 - fy * (Y0 - Y1);
  const lat = (2.5 * Math.atan(Math.exp(0.8 * y)) - (5 * Math.PI) / 8) / RAD;
  let lon = EARTH.lon0 + fx * 360; if (lon > 180) lon -= 360;
  return [lon, lat];
}
/** Fraction of the map (fx, fy) for a longitude and latitude. */
export function mapXY(lon, lat) { return [((((lon - EARTH.lon0) % 360) + 360) % 360) / 360, (Y0 - miller(lat)) / (Y0 - Y1)]; }

// ---------------------------------------------------------------- cities with a skyline marker (GDD: real echoes)
export const CITIES = Object.freeze([
  ['New York', -74, 40.7], ['Los Angeles', -118.2, 34], ['Mexico City', -99.1, 19.4], ['Sao Paulo', -46.6, -23.5],
  ['London', -0.1, 51.5], ['Moscow', 37.6, 55.8], ['Lagos', 3.4, 6.5], ['Cairo', 31.2, 30], ['Dubai', 55.3, 25.2],
  ['Mumbai', 72.9, 19], ['Beijing', 116.4, 39.9], ['Tokyo', 139.7, 35.7], ['Singapore', 103.8, 1.35], ['Sydney', 151.2, -33.9],
].map(([name, lon, lat]) => { const [fx, fy] = mapXY(lon, lat); return Object.freeze({ name, lon, lat, cell: [Math.floor(fx * MAP_COLS), Math.floor(fy * MAP_ROWS)] }); }));

// ---------------------------------------------------------------- the cell layout and its regions
/** Biome letter for a land point (used by the cell layout; the painter has its own finer version). */
export function biomeLetter(lon, lat) {
  if (geoScore(DESERTS, lon, lat) > 0.35) return 'd';
  if (ridgeDistance(lon, lat) < 1.2) return 'm';
  if (geoScore(RAINFORESTS, lon, lat) > 0.3 || (lat > 50 && lat < 64)) return 'f';
  return '#';
}
function buildLayout() {
  const rows = [], regions = [];
  const sx = EARTH.w / MAP_COLS, sy = EARTH.h / MAP_ROWS, g = earthGrid();
  const cityCells = new Set(CITIES.map((c) => c.cell.join(',')));
  for (let r = 0; r < MAP_ROWS; r++) {
    let row = ''; const reg = [];
    for (let c = 0; c < MAP_COLS; c++) {
      const count = new Map();
      for (let y = Math.floor(r * sy); y < Math.floor((r + 1) * sy); y += 2) for (let x = Math.floor(c * sx); x < Math.floor((c + 1) * sx); x += 2) { const v = g[y * EARTH.w + x]; count.set(v, (count.get(v) ?? 0) + 1); }
      const total = [...count.values()].reduce((a, b) => a + b, 0);
      const sea = count.get(0) ?? 0;
      let best = 0, bestN = -1;
      for (const [v, n] of count) if (v && n > bestN) { best = v; bestN = n; }
      const id = best ? EARTH.regions[best - 1] : null;
      const city = cityCells.has(`${c},${r}`) && best && EARTH.regions[best - 1] !== 'ice'; // a coastal city keeps its cell
      if (!best || (!city && (total - sea) / total < 0.3)) { row += '~'; reg.push(null); continue; }
      if (id === 'ice') { row += 'i'; reg.push(null); continue; }
      const [lon, lat] = lonLatAt((c + 0.5) / MAP_COLS, (r + 0.5) / MAP_ROWS);
      row += city ? 'c' : biomeLetter(lon, lat);
      reg.push(id);
    }
    rows.push(row); regions.push(Object.freeze(reg));
  }
  return { rows: Object.freeze(rows), regions: Object.freeze(regions) };
}

// ---------------------------------------------------------------- geography (lon/lat), shared with the painter
// Deserts and rainforests as soft ellipses [lon, lat, rx, ry] in degrees; mountain chains as polylines with a
// half-width in degrees. Hand-placed from physical maps (GDD: real echoes; director #138: "look like the Earth").
export const DESERTS = Object.freeze([
  [8, 23, 24, 8], [-6, 26, 10, 6], [30, 22, 6, 6], [47, 23, 9, 7], [54, 19, 6, 3], [57, 32, 7, 4], [64, 29, 5, 3], [71, 27, 3.5, 3],
  [62, 41, 9, 4], [83, 39, 7, 3], [104, 43, 12, 4.5], [95, 39, 5, 3], [20, -23, 7, 6], [15, -21, 2.5, 7], [128, -25, 14, 7],
  [136, -29, 7, 4], [-114, 37, 6, 5], [-107, 31, 4, 3], [-70, -23, 1.6, 7], [-68, -44, 3, 5], [44, 8, 4, 4], [-40, -8, 3, 3],
]);
export const RAINFORESTS = Object.freeze([
  [-62, -4, 15, 9], [-75, 4, 4, 5], [-86, 12, 4, 5], [20, 0, 10, 5], [11, 4, 5, 4], [110, 1, 13, 7], [100, 14, 5, 6],
  [143, -6, 8, 4], [-52, -24, 4, 4], [74, 12, 3, 4], [48, -18, 3, 6], [125, 8, 4, 6],
]);
export const RIDGES = Object.freeze([
  { w: 2.4, pts: [[-150, 61], [-140, 61], [-133, 58], [-126, 53], [-118, 48], [-112, 43], [-108, 38], [-106, 33]] }, // Rockies
  { w: 1.5, pts: [[-158, 67], [-148, 68], [-141, 69]] }, // Brooks Range
  { w: 1.6, pts: [[-108, 29], [-103, 24], [-99, 19], [-95, 17], [-90, 15]] }, // Sierra Madre
  { w: 1.6, pts: [[-74, 10], [-77, 4], [-78, -2], [-76, -10], [-71, -15], [-68, -20], [-68, -26], [-70, -33], [-71, -40], [-73, -47], [-73, -52]] }, // Andes
  { w: 1.0, pts: [[-84, 35], [-80, 37.5], [-77, 40], [-73, 43]] }, // Appalachians
  { w: 1.0, pts: [[5, 44], [7, 46], [10, 46.6], [13, 47], [16, 47.5]] }, // Alps
  { w: 0.8, pts: [[-2, 43], [2, 42.6]] }, // Pyrenees
  { w: 1.0, pts: [[6, 59], [9, 62], [13, 64.5], [17, 68], [20, 69.5]] }, // Scandes
  { w: 1.0, pts: [[40, 43.5], [44, 42.5], [48, 41]] }, // Caucasus
  { w: 1.3, pts: [[43, 37.5], [47, 34], [52, 30.5], [56, 27.5]] }, // Zagros
  { w: 1.0, pts: [[60, 68], [59.5, 62], [59, 56], [58.5, 52]] }, // Urals
  { w: 2.6, pts: [[70, 36], [75, 34.5], [80, 31.5], [85, 28.8], [90, 28], [96, 28.5]] }, // Himalaya
  { w: 4.5, pts: [[80, 34.5], [88, 33.5], [96, 33]] }, // Tibetan plateau
  { w: 1.6, pts: [[68, 41], [75, 42], [80, 42.3], [86, 43], [92, 43.5]] }, // Tian Shan
  { w: 1.4, pts: [[85, 50], [90, 49.5], [97, 49]] }, // Altai
  { w: 1.3, pts: [[-9, 30.5], [-5, 32.5], [0, 34.5], [5, 35.8], [9, 36.3]] }, // Atlas
  { w: 2.0, pts: [[37, 14], [39, 10], [38, 6], [36.5, 0], [35, -4]] }, // Ethiopian highlands, East African rift
  { w: 1.2, pts: [[146, -16], [148, -22], [150, -28], [150, -33], [147, -37]] }, // Great Dividing Range
  { w: 0.9, pts: [[167, -45.5], [170.5, -43.5], [173, -41.5]] }, // Southern Alps
  { w: 1.2, pts: [[130, 63], [138, 63], [148, 62], [160, 64]] }, // Verkhoyansk / Chersky
  { w: 1.0, pts: [[136, 35], [138.5, 36], [140, 39]] }, // Japanese Alps
]);
export function geoScore(list, lon, lat) {
  let best = 0;
  for (const [x, y, rx, ry] of list) { const d = Math.hypot((lon - x) / rx, (lat - y) / ry); if (d < 1) best = Math.max(best, 1 - d); }
  return best;
}
/** Distance (in units of the chain's half-width) to the nearest mountain chain's spine. */
export function ridgeDistance(lon, lat) {
  let best = Infinity;
  for (const { w, pts } of RIDGES) for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const k = Math.cos(lat * RAD); // degrees of longitude shrink toward the poles
    const dx = (bx - ax) * k, dy = by - ay, px = (lon - ax) * k, py = lat - ay;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(px - t * dx, py - t * dy) / w);
  }
  return best;
}

const LAYOUT = buildLayout();
export const WORLD_LAYOUT = LAYOUT.rows;
export const CELL_REGIONS = LAYOUT.regions;
