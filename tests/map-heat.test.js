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
  // #111: tipping breathes by brightness (the glow), not by flipping colours
  const alphas = (opts) => { const c = { alphas: [], globalAlpha: 1, fillRect() { c.alphas.push(c.globalAlpha); } }; drawHeat(c, mask, 'oce', 'tipping', opts); return c.alphas; };
  assert.notDeepEqual(alphas({ frame: 0 }), alphas({ frame: 4 }), 'it breathes');
  assert.deepEqual(alphas({ frame: 0, steady: true }), alphas({ frame: 4, steady: true }), 'held still under Reduced flashing');
});

test('the default look is clean (#111): no textures unless Crisis patterns is on', () => {
  const n = (strong) => { const c = ctx(); drawHeat(c, mask, 'afr', 'edge', { steady: true, strong }); return c.n; };
  const plain = n(false), patterned = n(true);
  assert.ok(patterned > plain * 1.5, `${plain} vs ${patterned}`);
  // no dark veil: every fill uses the level's own colour
  const c = ctx(); drawHeat(c, mask, 'afr', 'tipping', { steady: true });
  assert.deepEqual([...c.colors], [HEAT_STYLE.tipping.wash]);
});
