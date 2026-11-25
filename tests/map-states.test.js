// #124: every crisis state of every map region at the 64 px minimum, matching the redone (real Earth) map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapBaseAt } from '../src/art/map-base.js';
import { earthRegionAt } from '../src/art/earth.js';
import { regionArt, renderRegionState, REGION_STATE_IDS } from '../src/art/map-layers-hd.js';

const base = mapBaseAt(3); // a 1440x900 screen's terrain: 960x576
const art = regionArt(base, (fx, fy) => { const id = earthRegionAt(fx, fy); return id === 'ice' ? null : id; });
const REGIONS = ['nam', 'lat', 'eur', 'afr', 'mea', 'sas', 'eas', 'oce'];

test('all eight regions, five states each, every image at least 64 x 64', () => {
  assert.deepEqual([...art.mask.ids].sort(), [...REGIONS].sort());
  assert.deepEqual(REGION_STATE_IDS, ['calm', 'uneasy', 'edge', 'tipping', 'selected']);
  for (const id of REGIONS) for (const st of REGION_STATE_IDS) {
    const r = renderRegionState(art, base, id, st);
    assert.ok(r.w >= 64 && r.h >= 64, `${id}-${st} is ${r.w}x${r.h}`);
  }
});

test('each state changes only its own region (plus the selected outline just outside): it matches the map', () => {
  const { W, t, mask } = art;
  for (const id of REGIONS) {
    const calm = renderRegionState(art, base, id, 'calm'), kk = mask.index.get(id);
    const near = (x, y) => { for (let dy = -t - 1; dy <= t + 1; dy++) for (let dx = -t - 1; dx <= t + 1; dx++) if (mask.data[(y + dy) * W + (x + dx)] === kk) return true; return false; };
    let prev = null;
    for (const st of ['uneasy', 'edge', 'tipping', 'selected']) {
      const r = renderRegionState(art, base, id, st);
      let changed = 0, stray = 0;
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
        const o = (y * r.w + x) * 4;
        if (r.rgba[o] === calm.rgba[o] && r.rgba[o + 1] === calm.rgba[o + 1] && r.rgba[o + 2] === calm.rgba[o + 2]) continue;
        changed++;
        if (!near(r.x0 + x, r.y0 + y)) stray++;
      }
      assert.equal(stray, 0, `${id}-${st}: ${stray} changed pixels away from the region`);
      assert.ok(changed > mask.edges[id].pixels * 0.5, `${id}-${st} changes too little (${changed})`);
      if (prev) { let diff = 0; for (let i = 0; i < r.rgba.length; i += 4) if (r.rgba[i] !== prev.rgba[i] || r.rgba[i + 1] !== prev.rgba[i + 1]) diff++; assert.ok(diff > mask.edges[id].pixels * 0.3, `${id}-${st} too close to the state before`); }
      prev = r;
    }
  }
});

test('the exported state images are the current map, at its size', () => {
  const meta = JSON.parse(readFileSync(new URL('../assets/art/map-states/map-states.json', import.meta.url), 'utf8'));
  assert.deepEqual(meta.map, [base.w, base.h]);
  for (const id of REGIONS) for (const st of REGION_STATE_IDS) {
    const png = readFileSync(new URL(`../assets/art/map-states/${id}-${st}.png`, import.meta.url));
    const r = renderRegionState(art, base, id, st);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [r.w, r.h], `${id}-${st}`);
    assert.deepEqual(meta.states[`${id}-${st}`], { x: r.x0, y: r.y0, w: r.w, h: r.h });
  }
});
