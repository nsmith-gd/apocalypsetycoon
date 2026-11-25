// Region borders and region states for the world map (#101, art note D3).
//
// The layer works on a per-pixel REGION MASK, so it sits on any base layer: today the mask is built
// from the map's clickable hit areas (8px land cells, `regionAtCell`), so borders line up exactly with
// what the player can click. When the redone base layer (#100) has a pixel coastline, pass its land
// test as `isLandPx` and the borders hug the new coast instead of the cell grid.
//
//   const mask = buildRegionMask({ w: MAP_W, h: MAP_H, cell: CELL, regionAtCell });
//   drawRegionLayer(ctx, mask, { hover: 'eur', selected: 'afr', frame });
//
// Three states, palette colours only:
//   idle      a dotted, dark political border between neighbouring regions (coasts are the base's job)
//   hover     a bone-white 1px border all round and a faint bone tint
//   selected  a 2px border: a gold line with a dark outer edge and an old-gold inner shadow, a "marching"
//             glint that walks the border, and a warm gold tint over the region

import { HEX } from './palette.js';

export const REGION_STATES = Object.freeze(['idle', 'hover', 'selected']);

/**
 * Per-pixel region ids.
 * regionAtCell(col, row) -> region id | null.  isLandPx(x, y) -> bool (optional finer land mask).
 */
export function buildRegionMask({ w, h, cell, regionAtCell, isLandPx = null }) {
  const ids = [];
  const index = new Map();
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const id = regionAtCell(Math.floor(x / cell), Math.floor(y / cell));
    if (!id) continue;
    if (isLandPx && !isLandPx(x, y)) continue;
    if (!index.has(id)) { index.set(id, ids.length + 1); ids.push(id); }
    data[y * w + x] = index.get(id);
  }
  const mask = { w, h, ids, index, data };
  mask.edges = edgesOf(mask);
  return mask;
}

/** For each region: its edge pixels, split into borders with another region and coast/outer edges. */
function edgesOf({ w, h, ids, data }) {
  const out = Object.fromEntries(ids.map((id) => [id, { border: [], coast: [], inner: [], pixels: 0, box: [w, h, 0, 0] }]));
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : data[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = data[y * w + x];
    if (!k) continue;
    const e = out[ids[k - 1]];
    e.pixels++;
    e.box = [Math.min(e.box[0], x), Math.min(e.box[1], y), Math.max(e.box[2], x), Math.max(e.box[3], y)];
    const n = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)];
    if (n.some((v) => v !== k && v !== 0)) e.border.push([x, y]);
    else if (n.some((v) => v === 0)) e.coast.push([x, y]);
    else if ([at(x + 2, y), at(x - 2, y), at(x, y + 2), at(x, y - 2), at(x + 1, y + 1), at(x - 1, y - 1), at(x + 1, y - 1), at(x - 1, y + 1)].some((v) => v !== k)) e.inner.push([x, y]);
  }
  return out;
}

const px = (ctx, pts, color, alpha = 1) => {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (const [x, y] of pts) ctx.fillRect(x, y, 1, 1);
  ctx.globalAlpha = 1;
};

function tint(ctx, mask, id, color, alpha) {
  const k = mask.index.get(id);
  if (!k) return;
  const { w, h, data } = mask;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let y = 0; y < h; y++) {
    let run = -1;
    for (let x = 0; x <= w; x++) {
      const inside = x < w && data[y * w + x] === k;
      if (inside && run < 0) run = x;
      if (!inside && run >= 0) { ctx.fillRect(run, y, x - run, 1); run = -1; }
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * Idle borders for every region: a quiet, solid dark line where two regions meet. (It was dotted; next to the
 * crisis rims the dots crawled and read as busy and dated, #111.)
 */
export function drawIdleBorders(ctx, mask) {
  for (const id of mask.ids) {
    const e = mask.edges[id];
    px(ctx, e.border, HEX.K, 0.35);
  }
}

export function drawHover(ctx, mask, id) {
  const e = mask.edges[id];
  if (!e) return;
  tint(ctx, mask, id, HEX.W, 0.14);
  px(ctx, [...e.border, ...e.coast], HEX.W, 0.9);
}

export function drawSelected(ctx, mask, id, frame = 0) {
  const e = mask.edges[id];
  if (!e) return;
  tint(ctx, mask, id, HEX.Y, 0.2);
  const ring = [...e.border, ...e.coast];
  px(ctx, e.inner, HEX.y, 0.8); // old-gold shadow just inside the line
  px(ctx, ring, HEX.Y);
  // dark outer edge: the pixel just outside the ring, where it is not this region
  const k = mask.index.get(id);
  const outside = [];
  for (const [x, y] of ring) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= mask.w || ny >= mask.h) continue;
    if (mask.data[ny * mask.w + nx] !== k) outside.push([nx, ny]);
  }
  px(ctx, outside, HEX.K, 0.85);
  // marching glint: every 6th pixel along the ring (by position), shifting with the frame
  px(ctx, ring.filter(([x, y]) => (x + y + frame) % 6 === 0), HEX.L);
}

/** The whole layer: idle borders for all, then hover, then selected on top. */
export function drawRegionLayer(ctx, mask, { hover = null, selected = null, frame = 0 } = {}) {
  drawIdleBorders(ctx, mask);
  if (hover && hover !== selected) drawHover(ctx, mask, hover);
  if (selected) drawSelected(ctx, mask, selected, frame);
}
