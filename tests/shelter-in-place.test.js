// #66: shelter-in-place tests grade real shelters against the breached track's requirements.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CrisisSystem, defaultShelterTest, highlyExposed } from '../src/crisis/breach.js';
import { Pushback } from '../src/pushback/pushback.js';
import { CLASSIC_ROSTER, TRACK_BY_ID } from '../src/world/tracks.js';
import { APOCALYPSES } from '../src/midnight/engineered.js';
import { BunkerSite } from '../src/shelter/bunker.js';

const KEEP = { id: 'k', name: 'The Granite Keep', owner: 'Vance', region: 'mea', occupants: 8, sold: true, rooms: [], sealed: { daysSealed: 900, ratings: { seal: 4, blast: 4, security: 3, morale: 3 } } };
const FOLLY = { id: 'f', name: 'Marble Folly', owner: 'Okoro', region: 'mea', occupants: 8, sold: true, rooms: [], sealed: { daysSealed: 90, ratings: { seal: 1, blast: 1, security: 1, morale: 4 } } };
const FAR = { id: 'a', name: 'Alpine Retreat', owner: 'Lind', region: 'eur', occupants: 6, sold: true, rooms: [], sealed: { daysSealed: 10, ratings: { seal: 0, blast: 0 } } };
const NEAR = { id: 'n', name: 'Near Miss', owner: 'Hale', region: 'mea', occupants: 6, sold: true, rooms: [], sealed: { daysSealed: 700, ratings: { seal: 3, blast: 4, security: 2, morale: 2 } } };

function world(shelters, construction = []) {
  const pb = new Pushback({});
  for (const s of shelters) pb.onSale({ client: s.owner, price: 1 });
  const crisis = new CrisisSystem({
    seed: 2, pushback: pb, tips: { atomic: 90, bloom: 88, superstorm: 92, optimizer: 90, hush: 86, pitchforks: 94 },
    tracks: CLASSIC_ROSTER.map((id) => ({ id, name: TRACK_BY_ID[id].name, open: true })),
    shelters: () => shelters, construction: () => construction,
  });
  return { pb, crisis };
}

test('the test checks the contract\'s Days Sealed and the track\'s critical ratings', () => {
  const atomic = APOCALYPSES.atomic; // 730 days, blast 4, seal 3
  assert.equal(defaultShelterTest(KEEP, 'atomic').pass, true);
  const f = defaultShelterTest(FOLLY, 'atomic');
  assert.equal(f.pass, false);
  assert.ok(f.p < 0.5);
  assert.ok(f.why.some((w) => w.includes(`of ${atomic.days} days`)));
  const near = defaultShelterTest(NEAR, 'atomic');
  assert.equal(near.pass, false);
  assert.ok(near.p >= 0.5, 'a near miss is not a bad failure');
  // a contract can ask for less than the apocalypse's full duration
  assert.equal(defaultShelterTest({ ...NEAR, contract: { daysSealed: 365 } }, 'atomic').pass, true);
});

test('only shelters in the breached track\'s high-exposure regions are tested', () => {
  assert.equal(highlyExposed('mea', 'atomic'), true); // Old Capitals: Atomic Standoff high
  assert.equal(highlyExposed('eur', 'atomic'), false);
  const { crisis } = world([KEEP, { ...FAR }]);
  const seen = [];
  crisis.on('shelterTest', (r) => seen.push(r.shelter));
  crisis.setTension('atomic', 100);
  assert.deepEqual(seen, ['k']);
});

test('pass +2 reputation; fail -5 reputation, +15 leverage, and a bad failure loses occupants', () => {
  const folly = { ...FOLLY };
  const { pb, crisis } = world([{ ...KEEP }, folly]);
  const rep0 = crisis.reputation;
  const lev = pb.clients.map((c) => c.leverage);
  crisis.setTension('atomic', 100);
  assert.equal(crisis.reputation, rep0 + 2 - 5);
  assert.equal(pb.clients[0].leverage, lev[0]);
  assert.equal(pb.clients[1].leverage, lev[1] + 15);
  assert.ok(folly.occupants < 8 && folly.lostInBreaches > 0);
  const tests = crisis.tracks.atomic.window.shelterTests;
  assert.deepEqual(tests.map((t) => t.pass), [true, false]);
  assert.ok(crisis.log.some((l) => /Marble Folly .*FAILED/.test(l.text)));
});

test('a shelter still under construction in a hot region loses a week instead', () => {
  const site = new BunkerSite({ crews: () => 1 });
  site.surveyed = true;
  site.dig(1, 1);
  const before = site.jobs[0]?.progress ?? 0;
  const { crisis } = world([], [{ id: 'hq', name: 'Last Resort HQ', region: 'mea', delay: (d) => site.delay(d) }, { id: 'x', name: 'Far site', region: 'eur', delay: () => assert.fail('not exposed') }]);
  crisis.setTension('atomic', 100);
  assert.equal(site.stallDays, 7);
  site.tick(site.cfg.daySeconds * 7); // the lost week
  assert.equal(site.jobs[0]?.progress ?? 0, before);
  assert.deepEqual(crisis.tracks.atomic.window.shelterTests.map((t) => t.site), ['hq']);
});
