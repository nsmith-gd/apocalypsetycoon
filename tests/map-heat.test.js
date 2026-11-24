import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRegionMask } from '../src/art/map-regions.js';
import { drawHeatLayer, drawHeat, HEAT_LEVELS, HEAT_STYLE } from '../src/art/map-heat.js';
import { regionAtCell } from '../src/worldmap/worldmap-ui.js';
import { MAP_W, MAP_H, CELL } from '../src/art/worldmap.js';

const ctx = () => { const c = { colors: new Set(), seq: [], n: 0, globalAlpha: 1, fillRect() { c.n++; c.colors.add(c.fillStyle); if (c.seq.at(-1) !== c.fillStyle) c.seq.push(c.fillStyle); } }; return c; };
const mask = buildRegionMask({ w: MAP_W, h: MAP_H, cell: CELL, regionAtCell });

test('each heat level has its own colour and draws more than the one below it', () => {
  assert.deepEqual(HEAT_LEVELS, ['uneasy', 'edge', 'tipping']);
  assert.equal(new Set(HEAT_LEVELS.map((l) => HEAT_STYLE[l].wash)).size, 3);
  const counts = HEAT_LEVELS.map((lv) => { const c = ctx(); drawHeat(c, mask, 'afr', lv, { steady: true }); return c.n; });
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2], counts.join(' < '));
});

test('calm regions draw nothing; the tipping pulse stops under reduced flashing', () => {
  const c = ctx(); drawHeatLayer(c, mask, { nam: null, eur: null });
  assert.equal(c.n, 0);
  const a = ctx(); drawHeat(a, mask, 'oce', 'tipping', { frame: 2 });
  const b = ctx(); drawHeat(b, mask, 'oce', 'tipping', { frame: 2, steady: true });
  assert.notDeepEqual(a.seq, b.seq);
});
