import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, TRACK_BY_ID, COUNTER_ROOMS, CLASSIC_ROSTER, selectRoster, openTracks, unusedTracks, rosterLinks, tracksInSlot, GDD_REGIONS, hm } from '../src/world/tracks.js';
import { SCHEME_CATALOG, SCHEME_BY_ID, schemesForRoster, schemeSlots } from '../src/world/schemeCatalog.js';
import { ThreatWorld, bandOf } from '../src/world/momentum.js';
import { Ledger } from '../src/ledger/ledger.js';

test('ten tracks in six slots: slots 1 and 6 fixed, 2-5 each have a Classic track and one alternate', () => {
  assert.equal(TRACKS.length, 10);
  assert.equal(tracksInSlot(1).length, 1);
  assert.equal(tracksInSlot(6).length, 1);
  for (const s of [2, 3, 4, 5]) {
    const ts = tracksInSlot(s);
    assert.equal(ts.length, 2);
    const alt = ts.find((t) => !t.classic);
    assert.equal(alt.replaces, ts.find((t) => t.classic).id);
    assert.equal(alt.opensAt, ts.find((t) => t.classic).opensAt, 'alternates keep their slot’s opening time');
  }
  assert.deepEqual(CLASSIC_ROSTER, ['atomic', 'bloom', 'superstorm', 'optimizer', 'hush', 'pitchforks']);
  assert.deepEqual(TRACKS.filter((t) => t.classic).map((t) => t.opensAt), [25, 55, 118, 155, 200, 210]);
});

test('every track has a containment op, hot regions in the GDD region list, and a premise', () => {
  const regionIds = GDD_REGIONS.map((r) => r.id);
  for (const t of TRACKS) {
    assert.equal(SCHEME_BY_ID[t.containmentOp].group, 'containment', t.id);
    assert.equal(SCHEME_BY_ID[t.containmentOp].target, t.id);
    assert.ok(Object.keys(t.exposure).length > 0);
    for (const r of Object.keys(t.exposure)) assert.ok(regionIds.includes(r), `${t.id} ${r}`);
    assert.ok(t.premise && t.sells);
  }
  assert.equal(TRACK_BY_ID.cloudstrike.exposure.frontier, 'high', 'Cloud Strike is the one threat that reaches The Frontier');
  assert.ok(TRACKS.filter((t) => t.id !== 'cloudstrike').every((t) => !t.exposure.frontier));
});

test('each alternate brings three counter rooms of its own, 12 in all', () => {
  assert.equal(Object.keys(COUNTER_ROOMS).length, 12);
  for (const t of TRACKS.filter((x) => !x.classic)) {
    assert.equal(t.counterRooms.length, 3);
    for (const r of t.counterRooms) {
      assert.equal(COUNTER_ROOMS[r].track, t.id);
      assert.ok(COUNTER_ROOMS[r].unlockAt >= t.opensAt);
    }
    const times = t.counterRooms.map((r) => COUNTER_ROOMS[r].unlockAt).sort((a, b) => a - b);
    assert.equal(times[0], t.opensAt);
    assert.equal(times[1], t.opensAt);
    assert.ok(times[2] - t.opensAt >= 8 && times[2] - t.opensAt <= 12, 'the third about ten minutes later');
  }
});

