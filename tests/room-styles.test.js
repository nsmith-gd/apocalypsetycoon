// #120: the six design styles (#34) for every room, at the 64 px minimum (art note D4), and visually distinct.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRoomTile, ROOM_TILE_IDS, DESIGN_STYLES, MIN_ART_PX } from '../src/art/hd/room-tiles.js';
import { HD_COLOURS } from '../src/art/hd/raster.js';
import { STYLES } from '../src/shelter/styles.js';

const TRIM_ROWS = 8;
const palette = new Set(HD_COLOURS.filter(Boolean));
const tiles = new Map(ROOM_TILE_IDS.map((id) => [id, { base: renderRoomTile(id), ...Object.fromEntries(DESIGN_STYLES.map((d) => [d, renderRoomTile(id, { design: d })])) }]));

test('the six art styles are exactly the six design styles of the game', () => {
  assert.deepEqual([...DESIGN_STYLES].sort(), Object.keys(STYLES).sort());
});

test('every room in every style: same size as its tile (64 px minimum), palette-only, fully painted', () => {
  for (const [id, t] of tiles) for (const d of DESIGN_STYLES) {
    const r = t[d];
    assert.deepEqual([r.w, r.h], [t.base.w, t.base.h], `${id}/${d}`);
    assert.ok(r.w >= MIN_ART_PX && r.h >= MIN_ART_PX, `${id}/${d} ${r.w}x${r.h}`);
    for (const c of r.colours()) assert.ok(palette.has(c), `${id}/${d}: ${c} off-palette`);
    assert.ok(r.c.every(Boolean), `${id}/${d} has unpainted pixels`);
    if (id !== 'empty') assert.ok(r.colours().size >= 10, `${id}/${d}: only ${r.colours().size} colours`);
  }
});

test('the tier trim never changes with the style', () => {
  for (const [id, t] of tiles) for (const d of DESIGN_STYLES) {
    const a = t.base.c.subarray(0, TRIM_ROWS * t.base.w), b = t[d].c.subarray(0, TRIM_ROWS * t.base.w);
    assert.ok(a.every((v, i) => v === b[i]), `${id}/${d}: trim changed`);
  }
});

test('styles stay visually distinct: every pair differs on at least 5% of the room below the trim', () => {
  let worst = 1, at = '';
  for (const [id, t] of tiles) for (let i = 0; i < DESIGN_STYLES.length; i++) for (let j = i + 1; j < DESIGN_STYLES.length; j++) {
    const A = t[DESIGN_STYLES[i]].c, B = t[DESIGN_STYLES[j]].c, from = TRIM_ROWS * t.base.w;
    let diff = 0;
    for (let k = from; k < A.length; k++) if (A[k] !== B[k]) diff++;
    const f = diff / (A.length - from);
    if (f < worst) { worst = f; at = `${id} ${DESIGN_STYLES[i]}/${DESIGN_STYLES[j]}`; }
  }
  assert.ok(worst >= 0.05, `closest pair ${at}: ${(worst * 100).toFixed(1)}%`);
});

test('indoor rooms: each style has its own walls (pairs differ on 40%+ of the room)', () => {
  for (const id of ['lounge', 'bunk_room', 'master_suite', 'pantry', 'wine_cellar', 'med_bay']) {
    const t = tiles.get(id);
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
      const A = t[DESIGN_STYLES[i]].c, B = t[DESIGN_STYLES[j]].c;
      let diff = 0; for (let k = TRIM_ROWS * t.base.w; k < A.length; k++) if (A[k] !== B[k]) diff++;
      assert.ok(diff / A.length > 0.4, `${id} ${DESIGN_STYLES[i]}/${DESIGN_STYLES[j]}`);
    }
  }
});
