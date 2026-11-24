import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CrisisSystem, DOMINO_LINKS, BREACH } from '../src/crisis/breach.js';
import { Pushback } from '../src/pushback/pushback.js';
import { Ledger } from '../src/ledger/ledger.js';
import { DoomClock } from '../src/doomclock/doomclock.js';

const TIPS = { pandemic: 90, climate: 90, unrest: 90, markets: 90, war: 90 };

function world({ tips = TIPS, shelters = [] } = {}) {
  const ledger = new Ledger({ startingCash: 100_000_000 });
  const pb = new Pushback({ ledger });
  const clock = new DoomClock();
  const cs = new CrisisSystem({ tips, pushback: pb, doomClock: clock, ledger, shelters: () => shelters });
  return { ledger, pb, clock, cs };
}

test('hidden tipping points roll at 90 + (-8..+4)', () => {
  const seen = new Set();
  for (let seed = 1; seed < 400; seed++) {
    const cs = new CrisisSystem({ seed });
    for (const t of Object.values(cs.tracks)) {
      assert.ok(t.tipRolled >= 82 && t.tipRolled <= 94, String(t.tipRolled));
      seen.add(t.tipRolled);
    }
  }
  assert.equal(seen.size, 13); // every value 82..94 occurs
  const cs = new CrisisSystem({ seed: 5 });
  assert.deepEqual(cs.visibleTip('war'), { range: [82, 94] }); // hidden until revealed
});

test('the domino map has 10 links, every pair of the five tracks once', () => {
  assert.equal(DOMINO_LINKS.length, 10);
  assert.equal(new Set(DOMINO_LINKS.map(([a, b]) => [a, b].sort().join('-'))).size, 10);
});

test('breach auto-pauses and opens a 6, then 4, then 3-week window', () => {
  const { cs } = world();
  let paused = null;
  cs.on('pause', (e) => { paused = e; });
  cs.setTension('unrest', 90);
  assert.equal(cs.tracks.unrest.state, 'breach');
  assert.deepEqual(paused, { reason: 'breach', track: 'unrest' });
  assert.equal(cs.tracks.unrest.window.weeksLeft, 6);
  // government 25 + three executives 60 + four Everything Is Fine 16 = 101
  cs.contribute('unrest', 'government');
  for (const exec of ['ruth', 'june', 'theo']) cs.contribute('unrest', 'heroics', { exec });
  for (let i = 0; i < 4; i++) cs.contribute('unrest', 'calming');
  assert.equal(cs.tracks.unrest.state, 'locked');
  for (let i = 0; i < 3; i++) cs.advanceWeek();
  cs.setTension('unrest', 100);
  assert.equal(cs.tracks.unrest.window.weeksLeft, 4);
});

test('containment op costs $10M x breach count', () => {
  const { cs, ledger } = world();
  cs.setTension('pandemic', 95);
  assert.equal(cs.sourceOffer('pandemic', 'op').cash, 10_000_000);
  cs.setTension('war', 95);
  assert.equal(cs.sourceOffer('war', 'op').cash, 20_000_000);
  const cash = ledger.cash;
  cs.contribute('war', 'op');
  assert.equal(ledger.cash, cash - 20_000_000);
  assert.equal(cs.contribute('war', 'op'), null); // one op per track at a time
});

test('each breach week: +2 heat, -2 board confidence, panic premium doubled', () => {
  const { cs, pb } = world();
  pb.heat = 10;
  assert.equal(cs.panicMultiplier, 1);
  cs.setTension('markets', 92);
  assert.equal(cs.panicMultiplier, 2);
  const conf = cs.boardConfidence;
  cs.advanceWeek();
  cs.advanceWeek();
  assert.equal(pb.heat, 14);
  assert.equal(cs.boardConfidence, conf - 4);
});

test('successful containment: tension 60 and locked 3 weeks, scar -3, exact tipping point revealed', () => {
  const { cs, clock } = world();
  cs.setTension('climate', 91);
  cs.contribute('climate', 'government'); // 25
  for (const exec of ['ruth', 'june', 'theo']) cs.contribute('climate', 'heroics', { exec }); // +60 = 85
  for (let i = 0; i < 3; i++) cs.contribute('climate', 'calming'); // +12 = 97
  assert.equal(cs.tracks.climate.state, 'breach');
  cs.contribute('climate', 'calming'); // +4 -> 100 (capped)
  const t = cs.tracks.climate;
  assert.equal(t.state, 'locked');
  assert.equal(t.tension, 60);
  assert.equal(t.scars, 1);
  assert.equal(cs.tippingPoint('climate'), 90 - 3 - 1.25); // scar -3; fragility -1.25 (brink -0.25, contained -1)
  assert.deepEqual(cs.visibleTip('climate'), { exact: cs.tippingPoint('climate') });
  assert.equal(clock.breachesContained, 1);
  cs.addTension('climate', 30); // locked: can't be pushed up
  assert.equal(t.tension, 60);
  cs.advanceWeek(); cs.advanceWeek(); cs.advanceWeek();
  assert.equal(t.state, 'calm');
  cs.addTension('climate', 5);
  assert.equal(t.tension, 65);
  assert.equal(cs.paused, false);
});

