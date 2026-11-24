// Pixel tiles for the tile bunker (R32, L0 art): the five strata and the three construction stages.
// 16 px tiles, drawn procedurally and deterministically from the tile's grid position, so a strata wall
// reads as one continuous rock face rather than a repeated stamp.
//
//   drawStratumTile(ctx, 'clay', px, py, x, y)
//   drawDigStage(ctx, px, py, t, stratumId, x, y)       t = 0..1 progress: the hole opens, rubble piles up
//   drawShellStage(ctx, px, py, t, kind)                rebar cage, then concrete poured bottom-up
//   drawFitoutStage(ctx, px, py, w, h, t, frame)        scaffold and dust sheets around a piece being fitted

const T = 16;
const hash = (x, y, k = 0) => {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

export const STRATUM_ART = Object.freeze({
  topsoil: { base: '#6b4a32', dark: '#523624', light: '#86603f', accent: '#3e6b24' }, // crumbs and roots
  clay: { base: '#8a5a36', dark: '#6e4628', light: '#a6714a', accent: '#b88a5e' }, // smooth bands, pebbles
  bedrock: { base: '#5e5a60', dark: '#45424a', light: '#7a767c', accent: '#2e2c32' }, // cracked blocks
  deep: { base: '#3e3a44', dark: '#2c2932', light: '#55505c', accent: '#7ac8d8' }, // dark, mineral glints
  abyss: { base: '#24202a', dark: '#18151c', light: '#332d3a', accent: '#8a3ac0' }, // near-black, violet veins
});

/** One undug tile of rock. (x, y) are grid coordinates, for variety. */
export function drawStratumTile(ctx, id, px, py, x, y) {
  const a = STRATUM_ART[id] ?? STRATUM_ART.topsoil;
  const R = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(px + dx, py + dy, w, h); };
  R(0, 0, T, T, a.base);
  const h = hash(x, y);
  switch (id) {
    case 'topsoil':
      for (let i = 0; i < 6; i++) { const q = hash(x, y, i); R(q % 15, (q >> 4) % 15, 1 + (q >> 9) % 2, 1, (q >> 12) % 3 ? a.dark : a.light); }
      if (h % 5 === 0) { R(3 + (h % 8), 2, 1, 5, '#8a6a4a'); R(4 + (h % 8), 6, 1, 3, '#8a6a4a'); } // a root
      break;
    case 'clay':
      R(0, 3 + (y % 2), T, 1, a.dark); R(0, 9 + (y % 3), T, 1, a.light); R(0, 13, T, 1, a.dark);
      if (h % 3 === 0) { R(2 + (h % 10), 5 + ((h >> 4) % 6), 3, 2, a.accent); R(3 + (h % 10), 5 + ((h >> 4) % 6), 1, 1, a.light); } // pebble
      break;
    case 'bedrock': {
      // blocky strata with offset joints and a crack
      R(0, 7, T, 1, a.dark); R(0, 15, T, 1, a.dark);
      R((y % 2 ? 4 : 11), 0, 1, 7, a.dark); R((y % 2 ? 12 : 5), 8, 1, 7, a.dark);
      R(1, 1, 3, 1, a.light); R(9, 9, 3, 1, a.light);
      if (h % 4 === 0) { const c = 2 + (h % 10); R(c, 2, 1, 2, a.accent); R(c + 1, 4, 1, 2, a.accent); R(c + 2, 6, 1, 1, a.accent); }
      break;
    }
    case 'deep':
      for (let i = 0; i < 4; i++) { const q = hash(x, y, i + 7); R(q % 14, (q >> 5) % 14, 2, 2, (q >> 10) % 2 ? a.dark : a.light); }
      if (h % 6 === 0) { const gx = 3 + (h % 9), gy = 3 + ((h >> 4) % 9); R(gx, gy, 2, 1, a.accent); R(gx, gy + 1, 1, 1, '#d8f4ff'); } // crystal glint
      break;
    case 'abyss':
      for (let i = 0; i < 3; i++) { const q = hash(x, y, i + 3); R(q % 15, (q >> 5) % 15, 1, 1, a.light); }
      { const v = h % 16; R(v, 0, 1, 5, a.accent); R(Math.min(15, v + 1), 5, 1, 4, a.accent); R(Math.max(0, v - 1), 9, 1, 7, a.dark); } // vein
      break;
    default: break;
  }
}

