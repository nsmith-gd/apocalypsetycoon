// Exports the world map base layer (#100) to assets/art/map-base.png (320x192, 1x) plus a x3 preview.
//   node tools/export-map-base.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { paintMapBase } from '../src/art/map-base.js';

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
export function png(w, h, rgba, scale = 1) {
  const W = w * scale, H = h * scale;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const s = (Math.floor(y / scale) * w + Math.floor(x / scale)) * 4;
      rgba.slice(s, s + 4).forEach((v, k) => { raw[y * (W * 4 + 1) + 1 + x * 4 + k] = v; });
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const b = paintMapBase();
mkdirSync('assets/art', { recursive: true });
writeFileSync('assets/art/map-base.png', png(b.w, b.h, b.rgba));
if (process.argv[2]) writeFileSync(process.argv[2], png(b.w, b.h, b.rgba, 3));
console.log(`assets/art/map-base.png ${b.w}x${b.h}, ${new Set(b.colours).size} colours`);
