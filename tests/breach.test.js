import { TUNING } from '../src/config/tuning.js';
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
  cs.contribute('unrest', 'op'); cs.contribute('unrest', 'government'); cs.contribute('unrest', 'research'); cs.contribute('unrest', 'heroics');
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
  assert.equal(cs.contribute('war', 'op'), null); // one op per breach
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
  for (const k of ['op', 'government', 'research']) cs.contribute('climate', k); // 40 + 30 + 25 = 95
  assert.equal(cs.tracks.climate.state, 'breach');
  cs.contribute('climate', 'calming'); // +10 -> 100 (capped)
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
  assert.equal(cs.reputation, TUNING.reputation.start + 2 - 5);
  assert.equal(pb.clients[1].leverage, lev + 15);
  assert.equal(pb.clients[0].leverage, 10);
});

// A breach, week by week (built from the ticket's numbers; the GDD's own worked example is not in
// the repo yet, so this replays the same rules on a fixed scenario).
test('replay: a breach week by week, contained in week 4', () => {
  const { cs, pb, clock, ledger } = world({ tips: { ...TIPS, unrest: 86 } });
  pb.heat = 20;
  cs.setTension('unrest', 70);
  cs.addTension('unrest', 12); // 82: Brink (within 10 of 86 after fragility)
  assert.equal(cs.tracks.unrest.state, 'brink');
  assert.equal(clock.floor, 14.75);
  cs.addTension('unrest', 6); // 88 >= 86: BREACH, 6-week window, game paused
  const t = cs.tracks.unrest;
  assert.equal(t.state, 'breach');
  assert.equal(cs.paused, true);
  const conf0 = cs.boardConfidence;
  const cash0 = ledger.cash;

  // week 1: launch the containment op ($10M, +40)
  cs.contribute('unrest', 'op');
  cs.advanceWeek();
  assert.deepEqual([t.window.bar, t.window.weeksLeft, pb.heat, cs.boardConfidence], [40, 5, 22, conf0 - 2]);
  assert.equal(ledger.cash, cash0 - 10_000_000);
  // week 2: crash research program (+25), research is blocked meanwhile
  cs.contribute('unrest', 'research');
  cs.advanceWeek();
  assert.deepEqual([t.window.bar, t.window.weeksLeft, pb.heat, cs.researchBlocked], [65, 4, 24, true]);
  // week 3: two calming schemes (+10 each)
  cs.contribute('unrest', 'calming');
  cs.contribute('unrest', 'calming');
  cs.advanceWeek();
  assert.equal(t.window.bar, 85);
  // week 4: executive heroics (+15) closes it
  cs.contribute('unrest', 'heroics');
  assert.equal(t.state, 'locked');
  assert.equal(t.tension, 60);
  assert.equal(cs.paused, false);
  assert.equal(cs.researchBlocked, false);
  assert.equal(t.revealed, true);
  assert.equal(clock.floor, 13.75); // brink -0.25, contained -1
  assert.equal(cs.tippingPoint('unrest'), 86 - 3 - 1.25); // scar -3, fragility -1.25
});

test('config numbers match the ticket', () => {
  assert.deepEqual(BREACH.windowWeeks, [6, 4, 3]);
  assert.deepEqual(BREACH.shove, { strong: 15, medium: 8, weak: 4 });
  assert.deepEqual(BREACH.recovery, { tension: 60, lockWeeks: 3 });
  assert.equal(BREACH.sources.op.costPerBreach, 10_000_000);
});
