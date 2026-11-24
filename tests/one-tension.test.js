import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CrisisSystem } from '../src/crisis/breach.js';
import { Pushback } from '../src/pushback/pushback.js';
import { DoomClock } from '../src/doomclock/doomclock.js';
import { Ledger } from '../src/ledger/ledger.js';
import { researchCrisis } from '../src/schemes/schemes.js';

const TIPS = { pandemic: 90, climate: 90, unrest: 90, markets: 90, war: 90 };

function campaign() {
  const ledger = new Ledger({ startingCash: 100_000_000 });
  const pb = new Pushback({ ledger });
  const doom = new DoomClock();
  const crisis = new CrisisSystem({ tips: TIPS, pushback: pb, doomClock: doom, ledger });
  pb.useCrisis(crisis);
  return { ledger, pb, doom, crisis };
}

test('the Doom Clock hears only the crisis tracks: its total is their sum', () => {
  const { pb, doom, crisis } = campaign();
  crisis.setTension('pandemic', 40);
  crisis.setTension('war', 20);
  pb.onScheme({ label: 'old-style scheme', heat: 4, tension: 50 }); // no second meter to feed any more
  assert.deepEqual(Object.keys(doom.tensions).sort(), Object.keys(crisis.tracks).sort());
  assert.ok(!('world' in doom.tensions));
  const sum = Object.values(crisis.tracks).reduce((s, t) => s + t.tension, 0);
  assert.equal(sum, 60);
  assert.equal(doom.minutes, Math.min(doom.floor, 15 - sum / 40));
});

test('pushback reads tension from the hottest open crisis track, and cannot set its own', () => {
  const { pb, crisis } = campaign();
  crisis.setTension('climate', 55);
  crisis.setTension('markets', 30);
  assert.equal(pb.tension, 55);
  pb.tension = 99;
  pb.addTension(30, 'x');
  assert.equal(pb.tension, 55);
  pb.endQuarter({ quarter: 1, profit: 0 }); // no stand-in momentum or decay
  assert.equal(crisis.tracks.climate.tension, 55);
  assert.equal(pb.snapshot?.().tension ?? pb.tension, 55);
});

test('Fund relief calms the hottest crisis track; runaways are collapsed tracks', () => {
  const { pb, crisis } = campaign();
  crisis.setTension('unrest', 70);
  crisis.setTension('war', 50);
  const r = pb.fundRelief();
  assert.ok(r);
  assert.equal(crisis.tracks.unrest.tension, 56);
  assert.equal(crisis.tracks.war.tension, 50);
  assert.equal(pb.runaways, 0);
  crisis.setTension('war', 95);
  while (crisis.tracks.war.state === 'breach') crisis.advanceWeek();
  assert.equal(pb.runaways, 1);
});

test('research and the world view share the crisis tracks', () => {
  const { pb, crisis } = campaign();
  crisis.setTension('pandemic', 45);
  assert.ok(researchCrisis(crisis) > 0);
  assert.equal(pb.tension, 45);
});

test('without a crisis system the stand-in meter still runs (headless sims, pacing harness)', () => {
  const pb = new Pushback({ startingCash: 1e6 });
  const t0 = pb.tension;
  pb.onScheme({ label: 'x', tension: 10 });
  assert.equal(pb.tension, t0 + 10);
});
