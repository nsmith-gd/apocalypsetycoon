import { TUNING } from '../src/config/tuning.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CrisisSystem, BREACH, slotLinks } from '../src/crisis/breach.js';
import { SLOT_LINKS, TRACK_BY_ID, CLASSIC_ROSTER, selectRoster } from '../src/world/tracks.js';
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

// The GDD domino map (#65): 6 tracks by slot, 10 directed links (docs/gdd-figures/04-domino-map.png).
const GDD_MAP = [
  ['atomic', 'pitchforks', 'strong'], ['pitchforks', 'atomic', 'medium'], ['optimizer', 'atomic', 'strong'], ['optimizer', 'pitchforks', 'medium'],
  ['atomic', 'superstorm', 'weak'], ['superstorm', 'bloom', 'medium'], ['superstorm', 'hush', 'strong'], ['bloom', 'hush', 'strong'],
  ['bloom', 'pitchforks', 'medium'], ['hush', 'pitchforks', 'strong'],
];
function slotWorld(roster = CLASSIC_ROSTER, tension = 20) {
  const tips = Object.fromEntries(roster.map((id) => [id, 90]));
  const cs = new CrisisSystem({ tips, tracks: roster.map((id) => ({ id, name: TRACK_BY_ID[id].name })) });
  for (const id of roster) cs.setTension(id, tension);
  return cs;
}
const spillsFrom = (cs, id) => {
  const out = [];
  const off = cs.on('spillover', (e) => { if (e.from === id) out.push([e.to, e.momentum]); });
  cs.advanceWeek();
  off();
  return out.sort();
};

test('the domino map is the GDD picture: 10 directed links by slot, every track feeds The Pitchforks', () => {
  assert.equal(SLOT_LINKS.length, 10);
  const classic = slotLinks(CLASSIC_ROSTER).map((l) => [l.from, l.to, l.strength]);
  assert.deepEqual(classic.map((l) => l.join()).sort(), GDD_MAP.map((l) => l.join()).sort());
  for (const id of CLASSIC_ROSTER.filter((x) => x !== 'pitchforks')) {
    // every road leads to The Pitchforks: directly, or through a track that does
    const reach = (from, seen = new Set()) => GDD_MAP.filter(([a]) => a === from).some(([, b]) => b === 'pitchforks' || (!seen.has(b) && reach(b, seen.add(b))));
    assert.ok(reach(id), id);
  }
  assert.deepEqual(new CrisisSystem().links, [], 'the old generic demo tracks have no slots, so no links');
});

test('breach spillover follows every link at its weight: +6 strong, +3 medium, +1.5 weak momentum a week', () => {
  const W = { strong: 6, medium: 3, weak: 1.5 };
  for (const from of CLASSIC_ROSTER) {
    const cs = slotWorld();
    cs.setTension(from, 95); // breach
    const expected = GDD_MAP.filter(([a]) => a === from).map(([, b, w]) => [b, W[w]]).sort();
    assert.deepEqual(spillsFrom(cs, from), expected, from);
  }
});

test('alternates inherit their slot\'s links: The Grey Goo spills exactly like The Bloom', () => {
  const goo = selectRoster({ mode: 'custom', picks: { 2: 'greygoo' } });
  const a = slotWorld(); a.setTension('bloom', 95);
  const b = slotWorld(goo); b.setTension('greygoo', 95);
  assert.deepEqual(spillsFrom(b, 'greygoo'), spillsFrom(a, 'bloom'));
  const kessler = selectRoster({ mode: 'custom', picks: { 4: 'kessler' } });
  const k = slotWorld(kessler); k.setTension('kessler', 95);
  assert.deepEqual(spillsFrom(k, 'kessler'), [['atomic', 6], ['pitchforks', 3]], 'Kessler Rain takes The Optimizer\'s links');
});

test('a Bloom breach pushes The Hush: momentum arrives and a quarter of it turns into tension each week', () => {
  const cs = slotWorld();
  cs.setTension('bloom', 95);
  cs.advanceWeek();
  assert.equal(cs.tracks.hush.momentum, 4.5); // +6, then 1.5 released
  assert.equal(cs.tracks.hush.tension, 21.5);
  cs.advanceWeek();
  assert.ok(cs.tracks.hush.tension > 21.5 && cs.tracks.hush.momentum > 4.5);
});

