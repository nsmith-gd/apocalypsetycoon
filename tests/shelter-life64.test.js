// #122: shelter life visuals (doors with states, residents, the Days Sealed emblem) at the 64 px minimum.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doorRaster, residentRaster, residentLook, daysSealedRaster, DOOR_KINDS, DOOR_STATES, RESIDENT_POSES, LIFE_PX } from '../src/art/hd/shelter-life64.js';
import { reduceRaster } from '../src/art/hd/amenities64.js';
import { OBJECTS } from '../src/shelter/bunker-catalog.js';
import { HD_COLOURS } from '../src/art/hd/raster.js';

const same = (a, b) => a.c.length === b.c.length && a.c.every((v, i) => v === b.c[i]);

test('every door is drawn at 64 px per metre, in three different states', () => {
  for (const kind of DOOR_KINDS) {
    const [closed, open, sealed] = DOOR_STATES.map((s) => doorRaster(kind, s));
    for (const r of [closed, open, sealed]) {
      assert.equal(r.w, OBJECTS[kind].w * LIFE_PX, kind);
      assert.equal(r.h, OBJECTS[kind].h * LIFE_PX, kind);
      assert.ok(Math.min(r.w, r.h) >= 64);
    }
    assert.ok(!same(closed, open) && !same(closed, sealed) && !same(open, sealed), `${kind} states differ`);
  }
});

test('residents: every pose at least 64 px on its short side, every class looks different', () => {
  const looks = ['C1', 'C2', 'C3', 'C4'].map((cls) => residentLook({ name: 'Rowan', cls }));
  for (const pose of RESIDENT_POSES) {
    const r = residentRaster(looks[0], pose);
    assert.ok(Math.min(r.w, r.h) >= 64, pose);
    assert.deepEqual([r.w, r.h], pose === 'lie' ? [128, 64] : [64, 128]);
  }
  const stands = looks.map((l) => residentRaster(l, 'stand'));
  for (let i = 1; i < stands.length; i++) assert.ok(!same(stands[0], stands[i]));
  assert.ok(!same(residentRaster(looks[1], 'walk', { frame: 0 }), residentRaster(looks[1], 'walk', { frame: 1 })), 'walking has two frames');
});

test('the Days Sealed emblem is 64 x 64 and changes with the days', () => {
  const short = daysSealedRaster(10, 30), ok = daysSealedRaster(45, 30), long = daysSealedRaster(Infinity, 30);
  for (const r of [short, ok, long]) assert.deepEqual([r.w, r.h], [64, 64]);
  assert.ok(!same(short, ok) && !same(ok, long));
});

test('only palette ramp colours; the editor gets a crisp 4x reduction', () => {
  const r = doorRaster('airlock', 'sealed');
  for (const hex of r.colours()) assert.ok(HD_COLOURS.includes(hex));
  const small = reduceRaster(r, 4);
  assert.deepEqual([small.w, small.h], [16, 48]);
  assert.ok(small.colours().size > 4);
});
