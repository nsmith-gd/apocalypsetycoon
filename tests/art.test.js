import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSprite } from '../src/art/render.js';
import * as shelter from '../src/art/sprites-shelter.js';
import * as map from '../src/art/sprites-map.js';
import * as ui from '../src/art/sprites-ui.js';
import { RESEARCH_NODES } from '../src/research/research.js';
import { WORLD_LAYOUT, MAP_COLS, MAP_ROWS } from '../src/art/worldmap.js';

const all = {
  ...Object.fromEntries(Object.entries(shelter.TILES).map(([k, v]) => [`tile.${k}`, v])),
  ...Object.fromEntries(Object.entries(shelter.AMENITIES).map(([k, v]) => [`amenity.${k}`, v])),
  ...Object.fromEntries(Object.entries(map.MAP_TILES).map(([k, v]) => [`map.${k}`, v])),
  ...Object.fromEntries(Object.entries(map.MAP_MARKERS).map(([k, v]) => [`marker.${k}`, v])),
  ...Object.fromEntries(Object.entries(map.CRISIS_ICONS).map(([k, v]) => [`crisis.${k}`, v])),
  ...Object.fromEntries(Object.entries(map.CRISIS_OVERLAYS).map(([k, v]) => [`overlay.${k}`, v])),
  ...Object.fromEntries(Object.entries(ui.UI_FRAMES).map(([k, v]) => [`frame.${k}`, v.sprite])),
  ...Object.fromEntries(Object.entries(ui.UI_ICONS).map(([k, v]) => [`icon.${k}`, v])),
  ...Object.fromEntries(Object.entries(ui.UI_CURSOR).map(([k, v]) => [`cursor.${k}`, v])),
  logo: ui.LOGO,
};

test('every sprite has the declared size and only palette colours', () => {
  const problems = Object.entries(all).flatMap(([n, s]) => validateSprite(n, s));
  assert.deepEqual(problems, []);
});

test('grid tiles fill a 16px slot and map tiles an 8px cell, drawn from 64px+ art (#116)', () => {
  for (const s of [...Object.values(shelter.TILES), ...Object.values(shelter.AMENITIES)]) { assert.deepEqual([s.base.w, s.base.h], [16, 16]); assert.ok(Math.min(s.w, s.h) >= 64); }
  for (const s of Object.values(map.MAP_TILES)) { assert.deepEqual([s.base.w, s.base.h], [8, 8]); assert.ok(Math.min(s.w, s.h) >= 64); }
});

test('every researchable amenity has a sprite', () => {
  for (const n of RESEARCH_NODES.filter((n) => n.unlocks.type === 'amenity')) assert.ok(shelter.AMENITIES[n.unlocks.id], n.unlocks.id);
});

test('world layout is 40x24', () => {
  assert.equal(WORLD_LAYOUT.length, MAP_ROWS);
  for (const row of WORLD_LAYOUT) assert.equal(row.length, MAP_COLS);
});
