#!/usr/bin/env node
// Exports the 64 px room tiles (#117) as PNGs, headless (no browser, no canvas package).
//
//   node tools/export-room-tiles.mjs                 # assets/art/room-tiles.png + room-tiles.json (contact sheet, frame 0)
//   node tools/export-room-tiles.mjs --each <dir>    # also one PNG per room (and per frame) into <dir>
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { renderRoomTile, ROOM_TILE_IDS } from '../src/art/hd/room-tiles.js';

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const x of buf) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
/** RGBA bytes -> PNG file bytes. */
export function encodePng(w, h, rgba, scale = 1) {
  const W = w * scale, H = h * scale;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = ((Math.floor(y / scale) * w) + Math.floor(x / scale)) * 4; rgba.copy ? 0 : 0; const d = y * (W * 4 + 1) + 1 + x * 4; raw[d] = rgba[s]; raw[d + 1] = rgba[s + 1]; raw[d + 2] = rgba[s + 2]; raw[d + 3] = rgba[s + 3]; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Pack rasters into one sheet: rows of tiles up to `maxW` wide, 4 px gaps. */
export function sheet(items, maxW = 1600, gap = 4) {
  let x = 0, y = 0, rowH = 0, W = 0;
  const atlas = {};
  for (const it of items) {
    if (x && x + it.r.w > maxW) { x = 0; y += rowH + gap; rowH = 0; }
    atlas[it.id] = { x, y, w: it.r.w, h: it.r.h };
    x += it.r.w + gap; rowH = Math.max(rowH, it.r.h); W = Math.max(W, x);
  }
  const H = y + rowH;
  const out = new Uint8ClampedArray(W * H * 4);
  for (const it of items) { const a = atlas[it.id]; const px = it.r.rgba(); for (let j = 0; j < a.h; j++) out.set(px.subarray(j * a.w * 4, (j + 1) * a.w * 4), ((a.y + j) * W + a.x) * 4); }
  return { w: W, h: H, rgba: out, atlas };
}

if (import.meta.url === `file://${process.argv[1]}`) { // run as a script
  const args = process.argv.slice(2);
  const items = ROOM_TILE_IDS.map((id) => ({ id, r: renderRoomTile(id, { frame: 0 }) }));
  const s = sheet(items);
  mkdirSync(new URL('../assets/art/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../assets/art/room-tiles.png', import.meta.url), encodePng(s.w, s.h, s.rgba));
  writeFileSync(new URL('../assets/art/room-tiles.json', import.meta.url), JSON.stringify(s.atlas, null, 1));
  console.log(`room-tiles.png ${s.w}x${s.h}, ${items.length} tiles`);
  const each = args.includes('--each') ? args[args.indexOf('--each') + 1] : null;
  if (each) {
    mkdirSync(each, { recursive: true });
    for (const { id, r } of items) {
      writeFileSync(`${each}/${id}.png`, encodePng(r.w, r.h, r.rgba(), 2));
      const r1 = renderRoomTile(id, { frame: 1 });
      writeFileSync(`${each}/${id}-f1.png`, encodePng(r1.w, r1.h, r1.rgba(), 2));
    }
  }
}
