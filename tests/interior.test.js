import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BunkerSite } from '../src/shelter/bunker.js';
import { ResidentSim } from '../src/shelter/residents.js';
import { variantsFor, FINISHES } from '../src/shelter/bunker-catalog.js';

// spine at x 0-1 down to 9 m; living floor y 1..3 (x 2..16); lower floor y 5..7 (x 2..10)
function house() {
  const b = new BunkerSite({ surveyed: true });
  for (let y = 0; y < 9; y++) { b.dig(0, y); b.dig(1, y); b.build('spine', 0, y); b.build('spine', 1, y); }
  b.digRect(2, 0, 16, 4); b.buildRect('wall', 2, 0, 16, 0); b.buildRect('wall', 2, 4, 16, 4); b.buildRect('wall', 16, 1, 16, 3);
  b.digRect(2, 5, 10, 8); b.buildRect('wall', 2, 8, 10, 8); b.buildRect('wall', 10, 5, 10, 7);
  return b;
}
const roomAt = (b, x, y) => { const s = b.simulate(); return s.rooms[s.roomOf[b.idx(x, y)]]; };

test('layers: a painting hangs over a sofa, a rug sits under a bed, a chandelier hangs from the ceiling', () => {
  const b = house();
  b.finishAll();
  assert.equal(b.place('sofa', 5, 3).ok, true);
  assert.equal(b.place('painting', 5, 2).ok, true); // back wall, over the sofa
  assert.equal(b.place('rug', 5, 3).ok, true); // under the sofa
  assert.equal(b.place('chandelier', 9, 1).ok, true); // y 1 is just under the slab
  assert.match(b.place('chandelier', 9, 2).reason, /ceiling/);
  assert.match(b.place('painting', 5, 2).reason, /already/); // one painting per spot
  b.finishAll();
  assert.equal(b.objectsAt(5, 3).length, 2); // sofa + rug
  assert.equal(b.objectAt(5, 2, 'wall').kind, 'painting');
  assert.equal(roomAt(b, 5, 3).type.name, 'Lounge');
});

test('finishes apply to the whole room, cost per tile, and raise room beauty', () => {
  const b = house();
  b.finishAll();
  const before = roomAt(b, 5, 2).beauty;
  const r = b.paint('wall', 'marble', 5, 2);
  assert.equal(r.ok, true);
  assert.equal(r.tiles, roomAt(b, 5, 2).tiles.length);
  b.paint('floor', 'checker', 5, 2);
  b.paint('light', 'warm', 5, 2);
  const after = roomAt(b, 5, 2);
  assert.equal(after.finishBeauty, (FINISHES.wall.marble.beauty + FINISHES.floor.checker.beauty + FINISHES.light.warm.beauty) * 3);
  assert.equal(after.beauty - before, after.finishBeauty);
  assert.equal(b.paint('wall', 'marble', 5, 2).tiles, 0); // already marble: nothing charged
  assert.equal(b.paint('wall', 'brick', 5, 6, { single: true }).tiles, 1);
});

test('every object can be recoloured and flipped; luxe variants add beauty', () => {
  const b = house();
  b.place('sofa', 5, 3, { variant: 'cream' });
  b.finishAll();
  const sofa = b.built.find((o) => o.kind === 'sofa');
  const plain = roomAt(b, 5, 3).beauty;
  assert.equal(b.recolor(sofa), 'burgundy');
  assert.equal(roomAt(b, 5, 3).beauty, plain + 1);
  b.recolor(sofa, 'leather');
  assert.equal(sofa.variant, 'leather');
  assert.equal(b.flip(sofa), true);
  assert.ok(variantsFor('toilet').some((v) => v.id === 'gold'));
});

test('finishes, variants and flips survive save/load', () => {
  const b = house();
  b.place('armchair', 5, 3, { variant: 'leopard', flip: true });
  b.finishAll();
  b.paint('wall', 'damask', 5, 2);
  const c = new BunkerSite({ surveyed: true });
  c.load(JSON.parse(JSON.stringify(b)));
  const chair = c.built.find((o) => o.kind === 'armchair');
  assert.deepEqual([chair.variant, chair.flip], ['leopard', true]);
  assert.equal(c.finish.wall[c.idx(5, 2)], 'damask');
  assert.equal(roomAt(c, 5, 2).finishBeauty, roomAt(b, 5, 2).finishBeauty);
});

test('residents move in, one per bed slot, with names, classes and traits', () => {
  const b = house();
  b.place('bed', 2, 3); b.place('king_bed', 12, 3);
  b.finishAll();
  const sim = new ResidentSim(b);
  sim.tick(0.1);
  assert.equal(sim.residents.length, 4);
  assert.deepEqual(sim.residents.map((r) => r.cls).sort(), ['C2', 'C2', 'C3', 'C3']);
  for (const r of sim.residents) assert.ok(r.name && r.trait);
});

