// Demand heat overlay for the world map (#103, art note D3): how hot a region's crisis (and so its
// demand and prices) runs, drawn so it still reads on detailed terrain.
//
// Busy terrain (forest dots, desert ripples, mountains) swallowed the old sparse dot overlay. Each heat
// level now stacks three cues, so it reads by brightness, colour AND texture:
//   1. a dimming veil (dark) so the terrain steps back
//   2. a colour wash in the level's palette colour
//   3. a texture of its own: uneasy = dot lattice, edge = diagonal stripes, tipping = crosshatch,
//      plus an inner rim on the region's edge that thickens with the heat
// Tipping's rim pulses between alarm red and dried blood (steady under Reduced flashing).
//
//   drawHeatLayer(ctx, mask, { nam: 'edge', afr: 'tipping' }, { frame, strong, steady })

import { HEX } from './palette.js';

export const HEAT_LEVELS = Object.freeze(['uneasy', 'edge', 'tipping']);

export const HEAT_STYLE = Object.freeze({
  uneasy: { veil: 0.12, wash: HEX.Y, washA: 0.16, ink: HEX.Y, inkA: 0.85, rim: 1 },
  edge: { veil: 0.2, wash: HEX.O, washA: 0.24, ink: HEX.O, inkA: 0.9, rim: 1 },
  tipping: { veil: 0.28, wash: HEX.R, washA: 0.3, ink: HEX.R, inkA: 0.95, rim: 2 },
});

const textured = {
  uneasy: (x, y) => x % 4 === 1 && y % 4 === ((x >> 2) % 2 ? 3 : 1), // staggered dot lattice
  edge: (x, y) => (x + y) % 4 === 0, // diagonal stripes
  tipping: (x, y) => (x + y) % 4 === 0 || (x - y + 1024) % 4 === 0, // crosshatch
};

/** Fill every pixel of a region where test(x, y) holds. */
function eachPixel(mask, k, fn) {
  const { w, h, data } = mask;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[y * w + x] === k) fn(x, y);
}

function fillRuns(ctx, mask, k) {
  const { w, h, data } = mask;
  for (let y = 0; y < h; y++) {
    let run = -1;
    for (let x = 0; x <= w; x++) {
      const inside = x < w && data[y * w + x] === k;
      if (inside && run < 0) run = x;
      if (!inside && run >= 0) { ctx.fillRect(run, y, x - run, 1); run = -1; }
    }
  }
}

/** One region at one heat level. */
export function drawHeat(ctx, mask, id, level, { frame = 0, strong = false, steady = false } = {}) {
  const st = HEAT_STYLE[level];
  const k = mask.index.get(id);
  if (!st || !k) return;
  // 1. veil, 2. wash
  ctx.globalAlpha = st.veil; ctx.fillStyle = HEX.K; fillRuns(ctx, mask, k);
  ctx.globalAlpha = st.washA * (strong ? 1.25 : 1); ctx.fillStyle = st.wash; fillRuns(ctx, mask, k);
  // 3. texture
  ctx.globalAlpha = strong ? 1 : st.inkA; ctx.fillStyle = st.ink;
  const tex = textured[level];
  eachPixel(mask, k, (x, y) => { if (tex(x, y)) ctx.fillRect(x, y, 1, 1); });
  // rim: the region's edge pixels (and one more ring for tipping)
  const e = mask.edges[id];
  const pulse = level === 'tipping' && !steady && Math.floor(frame / 2) % 2 === 1;
  ctx.globalAlpha = 1;
  ctx.fillStyle = pulse ? HEX.r : st.ink;
  for (const [x, y] of [...e.border, ...e.coast]) ctx.fillRect(x, y, 1, 1);
  if (st.rim > 1) { ctx.fillStyle = pulse ? HEX.R : HEX.r; for (const [x, y] of e.inner) ctx.fillRect(x, y, 1, 1); }
  ctx.globalAlpha = 1;
}

/** All regions: levels = { regionId: 'uneasy' | 'edge' | 'tipping' | null }. */
export function drawHeatLayer(ctx, mask, levels, opts = {}) {
  for (const id of mask.ids) if (levels[id]) drawHeat(ctx, mask, id, levels[id], opts);
}
