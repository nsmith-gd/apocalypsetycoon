// #70: the Doom Clock striking or the Final Countdown ending takes the uncontrolled road to Midnight.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DoomClock } from '../src/doomclock/doomclock.js';
import { CrisisSystem } from '../src/crisis/breach.js';
import { CLASSIC_ROSTER, TRACK_BY_ID, rosterLinks } from '../src/world/tracks.js';
import { uncontrolledRoad, sealOrderClients, resolveUncontrolled, UNCONTROLLED } from '../src/midnight/uncontrolled.js';
import { APOCALYPSES, gradeFor } from '../src/midnight/engineered.js';
import { REGIONS } from '../src/demand/demand.js';

function world() {
  const doom = new DoomClock();
  const crisis = new CrisisSystem({
    seed: 3, doomClock: doom, clockWeeks: true, tips: { atomic: 90, bloom: 88, superstorm: 92, optimizer: 90, hush: 86, pitchforks: 94 },
    tracks: CLASSIC_ROSTER.map((id) => ({ id, name: TRACK_BY_ID[id].name, open: false })),
    links: rosterLinks(CLASSIC_ROSTER).map((l) => [l.from, l.to, l.strength]),
  });
  for (const id of CLASSIC_ROSTER) crisis.openTrack(id, { tension: 30 });
  return { doom, crisis };
}
const collapse = (crisis, id) => { crisis.setTension(id, 100); for (let i = 0; i < 8 && crisis.tracks[id].state === 'breach'; i++) crisis.advanceWeek(); };

const GOOD = { id: 's1', name: 'Deep Vault', owner: 'Vera Holt', occupants: 6, rooms: ['bunk', 'air_vent', 'water_tank', 'pantry', 'mil_scrubber', 'water_recycler', 'hydroponics'], sold: true, region: 'nam', sealed: { daysSealed: 2000, ratings: { seal: 5, blast: 5, security: 5, morale: 3 } } };
const GILDED = { id: 's2', name: 'Gold Grotto', owner: 'Chad Remington IV', occupants: 6, rooms: ['bunk', 'gold_taps', 'gold_taps', 'cryo_pod'], sold: true, region: 'eur', sealed: { daysSealed: 60, ratings: { seal: 1, blast: 1, security: 1, morale: 4 } } };

test('the Final Countdown road: the two collapsed tracks become a combined apocalypse', () => {
  const { doom, crisis } = world();
  let struck = null;
  doom.on('midnight', (e) => { struck = e; });
  collapse(crisis, 'bloom');
  collapse(crisis, 'atomic');
  assert.equal(doom.countdownWeeks, 4);
  for (let i = 0; i < 4; i++) crisis.advanceWeek();
  assert.equal(struck.reason, 'countdown');
  const road = uncontrolledRoad({ reason: struck.reason, crisis, doom });
  assert.deepEqual([...road.target].sort(), ['atomic', 'bloom']);
  assert.equal(road.apocalypse.combined, true);
  assert.equal(road.apocalypse.days, Math.max(APOCALYPSES.atomic.days, APOCALYPSES.bloom.days) + 180);
  assert.match(road.cause, /Final Countdown/);
});

test('the clock road: the hottest open track is the apocalypse that arrives', () => {
  const { doom, crisis } = world();
  crisis.setTension('superstorm', 75);
  const road = uncontrolledRoad({ reason: 'clock', crisis, doom });
  assert.equal(road.target, 'superstorm');
  assert.equal(road.apocalypse.name, APOCALYPSES.superstorm.name);
  assert.match(road.cause, /struck zero/);
  // alternates map onto the GDD apocalypse table too
  assert.equal(uncontrolledRoad({ reason: 'clock', doom: { tensions: { greygoo: 80 }, collapses: [] } }).apocalypse.name, APOCALYPSES.goo.name);
});

test('the Midnight sequence on the uncontrolled road: Seal Order, then graded one step down as Off the Rails', () => {
  const { doom, crisis } = world();
  const road = uncontrolledRoad({ reason: 'clock', crisis, doom });
  const pb = { clients: [{ name: 'Chad Remington IV', leverage: 80 }] };
  const clients = sealOrderClients({ sold: [GOOD, GILDED], pushback: pb, crisis, regions: REGIONS });
  assert.equal(clients.length, 2);
  assert.equal(clients[0].distance, UNCONTROLLED.distance.nam);
  assert.equal(clients[1].leverage, 80);
  const run = resolveUncontrolled({ road, shelters: [GOOD, GILDED], clients, world: { heat: 10, collapses: 0 }, seed: 4 });
  assert.equal(run.seal.length, 2);
  assert.ok(['on_time', 'late', 'lost'].includes(run.pickups.s1));
  const r = run.result;
  assert.equal(r.type, 'failed');
  assert.equal(r.road, 'uncontrolled');
  assert.equal(r.endingName, 'OFF THE RAILS');
  assert.equal(r.apocalypse.name, road.apocalypse.name);
  // graded one step down: the same survival share engineered would have graded higher
  assert.equal(r.grade.id, gradeFor(r.survivalRate, { uncontrolled: true }).id);
  assert.notEqual(r.grade.id, gradeFor(r.survivalRate, { engineered: true, uncontrolled: false }).id);
  // the gold taps don't help: the gilded shelter does worse than the deep vault
  const [g, gl] = r.shelters;
  assert.ok(g.survivors >= gl.survivors);
});
