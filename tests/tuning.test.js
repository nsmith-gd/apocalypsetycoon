import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TUNING, GDD_CONSTANTS, DEMAND, BREACH, DOOM_CLOCK } from '../src/config/tuning.js';
import { LeadMarket, nextFear } from '../src/demand/demand.js';
import { CrisisSystem } from '../src/crisis/breach.js';
import { DoomClock } from '../src/doomclock/doomclock.js';

test('every row of the GDD tuning-constants table is in the tuning file', () => {
  const gdd = readFileSync(new URL('../gdd/current/gdd-full.md', import.meta.url), 'utf8');
  const section = gdd.slice(gdd.indexOf('## Tuning constants'), gdd.indexOf('## Balance targets'));
  const rows = [...section.matchAll(/^\| ([^|]+?) \| [^|]+ \| [^|]+ \|$/gm)].map((m) => m[1].trim()).filter((r) => r !== 'Constant' && !r.startsWith('---'));
  assert.equal(rows.length, 22);
  assert.deepEqual(GDD_CONSTANTS.map((c) => c.row), rows);
  for (const c of GDD_CONSTANTS) assert.ok(TUNING[c.key] !== undefined, `${c.row} -> TUNING.${c.key}`);
});

test('changing Fear decay in one place changes behaviour', () => {
  const run = () => {
    const m = new LeadMarket({ seed: 2 });
    m.week({ tensions: { pandemic: 10 } });
    m.week({ tensions: { pandemic: 40 } }); // fear rises with tension
    for (let i = 0; i < 4; i++) m.week({ tensions: { pandemic: 60 } }); // held flat: fear decays
    return { fear: m.fear.pandemic, leads: m.leads.length };
  };
  const before = run();
  const old = TUNING.fear.decayPerWeek;
  try {
    TUNING.fear.decayPerWeek = 0.5;
    assert.equal(DEMAND.fearDecay, 0.5, 'demand reads the table live');
    assert.ok(nextFear(100, 0, false) < 100 * (1 - old) + 1e-9);
    const after = run();
    assert.ok(after.fear < before.fear, `${after.fear} < ${before.fear}`);
  } finally {
    TUNING.fear.decayPerWeek = old;
  }
  assert.deepEqual(run(), before);
});

test('one constant feeds several systems: the fragility floor and starting reputation', () => {
  const old = { floor: TUNING.fragility.tippingFloor, rep: TUNING.reputation.start };
  try {
    TUNING.fragility.tippingFloor = 80;
    TUNING.reputation.start = 25;
    assert.equal(BREACH.tipMin, 80);
    assert.equal(DOOM_CLOCK.tippingFloor, 80);
    assert.equal(new DoomClock().cfg.tippingFloor, 80);
    assert.equal(new CrisisSystem({ seed: 1 }).reputation, 25);
  } finally {
    TUNING.fragility.tippingFloor = old.floor;
    TUNING.reputation.start = old.rep;
  }
});
