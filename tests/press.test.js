import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pushback } from '../src/pushback/pushback.js';
import { Press, PRESS, storyGrowth, journalistGrowth, siegeStrength, siteDefence, reputationZone } from '../src/pushback/press.js';

function fakeLedger(cash = 5_000_000) {
  const entries = [];
  return {
    entries, quarter: 1,
    get cash() { return cash + entries.reduce((s, e) => s + e.amount, 0); },
    setQuarter() {},
    record(category, label, amount) { entries.push({ category, label, amount }); },
    summary() { return { net: 0 }; },
  };
}
const setup = (heat = 0, opts = {}) => {
  const ledger = fakeLedger();
  const pb = new Pushback({ ledger, seed: 3 });
  pb.heat = heat;
  const press = new Press({ pushback: pb, seed: 5, ...opts });
  return { ledger, pb, press };
};

test('story growth: 2% a week plus 1% per 10 heat', () => {
  assert.equal(storyGrowth(0), 2);
  assert.equal(storyGrowth(9), 2);
  assert.equal(storyGrowth(10), 3);
  assert.equal(storyGrowth(45), 6);
  assert.equal(storyGrowth(100), 12);
});

test('Gil is faster than Iris; Iris slows as trust grows', () => {
  assert.ok(journalistGrowth(40, 'gil') > journalistGrowth(40, 'iris'));
  assert.equal(journalistGrowth(40, 'iris', 0), 6);
  assert.equal(journalistGrowth(40, 'iris', 5), 3);
});

test('a story grows week by week and airs at 100%: heat +25, reputation -15, every client +10 leverage', () => {
  const { pb, press } = setup(30);
  pb.onSale({ client: 'A', price: 1e6 });
  pb.onSale({ client: 'B', price: 1e6 });
  press.journalists.gil.restWeeks = 999; // isolate Iris
  press.tickWeek(); // Iris opens a story (heat 30 >= 25)
  assert.equal(press.journalists.iris.story.progress, 0);
  press.tickWeek();
  assert.equal(press.journalists.iris.story.progress, storyGrowth(30));
  // Hold heat steady: weekly growth is (2 + 3) = 5, so 100% takes 20 weeks of growth.
  let aired = null; let weeks = 1;
  const lev0 = pb.clients.map((c) => c.leverage);
  while (!aired && weeks < 60) { pb.heat = 30; const r = press.tickWeek(); weeks++; aired = r.aired[0]; }
  assert.equal(weeks, 20);
  assert.equal(aired.journalist, 'iris');
  assert.equal(pb.heat, 30 + 25);
  assert.equal(press.reputation, PRESS.reputation.start - 15);
  assert.deepEqual(pb.clients.map((c) => c.leverage), lev0.map((l) => l + 10));
  assert.equal(press.journalists.iris.story, null);
  assert.equal(press.journalists.iris.restWeeks, PRESS.journalists.iris.cooldownWeeks);
});

test("Gil's story also shoves a random threat track +5", () => {
  const calls = [];
  const crisis = { tracks: { pandemic: {}, war: {} }, addTension: (id, n) => calls.push([id, n]) };
  const { press } = setup(20, { crisis });
  press.journalists.iris.restWeeks = 999;
  press.tickWeek();
  press.journalists.gil.story.progress = 99;
  const r = press.tickWeek();
  assert.equal(r.aired.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 5);
  assert.ok(['pandemic', 'war'].includes(calls[0][0]));
});

test('reputation starts at 40 and stays within 0..100', () => {
  const { press } = setup();
  assert.equal(press.reputation, 40);
  press.addReputation(-500);
  assert.equal(press.reputation, 0);
  press.addReputation(500);
  assert.equal(press.reputation, 100);
  assert.equal(reputationZone(40).id, 'respectable');
});

test('counters: bury escalates in price, discredit backfires on Iris but crushes Gil', () => {
  const { ledger, pb, press } = setup(30);
  press.tickWeek();
  press.journalists.iris.story.progress = 50;
  press.journalists.gil.story.progress = 80;
  const b1 = press.counter('iris', 'bury');
  const b2 = press.counter('iris', 'bury');
  assert.equal(b1.cost, 120_000);
  assert.equal(b2.cost, 180_000);
  assert.equal(press.journalists.iris.story.progress, 0);
  press.journalists.iris.story.progress = 50;
  press.journalists.iris.trust = 3;
  const h0 = pb.heat;
  press.counter('iris', 'discredit');
  assert.equal(press.journalists.iris.story.progress, 40);
  assert.equal(pb.heat, h0 + 10);
  assert.equal(press.journalists.iris.trust, 1);
  press.counter('gil', 'discredit');
  assert.equal(press.journalists.gil.story.progress, 20);
  assert.ok(ledger.entries.some((e) => e.label.startsWith('Bury')));
});