test('failed containment: pinned at 100 and linked tracks shoved +15/+8/+4', () => {
  const { cs, clock } = world();
  for (const id of ['pandemic', 'climate', 'unrest', 'war']) cs.setTension(id, 20);
  cs.setTension('markets', 90);
  for (let i = 0; i < 6; i++) cs.advanceWeek();
  assert.equal(cs.tracks.markets.state, 'collapsed');
  assert.equal(cs.tracks.markets.tension, 100);
  assert.equal(cs.tracks.pandemic.tension, 35); // strong
  assert.equal(cs.tracks.unrest.tension, 35); // strong
  assert.equal(cs.tracks.war.tension, 35); // strong
  assert.equal(cs.tracks.climate.tension, 28); // medium
  cs.setTension('markets', 10);
  assert.equal(cs.tracks.markets.tension, 100); // pinned
  assert.equal(clock.collapses.length, 1);
});

test('domino spillover can trigger the next breach', () => {
  const { cs } = world();
  cs.setTension('unrest', 80);
  let breached = [];
  cs.on('breach', (e) => breached.push(e.track));
  cs.setTension('markets', 90);
  for (let i = 0; i < 6; i++) cs.advanceWeek();
  assert.deepEqual(breached, ['markets', 'unrest']); // 80 + 15 = 95 >= tipping point (lowered by fragility)
});

test('shelter-in-place: pass +2 reputation; fail -5 reputation and +15 leverage', () => {
  const good = { id: 'a', name: 'Survival bunker', owner: 'Vance', occupants: 8, rooms: ['mil_scrubber', 'water_recycler', 'hydroponics'], sold: true };
  const bad = { id: 'b', name: 'Luxury bunker', owner: 'Okoro', occupants: 8, rooms: ['gold_taps', 'cryo_pod', 'wine_cellar'], sold: true };
  const { cs, pb } = world({ shelters: [good, bad] });
  pb.onSale({ client: 'Vance', price: 1 });
  pb.onSale({ client: 'Okoro', price: 1 });
  const lev = pb.clients[1].leverage;
  cs.setTension('pandemic', 95);
  assert.equal(cs.reputation, 50 + 2 - 5);
  assert.equal(pb.clients[1].leverage, lev + 15);
  assert.equal(pb.clients[0].leverage, 10);
});

// GDD: "A breach, week by week". The Bloom breaches; Fungicide Airdrop (the containment op, $10M) and a crash
// research program launch in week 1. Containment reads 15, 70, 85, then 100 in week 4.
test('replay: the GDD breach week by week (15, 70, 85, 100)', () => {
  const ledger = new Ledger({ startingCash: 100_000_000 });
  const pb = new Pushback({ ledger });
  const clock = new DoomClock();
  let rp = 200;
  const cs = new CrisisSystem({ tips: { ...TIPS, pandemic: 89 }, pushback: pb, doomClock: clock, ledger,
    research: { level: () => 2, spend: (n) => (rp >= n ? ((rp -= n), true) : false) } });
  cs.setTension('pandemic', 87);
  cs.addTension('pandemic', 3.3); // 90.3 >= 89 (lowered by fragility): BREACH, 6-week window
  const t = cs.tracks.pandemic;
  assert.equal(t.state, 'breach');
  assert.equal(t.window.weeksLeft, 6);
  const cash0 = ledger.cash;
  cs.contribute('pandemic', 'op');
  cs.contribute('pandemic', 'research');
  assert.equal(ledger.cash, cash0 - 10_000_000);
  cs.advanceWeek(); // week 1
  assert.equal(t.window.bar, 15);
  cs.advanceWeek(); // week 2: the airdrop lands
  assert.equal(t.window.bar, 70);
  cs.advanceWeek(); // week 3
  assert.equal(t.window.bar, 85);
  cs.advanceWeek(); // week 4: the crash program finishes the job
  assert.equal(t.state, 'locked');
  assert.equal(t.tension, 60);
  assert.equal(rp, 200 - 4 * 40);
  assert.equal(t.revealed, true);
  assert.equal(clock.breachesContained, 1);
});