test('a resident walks along the floor and climbs the spine to reach what they need', () => {
  const b = house();
  b.place('bed', 4, 3);
  b.place('toilet', 6, 7); b.conduitLine('water', 2, 7, 6, 7); // the only toilet is downstairs, plumbed
  b.finishAll();
  const sim = new ResidentSim(b);
  sim.tick(0.01);
  const r = sim.residents[0];
  r.needs.bladder = 5;
  r.action = null;
  let reached = false;
  for (let i = 0; i < 200 && !reached; i++) { sim.tick(0.1); reached = r.action?.kind === 'toilet' && r.action.started; }
  assert.ok(reached, 'used the downstairs toilet');
  assert.equal(r.y, 7);
  for (let i = 0; i < 20; i++) sim.tick(0.1);
  assert.ok(r.needs.bladder > 60);
});

test('residents ignore machines that are not plumbed or powered, and say why', () => {
  const b = house();
  b.place('bed', 4, 3); b.place('fridge', 9, 3); // no power
  b.finishAll();
  const sim = new ResidentSim(b);
  sim.tick(0.01);
  const r = sim.residents[0];
  r.needs.hunger = 5;
  r.action = null;
  sim.tick(0.1);
  assert.notEqual(r.action?.kind, 'fridge');
  assert.ok(sim.complaints.some((c) => /cold store doesn't work \(check its power\)/.test(c)));
});

test('beautiful things get admired, which lifts mood; a nicer room makes a happier resident', () => {
  const plainHouse = house();
  plainHouse.place('bed', 4, 3);
  plainHouse.finishAll();
  const nice = house();
  nice.place('bed', 4, 3); nice.place('statue', 9, 3); nice.place('aquarium', 12, 3); nice.conduitLine('power', 2, 3, 13, 3);
  nice.finishAll();
  nice.paint('wall', 'marble', 5, 2); nice.paint('floor', 'checker', 5, 2); nice.paint('light', 'warm', 5, 2);
  const a = new ResidentSim(plainHouse, { seed: 3 });
  const z = new ResidentSim(nice, { seed: 3 });
  for (let i = 0; i < 120; i++) { a.tick(0.1); z.tick(0.1); }
  assert.ok(z.residents.some((r) => r.thoughts.some((t) => /admires/.test(t.text))));
  assert.ok(z.averageMood > a.averageMood, `${z.averageMood} vs ${a.averageMood}`);
});

test('residents sleep in their own bed, not someone else\'s', () => {
  const b = house();
  b.place('bed', 2, 3); b.place('bed', 12, 3);
  b.finishAll();
  const sim = new ResidentSim(b);
  sim.tick(0.01);
  const r = sim.residents.find((x) => x.bedId === b.built.find((o) => o.x === 2).id);
  r.needs.energy = 5;
  r.action = null;
  const opts = sim.options(r).filter((o) => o.use.sleep);
  assert.ok(opts.length >= 1);
  assert.equal(opts[0].obj.id, r.bedId);
  assert.ok(!opts.some((o) => o.obj.id !== r.bedId));
});

test('a well-furnished suite keeps its billionaires happy over two resident days', async () => {
  const { furnishedSuite } = await import('../src/shelter/showcase.js');
  const b = new BunkerSite({ surveyed: true });
  furnishedSuite(b, { instant: true });
  const sim = b.people;
  let low = 100;
  for (let i = 0; i < 48 * 10; i++) { b.tick(sim.cfg.hourSeconds / 10); if (i > 60) low = Math.min(low, sim.averageMood); }
  assert.equal(sim.residents.length, 4);
  assert.ok(low >= 65, `average mood dipped to ${low}`);
  assert.ok(b.simulate().rooms.filter((r) => r.finishBeauty > 0).length >= 4);
});

test('a resident queuing for the only toilet says so instead of "can\'t reach"', () => {
  const b = house();
  b.place('bed', 2, 3); b.place('bed', 12, 3);
  b.place('toilet', 9, 3); b.conduitLine('water', 2, 3, 9, 3);
  b.finishAll();
  const sim = new ResidentSim(b);
  sim.tick(0.01);
  const [a, z] = sim.residents;
  const toilet = b.built.find((o) => o.kind === 'toilet');
  a.action = { objId: toilet.id, kind: 'toilet', use: { needs: { bladder: 1 }, hours: 5 }, hoursLeft: 5, started: true };
  z.needs.bladder = 5; z.action = null;
  sim._decide(z);
  assert.ok(sim.complaints.some((c) => /waiting for the toilet/.test(c)), sim.complaints.join());
});