test('the Interview builds Iris trust when cool, feeds the story when hot; one a week', () => {
  const { pb, press } = setup(30);
  press.tickWeek();
  press.journalists.iris.story.progress = 50;
  const r = press.counter('iris', 'interview');
  assert.ok(r.good);
  assert.equal(press.journalists.iris.trust, 1);
  assert.equal(press.journalists.iris.story.progress, 35);
  assert.equal(press.counter('iris', 'interview').ok, false);
  press.tickWeek();
  pb.heat = 80;
  const before = press.journalists.iris.story.progress;
  const r2 = press.counter('iris', 'interview');
  assert.equal(r2.good, false);
  assert.equal(press.journalists.iris.story.progress, before + 15);
});

test('kompromat kills the story and silences the reporter; spends intel when available', () => {
  const { ledger, press } = setup(30);
  press.tickWeek();
  press.intel = 1;
  const r = press.counter('gil', 'kompromat');
  assert.equal(r.cost, 0);
  assert.ok(r.usedIntel);
  assert.equal(press.journalists.gil.story, null);
  assert.equal(press.journalists.gil.restWeeks, 8);
  assert.equal(press.counterCost('iris', 'kompromat'), 400_000);
  assert.ok(!ledger.entries.some((e) => e.label.startsWith('Kompromat')));
});

test('a counter that pushes a story to 100% airs it immediately', () => {
  const { pb, press } = setup(40);
  press.tickWeek();
  press.journalists.gil.story.progress = 90;
  const r = press.counter('gil', 'interview'); // Gil always spins it: story +15
  assert.ok(r.aired);
  assert.equal(press.journalists.gil.story, null);
  assert.equal(pb.heat, 40 + 25);
});

test('siege strength = tension / 20 + visible surface features, against security', () => {
  assert.equal(siegeStrength(0, 0), 0);
  assert.equal(siegeStrength(60, 0), 3);
  assert.equal(siegeStrength(80, 2), 6);
  assert.equal(siegeStrength(90, 1), 5.5);
  assert.equal(siteDefence({ security: 3 }), 3);
  assert.equal(siteDefence({ security: 3, decoy: true }), 5);
});

test('sieges: occupy weak visible sites, repel strong ones, retake and decoy', () => {
  const { pb, press } = setup(10);
  pb.tension = 80;
  const c = pb.onSale({ client: 'V', price: 1e6 });
  const weak = press.addSite({ name: 'Helipad Ranch', security: 3, visible: 2, clientId: c.id });
  const strong = press.addSite({ name: 'Granite Vault', security: 5, visible: 0 });
  const r1 = press.siege(strong.id); // 4 vs 5
  assert.equal(r1.occupied, false);
  assert.equal(press.reputation, 41);
  const lev = c.leverage;
  const r2 = press.siege(weak.id); // 6 vs 3
  assert.equal(r2.occupied, true);
  assert.equal(press.reputation, 36);
  assert.equal(c.leverage, lev + 10);
  press.tickWeek(); // occupied: -1 reputation a week (plus any new siege on the other site)
  assert.ok(press.reputation <= 36);
  const rt = press.retake(weak.id);
  assert.ok(rt.ok);
  assert.equal(press.sites[0].occupied, false);
  press.buildDecoy(weak.id);
  pb.tension = 70; // 3.5 + 2 = 5.5 vs 3 + 2 = 5 -> still falls
  assert.equal(press.siege(weak.id).occupied, true);
  press.retake(weak.id);
  pb.tension = 60; // 3 + 2 = 5 vs 5 -> holds (ties go to the defender)
  assert.equal(press.siege(weak.id).occupied, false);
});

test('The Pitchforks opens at tension 60 and then sieges come weekly', () => {
  const { pb, press } = setup(0);
  press.addSite({ name: 'Glass Dome', security: 1, visible: 3 });
  pb.tension = 55;
  press.tickWeek();
  assert.equal(press.pitchforksOpen, false);
  pb.tension = 95;
  let sieges = 0;
  for (let i = 0; i < 10; i++) { pb.tension = 95; if (press.tickWeek().siege) sieges++; if (press.sites[0].occupied) break; }
  assert.equal(press.pitchforksOpen, true);
  assert.ok(sieges >= 1);
  assert.equal(press.sites[0].occupied, true);
});

test('the Inspector costs $0.2M a walkthrough and certifies only sound, quiet sites', () => {
  const { ledger, press } = setup();
  const good = press.addSite({ name: 'Vault', security: 4, visible: 1 });
  const bad = press.addSite({ name: 'Dome', security: 1, visible: 4 });
  const r = press.inspect(good.id);
  assert.ok(r.pass);
  assert.equal(press.reputation, 46);
  const r2 = press.inspect(bad.id);
  assert.equal(r2.pass, false);
  assert.equal(r2.fixes.length, 2);
  assert.equal(ledger.entries.filter((e) => e.label.startsWith('Inspector')).reduce((s, e) => s + e.amount, 0), -400_000);
  assert.equal(press.inspect(good.id).ok, false);
});

test('save and load keeps stories, trust, reputation and sites', () => {
  const { pb, press } = setup(30);
  press.tickWeek(); press.tickWeek();
  press.journalists.iris.trust = 2;
  press.addSite({ name: 'X', security: 2, visible: 1 });
  const copy = Press.fromJSON(JSON.parse(JSON.stringify(press)), { pushback: pb });
  assert.deepEqual(copy.snapshot(), press.snapshot());
});
