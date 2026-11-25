// Demand heat overlay for the world map (#103, restyled in #111; art note D3): how hot a region's crisis
// (and so its demand and prices) runs.
//
// Director on #104/#103: "too busy, too old looking". The dot lattices, stripes, crosshatch and the dark veil
// read as an 8-bit board game and fought the painted terrain. The default look is now clean and modern:
//   1. a hue tint in the level's colour that keeps the terrain's light and shade, plus a light wash
//      (no dark veil: the terrain stays bright underneath)
//   2. a soft inner glow: rings just inside the region's edge, fading inward, deeper at higher heat
//   3. a crisp rim on the region's edge (1px; 2px at tipping)
// Tipping breathes: its glow brightens and fades (no colour flicker), and holds still under Reduced flashing.
// The old textures stay available as an accessibility option: Crisis patterns (`strong`) adds them back,
// so heat never depends on colour alone for players who need that.
//
//   drawHeatLayer(ctx, mask, { nam: 'edge', afr: 'tipping' }, { frame, strong, steady })

import { HEX } from './palette.js';

export const HEAT_LEVELS = Object.freeze(['uneasy', 'edge', 'tipping']);

// wash = region fill; glow = alpha of each ring inward from the edge (ring 0 is the rim itself)
export const HEAT_STYLE = Object.freeze({
  // #129 (director on #124: "make them more distinct"): uneasy is light, with a thin DASHED rim; edge is a strong
  // amber with a solid DOUBLE rim and a wider glow; tipping keeps the red, the double rim, the fast pulse and embers.
  uneasy: { wash: HEX.Y, tintA: 0.25, washA: 0.06, rimA: 0.75, rim: 1, dash: true, glow: [0.18, 0.08] },
  edge: { wash: HEX.O, tintA: 0.55, washA: 0.14, rimA: 1, rim: 2, glow: [0.4, 0.26, 0.12] },
  tipping: { wash: HEX.R, tintA: 0.6, washA: 0.12, rimA: 1, rim: 2, glow: [0.42, 0.26, 0.14, 0.06] },
});

// Accessibility only (Crisis patterns): a pattern per level, so heat reads without colour.
const PATTERN = {
  uneasy: (x, y) => x % 4 === 1 && y % 4 === ((x >> 2) % 2 ? 3 : 1),
  edge: (x, y) => (x + y) % 4 === 0,
  tipping: (x, y) => (x + y) % 4 === 0 || (x - y + 1024) % 4 === 0,
};

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

/**
 * Distance (in pixels, 0 = on the edge) from each region pixel to the region's edge, up to `max`.
 * Computed once per mask and region: a breadth-first walk inward from the edge pixels.
 */
function rings(mask, id, max = 4) {
  mask._rings ??= {};
  const key = `${id}:${max}`;
  if (mask._rings[key]) return mask._rings[key];
  const { w, h, data } = mask;
  const k = mask.index.get(id);
  const dist = new Map();
  let frontier = [];
  const e = mask.edges[id];
  for (const [x, y] of [...e.border, ...e.coast]) { const i = y * w + x; if (!dist.has(i)) { dist.set(i, 0); frontier.push(i); } }
  for (let d = 1; d <= max; d++) {
    const next = [];
    for (const i of frontier) {
      const x = i % w, y = (i - x) / w;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (data[j] !== k || dist.has(j)) continue;
        dist.set(j, d);
        next.push(j);
      }
    }
    frontier = next;
  }
  const byRing = Array.from({ length: max + 1 }, () => []);
  for (const [i, d] of dist) byRing[d].push([i % w, Math.floor(i / w)]);
  return (mask._rings[key] = byRing);
}

/** One region at one heat level. */
export function drawHeat(ctx, mask, id, level, { frame = 0, strong = false, steady = false } = {}) {
  const st = HEAT_STYLE[level];
  const k = mask.index.get(id);
  if (!st || !k) return;
  const alpha0 = ctx.globalAlpha ?? 1;
  // tipping breathes: the glow swells and settles over an 8-frame cycle (held at its middle under Reduced flashing)
  const breath = level === 'tipping' && !steady ? 0.75 + 0.5 * Math.abs(((frame % 8) / 4) - 1) : 1;
  // 1. wash: a hue tint that keeps the terrain's light and shade (a plain red fill over green land mixes to mud),
  // then a light plain wash so the level's colour is unmistakable
  const op0 = ctx.globalCompositeOperation;
  ctx.fillStyle = st.wash;
  ctx.globalAlpha = st.tintA;
  ctx.globalCompositeOperation = 'color';
  fillRuns(ctx, mask, k);
  ctx.globalCompositeOperation = op0 ?? 'source-over';
  ctx.globalAlpha = st.washA * (strong ? 1.3 : 1);
  fillRuns(ctx, mask, k);
  // 2. inner glow, fading inward (ring 1 onward; ring 0 is the rim)
  const r = rings(mask, id, st.glow.length);
  for (let d = 1; d <= st.glow.length; d++) {
    ctx.globalAlpha = Math.min(1, st.glow[d - 1] * breath);
    for (const [x, y] of r[d]) ctx.fillRect(x, y, 1, 1);
  }
  // 3. rim (2px at tipping: the edge and the first ring at full strength)
  ctx.globalAlpha = st.rimA;
  for (const [x, y] of r[0]) if (!st.dash || ((x + y) >> 1) % 2 === 0) ctx.fillRect(x, y, 1, 1);
  if (st.rim > 1) { ctx.globalAlpha = st.rimA * 0.7 * breath; for (const [x, y] of r[1]) ctx.fillRect(x, y, 1, 1); }
  // accessibility: Crisis patterns adds a texture per level
  if (strong) {
    ctx.globalAlpha = 0.6;
    const pat = PATTERN[level];
    const { w, h, data } = mask;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[y * w + x] === k && pat(x, y)) ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = alpha0;
}

/** All regions: levels = { regionId: 'uneasy' | 'edge' | 'tipping' | null }. */
export function drawHeatLayer(ctx, mask, levels, opts = {}) {
  for (const id of mask.ids) if (levels[id]) drawHeat(ctx, mask, id, levels[id], opts);
}
