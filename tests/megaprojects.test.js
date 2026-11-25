import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MegaprojectBoard, Compound } from '../src/shelter/megaprojects.js';
import { MEGAPROJECTS } from '../src/config/tuning.js';
import { LeadInventory } from '../src/leads/leads.js';
import { Ledger } from '../src/ledger/ledger.js';

const unlockedAll = () => true;
const tableLead = () => new LeadInventory().create({ guest: { name: 'Mr. Gray' }, region: 'capitals', wealthClass: 'C5', quality: 80 });

test('start an Ark from a Table lead (C5), only once unlocked; other leads cannot', () => {
  const locked = new MegaprojectBoard({ isUnlocked: (id) => id !== 'ark' });
  assert.match(locked.startArk(tableLead()).reason, /5:00/);
  const board = new MegaprojectBoard({ isUnlocked: unlockedAll });
  const c3 = new LeadInventory().create({ guest: { name: 'Lady Ashcombe' }, region: 'capitals', wealthClass: 'C3', quality: 60 });
  assert.match(board.startArk(c3).reason, /Table/);
  const r = board.startArk(tableLead());
  assert.ok(r.ok);
  assert.equal(board.ark.site.W, 64);
  assert.ok(board.ark.site.H >= MEGAPROJECTS.ark.abyssDepth);
  assert.equal(board.ark.consortium[0].name, 'Mr. Gray');
  const r2 = board.startArk({ ...tableLead(), id: 99, guest: { name: 'The Admiral' } });
  assert.ok(r2.joined);
  assert.equal(board.ark.consortium.length, 2);
});

test('the Ark checklist: Abyss depth, Governance Hall, Schoolhouse, 200 beds', () => {
  const ledger = new Ledger({ startingCash: 1e12 });
  const board = new MegaprojectBoard({ ledger, isUnlocked: unlockedAll, siteOpts: { surveyed: true } });
  board.startArk(tableLead());
  const ark = board.ark;
  const s = ark.site;
  let c = ark.checklist();
  assert.equal(c.done, false);
  assert.equal(c.items.find((i) => i.id === 'width').done, true);
  // a shaft to the Abyss
  for (let y = 0; y <= 121; y++) { s.dig(0, y); s.dig(1, y); s.build('spine', 0, y); s.build('spine', 1, y); }
  // a 12-wide hall at y 1..3 with a table and six chairs; a schoolroom at y 5..7
  s.digRect(2, 0, 15, 4); s.buildRect('wall', 2, 0, 15, 0); s.buildRect('wall', 2, 4, 15, 4); s.buildRect('wall', 15, 1, 15, 3);
  s.place('dining_table', 3, 3); for (const x of [7, 8, 9, 10, 11, 12]) s.place('dining_chair', x, 3);
  s.digRect(2, 5, 15, 8); s.buildRect('wall', 2, 8, 15, 8); s.buildRect('wall', 15, 5, 15, 7);
  for (const x of [2, 4, 6, 8]) s.place('desk', x, 7); s.place('bookshelf', 11, 7);
  s.finishAll();
  c = ark.checklist();
  assert.equal(c.items.find((i) => i.id === 'abyss').done, true);
  assert.equal(c.items.find((i) => i.id === 'governance_hall').done, true);
  assert.equal(c.items.find((i) => i.id === 'schoolhouse').done, true);
  assert.equal(c.items.find((i) => i.id === 'occupants').done, false);
  assert.match(ark.handOver().reason, /Sleeps 200/);
});

test('Compound: three sites, tunnels, flooding below the water table, pooled days', () => {
  const ledger = new Ledger({ startingCash: 1e12 });
  const board = new MegaprojectBoard({ ledger, isUnlocked: (id) => id === 'compound', seed: 3 });
  assert.match(new MegaprojectBoard().startCompound().reason, /4:20/);
  const r = board.startCompound();
  assert.ok(r.ok);
  const cp = board.compound;
  assert.deepEqual(Object.keys(cp.sites), ['A', 'B', 'C']);
  assert.equal(cp.groups().length, 3); // nothing linked yet
  const cash = ledger.cash;
  cp.digTunnel('AB', 8);
  cp.digTunnel('BC', 30);
  assert.ok(ledger.cash < cash);
  assert.ok(cp.tunnelCost(30) > cp.tunnelCost(8));
  assert.equal(cp.groups().length, 1);
  // the shallow tunnel never floods; the deep one eventually does
  let flooded = false;
  for (let w = 0; w < 200 && !flooded; w++) { cp.week(); flooded = cp.tunnel('BC').state === 'flooded'; assert.equal(cp.tunnel('AB').state, 'open'); }
  assert.ok(flooded);
  assert.equal(cp.groups().length, 2);
  assert.ok(cp.repairTunnel('BC').ok);
  assert.equal(cp.groups().length, 1);
});

test('Compound tunnels to a besieged site can be breached', () => {
  const cp = new Compound({ seed: 5 });
  cp.digTunnel('AB', 6);
  cp.besieged.add('A');
  let breached = false;
  for (let w = 0; w < 100 && !breached; w++) { cp.week(); breached = cp.tunnel('AB').state === 'breached'; }
  assert.ok(breached);
});

test('save and load keeps both projects', () => {
  const board = new MegaprojectBoard({ isUnlocked: unlockedAll, siteOpts: { surveyed: true } });
  board.startCompound(); board.compound.digTunnel('AB', 20);
  board.startArk(tableLead()); board.ark.site.dig(5, 0);
  const copy = new MegaprojectBoard({ isUnlocked: unlockedAll, siteOpts: { surveyed: true } });
  copy.load(JSON.parse(JSON.stringify(board)));
  assert.equal(copy.compound.tunnel('AB').depth, 20);
  assert.equal(copy.ark.consortium[0].name, 'Mr. Gray');
  assert.equal(copy.ark.site.W, 64);
});
