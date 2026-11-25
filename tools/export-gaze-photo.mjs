#!/usr/bin/env node
// Exports the Client Gaze and photo mode art (#121) as one sheet, headless.
//   node tools/export-gaze-photo.mjs     # assets/art/gaze-photo.png + gaze-photo.json (every frame, 1x)
import { writeFileSync, mkdirSync } from 'node:fs';
import { gazeRaster, photoRaster, GAZE_ASSETS, PHOTO_ASSETS } from '../src/art/hd/gaze-photo.js';
import { encodePng, sheet } from './export-room-tiles.mjs';

const items = [];
for (const [id, a] of Object.entries(GAZE_ASSETS)) for (let f = 0; f < a.frames; f++) items.push({ id: `gaze/${id}/${f}`, r: gazeRaster(id, { frame: f }) });
for (const [id, a] of Object.entries(PHOTO_ASSETS)) for (let f = 0; f < a.frames; f++) items.push({ id: `photo/${id}/${f}`, r: photoRaster(id, { frame: f }) });
const s = sheet(items, 768, 4);
mkdirSync(new URL('../assets/art/', import.meta.url), { recursive: true });
writeFileSync(new URL('../assets/art/gaze-photo.png', import.meta.url), encodePng(s.w, s.h, s.rgba));
writeFileSync(new URL('../assets/art/gaze-photo.json', import.meta.url), JSON.stringify(s.atlas, null, 1));
console.log(`gaze-photo.png ${s.w}x${s.h}, ${items.length} frames`);
