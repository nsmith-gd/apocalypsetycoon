import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BunkerSite } from '../src/shelter/bunker.js';
import { STYLE_KITS, FINISHES, variantsFor, familyOf } from '../src/shelter/bunker-catalog.js';
import { satisfaction, roomStyle } from '../src/shelter/styles.js';
import { wallPieceKey, floorPieceKey, DETAILED_WALLS, DETAILED_FLOORS } from '../src/art/finish-art.js';
import { HEX } from '../src/art/palette.js';

// One room: floor y 1..3, x 2..12, with a sofa, a lamp and a bed in it.
function site() {
  const b = new BunkerSite({ surveyed: true });
  for (let y = 0; y < 9; y++) { b.dig(0, y); b.dig(1, y); b.build('spine', 0, y); b.build('spine', 1, y); }
  b.digRect(2, 0, 13, 4);
  b.buildRect('wall', 2, 0, 13, 0);
  b.buildRect('wall', 2, 4, 13, 4);
  b.buildRect('wall', 13, 1, 13, 3);
  b.place('sofa', 3, 3);
  b.place('bed', 8, 3);
  b.place('lamp', 11, 3);
  b.finishAll();
  return b;
}
const room = (b) => b.simulate().rooms.find((r) => r.minY === 1 && r.minX === 2);

test('each style kit is a set of pieces that exist in the catalog', () => {
  for (const kit of Object.values(STYLE_KITS)) {
    assert.ok(FINISHES.wall[kit.wall] && FINISHES.floor[kit.floor] && FINISHES.light[kit.light]);
    for (const [fam, v] of Object.entries(kit.variants)) assert.ok(variantsFor({ upholstery: 'sofa', wood: 'bookshelf', metal: 'sconce', bedding: 'bed', plant: 'plant' }[fam]).some((x) => x.id === v), `${fam}:${v}`);
  }
});

test('a bare room has no style; applying a kit dresses walls, floor, light and furniture', () => {
  const b = site();
  assert.equal(room(b).style, null);
  const r = b.applyStyle('gilded', 5, 2);
  assert.ok(r.ok);
  const rm = room(b);
  for (const [x, y] of rm.tiles) {
    const i = b.idx(x, y);
    assert.equal(b.finish.wall[i], 'damask');
    assert.equal(b.finish.floor[i], 'checker');
    assert.equal(b.finish.light[i], 'candle');
  }
  const sofa = [...b.objects.values()].find((o) => o.kind === 'sofa');
  assert.equal(sofa.variant, 'burgundy');
  assert.equal(rm.style, 'gilded');
  assert.equal(roomStyle(rm), 'gilded');
});

test('pieces stay individually editable, and the room style follows what it is made of', () => {
  const b = site();
  b.applyStyle('gilded', 5, 2);
  b.paint('wall', 'board_concrete', 5, 2);
  b.paint('floor', 'polished_slab', 5, 2);
  // two pieces now say Brutalist, light and furniture still say Gilded
  const rm = room(b);
  assert.ok(rm.styleVotes.brutalist >= 2); // walls + floor (+0.5 for ebony, which both kits share)
  assert.ok(rm.styleVotes.gilded >= 1);
  b.applyStyle('brutalist', 5, 2);
  assert.equal(room(b).style, 'brutalist');
  assert.equal([...b.objects.values()].find((o) => o.kind === 'sofa').variant, 'leather');
});

test("a Gilded client is happier in the Gilded-dressed room than the Brutalist one", () => {
  const client = { wealthClass: 'C3', style: 'gilded', traits: [] };
  const met = { survive: 1, comfort: 1, status: 0.5, delusion: 0.2 };
  const g = site(); g.applyStyle('gilded', 5, 2);
  const br = site(); br.applyStyle('brutalist', 5, 2);
  const sg = satisfaction(client, [{ ...room(g), tier: 'comfort' }], { met });
  const sb = satisfaction(client, [{ ...room(br), tier: 'comfort' }], { met });
  assert.equal(sg.s, 1.25);
  assert.equal(sb.s, 0.8);
  assert.ok(sb.score < sg.score);
});

test('the detailed wall and floor pieces use only palette colours and tile seamlessly', () => {
  const palette = new Set(Object.keys(HEX));
  for (const id of DETAILED_WALLS) {
    const seen = new Set();
    for (let Y = 0; Y < 96; Y++) for (let X = 0; X < 96; X++) { const k = wallPieceKey(id, X, Y); assert.ok(palette.has(k), `${id} ${k}`); seen.add(k); }
    assert.ok(seen.size >= 5, `${id} has ${seen.size} tones`);
  }
  for (const id of DETAILED_FLOORS) for (let y = 0; y < 4; y++) for (let X = 0; X < 64; X++) assert.ok(palette.has(floorPieceKey(id, X, y)), id);
  assert.equal(familyOf('sofa'), 'upholstery');
});
