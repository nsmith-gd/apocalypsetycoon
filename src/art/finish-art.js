// Detailed interior pieces for the style kits (#97): wall patterns and floors drawn per pixel from the
// palette's material ramps. Patterns are laid out in WORLD pixels, so seams, tie holes, damask motifs and
// marble veins run continuously across every tile of a room instead of repeating inside each tile.
//
//   drawWallPiece(ctx, finishId, px, py, tx, ty, T)   -> true if this module drew it
//   drawFloorPiece(ctx, finishId, px, py, tx, T, h)   -> true if this module drew it (h = floor strip height)

import { HEX } from './palette.js';

function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const bayer = (x, y) => (BAYER[y & 3][x & 3] + 0.5) / 16;

function plot(ctx, x, y, key) { ctx.fillStyle = HEX[key]; ctx.fillRect(x, y, 1, 1); }

// ---------- Brutalist: board-formed concrete ----------
// Mottled cast texture in 2x2 clusters, board joints every 6 px (broken in places), form-panel seams every
// 48 x 32 px with a lit lip, tie holes on a 24 x 16 grid with drip stains, and a darker band of damp
// rising from the floor at the bottom of each panel.
function boardConcreteKey(X, Y) {
  // tie holes and their drips
  const hx = ((X % 24) + 24) % 24;
  const hy = ((Y % 16) + 16) % 16;
  if ((hx === 11 || hx === 12) && (hy === 7 || hy === 8)) return hx === 12 && hy === 8 ? 'f' : 'a';
  if (hx === 10 && hy === 6) return 'j';
  const drip = 2 + Math.floor(hash(Math.floor(X / 24), Math.floor(Y / 16), 3) * 5);
  if (hx === 12 && hy > 8 && hy <= 8 + drip) return hy === 8 + drip ? 'h' : 'f';
  // form-panel seams
  const sx = ((X % 48) + 48) % 48;
  const sy = ((Y % 32) + 32) % 32;
  if (sx === 0 || sy === 0) return 'f';
  if (sx === 1 || sy === 1) return 'i';
  // board joints
  if (Y % 6 === 5 && hash(X >> 3, Y, 7) < 0.65) return 'f';
  // cast mottling and specks
  const m = hash(X >> 1, Y >> 1, 1);
  let k = m < 0.16 ? 'f' : m > 0.86 ? 'i' : 'h';
  if (hash(X, Y, 2) > 0.975) k = 'j';
  // damp rising at the foot of each 32 px panel
  if (sy > 26 && bayer(X, Y) < (sy - 26) / 8) k = k === 'i' ? 'h' : 'f';
  return k;
}

// ---------- Gilded: velvet damask with gold pinstripes ----------
// A 12 x 16 damask motif (a fleur in sheen and shadow velvet) between gold pinstripes, with worn pile
// and the occasional gold-leaf glint on the stripe.
const DAMASK = [
  '......s.....',
  '.....sss....',
  '....sqVqs...',
  '.....sqs....',
  '...s..s..s..',
  '..ssssqssss.',
  '...s.sqs.s..',
  '.....sqs....',
  '....sqqqs...',
  '...sqV.Vqs..',
  '....s...s...',
  '............',
  '......q.....',
  '.....qVq....',
  '......q.....',
  '............',
];
function damaskKey(X, Y) {
  const mx = ((X % 12) + 12) % 12;
  const my = ((Y % 16) + 16) % 16;
  if (mx === 11) return hash(X, Y >> 2, 4) > 0.94 ? 'L' : (Y % 4 === 0 ? 'Y' : 't');
  // offset every other column of motifs by half a repeat
  const col = Math.floor(X / 12);
  const yy = (((Y + (col % 2 ? 8 : 0)) % 16) + 16) % 16;
  let k = DAMASK[yy][mx];
  if (k === '.') k = 'V';
  if (hash(X, Y, 5) < 0.035) k = k === 's' ? 'V' : 'q'; // worn pile
  return k;
}

const WALLS = { board_concrete: boardConcreteKey, damask: damaskKey };

export function drawWallPiece(ctx, finishId, px, py, tx, ty, T = 16) {
  const fn = WALLS[finishId];
  if (!fn) return false;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) plot(ctx, px + x, py + y, fn(tx * T + x, ty * T + y));
  return true;
}

// ---------- floors (the strip laid on top of the slab under a room) ----------
function polishedSlabKey(X, y, h) {
  if (y === 0) return 'j'; // lit nosing
  if (y === h - 1) return 'f';
  if (hash(X, y, 9) < 0.05) return 'f'; // hairline cracks
  if ((X + y * 3) % 23 < 2 && y === 1) return 'l'; // reflection streak
  return y === 1 ? 'i' : 'h';
}
function checkerKey(X, y, h) {
  const light = ((X >> 3) + (y >> 1)) % 2 === 0;
  if (y === 0) return light ? 'W' : 'h';
  let k = light ? 'u' : 'a';
  if (light && hash(X, y, 2) < 0.14) k = 'x'; // veins
  if (!light && hash(X, y, 3) > 0.9) k = 'f';
  if (y === h - 1) k = light ? 'x' : 'a';
  return k;
}
const FLOORS = { polished_slab: polishedSlabKey, checker: checkerKey };

export function drawFloorPiece(ctx, finishId, px, py, tx, T = 16, h = 4) {
  const fn = FLOORS[finishId];
  if (!fn) return false;
  for (let y = 0; y < h; y++) for (let x = 0; x < T; x++) plot(ctx, px + x, py + y, fn(tx * T + x, y, h));
  return true;
}

/** Which finishes this module draws (for the gallery and tests). */
export const DETAILED_WALLS = Object.freeze(Object.keys(WALLS));
export const DETAILED_FLOORS = Object.freeze(Object.keys(FLOORS));
export const wallPieceKey = (finishId, X, Y) => WALLS[finishId]?.(X, Y) ?? null;
export const floorPieceKey = (finishId, X, y, h = 4) => FLOORS[finishId]?.(X, y, h) ?? null;
