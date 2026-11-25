// Pixel font for the UI theme (#126): turns the game's own 3x5 glyphs (src/art/font.js) into a TrueType font
// at runtime, so DOM text (HUD, buttons, panel titles) uses the same letters as the map labels. No font file is
// shipped: the bytes are built here and loaded with FontFace.
//
// Metrics are whole pixels: 1 em = 6 font pixels (5 for the cap, 1 for the gap under it), each glyph 3 pixels wide
// (5 for the WIDE_GLYPHS) plus 1 pixel of spacing. So font-size 12px draws every font pixel as 2x2 screen pixels, 18px as 3x3, 24px as 4x4:
// use multiples of 6 (PIXEL_FONT_STEP) and the text stays on the pixel grid. Lowercase maps to the capitals.

import { GLYPH_TABLE } from '../art/font.js';

export const PIXEL_FONT_FAMILY = 'AT Pixel';
export const PIXEL_FONT_STEP = 6; // CSS px per 1x; font-size must be a multiple of this
const PX = 128; // font units per font pixel
const EM = PX * PIXEL_FONT_STEP;
const ASC = PX * 6;
const DESC = PX * 1;

// The DOM font may use wider cells where 3 px can't tell letters apart (the canvas font keeps its 3 px grid):
// '$' read as S or 5 in the HUD, M and W as N and H.
export const WIDE_GLYPHS = {
  $: ['.####', '#.#..', '.###.', '..#.#', '####.'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
};

/** Code point -> glyph rows, lowercase folded onto the capitals. */
export function pixelFontCharset() {
  const map = new Map();
  for (const [ch, rows] of Object.entries({ ...GLYPH_TABLE, ...WIDE_GLYPHS })) map.set(ch.codePointAt(0), rows);
  for (let c = 97; c <= 122; c++) map.set(c, map.get(c - 32));
  map.set(0xa0, GLYPH_TABLE[' ']); // nbsp
  return new Map([...map].sort((a, b) => a[0] - b[0]));
}

/** One rectangle per horizontal run of ink in a row (font units, y up, baseline at the bottom row). */
function rects(rows) {
  const out = [];
  rows.forEach((row, r) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== '#') { x++; continue; }
      let e = x; while (e < row.length && row[e] === '#') e++;
      const y0 = (rows.length - 1 - r) * PX;
      out.push([x * PX, y0, e * PX, y0 + PX]);
      x = e;
    }
  });
  return out;
}

class Bytes {
  constructor() { this.a = []; }
  u8(v) { this.a.push(v & 255); return this; }
  u16(v) { this.a.push((v >> 8) & 255, v & 255); return this; }
  i16(v) { return this.u16(v < 0 ? v + 65536 : v); }
  u32(v) { this.u16((v >>> 16) & 65535); return this.u16(v & 65535); }
  tag(s) { for (const c of s) this.u8(c.charCodeAt(0)); return this; }
  bytes(b) { for (const v of b) this.a.push(v); return this; }
  pad() { while (this.a.length % 4) this.a.push(0); return this; }
  get length() { return this.a.length; }
}

function glyphBytes(rs) {
  const b = new Bytes();
  if (!rs.length) return b;
  const xs = rs.flatMap((q) => [q[0], q[2]]), ys = rs.flatMap((q) => [q[1], q[3]]);
  b.i16(rs.length).i16(Math.min(...xs)).i16(Math.min(...ys)).i16(Math.max(...xs)).i16(Math.max(...ys));
  rs.forEach((_, i) => b.u16(i * 4 + 3)); // endPtsOfContours
  b.u16(0); // no instructions
  const pts = rs.flatMap(([x0, y0, x1, y1]) => [[x0, y0], [x0, y1], [x1, y1], [x1, y0]]); // clockwise
  pts.forEach(() => b.u8(1)); // on-curve, 16-bit coordinates
  let px = 0; for (const [x] of pts) { b.i16(x - px); px = x; }
  let py = 0; for (const [, y] of pts) { b.i16(y - py); py = y; }
  return b;
}

function checksum(arr) {
  const a = [...arr]; while (a.length % 4) a.push(0);
  let s = 0;
  for (let i = 0; i < a.length; i += 4) s = (s + ((a[i] << 24) | (a[i + 1] << 16) | (a[i + 2] << 8) | a[i + 3])) >>> 0;
  return s;
}

