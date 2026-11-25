// #128: build feedback effects in the shelter builder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBuildFx, drawCrew, drawSnap } from '../src/shelter/build-fx.js';

function recorder() {
  const px = new Map(); let fill = '#000'; let alpha = 1;
  return {
    px,
    set fillStyle(v) { fill = v; }, get fillStyle() { return fill; },
    set strokeStyle(v) {}, set lineWidth(v) {},
    set globalAlpha(v) { alpha = v; }, get globalAlpha() { return alpha; },
    fillRect(x, y, w, h) { if (alpha <= 0) return; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px.set(`${x + i},${y + j}`, fill); },
    strokeRect() {},
  };
}
const PX = (x) => x * 16, PY = (y) => y * 16;

test('place, complete, room, upgrade, demolish and dug each draw something different, then expire', () => {
  const looks = {};
  for (const type of ['place', 'complete', 'room', 'upgrade', 'demolish', 'dug']) {
    const fx = createBuildFx({ T: 16 });
    fx.add(type, { x: 4, y: 4, w: 3, h: 2, now: 0, tier: 'status', label: 'LOUNGE', drawText: () => {} });
    const ctx = recorder();
    fx.draw(ctx, 200, PX, PY);
    assert.ok(ctx.px.size >= 6, `${type} drew ${ctx.px.size} px`);
    looks[type] = [...ctx.px.values()].sort().join();
    fx.draw(recorder(), 5000, PX, PY);
    assert.equal(fx.active, 0, `${type} expires`);
  }
  assert.equal(new Set(Object.values(looks)).size, 6, 'every effect looks different');
});

test('crews swing the right tool for their job, on a two-frame cycle', () => {
  const pics = {};
  for (const type of ['dig', 'build', 'object']) for (const frame of [0, 6]) { const ctx = recorder(); drawCrew(ctx, { type, x: 2, y: 2 }, 32, 32, frame); pics[`${type}${frame}`] = [...ctx.px.keys()].sort().join(); }
  for (const type of ['dig', 'build', 'object']) assert.notEqual(pics[`${type}0`], pics[`${type}6`], `${type} animates`);
  assert.notEqual(pics.dig0, pics.build0);
});

test('the placement preview is green when it fits and red and hatched when it does not', () => {
  const ok = recorder(); drawSnap(ok, 32, 32, 32, 32, true, 0);
  const bad = recorder(); drawSnap(bad, 32, 32, 32, 32, false, 0);
  assert.ok([...ok.px.values()].includes('#7ed957') && !ok.px.has('#ff5a4f'));
  assert.ok([...bad.px.values()].filter((c) => c === '#ff5a4f').length > 20);
});
