import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Company, TIERS } from '../src/company/company.js';
import { Ledger } from '../src/ledger/ledger.js';
import { BunkerSite } from '../src/shelter/bunker.js';
import { MONEY } from '../src/config/tuning.js';

const M = 1_000_000;
const [L2, L3] = MONEY.departmentLevelsM.map((m) => m * M);

test('Startup: 1 site, 2 crews, department cap 2', () => {
  const co = new Company();
  assert.equal(co.tier.name, 'Startup');
  assert.equal(co.siteCap, 1);
  assert.equal(co.crewCap, 2);
  assert.equal(co.cap, 2);
  assert.equal(co.crews(5), 2, 'crews beyond the tier cap sit idle');
  assert.equal(TIERS.length, 5);
});

test('the cap is enforced: Engineering can reach 2 but not 3 at Startup', () => {
  const ledger = new Ledger({ startingCash: L2 + L3 });
  const co = new Company({ ledger });
  assert.equal(co.level('engineering'), 1);
  assert.deepEqual(co.levelUp('engineering'), { ok: true, level: 2, cost: L2 });
  assert.equal(ledger.cash, L3, 'enough left for level 3, so only the cap can refuse it');
  const r = co.levelUp('engineering');
  assert.equal(r.ok, false);
  assert.match(r.reason, /Startup cap: level 2/);
  co.setTier('boutique');
  assert.equal(co.levelUp('engineering').ok, true, 'Boutique raises the cap to 3');
});

test('departments open by tier and by play time', () => {
  let minutes = 0;
  const co = new Company({ getPlayMinutes: () => minutes });
  assert.equal(co.isOpen('sales'), true);
  assert.equal(co.isOpen('special'), false);
  assert.match(co.blocker('special'), /0:25/);
  minutes = 30;
  assert.equal(co.isOpen('special'), true);
  assert.match(co.blocker('rnd'), /Boutique/);
  assert.equal(co.level('rnd'), 0);
});

test('levelling Engineering speeds crews by 15%: a dig finishes sooner', () => {
  const dayAt = (level) => {
    const co = new Company({ ledger: new Ledger({ startingCash: 1e9 }) });
    if (level > 1) co.levelUp('engineering');
    const site = new BunkerSite({ surveyed: true, crewSpeed: () => co.crewSpeed });
    site.dig(5, 0);
    const job = site.jobs[0];
    let t = 0;
    while (site.jobs.length && t < 10_000) { site.tick(0.1); t += 0.1; }
    return { seconds: t, jobDays: job.days };
  };
  assert.equal(new Company().crewSpeed, 1);
  const base = dayAt(1);
  const eng = dayAt(2);
  assert.ok(eng.seconds < base.seconds, `${eng.seconds} < ${base.seconds}`);
  assert.ok(Math.abs(base.seconds / eng.seconds - 1.15) < 0.08, `ratio ${(base.seconds / eng.seconds).toFixed(3)}`);
});

test('save/load', () => {
  const co = new Company({ ledger: new Ledger({ startingCash: 1e9 }) });
  co.levelUp('sales');
  const c2 = new Company();
  c2.load(JSON.parse(JSON.stringify(co)));
  assert.equal(c2.level('sales'), 2);
});

test('#72/#91: level-ups cost the GDD $2/4/8/16M', () => {
  const co = new Company({ ledger: new Ledger({ startingCash: 1e9 }) });
  co.setTier('last_resort');
  const costs = [];
  for (let i = 0; i < 4; i++) { costs.push(co.levelCost('engineering')); co.levelUp('engineering'); }
  assert.deepEqual(costs, [2 * M, 4 * M, 8 * M, 16 * M]);
  assert.deepEqual(costs, MONEY.departmentLevelsM.map((m) => m * M));
  assert.equal(co.level('engineering'), 5);
});

test('#72: each Engineering level adds a crew (and its slot); R&D adds 3 RP a week per level', () => {
  const co = new Company({ ledger: new Ledger({ startingCash: 1e9 }), getPlayMinutes: () => 60 });
  assert.equal(co.crews(2), 2);
  co.levelUp('engineering');
  assert.equal(co.extraCrews, 1);
  assert.equal(co.crewCap, 3);
  assert.equal(co.crews(2), 3);
  assert.equal(co.rpPerWeek, 0, 'R&D opens at Boutique');
  co.setTier('boutique');
  assert.equal(co.rpPerWeek, 3);
  co.levelUp('rnd');
  assert.equal(co.rpPerWeek, 6);
});

test('#72: a live build with Engineering 2 gets 2.3x the work done (15% faster crews, plus one)', () => {
  const work = (co) => {
    const site = new BunkerSite({ surveyed: true, crews: () => co.crews(1), crewSpeed: () => co.crewSpeed });
    for (let x = 0; x < 24; x++) site.dig(x, 0);
    const left = () => site.jobs.reduce((s, j) => s + (j.days - j.progress), 0);
    const l0 = left();
    site.tick(5);
    return l0 - left();
  };
  const co = new Company({ ledger: new Ledger({ startingCash: 1e9 }) });
  const before = work(co);
  co.levelUp('engineering');
  const after = work(co);
  assert.ok(Math.abs(after / before - 2.3) < 0.05, `${after / before}`);
});