/** Build the TrueType bytes (Uint8Array). Pure: runs in node for the tests and in the browser for the theme. */
export function buildPixelFont(family = PIXEL_FONT_FAMILY) {
  const chars = pixelFontCharset();
  const codes = [...chars.keys()];
  const glyphs = [[], ...codes.map((c) => rects(chars.get(c)))]; // glyph 0 = .notdef (empty)
  const advs = [4 * PX, ...codes.map((c) => (chars.get(c)[0].length + 1) * PX)];
  const adv = 4 * PX; // the common advance (xAvgCharWidth)
  const advMax = Math.max(...advs);

  // glyf + loca
  const glyf = new Bytes(); const loca = new Bytes();
  let maxPts = 0, maxCtr = 0;
  for (const g of glyphs) {
    loca.u32(glyf.length);
    glyf.bytes(glyphBytes(g).a); glyf.pad();
    maxPts = Math.max(maxPts, g.length * 4); maxCtr = Math.max(maxCtr, g.length);
  }
  loca.u32(glyf.length);

  const head = new Bytes().u32(0x00010000).u32(0x00010000).u32(0).u32(0x5f0f3cf5).u16(0x000b).u16(EM)
    .u32(0).u32(0).u32(0).u32(0).i16(0).i16(0).i16(advMax - PX).i16(5 * PX).u16(0).u16(6).i16(2).i16(1).i16(0);
  const hhea = new Bytes().u32(0x00010000).i16(ASC).i16(-DESC).i16(0).u16(advMax).i16(0).i16(PX).i16(advMax - PX)
    .i16(1).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).u16(glyphs.length);
  const maxp = new Bytes().u32(0x00010000).u16(glyphs.length).u16(maxPts).u16(maxCtr).u16(0).u16(0).u16(2)
    .u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0);
  const hmtx = new Bytes();
  glyphs.forEach((g, i) => hmtx.u16(advs[i]).i16(g.length ? Math.min(...g.map((q) => q[0])) : 0));
  const os2 = new Bytes().u16(4).i16(adv).u16(400).u16(5).u16(0)
    .i16(EM / 2).i16(EM / 2).i16(0).i16(PX).i16(EM / 2).i16(EM / 2).i16(0).i16(3 * PX).i16(PX).i16(2 * PX)
    .i16(0).bytes([2, 11, 6, 9, 0, 0, 0, 0, 0, 0]).u32(1).u32(0).u32(0).u32(0).tag('BLST').u16(0x40)
    .u16(Math.min(codes[0], 0xffff)).u16(Math.min(codes[codes.length - 1], 0xffff))
    .i16(ASC).i16(-DESC).i16(0).u16(ASC).u16(DESC).u32(1).u32(0).i16(5 * PX).i16(5 * PX).u16(0).u16(32).u16(1);
  const post = new Bytes().u32(0x00030000).u32(0).i16(-PX).i16(PX).u32(0).u32(0).u32(0).u32(0).u32(0);

  // cmap: format 4, one segment per code point plus the 0xFFFF terminator
  const segs = codes.map((c, i) => [c, c, (i + 1 - c + 65536) % 65536]).concat([[0xffff, 0xffff, 1]]);
  const n = segs.length, sr = 2 * 2 ** Math.floor(Math.log2(n));
  const sub = new Bytes().u16(4).u16(16 + n * 8).u16(0).u16(n * 2).u16(sr).u16(Math.log2(sr / 2)).u16(n * 2 - sr);
  segs.forEach((s) => sub.u16(s[1])); sub.u16(0);
  segs.forEach((s) => sub.u16(s[0]));
  segs.forEach((s) => sub.u16(s[2]));
  segs.forEach(() => sub.u16(0));
  const cmap = new Bytes().u16(0).u16(1).u16(3).u16(1).u32(12).bytes(sub.a);

  // name: Windows Unicode strings
  const names = [[1, family], [2, 'Regular'], [3, `${family} Regular`], [4, family], [6, family.replace(/\s+/g, '')]];
  const strs = names.map(([, s]) => { const b = new Bytes(); for (const c of s) b.u16(c.charCodeAt(0)); return b.a; });
  const name = new Bytes().u16(0).u16(names.length).u16(6 + names.length * 12);
  let off = 0;
  names.forEach(([id], i) => { name.u16(3).u16(1).u16(0x409).u16(id).u16(strs[i].length).u16(off); off += strs[i].length; });
  strs.forEach((s) => name.bytes(s));

  const tables = { 'OS/2': os2, cmap, glyf, head, hhea, hmtx, loca, maxp, name, post };
  const tags = Object.keys(tables).sort();
  const nt = tags.length, tsr = 16 * 2 ** Math.floor(Math.log2(nt));
  const font = new Bytes().u32(0x00010000).u16(nt).u16(tsr).u16(Math.log2(tsr / 16)).u16(nt * 16 - tsr);
  let at = 12 + nt * 16;
  const body = new Bytes();
  let headAt = 0;
  for (const t of tags) {
    const data = tables[t].a;
    if (t === 'head') headAt = at;
    font.tag(t).u32(checksum(data)).u32(at).u32(data.length);
    body.bytes(data); body.pad();
    at = 12 + nt * 16 + body.length;
  }
  const out = Uint8Array.from([...font.a, ...body.a]);
  const adj = (0xb1b0afba - checksum(out)) >>> 0;
  out[headAt + 8] = adj >>> 24; out[headAt + 9] = (adj >>> 16) & 255; out[headAt + 10] = (adj >>> 8) & 255; out[headAt + 11] = adj & 255;
  return out;
}
