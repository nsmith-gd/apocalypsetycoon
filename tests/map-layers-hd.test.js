// #123: region borders, states and demand heat drawn at the terrain's resolution, aligned region for region.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { artRegionMask } from '../src/art/map-layers-hd.js';
import { mapBaseAt } from '../src/art/map-base.js';
import { earthRegionAt } from '../src/art/earth.js';
import { regionAtPx } from '../src/worldmap/worldmap-ui.js';
import { MAP_W, MAP_H } from '../src/art/worldmap.js';

const regionAt = (fx, fy) => { const id = earthRegionAt(fx, fy); return id === 'ice' ? null : id; };

for (const scale of [2, 3, 4]) {
  test(`at ${320 * scale}x${192 * scale}: the layer mask is the painted land, and agrees with the click map region for region`, () => {
    const base = mapBaseAt(scale);
    const mask = artRegionMask(base, regionAt);
    assert.deepEqual([mask.w, mask.h], [base.w, base.h]);
    assert.equal(mask.ids.length, 8);
    let land = 0, agree = 0, compared = 0;
    for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) {
      const k = mask.data[y * mask.w + x];
      if (base.isLandPx(x, y)) land++; else assert.equal(k, 0, 'no tint on sea or ice');
      const click = regionAtPx(((x + 0.5) / mask.w) * MAP_W, ((y + 0.5) / mask.h) * MAP_H);
      if (k && click) { compared++; if (mask.ids[k - 1] === click) agree++; }
    }
    assert.ok(mask.data.filter(Boolean).length / land > 0.97, 'nearly every land pixel belongs to a region');
    assert.ok(agree / compared > 0.99, `${((100 * agree) / compared).toFixed(2)}% agree with the click map`);
    for (const id of mask.ids) assert.ok(mask.edges[id].coast.length > 0, `${id} has a coast`);
  });
}
