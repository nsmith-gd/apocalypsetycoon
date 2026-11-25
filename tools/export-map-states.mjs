#!/usr/bin/env node
// Exports every region in every crisis state (#124) at the terrain size of a 1440x900 screen (960x576), headless:
//   node tools/export-map-states.mjs [scale=3]   # assets/art/map-states/<region>-<state>.png + map-states.json
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { mapBaseAt } from '../src/art/map-base.js';
import { earthRegionAt } from '../src/art/earth.js';
import { regionArt, renderRegionState, REGION_STATE_IDS } from '../src/art/map-layers-hd.js';
import { encodePng } from './export-room-tiles.mjs';

const scale = Number(process.argv[2] ?? 3);
const base = mapBaseAt(scale);
const art = regionArt(base, (fx, fy) => { const id = earthRegionAt(fx, fy); return id === 'ice' ? null : id; });
const dir = new URL('../assets/art/map-states/', import.meta.url);
rmSync(new URL('../assets/art/map-heat/', import.meta.url), { recursive: true, force: true }); // the 320x192 #103 exports of the old map
mkdirSync(dir, { recursive: true });
const index = {};
for (const id of art.mask.ids) for (const st of REGION_STATE_IDS) {
  const r = renderRegionState(art, base, id, st);
  writeFileSync(new URL(`${id}-${st}.png`, dir), encodePng(r.w, r.h, r.rgba));
  index[`${id}-${st}`] = { x: r.x0, y: r.y0, w: r.w, h: r.h };
}
writeFileSync(new URL('map-states.json', dir), JSON.stringify({ map: [base.w, base.h], states: index }, null, 1));
console.log(`map-states: ${Object.keys(index).length} images at ${base.w}x${base.h}`);