test('a collapsed track keeps spilling for good, doubled', () => {
  const cs = slotWorld();
  cs.setTension('bloom', 95);
  for (let i = 0; i < 6 && cs.tracks.bloom.state === 'breach'; i++) cs.advanceWeek();
  assert.equal(cs.tracks.bloom.state, 'collapsed');
  const after = spillsFrom(cs, 'bloom').filter(([to]) => cs.tracks[to].state !== 'collapsed');
  assert.deepEqual(after.find(([to]) => to === 'pitchforks'), ['pitchforks', 6]); // medium 3 x 2
});

test('breach auto-pauses and opens a 6, then 4, then 3-week window', () => {
  const { cs } = world();
  let paused = null;
  cs.on('pause', (e) => { paused = e; });
  cs.setTension('unrest', 90);
  assert.equal(cs.tracks.unrest.state, 'breach');
  assert.deepEqual(paused, { reason: 'breach', track: 'unrest' });
  assert.equal(cs.tracks.unrest.window.weeksLeft, 6);
  cs.reputation = 60;
  for (const exec of ['ruth', 'june', 'theo']) cs.contribute('unrest', 'heroics', { exec }); // 60
  cs.contribute('unrest', 'government'); // 85
  cs.tracks.unrest.window.bar = 96;
  cs.contribute('unrest', 'calming'); // +4 -> 100
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
  assert.match(cs.sourceOffer('war', 'op').reason, /under way/);
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
  cs.reputation = 60;
  cs.contribute('climate', 'government'); // 25
  for (const exec of ['ruth', 'june', 'theo']) cs.contribute('climate', 'heroics', { exec }); // 85
  assert.equal(cs.tracks.climate.state, 'breach');
  cs.tracks.climate.window.bar = 97;
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

test('failed containment: pinned at 100 and the tracks it links to are shoved +15 / +8 / +4', () => {
  const tips = Object.fromEntries(CLASSIC_ROSTER.map((id) => [id, 90]));
  const clock = new DoomClock();
  const cs = new CrisisSystem({ tips, doomClock: clock, tracks: CLASSIC_ROSTER.map((id) => ({ id, name: TRACK_BY_ID[id].name })) });
  for (const id of CLASSIC_ROSTER) cs.setTension(id, 10);
  const shoves = [];
  cs.on('domino', (e) => shoves.push([e.from, e.to, e.shove]));
  cs.setTension('atomic', 90);
  for (let i = 0; i < 6; i++) cs.advanceWeek();
  assert.equal(cs.tracks.atomic.state, 'collapsed');
  assert.equal(cs.tracks.atomic.tension, 100);
  assert.deepEqual(shoves.sort(), [['atomic', 'pitchforks', 15], ['atomic', 'superstorm', 4]]); // strong, weak; links are one-way
  assert.ok(!shoves.some(([, to]) => to === 'optimizer'), 'Optimizer feeds Atomic, not the other way round');
  cs.setTension('atomic', 10);
  assert.equal(cs.tracks.atomic.tension, 100); // pinned
  assert.equal(clock.collapses.length, 1);
});

test('a domino can trigger the next breach: a collapsing Bloom tips a hot Hush', () => {
  const cs = slotWorld();
  cs.setTension('hush', 70);
  const breached = [];
  cs.on('breach', (e) => breached.push(e.track));
  cs.setTension('bloom', 90);
  for (let i = 0; i < 6; i++) cs.advanceWeek();
  assert.deepEqual(breached.slice(0, 2), ['bloom', 'hush']);
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

  // week 1: launch the containment op ($10M, +40 in 2 weeks) and a crash research program (+15 a week)
  cs.contribute('unrest', 'op');
  cs.contribute('unrest', 'research');
  assert.equal(t.window.bar, 0); // nothing lands on purchase
  cs.advanceWeek();
  assert.deepEqual([t.window.bar, t.window.weeksLeft, pb.heat, cs.boardConfidence, cs.researchBlocked], [15, 5, 22, conf0 - 2, true]);
  assert.equal(ledger.cash, cash0 - 10_000_000);
  // week 2: research +15 and the op lands (+40)
  cs.advanceWeek();
  assert.deepEqual([t.window.bar, t.window.weeksLeft, pb.heat], [70, 4, 24]);
  // week 3: three Everything Is Fine campaigns (+4 each, $1M and heat -2 each), research +15
  for (let i = 0; i < 3; i++) cs.contribute('unrest', 'calming');
  assert.equal(t.window.bar, 82);
  assert.equal(pb.heat, 18);
  cs.advanceWeek();
  assert.equal(t.window.bar, 97);
  assert.equal(ledger.cash, cash0 - 13_000_000);
  // week 4: Ruth's engineering fix (+20) closes it
  cs.contribute('unrest', 'heroics', { exec: 'ruth' });
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
  const S = BREACH.sources;
  assert.deepEqual([S.op.points, S.op.weeks, S.research.points, S.research.rpPerWeek, S.research.requiresRD, S.calming.momentumShare, S.government.points, S.government.minReputation, S.government.heat, S.heroics.points],
    [40, 2, 15, 40, 2, 0.5, 25, 50, -5, 20]);
});

test('containment op: paid at launch, its +40 lands two breach weeks later', () => {
  const { cs, ledger } = world();
  cs.setTension('war', 95);
  const cash = ledger.cash;
  cs.contribute('war', 'op');
  const t = cs.tracks.war;
  assert.equal(ledger.cash, cash - 10_000_000);
  assert.equal(t.window.bar, 0);
  cs.advanceWeek();
  assert.equal(t.window.bar, 0);
  cs.advanceWeek();
  assert.equal(t.window.bar, 40);
  assert.equal(cs.sourceOffer('war', 'op').available, true, 'a new op can start once the last one landed');
});

test('crash research: needs R&D level 2, drips +15 a week for 40 RP a week, stops when RP runs out', () => {
  let rd = 1;
  let rp = 100;
  const cs = new CrisisSystem({ tips: TIPS, rdLevel: () => rd, spendRp: (n) => (rp >= n ? ((rp -= n), true) : false) });
  cs.setTension('pandemic', 95);
  const locked = cs.sourceOffer('pandemic', 'research');
  assert.equal(locked.available, false);
  assert.match(locked.reason, /R&D level 2/);
  assert.equal(cs.contribute('pandemic', 'research'), null);
  rd = 2;
  cs.contribute('pandemic', 'research');
  assert.equal(cs.researchBlocked, true);
  const t = cs.tracks.pandemic;
  cs.advanceWeek();
  cs.advanceWeek();
  assert.deepEqual([t.window.bar, rp], [30, 20]);
  cs.advanceWeek(); // 20 RP left: not enough, the program stops
  assert.equal(t.window.bar, 30);
  assert.equal(t.window.research, null);
  assert.equal(cs.researchBlocked, false);
});

test('calming: half the calming scheme’s momentum, at that scheme’s cost and heat', () => {
  const { cs, pb, ledger } = world();
  pb.heat = 30;
  cs.setTension('war', 95); // a new breach: pb heat unchanged until the week turns
  const cash = ledger.cash;
  assert.equal(cs.sourceOffer('war', 'calming').points, 4); // Everything Is Fine: momentum 8 -> +4
  assert.equal(cs.contribute('war', 'calming'), 4);
  assert.equal(ledger.cash, cash - 1_000_000);
  assert.equal(pb.heat, 28);
  assert.equal(cs.sourceOffer('war', 'calming', { scheme: 'peacesummit' }).points, 7.5); // momentum 15
  assert.equal(cs.sourceOffer('war', 'calming', { scheme: 'leak' }).available, false); // not a calming scheme
  cs.contribute('war', 'calming'); cs.contribute('war', 'calming');
  assert.equal(cs.sourceOffer('war', 'calming').available, false); // three per breach
});

test('government partnership: +25 once, needs reputation 50, lowers heat by 5', () => {
  const { cs, pb } = world();
  pb.heat = 30;
  cs.setTension('markets', 95);
  cs.reputation = 45;
  assert.match(cs.sourceOffer('markets', 'government').reason, /reputation 50/);
  assert.equal(cs.contribute('markets', 'government'), null);
  cs.reputation = 50;
  assert.equal(cs.contribute('markets', 'government'), 25);
  assert.equal(pb.heat, 25);
  assert.equal(cs.contribute('markets', 'government'), null); // once per breach
});

test('executive heroics: +20, each executive once per campaign, across breaches and saves', () => {
  const { cs, pb } = world();
  pb.heat = 0;
  cs.setTension('climate', 95);
  assert.deepEqual(cs.sourceOffer('climate', 'heroics').executives, ['ruth', 'june', 'theo']);
  assert.equal(cs.contribute('climate', 'heroics', { exec: 'theo' }), 20);
  assert.equal(pb.heat, 10); // Theo's dirty fix
  assert.equal(cs.contribute('climate', 'heroics', { exec: 'theo' }), null);
  cs.contribute('climate', 'heroics'); // the first unused: Ruth
  const copy = new CrisisSystem({ tips: TIPS });
  copy.load(JSON.parse(JSON.stringify(cs.toJSON())));
  copy.setTension('war', 95);
  assert.deepEqual(copy.sourceOffer('war', 'heroics').executives, ['june']);
  copy.contribute('war', 'heroics');
  assert.equal(copy.sourceOffer('war', 'heroics').available, false);
});
