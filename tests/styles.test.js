import { test } from 'node:test';
import assert from 'node:assert/strict';
import { satisfaction, styleMultiplier, styleRelation, roomStyle, setRoomStyle, styledPrestige, nextStyle, WTP_WEIGHTS } from '../src/shelter/styles.js';
import { ShelterGrid } from '../src/shelter/grid.js';

const gilded = { name: 'Lady Eleanor Ashcombe', wealthClass: 'C3', style: 'gilded', traits: ['Dynast'] };
const rooms = (style) => [
  { id: 'bunk', style }, { id: 'pantry', style }, { id: 'air_vent', style }, { id: 'water_tank', style },
  { id: 'gold_taps', style }, { id: 'wine_cellar', style }, { id: 'cryo_pod', style },
];

test('style multiplier: 1.25 match, 1.0 neutral, 0.8 clash', () => {
  assert.equal(styleMultiplier('gilded', 'gilded'), 1.25);
  assert.equal(styleMultiplier('brutalist', 'gilded'), 0.8);
  assert.equal(styleMultiplier('biophilic', 'gilded'), 1.0);
  assert.equal(styleMultiplier(null, 'gilded'), 1.0);
  assert.equal(styleMultiplier('gilded', null), 1.0);
  assert.equal(styleRelation('gilded', ['tech_minimal', 'gilded']), 'match');
});

test("switching a Gilded client's rooms to Brutalist lowers satisfaction", () => {
  const met = { survive: 1, comfort: 0.5, status: 0.6, delusion: 0.6 };
  const g = satisfaction(gilded, rooms('gilded'), { met });
  const b = satisfaction(gilded, rooms('brutalist'), { met });
  assert.equal(g.s, 1.25);
  assert.equal(b.s, 0.8);
  assert.ok(b.score < g.score, `${b.score} < ${g.score}`);
  // base = 5*1 + 20*0.5 + 40*0.6 + 35*0.6 = 60
  assert.equal(g.base, 60);
  assert.equal(g.score, 75);
  assert.equal(b.score, 48);
});

test('only rooms the client looks at count toward s (Survive needs Paranoid/Engineer/Inspector)', () => {
  const mixed = [{ id: 'bunk', style: 'brutalist' }, { id: 'pantry', style: 'brutalist' }, { id: 'gold_taps', style: 'gilded' }];
  assert.equal(satisfaction(gilded, mixed).s, 1.25);
  assert.equal(satisfaction({ ...gilded, traits: ['Paranoid'] }, mixed).s, Math.round(((0.8 + 0.8 + 1.25) / 3) * 1000) / 1000);
});

test('satisfaction is capped at 100 and uses the wealth-class weights', () => {
  const full = { survive: 1, comfort: 1, status: 1, delusion: 1 };
  assert.equal(satisfaction(gilded, rooms('gilded'), { met: full }).score, 100);
  assert.equal(satisfaction({ wealthClass: 'C4' }, [], { met: { survive: 0, comfort: 0, status: 0, delusion: 1 } }).score, WTP_WEIGHTS.C4.delusion);
});

test('bunker rooms take the majority style of their furniture; setRoomStyle re-skins them', () => {
  const objects = new Map([[1, { id: 1, kind: 'wine_rack', style: 'brutalist' }], [2, { id: 2, kind: 'sofa' }]]);
  let changed = 0;
  const site = { objects, _changed: () => changed++ };
  const room = { id: 0, type: { tier: 'status' }, objects: [...objects.values()] };
  assert.equal(roomStyle(room), 'brutalist');
  setRoomStyle(site, room, 'gilded');
  assert.equal(roomStyle(room), 'gilded');
  assert.equal(objects.get(2).style, 'gilded');
  assert.equal(changed, 1);
  assert.equal(styledPrestige(gilded, [{ ...room, prestige: 8 }]), 10);
});

test('grid rooms get a style when placed and can be switched', () => {
  const g = new ShelterGrid({ isUnlocked: () => true });
  g.place(1, 1, 'gold_taps');
  assert.equal(g.at(1, 1).style, 'brutalist');
  g.place(2, 1, 'wine_cellar', { style: 'gilded' });
  assert.equal(g.at(2, 1).style, 'gilded');
  assert.ok(g.setStyle(1, 1, nextStyle('brutalist')).ok);
  assert.equal(g.at(1, 1).style, 'gilded');
  assert.equal(JSON.parse(JSON.stringify(g)).cells.find((c) => c.col === 1).style, 'gilded');
  assert.equal(g.setStyle(1, 1, 'mauve').ok, false);
});