// ---------- the Inspector and the scapegoat (#151) ----------
import { TUNING } from '../src/config/tuning.js';
import { Pushback } from '../src/pushback/pushback.js';
import { MapSales } from '../src/worldmap/sales.js';
import { LeadMarket } from '../src/demand/demand.js';

const richCompany = () => {
  const ledger = new Ledger({ startingCash: 500_000_000 });
  const co = new Company({ ledger, getPlayMinutes: () => 200 });
  co.setTier('firm');
  return { ledger, co };
};

test('the Inspector needs Sales level 3, then charges $0.2M per walkthrough', () => {
  const { ledger, co } = richCompany();
  assert.match(co.setInspector(true).reason, /Sales level 3/);
  assert.equal(co.walkthrough('Pod'), false);
  co.levelUp('sales'); co.levelUp('sales');
  assert.equal(co.level('sales'), 3);
  assert.equal(co.setInspector(true).ok, true);
  const cash = ledger.cash;
  assert.equal(co.walkthrough('Pod'), true);
  assert.equal(ledger.cash, cash - TUNING.inspector.costPerWalkthrough);
  assert.equal(ledger.entries.at(-1).label, 'Inspector walkthrough: Pod');
  co.setInspector(false);
  assert.equal(co.walkthrough('Pod'), false);
});

test('inspected clients gain leverage half as fast', () => {
  const pb = new Pushback({ seed: 1 });
  pb.heat = 60;
  pb.onSale({ client: 'Plain', price: 1 });
  pb.onSale({ client: 'Inspected', price: 1, inspected: true });
  const [a, b] = pb.clients.map((c) => c.leverage);
  pb.endQuarter({ quarter: 1, profit: 0 });
  const growth = pb.clients.map((c, i) => c.leverage - [a, b][i]);
  assert.ok(growth[0] > 0);
  assert.ok(Math.abs(growth[1] - growth[0] * TUNING.inspector.leverageGrowth) <= 1, JSON.stringify(growth));
});

test('a handed-over shelter carries the inspection to its buyer', () => {
  const market = new LeadMarket({ seed: 2 });
  const pb = new Pushback({ seed: 1 });
  const sales = new MapSales({ market, pushback: pb });
  const s = sales.addFinished({ name: 'Inspected Pod', rooms: ['bunk'], inspected: true });
  market.addLeads('nam', 1);
  const rec = sales.sell('nam', s.id);
  assert.equal(rec.inspected, true);
  assert.equal(pb.clients.at(-1).inspected, true);
});

test('the scapegoat: once per campaign, heat -40, department -2 levels, other heads -15 loyalty (Marcus -25)', () => {
  const { co } = richCompany();
  for (let i = 0; i < 3; i++) co.levelUp('engineering');
  assert.equal(co.level('engineering'), 4);
  const pb = new Pushback({ seed: 1 });
  pb.heat = 70;
  const start = TUNING.loyalty.start;
  const r = co.scapegoat('engineering', { pushback: pb });
  assert.equal(r.ok, true);
  assert.equal(r.head, 'Ruth Abernathy');
  assert.equal(pb.heat, 30);
  assert.equal(co.level('engineering'), 2);
  assert.equal(co.loyalty.sales, start - 15);
  assert.equal(co.loyalty.legal, start - 25);
  assert.equal(co.loyalty.engineering, start, 'the new acting head starts fresh');
  assert.notEqual(co.headOf('engineering'), 'Ruth Abernathy');
  assert.match(co.scapegoat('sales', { pushback: pb }).reason, /Already used/);
  // a level-1 department never drops below 1; heat never below 0
  const { co: c2 } = richCompany();
  const p2 = new Pushback({ seed: 1 });
  p2.heat = 10;
  c2.scapegoat('sales', { pushback: p2 });
  assert.equal(c2.level('sales'), 1);
  assert.equal(p2.heat, 0);
});

test('the Inspector and the scapegoat are saved', () => {
  const { co } = richCompany();
  co.levelUp('sales'); co.levelUp('sales');
  co.setInspector(true);
  co.walkthrough('x');
  co.scapegoat('special', { pushback: new Pushback({ seed: 1 }) });
  const again = new Company({ getPlayMinutes: () => 200 });
  again.load(JSON.parse(JSON.stringify(co.toJSON())));
  assert.equal(again.inspectorHired, true);
  assert.equal(again.inspections, 1);
  assert.equal(again.scapegoated.head, 'Theo Lisk');
  assert.deepEqual(again.loyalty, co.loyalty);
});
