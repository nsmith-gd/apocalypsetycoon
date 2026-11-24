import { test } from 'node:test';
import assert from 'node:assert/strict';
import { styledShell, styledAmenity, SHELL_SWAPS, AMENITY_SWAPS, TIER_TRIM, ROOM_SHELL } from '../src/art/styleArt.js';
import { AMENITIES } from '../src/art/sprites-shelter.js';
import { validateSprite } from '../src/art/render.js';
import { HEX } from '../src/art/palette.js';

test('every style swap produces valid palette sprites for the shell and every amenity', () => {
  for (const style of Object.keys(SHELL_SWAPS)) {
    assert.deepEqual(validateSprite(`shell:${style}`, styledShell(style)), []);
    for (const id of Object.keys(AMENITIES)) {
      const s = styledAmenity(id, style);
      assert.deepEqual(validateSprite(`${id}:${style}`, { ...s, rows: s.rows }), []);
      assert.equal(s.frames?.length ?? 1, AMENITIES[id].frames?.length ?? 1);
    }
  }
  assert.equal(ROOM_SHELL.rows.length, 16);
});

test('Brutalist and Gilded look different; the tier trim colours are palette colours', () => {
  assert.notDeepEqual(styledShell('brutalist').rows, styledShell('gilded').rows);
  assert.notDeepEqual(styledAmenity('air_vent', 'brutalist').rows, styledAmenity('air_vent', 'gilded').rows);
  for (const t of Object.values(TIER_TRIM)) { assert.ok(HEX[t.a]); assert.ok(HEX[t.b]); }
  for (const m of Object.values(AMENITY_SWAPS)) for (const v of Object.values(m)) assert.ok(HEX[v]);
});
