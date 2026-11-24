// #69: the Doom Clock fed by the six real roster tracks through the CrisisSystem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DoomClock } from '../src/doomclock/doomclock.js';
import { CrisisSystem } from '../src/crisis/breach.js';
import { CLASSIC_ROSTER, TRACK_BY_ID, rosterLinks } from '../src/world/tracks.js';
import { SchemeBoard } from '../src/schemes/schemes.js';
import { LeadMarket } from '../src/demand/demand.js';
import { Ledger } from '../src/ledger/ledger.js';

const TIPS = { atomic: 90, bloom: 88, superstorm: 92, optimizer: 90, hush: 86, pitchforks: 94 };

function world({ open = ['atomic', 'bloom'] } = {}) {
  const doom = new DoomClock();
  const crisis = new CrisisSystem({
    seed: 5, doomClock: doom, tips: TIPS, clockWeeks: true,
    tracks: CLASSIC_ROSTER.map((id) => ({ id, name: TRACK_BY_ID[id].name, open: false })),
    links: rosterLinks(CLASSIC_ROSTER).map((l) => [l.from, l.to, l.strength]),
  });
  for (const id of open) crisis.openTrack(id, { tension: 20 });
  return { doom, crisis };
}

/** Push a track over its tip and let the containment window run out. */
function collapse(crisis, id) {
  crisis.setTension(id, 100);
  assert.equal(crisis.tracks[id].state, 'breach');
  let n = 0;
  while (crisis.tracks[id].state === 'breach' && n++ < 10) crisis.advanceWeek();
  assert.equal(crisis.tracks[id].state, 'collapsed');
}

test('the clock hears only the open roster tracks, with no stand-in world track', () => {
  const { doom, crisis } = world();
  assert.deepEqual(Object.keys(doom.tensions).sort(), ['atomic', 'bloom']);
  assert.equal(doom.tensionSum, 40);
  crisis.addTension('hush', 30); // closed: ignored
  assert.equal(crisis.tracks.hush.tension, 0);
  crisis.openTrack('hush', { tension: 20 });
  assert.equal(doom.tensionSum, 60);
  assert.equal(doom.minutes, 15 - 60 / 40);
});

test('every crisis week pushes the open tensions and tips and advances the clock a week', () => {
  const { doom, crisis } = world();
  crisis.tracks.atomic.tension = 50; // moved without telling anyone
  crisis.advanceWeek();
  assert.equal(doom.tensions.atomic, 50);
  assert.equal(doom.week, 1);
});

test('a real first Brink drops the floor a quarter minute, once per track', () => {
  const { doom, crisis } = world();
  crisis.setTension('atomic', 81); // tip 90, Brink from 80
  assert.equal(crisis.tracks.atomic.state, 'brink');
  assert.equal(doom.floor, 14.75);
  crisis.setTension('atomic', 60);
  crisis.setTension('atomic', 82);
  assert.equal(doom.floor, 14.75);
});

test('a collapse moves the floor 4 minutes and every tip drops by 4, unopened tracks included', () => {
  const { doom, crisis } = world();
  const before = Object.fromEntries(CLASSIC_ROSTER.map((id) => [id, crisis.tippingPoint(id)]));
  const floor0 = doom.floor;
  collapse(crisis, 'bloom');
  const brinkDrop = doom.history.filter((h) => h.reason === 'brink').reduce((s, h) => s + h.drop, 0);
  assert.equal(doom.history.filter((h) => h.reason === 'collapse')[0].drop, 4);
  assert.equal(doom.floor, floor0 - 4 - brinkDrop);
  for (const id of CLASSIC_ROSTER) {
    if (id === 'bloom') continue;
    assert.equal(before[id] - crisis.tippingPoint(id), 4 + brinkDrop, `${id} tip`);
  }
  // an unopened track opens already fragile: its rolled tip minus every floor minute lost so far
  assert.equal(crisis.tracks.superstorm.open, false);
  crisis.openTrack('superstorm');
  assert.equal(crisis.tippingPoint('superstorm'), TIPS.superstorm - doom.minutesLost);
});

test('the domino map is the roster\'s: a collapse shoves the linked roster tracks', () => {
  const { crisis } = world({ open: ['atomic', 'bloom', 'pitchforks'] });
  const shoves = [];
  crisis.on('domino', (e) => shoves.push(e));
  collapse(crisis, 'bloom'); // slot 2 -> slot 6 (medium, +8); breach weeks also spill momentum along the link
  assert.deepEqual(shoves.map((e) => [e.from, e.to, e.shove]), [['bloom', 'pitchforks', 8]]); // hush is closed here
  assert.ok(crisis.tracks.pitchforks.tension >= 8);
});

test('a second collapse starts the four-week Final Countdown, counted in real crisis weeks, then Midnight', () => {
  const { doom, crisis } = world({ open: ['atomic', 'bloom', 'superstorm'] });
  let midnight = null;
  doom.on('midnight', (e) => { midnight = e; });
  collapse(crisis, 'bloom');
  assert.equal(doom.finalCountdown, false);
  collapse(crisis, 'superstorm');
  assert.equal(doom.countdownWeeks, 4);
  for (let i = 0; i < 3; i++) crisis.advanceWeek();
  assert.equal(midnight, null);
  crisis.advanceWeek();
  assert.equal(midnight?.reason, 'countdown');
});

test('schemes push the roster track in their slot, and wait for it to open', () => {
  const { crisis } = world({ open: ['atomic'] });
  const ledger = new Ledger({ startingCash: 1_000_000 });
  const market = new LeadMarket({ seed: 2 });
  const schemes = new SchemeBoard({ crisis, market, ledger });
  const memo = schemes.available('lat').find((o) => o.scheme.id === 'memo');
  assert.equal(memo.track.id, 'bloom');
  assert.match(memo.reason, /hasn't opened/);
  crisis.openTrack('bloom', { tension: 20 });
  const r = schemes.run('memo', 'lat');
  assert.equal(r.track, 'bloom');
  assert.ok(crisis.tracks.bloom.tension > 20);
  // demand follows the roster tracks too: Fear rises on the track the scheme pushed
  market.week({ tensions: Object.fromEntries(Object.values(crisis.tracks).map((t) => [t.id, t.tension])) });
  market.week({ tensions: Object.fromEntries(Object.values(crisis.tracks).map((t) => [t.id, t.tension + (t.id === 'bloom' ? 10 : 0)])) });
  assert.ok(market.fear.bloom > 0);
});

test('the crisis system saves and loads, hidden rolls and all', () => {
  const { crisis } = world();
  crisis.setTension('atomic', 55);
  const data = JSON.parse(JSON.stringify(crisis.toJSON()));
  const { crisis: fresh } = world({ open: [] });
  fresh.load(data);
  assert.equal(fresh.tracks.atomic.tension, 55);
  assert.equal(fresh.tracks.atomic.open, true);
  assert.equal(fresh.tracks.hush.open, false);
  assert.equal(fresh.tippingPoint('bloom'), crisis.tippingPoint('bloom'));
});