test('37 schemes: 23 Classic world schemes + 6 Classic containment ops, alternates add 8', () => {
  assert.equal(SCHEME_CATALOG.length, 37);
  assert.equal(new Set(SCHEME_CATALOG.map((s) => s.id)).size, 37);
  const altTracks = TRACKS.filter((t) => !t.classic).map((t) => t.id);
  const altOnly = SCHEME_CATALOG.filter((s) => altTracks.includes(s.requires));
  assert.equal(altOnly.length, 8);
  assert.equal(SCHEME_CATALOG.length - altOnly.length, 29);
  const g = (x) => SCHEME_CATALOG.filter((s) => s.group === x && !altTracks.includes(s.requires)).length;
  assert.equal(g('escalate'), 11);
  assert.equal(g('calm'), 5);
  assert.equal(g('influence'), 7);
  assert.equal(g('containment'), 6);
  for (const s of SCHEME_CATALOG) {
    assert.ok(s.cost >= 0 && Number.isFinite(s.heat) && s.unlockAt >= 0 && s.effect, s.id);
    assert.ok(s.cost > 0 || s.rp > 0, `${s.id} costs cash or RP`);
  }
  assert.equal(SCHEME_BY_ID.leak.cost, 500_000);
  assert.equal(SCHEME_BY_ID.takeover.cost, 150_000_000);
  assert.equal(SCHEME_BY_ID.intel2.rp, 300);
  assert.equal(SCHEME_BY_ID.sabotage.unlockAt, hm('3:12'));
});

test('a world only sees the schemes for the tracks it runs; Debunk follows slots 2 and 4', () => {
  const classic = schemesForRoster(CLASSIC_ROSTER).map((s) => s.id);
  assert.equal(classic.length, 29);
  assert.ok(classic.includes('lableak') && !classic.includes('skincare'));
  const alt = selectRoster({ mode: 'custom', picks: { 2: 'greygoo', 3: 'longshade', 4: 'kessler', 5: 'cloudstrike' } });
  const ids = schemesForRoster(alt).map((s) => s.id);
  assert.equal(ids.length, 29);
  for (const x of ['skincare', 'sunshade', 'launchparty', 'waterfutures', 'firmware', 'bridgeround', 'orbitalsweep', 'bargaining', 'debunk']) assert.ok(ids.includes(x), x);
  for (const x of ['lableak', 'weathermod', 'featurecreep', 'pesticide', 'fungicide']) assert.ok(!ids.includes(x), x);
});

test('roster selection: Classic, Random, Custom; first campaign is always Classic', () => {
  assert.deepEqual(selectRoster({ mode: 'random', firstCampaign: true }), CLASSIC_ROSTER);
  const custom = selectRoster({ mode: 'custom', picks: { 2: 'greygoo', 5: 'cloudstrike', 1: 'bloom' } });
  assert.deepEqual(custom, ['atomic', 'greygoo', 'superstorm', 'optimizer', 'cloudstrike', 'pitchforks']);
  let i = 0;
  const alt = selectRoster({ mode: 'random', rng: () => (i++ % 2 ? 0.9 : 0.1) });
  assert.equal(alt[0], 'atomic');
  assert.equal(alt[5], 'pitchforks');
  assert.equal(new Set(alt.map((id) => TRACK_BY_ID[id].slot)).size, 6);
  assert.deepEqual(unusedTracks(custom).sort(), ['bloom', 'hush', 'kessler', 'longshade']);
  assert.deepEqual(openTracks(CLASSIC_ROSTER, 60), ['atomic', 'bloom']);
  const links = rosterLinks(custom);
  assert.equal(links.length, 10);
  assert.ok(links.every((l) => custom.includes(l.from) && custom.includes(l.to)));
  assert.ok(links.some((l) => l.from === 'pitchforks' && l.to === 'atomic'));
});

test('momentum: 25% released as tension each week, so a Leak delivers its 8 over time', () => {
  const w = new ThreatWorld({ roster: CLASSIC_ROSTER, minutes: () => 30, start: { atomic: 30 } });
  assert.ok(w.run('leak', { track: 'atomic' }).ok);
  assert.equal(w.tracks.atomic.momentum, 8);
  w.advanceWeek();
  assert.equal(w.tracks.atomic.momentum, 6);
  assert.equal(w.tracks.atomic.tension, 32);
  for (let i = 0; i < 30; i++) w.advanceWeek();
  assert.ok(Math.abs(w.tracks.atomic.tension - 38) < 0.1, `${w.tracks.atomic.tension}`);
  assert.ok(w.tracks.atomic.momentum < 0.01);
});

