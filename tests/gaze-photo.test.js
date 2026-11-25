// #121: Client Gaze overlay and photo mode art at the 64 px minimum (art note D4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gazeRaster, photoRaster, GAZE_ASSETS, PHOTO_ASSETS, PHOTO_CARD_WINDOW, gazeLevel } from '../src/art/hd/gaze-photo.js';
import { HD_COLOURS } from '../src/art/hd/raster.js';
import { inventory } from '../tools/asset-inventory.mjs';

const palette = new Set(HD_COLOURS.filter(Boolean));
const all = [
  ...Object.entries(GAZE_ASSETS).map(([id, a]) => ['gaze', id, a, (f) => gazeRaster(id, { frame: f })]),
  ...Object.entries(PHOTO_ASSETS).map(([id, a]) => ['photo', id, a, (f) => photoRaster(id, { frame: f })]),
];

test('every gaze and photo-mode frame is at least 64 x 64, palette-only and actually drawn', () => {
  for (const [kind, id, a, r] of all) for (let f = 0; f < a.frames; f++) {
    const b = r(f);
    assert.deepEqual([b.w, b.h], [a.w, a.h], `${kind}/${id}`);
    assert.ok(b.w >= 64 && b.h >= 64, `${kind}/${id} is ${b.w}x${b.h}`);
    for (const c of b.colours()) assert.ok(palette.has(c), `${kind}/${id}: ${c} off-palette`);
    const painted = b.c.reduce((n, v) => n + (v ? 1 : 0), 0);
    assert.ok(painted > 300, `${kind}/${id} frame ${f}: only ${painted} px`);
  }
});

test('animated assets really move: frame 1 differs from frame 0', () => {
  for (const [kind, id, a, r] of all) if (a.frames > 1) assert.ok(!r(0).c.every((v, i) => v === r(1).c[i]), `${kind}/${id}`);
});

test('the gaze eyes are four different reads', () => {
  const eyes = ['look', 'maybe', 'skip', 'inspect'].map((id) => gazeRaster(id).c);
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    let d = 0; for (let k = 0; k < eyes[i].length; k++) if (eyes[i][k] !== eyes[j][k]) d++;
    assert.ok(d > 400, `eyes ${i}/${j} differ on only ${d} px`);
  }
});

test('walkthrough rules (GDD): Status and Delusion always, Comfort half the time, Survive only with an Inspector', () => {
  assert.equal(gazeLevel('status'), 'look');
  assert.equal(gazeLevel('delusion'), 'look');
  assert.equal(gazeLevel('comfort'), 'maybe');
  assert.equal(gazeLevel('survive'), 'skip');
  assert.equal(gazeLevel('survive', { inspector: true }), 'inspect');
});

test('the share card leaves its photo window clear and fits inside the card', () => {
  const card = photoRaster('card'), w = PHOTO_CARD_WINDOW;
  assert.ok(w.x + w.w <= card.w && w.y + w.h <= card.h);
  for (let y = w.y; y < w.y + w.h; y++) for (let x = w.x; x < w.x + w.w; x++) assert.equal(card.get(x, y), 0, `${x},${y}`);
});

test('the asset inventory lists every gaze and photo-mode asset, none under 64 px', async () => {
  const rows = (await inventory()).filter((r) => r.asset.startsWith('client-gaze/') || r.asset.startsWith('photo-mode/'));
  assert.equal(rows.length, Object.keys(GAZE_ASSETS).length + Object.keys(PHOTO_ASSETS).length);
  for (const r of rows) assert.ok(r.w >= 64 && r.h >= 64, r.asset);
});
