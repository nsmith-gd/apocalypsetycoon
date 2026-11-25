import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRegionMask, drawRegionLayer, REGION_STATES } from '../src/art/map-regions.js';
import { regionAtCell } from '../src/worldmap/worldmap-ui.js';
import { MAP_W, MAP_H, CELL } from '../src/art/worldmap.js';

const fakeCtx = () => { const hits = []; return { hits, globalAlpha: 1, fillStyle: '', fillRect: (x, y, w, h) => hits.push([x, y, w, h]) }; };

test('region borders line up exactly with the clickable hit areas, for all eight regions', () => {
  const mask = buildRegionMask({ w: MAP_W, h: MAP_H, cell: CELL, regionAtCell });
  assert.equal(mask.ids.length, 8);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const k = mask.data[y * MAP_W + x];
    assert.equal(k ? mask.ids[k - 1] : null, regionAtCell(Math.floor(x / CELL), Math.floor(y / CELL)) ?? null);
  }
  for (const id of mask.ids) assert.ok(mask.edges[id].border.length + mask.edges[id].coast.length > 0, id);
});

test('idle, hover and selected each draw, and only inside the map', () => {
  const mask = buildRegionMask({ w: MAP_W, h: MAP_H, cell: CELL, regionAtCell });
  assert.deepEqual(REGION_STATES, ['idle', 'hover', 'selected']);
  const idle = fakeCtx(); drawRegionLayer(idle, mask);
  const both = fakeCtx(); drawRegionLayer(both, mask, { hover: 'eur', selected: 'afr', frame: 3 });
  assert.ok(idle.hits.length > 0 && both.hits.length > idle.hits.length);
  for (const [x, y] of both.hits) assert.ok(x >= 0 && y >= 0 && x < MAP_W && y < MAP_H);
});

test('a finer land mask (the redone base layer) narrows the regions to its coast', () => {
  const coarse = buildRegionMask({ w: MAP_W, h: MAP_H, cell: CELL, regionAtCell });
  const fine = buildRegionMask({ w: MAP_W, h: MAP_H, cell: CELL, regionAtCell, isLandPx: (x, y) => (x + y) % 3 !== 0 });
  assert.ok(fine.data.filter(Boolean).length < coarse.data.filter(Boolean).length);
});

test('regions follow the real countries (#138): the click map, no sea or ice, every region where it is on Earth', async () => {
  const { regionAtPx, regionMask } = await import('../src/worldmap/worldmap-ui.js');
  const { mapBase } = await import('../src/art/map-base.js');
  const { mapXY } = await import('../src/art/earth.js');
  const base = mapBase();
  const mask = regionMask();
  assert.equal(mask.ids.length, 8);
  let wet = 0;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const id = regionAtPx(x, y);
    const k = mask.data[y * MAP_W + x];
    assert.equal(k ? mask.ids[k - 1] : null, id); // the mask IS the click map
    if (id && !base.isLandPx(x, y)) wet++;
  }
  assert.equal(wet, 0, 'no sea or ice belongs to a region');
  const places = [[-98, 39, 'nam', 'Kansas'], [-102, 24, 'lat', 'Mexico'], [-48, -15.8, 'lat', 'Brasilia'], [10, 51, 'eur', 'Germany'], [40, 57, 'eur', 'western Russia'],
    [19, 15, 'afr', 'Chad'], [30, 26, 'mea', 'Egypt'], [45, 24, 'mea', 'Saudi Arabia'], [78, 22, 'sas', 'India'], [114, 0, 'sas', 'Borneo'],
    [105, 35, 'eas', 'China'], [100, 62, 'eas', 'Siberia'], [68, 48, 'eas', 'Kazakhstan'], [134, -25, 'oce', 'Australia']];
  for (const [lon, lat, want, name] of places) { const [fx, fy] = mapXY(lon, lat); assert.equal(regionAtPx(fx * MAP_W, fy * MAP_H), want, name); }
});
