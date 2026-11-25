import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURE_KINDS, FIXTURE_SIZE, FIXTURE_PX, fixturePixels, reducePixels, hasFixture } from '../src/art/fixtures64.js';
import { OBJECTS } from '../src/shelter/bunker-catalog.js';
import { inventory } from '../tools/asset-inventory.mjs';
import { check } from '../tools/check-asset-minimum.mjs';

const SURVIVAL = Object.entries(OBJECTS).filter(([, o]) => ['air', 'water', 'food'].includes(o.cat)).map(([id]) => id);

test('every air, water and food fixture in the catalog has 64 px-per-metre art', () => {
  assert.equal(FIXTURE_PX, 64);
  assert.deepEqual([...SURVIVAL].sort(), [...FIXTURE_KINDS].sort());
  for (const id of SURVIVAL) {
    assert.ok(hasFixture(id));
    assert.deepEqual(FIXTURE_SIZE[id], [OBJECTS[id].w, OBJECTS[id].h], id);
    const b = fixturePixels(id);
    assert.equal(b.w, OBJECTS[id].w * 64);
    assert.equal(b.h, OBJECTS[id].h * 64);
    assert.ok(Math.min(b.w, b.h) >= 64);
  }
});

test('each fixture is real art: fills its frame, uses a wide tonal range, animates where it should', () => {
  for (const id of FIXTURE_KINDS) {
    const b = fixturePixels(id);
    const filled = b.px.filter(Boolean).length / b.px.length;
    const colours = new Set(b.px.filter(Boolean).map((c) => c.join()));
    assert.ok(filled > (id === 'grow_light' ? 0.2 : 0.35), `${id} fills ${filled.toFixed(2)}`);
    assert.ok(colours.size >= (id === 'grow_light' ? 10 : 12), `${id} uses ${colours.size} colours`);
  }
  for (const id of ['hepa', 'crank_scrubber', 'recycler', 'vat']) {
    const a = fixturePixels(id, {}, { frame: 0 }).px.map((c) => c?.join()).join('|');
    const b = fixturePixels(id, {}, { frame: 3 }).px.map((c) => c?.join()).join('|');
    assert.notEqual(a, b, `${id} animates`);
  }
});

test('the editor-scale reduction keeps the size and the outline colour', () => {
  const b = fixturePixels('tank');
  const r = reducePixels(b, 4);
  assert.equal(r.w, 32);
  assert.equal(r.h, 48);
  assert.ok(r.px.some((c) => c && c.join() === '10,8,7'));
});

test('the 64 px check passes for every survival fixture', async () => {
  const rows = (await inventory()).filter((r) => SURVIVAL.some((id) => r.asset === `bunker-objects/${id}`));
  assert.equal(rows.length, SURVIVAL.length);
  assert.deepEqual(check(rows, 64), []);
});
