#!/usr/bin/env node
// Exports the 64 px map markers (#24) to assets/art/map-markers/<id>.png (frame 0), headless.
import { writeFileSync, mkdirSync } from 'node:fs';
import { encodePng } from './export-room-tiles.mjs';
import { markerRaster, MARKER64_KINDS } from '../src/art/hd/markers64.js';
mkdirSync(new URL('../assets/art/map-markers/', import.meta.url), { recursive: true });
for (const id of MARKER64_KINDS) { const r = markerRaster(id); writeFileSync(new URL(`../assets/art/map-markers/${id}.png`, import.meta.url), encodePng(r.w, r.h, r.rgba())); }
console.log(`${MARKER64_KINDS.length} markers at 64 px`);
