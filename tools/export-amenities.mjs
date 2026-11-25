#!/usr/bin/env node
// Exports the 64 px luxury amenities (#118) as PNG sheets, headless.
//
//   node tools/export-amenities.mjs              # assets/art/amenities-64.png + .json (default colours, frame 0)
//   node tools/export-amenities.mjs --each <dir> # also every piece in every colour variant, 2x, into <dir>
import { writeFileSync, mkdirSync } from 'node:fs';
import { encodePng, sheet } from './export-room-tiles.mjs';
import { AMENITY_KINDS, amenityRaster } from '../src/art/hd/amenities64.js';
import { variantsFor } from '../src/shelter/bunker-catalog.js';

const items = AMENITY_KINDS.map((id) => ({ id, r: amenityRaster(id, variantsFor(id)[0], { frame: 0 }) }));
const s = sheet(items, 1100, 6);
writeFileSync(new URL('../assets/art/amenities-64.png', import.meta.url), encodePng(s.w, s.h, s.rgba));
writeFileSync(new URL('../assets/art/amenities-64.json', import.meta.url), JSON.stringify(s.atlas, null, 1));
console.log(`amenities-64.png ${s.w}x${s.h}, ${items.length} pieces`);
const args = process.argv.slice(2);
const each = args.includes('--each') ? args[args.indexOf('--each') + 1] : null;
if (each) {
  mkdirSync(each, { recursive: true });
  for (const id of AMENITY_KINDS) {
    const vs = variantsFor(id).map((v) => ({ id: `${id}-${v.id}`, r: amenityRaster(id, v, { frame: 0 }) }));
    vs.push({ id: `${id}-f1`, r: amenityRaster(id, variantsFor(id)[0], { frame: 1 }) });
    vs.push({ id: `${id}-off`, r: amenityRaster(id, variantsFor(id)[0], { on: false }) });
    const v = sheet(vs, 2000, 6);
    writeFileSync(`${each}/${id}.png`, encodePng(v.w, v.h, v.rgba, 2));
  }
}
