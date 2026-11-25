// Placeholder tileset remaster (#116, art note D4: "all assets need to be 64bit now minimum").
//
// The #9 placeholder sprites were authored at 8-24 px. Each is rebuilt here at 64 px or more on its
// shortest side, deterministically and in the palette, from its hand-made master:
//   1. Scale2x (EPX), applied until the sprite reaches the minimum: clean diagonals and curves instead of
//      blocky nearest-neighbour steps.
//   2. Light from the top-left (style guide): the top/left pixel of every colour run takes the next lighter
//      shade of its ramp, the bottom/right pixel the next darker one, so every shape is bevelled.
//   3. Wear: a sparse, position-hashed speckle of the darker shade inside large flat areas, so surfaces
//      read as material rather than flat fill.
// Outline (K) pixels are never changed. The result is still a { w, h, rows } pixel map in palette keys,
// validated like any hand-made sprite. `base` keeps the master's size: renderers draw a remastered sprite
// into that footprint unless asked for native resolution, so every existing slot still lines up.
//
// This is the L0 placeholder answer to the new minimum: real 64 px repaints come with each section's art.

export const MIN_SIZE = 64;

// Ramps, dark -> light, by palette key. A key's lighter/darker neighbour is the next one along its ramp.
const RAMPS = ['eEBb', 'kMmw', 'yYL', 'gG', 'NncC', 'rRO', 'Vv', 'Dd', 'SW', 'afhijl', 'op'];
const LIGHTER = {};
const DARKER = {};
for (const r of RAMPS) for (let i = 0; i < r.length; i++) {
  LIGHTER[r[i]] = r[Math.min(r.length - 1, i + 1)];
  DARKER[r[i]] = r[Math.max(0, i - 1)];
}
const FIXED = new Set(['K', '.', ' ']);

function scale2x(grid) {
  const h = grid.length;
  const w = grid[0].length;
  const at = (x, y) => grid[Math.max(0, Math.min(h - 1, y))][Math.max(0, Math.min(w - 1, x))];
  const out = Array.from({ length: h * 2 }, () => new Array(w * 2));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const E = grid[y][x], B = at(x, y - 1), D = at(x - 1, y), F = at(x + 1, y), H = at(x, y + 1);
    out[2 * y][2 * x] = D === B && B !== F && D !== H ? D : E;
    out[2 * y][2 * x + 1] = B === F && B !== D && F !== H ? F : E;
    out[2 * y + 1][2 * x] = D === H && D !== B && H !== F ? D : E;
    out[2 * y + 1][2 * x + 1] = H === F && D !== H && B !== F ? F : E;
  }
  return out;
}

const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

function detail(grid, scale) {
  const h = grid.length;
  const w = grid[0].length;
  const out = grid.map((r) => [...r]);
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : grid[y][x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = grid[y][x];
    if (FIXED.has(c)) continue;
    const up = at(x, y - 1), left = at(x - 1, y), down = at(x, y + 1), right = at(x + 1, y);
    if ((up !== c || left !== c) && LIGHTER[c]) out[y][x] = LIGHTER[c]; // lit edge
    else if ((down !== c || right !== c) && DARKER[c]) out[y][x] = DARKER[c]; // shaded edge
    else {
      // wear inside flat areas: only where a whole block around is the same colour
      const flat = [-2, 2].every((d) => at(x + d, y) === c && at(x, y + d) === c);
      if (flat && DARKER[c] && hash(x, y) % (scale * 9) === 0) out[y][x] = DARKER[c];
    }
  }
  return out;
}

const toGrid = (rows, w) => rows.map((r) => r.padEnd(w, '.').split(''));

/** Remaster one { w, h, rows | frames } sprite to at least `min` px on its shortest side. */
export function remaster(sprite, min = MIN_SIZE) {
  if (!sprite?.w || Math.min(sprite.w, sprite.h) >= min) return sprite;
  let scale = 1;
  while (Math.min(sprite.w, sprite.h) * scale < min) scale *= 2;
  const frames = (sprite.frames ?? [sprite.rows]).map((rows) => {
    let g = toGrid(rows, sprite.w);
    for (let s = 1; s < scale; s *= 2) g = scale2x(g);
    return detail(g, scale).map((r) => r.join(''));
  });
  const out = { ...sprite, w: sprite.w * scale, h: sprite.h * scale, rows: frames[0], base: { w: sprite.w, h: sprite.h }, scale };
  if (sprite.frames) out.frames = frames;
  return out;
}

/** Remaster a whole set; entries may be sprites or { sprite, border, ... } (nine-slice frames). */
export function remasterSet(set, min = MIN_SIZE) {
  return Object.fromEntries(Object.entries(set).map(([k, v]) => {
    // nine-slice frames: the border stays in master pixels; drawNineSlice scales it
    if (v?.sprite) return [k, { ...v, sprite: remaster(v.sprite, min) }];
    return [k, remaster(v, min)];
  }));
}
