import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Company, TIERS } from '../src/company/company.js';
import { Ledger } from '../src/ledger/ledger.js';
import { BunkerSite } from '../src/shelter/bunker.js';

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
  const ledger = new Ledger({ startingCash: 1_000_000 });
  const co = new Company({ ledger });
  assert.equal(co.level('engineering'), 1);
  assert.deepEqual(co.levelUp('engineering'), { ok: true, level: 2, cost: 200_000 });
  assert.equal(ledger.cash, 800_000);
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

test('#72: level-ups cost the GDD $2/4/8/16M at the bunker price scale', () => {
  const co = new Company({ ledger: new Ledger({ startingCash: 1e9 }) });
  co.setTier('last_resort');
  const costs = [];
  for (let i = 0; i < 4; i++) { costs.push(co.levelCost('engineering')); co.levelUp('engineering'); }
  assert.deepEqual(costs, [200_000, 400_000, 800_000, 1_600_000]);
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
