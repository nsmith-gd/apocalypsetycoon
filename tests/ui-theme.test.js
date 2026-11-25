// #126 UI theme: the pixel web font is a valid TrueType built from the game's glyphs, and the theme only uses it
// at whole-number scales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPixelFont, pixelFontCharset, PIXEL_FONT_STEP, WIDE_GLYPHS } from '../src/ui/pixel-font.js';
import { GLYPH_TABLE } from '../src/art/font.js';

const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u16 = (b, o) => (b[o] << 8) | b[o + 1];
function tables(b) {
  const n = u16(b, 4); const out = {};
  for (let i = 0; i < n; i++) { const r = 12 + i * 16; out[String.fromCharCode(...b.slice(r, r + 4))] = { sum: u32(b, r + 4), off: u32(b, r + 8), len: u32(b, r + 12) }; }
  return out;
}
const sum = (b) => { let s = 0; for (let i = 0; i < b.length; i += 4) s = (s + (((b[i] ?? 0) << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0))) >>> 0; return s; };

test('pixel font is a well-formed TrueType file', () => {
  const b = buildPixelFont();
  assert.equal(u32(b, 0), 0x00010000);
  const t = tables(b);
  for (const tag of ['OS/2', 'cmap', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'name', 'post']) assert.ok(t[tag], `missing ${tag}`);
  const tags = Object.keys(t); assert.deepEqual(tags, [...tags].sort(), 'table records sorted');
  for (const [tag, { sum: s, off, len }] of Object.entries(t)) {
    assert.equal(off % 4, 0, `${tag} aligned`);
    const data = Uint8Array.from(b.slice(off, off + len));
    if (tag === 'head') data.fill(0, 8, 12);
    assert.equal(sum(data), s, `${tag} checksum`);
  }
  assert.equal(sum(b), 0xb1b0afba, 'whole-font checksum adjustment');
  assert.equal(u16(b, t.head.off + 18), 128 * PIXEL_FONT_STEP, 'unitsPerEm = 6 font pixels');
});

test('pixel font covers the glyph table, lowercase and the wide glyphs', () => {
  const cs = pixelFontCharset();
  for (const ch of Object.keys(GLYPH_TABLE)) assert.ok(cs.has(ch.codePointAt(0)), ch);
  for (const ch of 'abcxyz') assert.deepEqual(cs.get(ch.charCodeAt(0)), cs.get(ch.toUpperCase().charCodeAt(0)));
  for (const [ch, rows] of Object.entries(WIDE_GLYPHS)) { assert.equal(rows.length, 5); assert.ok(rows.every((r) => r.length === 5)); assert.deepEqual(cs.get(ch.charCodeAt(0)), rows); }
});

test('theme uses the pixel font only at whole-number scales', () => {
  const css = readFileSync(new URL('../src/ui/theme.css', import.meta.url), 'utf8');
  const sizes = [...css.matchAll(/--th-x(\d):\s*(\d+)px/g)];
  assert.ok(sizes.length >= 3);
  for (const [, k, px] of sizes) assert.equal(Number(px), Number(k) * PIXEL_FONT_STEP, `--th-x${k}`);
  // every rule that switches to the pixel font sizes it with a token or a multiple of 6
  for (const rule of css.split('}')) {
    if (!/font-family:\s*var\(--th-pixel\)/.test(rule)) continue;
    const fs = rule.match(/font-size:\s*([^;]+);/);
    if (!fs) continue;
    const v = fs[1].trim();
    assert.ok(/^var\(--th-x\d\)$/.test(v) || (/^\d+px$/.test(v) && parseInt(v, 10) % PIXEL_FONT_STEP === 0), `font-size ${v} in: ${rule.trim().slice(0, 80)}`);
  }
});