test('containment op: paid at launch, +40 lands two weeks later', () => {
  const { cs } = world();
  cs.setTension('war', 95);
  cs.contribute('war', 'op');
  assert.equal(cs.tracks.war.window.bar, 0);
  assert.equal(cs.sourceOffer('war', 'op').blocked, 'Op already under way');
  cs.advanceWeek();
  assert.equal(cs.tracks.war.window.bar, 0);
  cs.advanceWeek();
  assert.equal(cs.tracks.war.window.bar, 40);
  assert.equal(cs.sourceOffer('war', 'op').blocked, null); // a second op may follow
});

test('crash research: +15 a week for 40 RP, needs R&D level 2, stops when RP runs out', () => {
  let level = 1;
  let rp = 50;
  const cs = new CrisisSystem({ tips: TIPS, research: { level: () => level, spend: (n) => (rp >= n ? ((rp -= n), true) : false) } });
  cs.setTension('markets', 95);
  assert.equal(cs.sourceOffer('markets', 'research').blocked, 'Needs R&D level 2');
  assert.equal(cs.contribute('markets', 'research'), null);
  level = 2;
  cs.contribute('markets', 'research');
  cs.advanceWeek();
  assert.equal(cs.tracks.markets.window.bar, 15);
  assert.equal(rp, 10);
  cs.advanceWeek(); // only 10 RP left: the program stops
  assert.equal(cs.tracks.markets.window.bar, 15);
  assert.equal(cs.tracks.markets.window.program, false);
});

test('calming schemes on the breached track give half their momentum (Everything Is Fine +4)', () => {
  const { cs, pb, ledger } = world();
  pb.heat = 20;
  cs.setTension('climate', 95);
  const cash = ledger.cash;
  cs.contribute('climate', 'calming');
  assert.equal(cs.tracks.climate.window.bar, 4);
  assert.equal(ledger.cash, cash - 1_000_000);
  assert.equal(pb.heat, 18);
  assert.equal(cs.calmingScheme('climate', -15, 'Peace Summit'), 7.5);
  assert.equal(cs.tracks.climate.window.bar, 11.5);
  assert.equal(cs.calmingScheme('war', -8), 0); // war isn't breached
});

test('government partnership: +25 once per breach, needs reputation 50+, heat -5', () => {
  const { cs, pb } = world();
  pb.heat = 30;
  cs.reputation = 49;
  cs.setTension('unrest', 95);
  assert.equal(cs.contribute('unrest', 'government'), null);
  cs.reputation = 50;
  assert.equal(cs.contribute('unrest', 'government'), 25);
  assert.equal(pb.heat, 30 - 5 + 0);
  assert.equal(cs.contribute('unrest', 'government'), null);
});

test('executive heroics: +20, once per executive per campaign; Theo\'s dirty fix costs heat +10', () => {
  const { cs, pb } = world();
  pb.heat = 10;
  cs.setTension('unrest', 95);
  cs.contribute('unrest', 'heroics', { exec: 'theo' });
  assert.equal(cs.tracks.unrest.window.bar, 20);
  assert.equal(pb.heat, 20);
  assert.equal(cs.contribute('unrest', 'heroics', { exec: 'theo' }), null);
  assert.equal(cs.contribute('unrest', 'heroics', { exec: 'ruth' }), 40);
  // a later breach elsewhere: only June is left
  cs.setTension('war', 95);
  assert.deepEqual(cs.sourceOffer('war', 'heroics').execs, ['june']);
  cs.contribute('war', 'heroics');
  assert.equal(cs.sourceOffer('war', 'heroics').blocked, 'No executive left to step in');
});

test('config numbers match the ticket', () => {
  assert.deepEqual(BREACH.windowWeeks, [6, 4, 3]);
  assert.deepEqual(BREACH.shove, { strong: 15, medium: 8, weak: 4 });
  assert.deepEqual(BREACH.recovery, { tension: 60, lockWeeks: 3 });
  assert.equal(BREACH.sources.op.costPerBreach, 10_000_000);
  const S = BREACH.sources;
  assert.deepEqual([S.op.points, S.op.delayWeeks, S.research.pointsPerWeek, S.research.rpPerWeek, S.research.rdLevel, S.calming.points, S.government.points, S.government.minReputation, S.government.heat, S.heroics.points],
    [40, 2, 15, 40, 2, 4, 25, 50, -5, 20]);
});
