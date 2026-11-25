// #127: canvases show at whole DEVICE pixels per art pixel at any pixel ratio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceScale, cssLen, snapPx } from '../src/ui/pixel-perfect.js';

const at = (r, fn) => { const old = globalThis.devicePixelRatio; globalThis.devicePixelRatio = r; try { return fn(); } finally { globalThis.devicePixelRatio = old; } };

test('scale is whole device pixels and fits the box', () => {
  for (const r of [1, 1.25, 1.5, 1.75, 2, 3]) at(r, () => {
    for (const avail of [320, 641, 960, 1000, 1283]) {
      const k = deviceScale(320, 192, avail, 2000);
      assert.equal(k, Math.floor(k));
      assert.ok(k >= 1);
      const css = cssLen(320, k);
      assert.ok(css <= Math.max(avail, cssLen(320, 1)) + 1e-9, `${r}: ${css} > ${avail}`);
      assert.ok(Math.abs(css * r - 320 * k) < 1e-9, 'CSS size is exactly k device px per art px');
      if (k > 1) assert.ok(cssLen(320, k + 1) > avail, 'largest whole scale');
    }
  });
});

test('125%: a 3x CSS fit becomes 3 device px, not 3.75', () => at(1.25, () => {
  const k = deviceScale(320, 192, 960, 576);
  assert.equal(k, 3); // 960 css * 1.25 = 1200 device px / 320 = 3.75 -> 3
  assert.equal(cssLen(320, k), 768);
}));

test('snapPx rounds to device pixels', () => at(1.5, () => { assert.equal(snapPx(10.4) * 1.5, Math.round(10.4 * 1.5)); }));
