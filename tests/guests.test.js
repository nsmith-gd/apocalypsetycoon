import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadGuestRoster, parseGuestRoster, validateRoster, rollGuest, generateGuestList, trackInWorld, WEALTH_CLASSES } from '../src/guests/guests.js';
import { TRACK_BY_ID, CLASSIC_ROSTER, selectRoster } from '../src/world/tracks.js';
import { mulberry32 } from '../src/pushback/pushback.js';
import { EventCircuit } from '../src/events/attend.js';
import { loadVenueCatalog } from '../src/events/venues.js';
import { Ledger } from '../src/ledger/ledger.js';

const raw = () => JSON.parse(readFileSync(new URL('../data/guests.json', import.meta.url), 'utf8'));

test('at least 12 archetypes and the ticket’s personality traits load from data', async () => {
  const r = await loadGuestRoster();
  assert.ok(r.archetypes.length >= 12, `${r.archetypes.length}`);
  for (const t of ['vain', 'paranoid', 'skeptical', 'generous']) assert.ok(r.traitById[t], t);
  for (const t of ['engineer', 'germaphobe', 'influencer', 'penny_pincher', 'knows_too_much']) assert.ok(r.traitById[t], t);
  const classes = new Set(r.archetypes.flatMap((a) => Object.keys(a.classes)));
  assert.deepEqual([...classes].sort(), ['C1', 'C2', 'C3', 'C4', 'C5'], 'every wealth class has archetypes');
  assert.ok(Object.isFrozen(r.archetypes[0]));
});

test('the validator names every problem', () => {
  const bad = raw();
  bad.archetypes[0].fears = { pandemic: 1 };
  bad.archetypes[1].traits = { brave: 1 };
  bad.archetypes[2].classes = { C9: 1 };
  bad.archetypes[3].regions = { atlantis: 1 };
  bad.traits[0].likes = ['bribery'];
  bad.archetypes.push({ ...bad.archetypes[4] });
  const errors = validateRoster(bad);
  for (const s of ['unknown threat track "pandemic"', 'unknown trait "brave"', 'unknown wealth class "C9"', 'unknown region "atlantis"', 'unknown approach "bribery"', 'duplicate id']) {
    assert.ok(errors.some((e) => e.includes(s)), s);
  }
  assert.throws(() => parseGuestRoster(bad), /guest roster invalid/);
  assert.deepEqual(validateRoster(raw()), []);
});

test('same seed, same guest list; different seed, different list', async () => {
  const r = await loadGuestRoster();
  const opts = { count: 6, classes: { C1: 2, C2: 2, C3: 1 }, region: 'tech' };
  const a = generateGuestList(r, { ...opts, seed: 42 });
  const b = generateGuestList(r, { ...opts, seed: 42 });
  const c = generateGuestList(r, { ...opts, seed: 43 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.length, 6);
  assert.equal(new Set(a.map((g) => g.archetype)).size, 6, 'no repeated archetype while others fit');
});

test('a guest has a name, wealth tier and budget in range, region, dominant fear and 2-3 traits', async () => {
  const r = await loadGuestRoster();
  const rng = mulberry32(7);
  for (let i = 0; i < 300; i++) {
    const cls = ['C1', 'C2', 'C3', 'C4', 'C5'][i % 5];
    const g = rollGuest(r, rng, { wealthClass: cls });
    assert.equal(g.wealthClass, cls);
    assert.equal(g.wealthTier, WEALTH_CLASSES[cls].tier);
    const [lo, hi] = WEALTH_CLASSES[cls].budget;
    assert.ok(g.budget >= lo - 1e5 && g.budget <= hi + 1e5, `${cls} ${g.budget}`);
    assert.ok(r.archetypeById[g.archetype].classes[cls]);
    assert.match(g.name, /^\S+ \S+$/);
    assert.ok(CLASSIC_ROSTER.includes(g.dominantFear));
    assert.equal(g.fears[0], g.dominantFear);
    const n = g.traits.length + g.hiddenTraits.length;
    assert.ok(n >= 2 && n <= 3);
    assert.ok(g.hiddenTraits.every((t) => r.traitById[t].hidden));
    assert.ok(g.traits.every((t) => !r.traitById[t].hidden));
  }
});

test('fears follow the campaign’s world: alternate fears fall to the Classic track in the slot and back', async () => {
  const r = await loadGuestRoster();
  assert.equal(trackInWorld('greygoo', CLASSIC_ROSTER), 'bloom');
  const goo = selectRoster({ mode: 'custom', picks: { 2: 'greygoo', 4: 'kessler' } });
  assert.equal(trackInWorld('optimizer', goo), 'kessler');
  const rng = mulberry32(3);
  for (let i = 0; i < 100; i++) {
    const g = rollGuest(r, rng, { archetypeId: 'reformed_ai_engineer', world: goo });
    assert.ok(g.fears.every((f) => goo.includes(f)), g.fears.join());
    assert.ok(!g.fears.includes('optimizer'));
  }
});

test('hot tracks and venue themes make a fear dominant more often', async () => {
  const r = await loadGuestRoster();
  const count = (opts) => {
    const rng = mulberry32(11);
    let n = 0;
    for (let i = 0; i < 400; i++) if (rollGuest(r, rng, { archetypeId: 'hedge_fund_doomer', ...opts }).dominantFear === 'superstorm') n++;
    return n;
  };
  const base = count({});
  assert.ok(count({ tension: { superstorm: 100 } }) > base * 1.5);
  assert.ok(count({ themes: ['superstorm'] }) > base * 1.5);
});

test('event guest lists draw from the archetypes (attend flow)', async () => {
  const roster = await loadGuestRoster();
  const catalog = await loadVenueCatalog();
  const circuit = new EventCircuit({ catalog, ledger: new Ledger({ startingCash: 10_000_000 }), seed: 5, guestRoster: roster });
  const opt = circuit.options(1).find((o) => o.canAttend);
  const visit = circuit.attend(opt.venue.id, { quarter: 1 });
  assert.ok(visit.guests.length > 0);
  for (const g of visit.guests) {
    assert.ok(roster.archetypeById[g.archetype], g.archetype);
    assert.ok(g.traits.length + g.hiddenTraits.length >= 2);
    assert.equal(g.venueId, opt.venue.id);
    assert.equal(g.region, opt.venue.region);
    assert.ok(TRACK_BY_ID[g.dominantFear]);
  }
  const again = new EventCircuit({ catalog, ledger: new Ledger({ startingCash: 10_000_000 }), seed: 5, guestRoster: roster });
  assert.deepEqual(again.pool(opt.venue), circuit.pool(opt.venue), 'a venue’s crowd is stable for the campaign seed');
});
