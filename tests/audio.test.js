import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUSIC, SFX, midnightTimes } from '../src/audio/synth.js';
import { wireAudio } from '../src/audio/audio.js';
import { Pushback } from '../src/pushback/pushback.js';
import { Ledger } from '../src/ledger/ledger.js';

test('tension layers are silent when calm and all in at the edge', () => {
  assert.deepEqual(MUSIC.layers(10), { pulse: 0, drone: 0, alarm: 0 });
  const edge = MUSIC.layers(95);
  assert.equal(edge.pulse, 1);
  assert.equal(edge.drone, 1);
  assert.equal(edge.alarm, 1);
});

test('layers and tempo only ever rise with crisis', () => {
  let prev = MUSIC.layers(0);
  let prevTempo = MUSIC.tempo(0);
  for (let c = 1; c <= 100; c++) {
    const l = MUSIC.layers(c);
    for (const k of Object.keys(l)) assert.ok(l[k] >= prev[k]);
    assert.ok(MUSIC.tempo(c) >= prevTempo);
    prev = l;
    prevTempo = MUSIC.tempo(c);
  }
  assert.equal(MUSIC.tempo(0), 92);
  assert.equal(MUSIC.tempo(100), 120);
});

test('Midnight stinger: twelve accelerating tolls, then the boom', () => {
  const { tolls, boom } = midnightTimes();
  assert.equal(tolls.length, 12);
  for (let i = 2; i < 12; i++) assert.ok(tolls[i] - tolls[i - 1] <= tolls[i - 1] - tolls[i - 2] + 1e-9);
  assert.ok(boom > tolls[11]);
});

test('every event the game fires has a sound', () => {
  for (const k of ['place', 'sell', 'scheme', 'heatWarning', 'raid', 'runaway', 'leverage', 'boardMiss', 'boardMet']) assert.equal(typeof SFX[k], 'function');
});

test('wireAudio maps builds, sales, schemes, heat and pushback events to sounds and tracks crisis', () => {
  const played = [];
  const fake = { crisis: 0, play: (n) => played.push(n), setCrisis(c) { this.crisis = c; } };
  const ledger = new Ledger({ startingCash: 1_000_000 });
  const pb = new Pushback({ ledger });
  wireAudio(fake, { ledger, pushback: pb });

  ledger.record('builds', 'Air vent', -15_000);
  ledger.record('sales', 'Bunker', 200_000);
  pb.onSale({ client: 'X', price: 200_000 });
  ledger.record('schemes', 'Riots', -60_000);
  pb.onScheme({ label: 'Riots', heat: 40, tension: 30 }); // crosses the 35 "watched" heat line
  assert.deepEqual(played.slice(0, 4), ['place', 'sell', 'scheme', 'heatWarning']);
  assert.equal(fake.crisis, pb.tension);

  pb.onScheme({ label: 'More riots', heat: 15, tension: 0 }); // crosses 50: investigation
  assert.ok(played.filter((p) => p === 'heatWarning').length >= 2);

  pb.onScheme({ label: 'Everything', heat: 0, tension: 100 }); // runaway
  assert.ok(played.includes('runaway'));
});