/** A tile being dug: a hollow opens from the top as t goes 0 -> 1, rubble gathers at the bottom. */
export function drawDigStage(ctx, px, py, t, id, x, y) {
  const a = STRATUM_ART[id] ?? STRATUM_ART.topsoil;
  const R = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(px + dx, py + dy, w, h); };
  const open = Math.round(t * 12);
  if (open > 0) {
    R(2, 1, 12, open, '#16120f'); // the hole
    R(2, 1, 1, open, a.dark); R(13, 1, 1, open, a.dark);
  }
  // pick marks on the face that is left
  for (let i = 0; i < 3; i++) { const q = hash(x, y, 20 + i); const yy = 1 + open + (q % Math.max(1, 13 - open)); if (yy < 14) R(3 + (q >> 4) % 10, yy, 2, 1, '#f5c542'); }
  // rubble pile and a bucket
  const pile = 1 + Math.round(t * 3);
  for (let i = 0; i < 5; i++) R(2 + i * 2 + (hash(x, y, i) % 2), 15 - pile + (i % 2), 2, pile, i % 2 ? a.light : a.dark);
  R(12, 11, 3, 3, '#7a7a82'); R(12, 11, 3, 1, '#a8acb0');
  // hazard frame: this tile is a work order
  ctx.strokeStyle = 'rgba(245,197,66,.9)'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
}

/** A wall or spine tile being built: rebar cage first, then concrete rising from the bottom. */
export function drawShellStage(ctx, px, py, t, kind = 'wall') {
  const R = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(px + dx, py + dy, w, h); };
  R(0, 0, T, T, 'rgba(22,18,15,.85)');
  // formwork boards on the sides
  R(0, 0, 2, T, '#8a6a3a'); R(14, 0, 2, T, '#8a6a3a'); R(0, 4, 2, 1, '#5a4024'); R(14, 10, 2, 1, '#5a4024');
  // rebar grid
  const rebar = kind === 'spine' ? '#f5c542' : '#c8743a';
  for (const xx of [4, 8, 12]) R(xx, 1, 1, 14, rebar);
  for (const yy of [3, 8, 13]) R(2, yy, 12, 1, rebar);
  // concrete pour
  const fill = Math.round(t * 14);
  if (fill > 0) { R(2, 15 - fill, 12, fill, '#8a8680'); R(2, 15 - fill, 12, 1, '#b8b4ac'); }
}

/** A piece of furniture or machinery being fitted: scaffold poles, a dust sheet, sparks while the crew works. */
export function drawFitoutStage(ctx, px, py, w, h, t, frame = 0) {
  const R = (dx, dy, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(px + dx, py + dy, ww, hh); };
  // dust sheet hangs over the unfinished part
  const covered = Math.round((1 - t) * (h - 2));
  if (covered > 0) { R(1, 1, w - 2, covered, 'rgba(216,208,192,.55)'); for (let x = 3; x < w - 2; x += 5) R(x, 1, 1, covered, 'rgba(160,150,135,.6)'); }
  // scaffold poles and a plank
  R(0, 0, 1, h, '#a8acb0'); R(w - 1, 0, 1, h, '#a8acb0'); R(0, 0, w, 1, '#a8acb0');
  R(0, Math.floor(h / 2), w, 2, '#8a6a3a');
  if (t > 0 && Math.floor(frame / 4) % 2) { R(Math.floor(w / 2), Math.floor(h / 2) - 2, 1, 1, '#fff6d0'); R(Math.floor(w / 2) + 2, Math.floor(h / 2) - 3, 1, 1, '#f5c542'); }
}
