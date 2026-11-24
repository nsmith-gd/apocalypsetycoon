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