test('bands drift: Calm falls, Simmer holds, Boil and Brink creep up', () => {
  assert.equal(bandOf(10).id, 'calm');
  assert.equal(bandOf(70).id, 'brink');
  const w = new ThreatWorld({ roster: CLASSIC_ROSTER, minutes: () => 30, start: { atomic: 75 } });
  w.advanceWeek();
  assert.equal(w.tracks.atomic.tension, 76.5);
  assert.equal(w.tracks.bloom.tension, 0, 'closed tracks do not move');
});

test('repeat calming loses 25% per use on the same track within 8 weeks', () => {
  const w = new ThreatWorld({ roster: CLASSIC_ROSTER, minutes: () => 300, spLevel: () => 5, start: { atomic: 80 } });
  const r = [];
  for (let i = 0; i < 4; i++) { r.push(w.run('everythingfine', { track: 'atomic' }).applied.atomic); w.advanceWeek(); }
  assert.deepEqual(r, [-8, -6, -4, -2]);
  for (let i = 0; i < 8; i++) w.advanceWeek();
  assert.equal(w.run('everythingfine', { track: 'atomic' }).applied.atomic, -8, 'the penalty wears off after 8 weeks');
  assert.equal(w.run('everythingfine', { track: 'bloom' }).applied.bloom, -8, 'other tracks are unaffected');
});

test('Special Projects has one scheme slot at level 1 and five at level 5', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(schemeSlots), [1, 2, 3, 4, 5]);
  let level = 1;
  const w = new ThreatWorld({ roster: CLASSIC_ROSTER, minutes: () => 300, spLevel: () => level });
  assert.ok(w.run('leak', { track: 'atomic' }).ok);
  assert.match(w.run('leak', { track: 'bloom' }).reason, /busy/);
  assert.ok(w.run('everythingfine', { track: 'bloom' }).ok, 'Communications schemes do not use Special Projects slots');
  level = 2;
  assert.ok(w.run('leak', { track: 'bloom' }).ok);
  w.advanceWeek(); w.advanceWeek();
  level = 1;
  assert.ok(w.run('leak', { track: 'atomic' }).ok, 'slots free up when schemes finish');
});

test('unlock times, cash, heat by band and paybacks', () => {
  const ledger = new Ledger({ startingCash: 10_000_000 });
  let heat = 0;
  let minutes = 20;
  const w = new ThreatWorld({ roster: CLASSIC_ROSTER, minutes: () => minutes, ledger, onHeat: (h) => { heat += h; }, spLevel: () => 1, start: { atomic: 75 } });
  assert.match(w.run('leak', { track: 'atomic' }).reason, /0:25/);
  minutes = 130;
  const r = w.run('armsbroker');
  assert.ok(r.ok);
  assert.equal(heat, 10, 'heat 8 x Brink 1.25');
  assert.equal(ledger.cash, 9_000_000);
  w.advanceWeek(); w.advanceWeek();
  assert.equal(ledger.cash, 11_000_000, 'Arms Broker pays $2M back');
  assert.equal(w.run('summit').reason, 'Only during a breach');
  assert.equal(w.run('lableak').reason, 'Unlocks at 2:15');
});

test('tracks open on schedule and the world saves', () => {
  let minutes = 0;
  const opened = [];
  const w = new ThreatWorld({ roster: selectRoster({ mode: 'custom', picks: { 2: 'greygoo' } }), minutes: () => minutes });
  w.on((e) => e.type === 'open' && opened.push(e.track));
  minutes = 56; w.advanceWeek();
  assert.deepEqual(opened, ['atomic', 'greygoo']);
  const copy = new ThreatWorld({ roster: CLASSIC_ROSTER });
  copy.load(JSON.parse(JSON.stringify(w)));
  assert.equal(copy.roster[1], 'greygoo');
  assert.equal(copy.week, 1);
});
