// Zoomable shelter grid: 64 px art draws at the context's real scale, 1:1 in device space.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawCrisp, ctxScale } from '../src/art/hd/crisp.js';

function fakeCtx(a) {
  let m = { a, b: 0, c: 0, d: a, e: 10, f: 20 };
  const calls = [];
  return {
    calls, imageSmoothingEnabled: true,
    getTransform: () => ({ ...m }), setTransform: (A, B, C, D, E, F) => { m = { a: A, b: B, c: C, d: D, e: E, f: F }; },
    save() { this._s = { ...m }; }, restore() { m = this._s; }, translate() {}, scale() {},
    drawImage: (cv, x, y) => calls.push({ w: cv.width, x, y, a: m.a }),
  };
}
test('drawCrisp asks for art at tile x zoom and draws it unscaled at the right spot', () => {
  const asked = [];
  const get = (tile) => { asked.push(tile); return { width: tile * 2, height: tile }; };
  const c4 = fakeCtx(4); assert.equal(ctxScale(c4), 4);
  drawCrisp(c4, get, 16, 32, 16);
  assert.deepEqual(asked, [64]);
  assert.deepEqual(c4.calls[0], { w: 128, x: 4 * 16 + 10, y: 4 * 32 + 20, a: 1 });
  const c1 = fakeCtx(1); drawCrisp(c1, get, 5, 6, 16);
  assert.equal(asked.at(-1), 16); assert.equal(c1.calls[0].x, 5);
});
