// #142: room special rules, one test each.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BunkerSite, ROOM_RULES } from '../src/shelter/bunker.js';

// A row of rooms on one floor: each [x0, x1], a door between neighbours, a wall at the end. Floor y 1..3.
function floor(rooms, { top = 1, site = new BunkerSite({ surveyed: true }) } = {}) {
  const b = site;
  for (let y = 0; y <= top + 3; y++) { b.dig(0, y); b.dig(1, y); b.build('spine', 0, y); b.build('spine', 1, y); }
  const x1 = rooms.at(-1)[1] + 1;
  b.digRect(2, top - 1, x1, top + 3);
  b.buildRect('wall', 2, top - 1, x1, top - 1); b.buildRect('wall', 2, top + 3, x1, top + 3);
  rooms.forEach(([, x], i) => { if (i === rooms.length - 1) b.buildRect('wall', x + 1, top, x + 1, top + 2); else b.place('door', x + 1, top + 2); }); // doors between, so crews reach every room
  return b;
}
const roomAt = (b, x, y) => { const s = b.simulate(); return s.rooms[s.roomOf[b.idx(x, y)]]; };

test('the Panic Room must touch the Master Suite', () => {
  const b = floor([[2, 6], [8, 12], [14, 18]]);
  b.place('king_bed', 3, 3); b.place('panic_console', 9, 3); // touching
  b.finishAll();
  assert.equal(roomAt(b, 9, 3).type.id, 'panic_room');
  assert.ok(roomAt(b, 9, 3).prestige > 0);
  const far = floor([[2, 6], [8, 12], [14, 18]]);
  far.place('king_bed', 3, 3); far.place('sofa', 9, 3); far.place('panic_console', 15, 3); // a lounge in between
  far.finishAll();
  const pr = roomAt(far, 15, 3);
  assert.equal(pr.type.id, 'panic_room');
  assert.equal(pr.prestige, 0);
  assert.match(pr.rule, /Master Suite/);
});

test('the Wine Cellar gets +50% prestige at 10 m or deeper', () => {
  const shallow = floor([[2, 8]]);
  shallow.place('wine_rack', 3, 3); shallow.finishAll();
  const deep = floor([[2, 8]], { top: 11 });
  deep.place('wine_rack', 3, 13); deep.finishAll();
  const a = roomAt(shallow, 3, 3), d = roomAt(deep, 3, 13);
  assert.equal(a.type.id, 'wine_cellar');
  assert.equal(d.type.id, 'wine_cellar');
  assert.equal(d.prestige, a.prestige * 1.5);
});

test('the Art Vault loses 2% prestige a week without climate power, and not with it', () => {
  const mk = (climate) => {
    const b = floor([[2, 8], [10, 16]]);
    b.place('painting', 3, 2); b.place('painting', 6, 2);
    b.place('diesel', 11, 3); b.place('fuel', 14, 3);
    b.conduitLine('air', 10, 3, 16, 3); b.conduitLine('power', 10, 3, 12, 3);
    if (climate) b.conduitLine('power', 3, 3, 12, 3); // a powered cable through the vault (crossing the wall)
    b.finishAll();
    return b;
  };
  const cold = mk(false), warm = mk(true);
  assert.equal(roomAt(cold, 3, 3).type.id, 'art_vault');
  const p0 = roomAt(cold, 3, 3).prestige;
  assert.equal(roomAt(warm, 3, 3).climate, true, 'powered cable = climate control');
  for (const b of [cold, warm]) b.tick(b.cfg.daySeconds * 7 * 3 + 1); // three weeks
  assert.ok(Math.abs(roomAt(cold, 3, 3).prestige - p0 * (1 - ROOM_RULES.artDecayPerWeek) ** 3) < 1e-9);
  assert.equal(roomAt(warm, 3, 3).prestige, p0);
});

test('a Fuel Depot can never sit beside a bedroom: the shelter can\'t be handed over', () => {
  const b = floor([[2, 8], [10, 16]]);
  b.place('bunk', 3, 3); b.place('fuel_bladder', 11, 3);
  b.finishAll();
  assert.equal(roomAt(b, 11, 3).type.id, 'fuel_depot');
  assert.match(roomAt(b, 11, 3).rule, /bedroom/);
  assert.match(b.handOver('X').reason, /Fuel Depot/);
  const ok = floor([[2, 8], [10, 14], [16, 20]]);
  ok.place('bunk', 3, 3); ok.place('shelf', 11, 3); ok.place('fuel_bladder', 17, 3); // a pantry between
  ok.finishAll();
  assert.equal(roomAt(ok, 17, 3).rule, null);
  assert.equal(ok.handOver('Y').ok, true);
});

test('the Infinity Pool needs the Deep Water Recycler running', () => {
  const mk = (recycler) => {
    const b = floor([[2, 9], [11, 18]]);
    b.place('pool_basin', 3, 3);
    b.place('diesel', 12, 3); b.place('fuel', 14, 3); b.place('tank', 15, 3);
    if (recycler) b.place('recycler', 17, 3);
    b.conduitLine('air', 11, 3, 18, 3); b.conduitLine('power', 2, 3, 18, 3); b.conduitLine('water', 2, 2, 18, 2);
    b.finishAll();
    return b;
  };
  const dry = roomAt(mk(false), 3, 3);
  assert.equal(dry.type.id, 'infinity_pool');
  assert.equal(dry.prestige, 0);
  assert.match(dry.rule, /Recycler/);
  const wet = mk(true);
  assert.ok(wet.simulate().online.has([...wet.objects.values()].find((o) => o.kind === 'recycler').id), 'recycler runs');
  assert.ok(roomAt(wet, 3, 3).prestige > 0);
});

test('same-style neighbours add +10% prestige each, up to +30%', () => {
  const rooms = [[2, 5], [7, 10], [12, 15], [17, 20], [22, 22]];
  const b = floor(rooms.slice(0, 4));
  const centre = (x0) => x0 + 1;
  for (const [x0] of rooms.slice(0, 4)) { b.place('statue', centre(x0), 3); }
  b.finishAll();
  const solo = roomAt(b, 3, 3).prestige;
  // gild the first room only: no gilded neighbours, no bonus
  b.paint('wall', 'damask', 3, 2); b.paint('floor', 'checker', 3, 2);
  assert.equal(roomAt(b, 3, 3).style, 'gilded');
  assert.equal(roomAt(b, 3, 3).prestige, solo);
  // gild the second: each gets +10% from the other
  b.paint('wall', 'damask', 8, 2); b.paint('floor', 'checker', 8, 2);
  assert.ok(Math.abs(roomAt(b, 3, 3).prestige - solo * 1.1) < 1e-9);
  // the second room, with gilded rooms on both sides, gets +20%
  b.paint('wall', 'damask', 13, 2); b.paint('floor', 'checker', 13, 2);
  assert.ok(Math.abs(roomAt(b, 8, 3).prestige - roomAt(b, 8, 3).prestige / (1 + roomAt(b, 8, 3).styleBonus) * 1.2) < 1e-9);
  assert.equal(roomAt(b, 8, 3).styleBonus, 0.2);
  assert.equal(ROOM_RULES.styleCap, 0.3);
});
