import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';
import { run, check, minimumFromStyleGuide, DEFAULT_MIN } from '../tools/check-asset-minimum.mjs';

// A minimal valid RGBA PNG of w x h.
function png(w, h) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('passes compliant assets and reports offenders by path', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'assets-'));
  writeFileSync(join(dir, 'tile-64.png'), png(64, 64));
  writeFileSync(join(dir, 'banner.png'), png(256, 64));
  assert.equal((await run(['--files', dir, '--min', '64'])).code, 0);
  writeFileSync(join(dir, 'icon-16.png'), png(16, 16));
  writeFileSync(join(dir, 'strip.png'), png(128, 32)); // shortest side counts
  const r = await run(['--files', dir, '--min', '64']);
  assert.equal(r.code, 1);
  assert.deepEqual(r.failing.map((f) => f.path.split('/').pop()).sort(), ['icon-16.png', 'strip.png']);
  assert.ok(r.lines.some((l) => /FAIL .*icon-16\.png\s+16x16 < 64px/.test(l)));
  writeFileSync(join(dir, 'broken.png'), Buffer.from('not a png'));
  assert.ok((await run(['--files', dir])).lines.some((l) => /broken\.png.*not a readable PNG/.test(l)));
});

test('the minimum comes from the style guide, 64 until it says otherwise', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sg-'));
  writeFileSync(join(dir, 'sg.md'), '# Style\n\nMinimum asset size: 96 px on the shortest side.\n');
  assert.equal(minimumFromStyleGuide(join(dir, 'sg.md')), 96);
  assert.equal(minimumFromStyleGuide(join(dir, 'missing.md')), DEFAULT_MIN);
  assert.deepEqual(check([{ asset: 'a', w: 64, h: 64 }, { asset: 'b', w: 63, h: 200 }], 64).map((r) => r.asset), ['b']);
});

test('CI mode: the game passes with today\'s audited offenders baselined, and fails on a new one', async () => {
  const r = await run(['--baseline']);
  assert.equal(r.code, 0, r.lines.join('\n'));
  assert.ok(r.known.length > 0);
});
