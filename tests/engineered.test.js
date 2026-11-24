import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EngineeredMidnight, PROJECTS, APOCALYPSES, combinedRequirement, requirementFor, gradeFor, GRADES, boardVote, runSealOrder, Overtime, ENGINEERED } from '../src/midnight/engineered.js';
import { computeMidnight } from '../src/midnight/midnight.js';
import { Pushback } from '../src/pushback/pushback.js';

test('the two projects sit at 4:50 and 5:30 on the timeline; the Final Product needs a 3-of-5 vote', () => {
  assert.equal(PROJECTS.lights_out.timeline, '4:50');
  assert.equal(PROJECTS.final_product.timeline, '5:30');
  assert.deepEqual(PROJECTS.final_product.boardVote, { of: 5, need: 3 });
  const em = new EngineeredMidnight();
  assert.equal(em.available('lights_out', { hours: 4.5 }), false);
  assert.equal(em.available('lights_out', { hours: 4.9 }), true);
  assert.equal(em.available('final_product', { researched: new Set([45]) }), true); // research 45 (GDD)
});

test('the GDD table: ten apocalypses with required Days Sealed; a pair takes the longer + 180 and both sets', () => {
  assert.equal(Object.keys(APOCALYPSES).length, 10);
  assert.equal(APOCALYPSES.atomic.days, 730);
  assert.deepEqual(APOCALYPSES.atomic.critical, { blast: 4, seal: 3 });
  assert.equal(APOCALYPSES.hush.days, 1460);
  assert.equal(APOCALYPSES.pitchforks.critical.security, 4);
  const c = combinedRequirement('war', 'pandemic'); // Atomic Standoff + The Bloom
  assert.equal(c.days, 730 + 180);
  assert.deepEqual(c.critical, { blast: 4, seal: 4 });
  assert.deepEqual(c.needs, ['decon', 'HEPA']);
  assert.equal(requirementFor('war').name, 'Atomic Standoff');
});

test('the date must be 4 to 12 weeks out; a pair pays more', () => {
  const em = new EngineeredMidnight();
  assert.equal(em.start({ target: 'war', weeks: 3 }).ok, false);
  assert.equal(em.start({ target: 'war', weeks: 13 }).ok, false);
  assert.equal(em.start({ target: ['war', 'markets'], weeks: 8 }).ok, true);
  assert.equal(em.plan.payout, PROJECTS.lights_out.pairPayout);
  assert.ok(em.plan.requirement.combined);
});

test('Last Call: triple premium, heat +3 a week, then a 2-week Seal Order, then Midnight', () => {
  const pb = new Pushback({ startingCash: 1e6 });
  pb.heat = 10;
  const em = new EngineeredMidnight({ pushback: pb });
  em.start({ target: 'pandemic', weeks: 4 });
  assert.equal(em.salesMultiplier, 3);
  const phases = [];
  for (let i = 0; i < 6; i++) phases.push(em.advanceWeek());
  assert.deepEqual(phases, ['last_call', 'last_call', 'last_call', 'seal_order', 'seal_order', 'midnight']);
  assert.equal(pb.heat, 10 + 4 * ENGINEERED.lastCallHeatPerWeek);
  assert.equal(em.salesMultiplier, 1);
});

test('calling it off costs 20 board confidence and only works once', () => {
  const board = { confidence: 60 };
  const em = new EngineeredMidnight({ board });
  em.start({ target: 'war', weeks: 6 });
  assert.equal(em.callOff(), true);
  assert.equal(board.confidence, 40);
  assert.equal(em.phase, 'none');
  em.start({ target: 'war', weeks: 6 });
  assert.equal(em.callOff(), false);
  assert.equal(board.confidence, 40);
});

test('The Final Product needs the board: a low-confidence board votes it down', () => {
  assert.equal(boardVote({ confidence: 0 }).passed, false);
  assert.equal(boardVote({ confidence: 100 }).passed, true);
  const em = new EngineeredMidnight({ board: { confidence: 5 } });
  const r = em.start({ project: 'final_product', target: 'war', weeks: 6 });
  assert.equal(r.ok, false);
  assert.match(r.reason, /board voted/);
});

test('Seal Order: distance, sieges and high-leverage clients make pickups late or lost; helicopters help', () => {
  const near = runSealOrder([{ id: 'a', distance: 0 }], { seed: 3 });
  assert.equal(near[0].outcome, 'on_time');
  assert.equal(near[0].risk, 0);
  const far = runSealOrder([{ id: 'b', distance: 3, siege: true, leverage: 70 }], { seed: 3 });
  assert.equal(far[0].risk, 0.95); // 0.36 + 0.35 + 0.25, capped at 95%
  const heli = runSealOrder([{ id: 'b', distance: 3, siege: true, leverage: 70 }], { seed: 3, helicopters: true });
  assert.ok(heli[0].risk < far[0].risk);
  assert.equal(heli[0].transport, 'helicopter');
  // over many clients, risky ones fail more often
  const many = (c) => runSealOrder(Array.from({ length: 400 }, (_, i) => ({ id: i, ...c })), { seed: 9 }).filter((r) => r.outcome !== 'on_time').length;
  assert.ok(many({ distance: 3, siege: true }) > many({ distance: 1 }) * 2);
});

test('grades from Platinum to The Gerald; Platinum needs engineered, no collapses, heat under 75; uncontrolled drops one', () => {
  assert.deepEqual(GRADES.map((g) => g.name), ['Platinum', 'Gold', 'Silver', 'Bronze', 'The Gerald']);
  assert.equal(gradeFor(0.92).id, 'platinum');
  assert.equal(gradeFor(0.92, { heat: 80 }).id, 'gold');
  assert.equal(gradeFor(0.92, { collapses: 1 }).id, 'gold');
  assert.equal(gradeFor(0.8).id, 'gold');
  assert.equal(gradeFor(0.6).id, 'silver');
  assert.equal(gradeFor(0.3).id, 'bronze');
  assert.equal(gradeFor(0.1).id, 'gerald');
  assert.equal(gradeFor(0.92, { uncontrolled: true }).id, 'silver'); // capped at Gold (not engineered), then -1
  assert.equal(gradeFor(0.6, { uncontrolled: true }).id, 'bronze');
  assert.equal(gradeFor(0.1, { uncontrolled: true }).id, 'gerald');
});

test('Midnight applies Seal Order outcomes and the apocalypse requirements, and grades the result', () => {
  const survival = (id, owner) => ({ id, name: id, owner, occupants: 8, rooms: ['mil_scrubber', 'water_recycler', 'hydroponics'], sold: true });
  const shelters = [survival('a', 'Vance'), survival('b', 'Okoro'), survival('c', 'Pike')];
  const calm = { tension: 70, heat: 10, runaways: 0 };
  const all = computeMidnight({ shelters, world: calm });
  assert.equal(all.grade.id, 'platinum');
  const r = computeMidnight({ shelters, world: calm, pickups: { Okoro: 'lost', Pike: 'late' } });
  assert.equal(r.shelters[1].survivors, 0);
  assert.equal(r.shelters[2].survivors, 6);
  assert.equal(r.grade.id, 'silver'); // 14 / 24 = 58%
  // A life-systems shelter is held to the apocalypse's Days Sealed and critical ratings.
  const life = { id: 'hq', name: 'HQ', owner: 'board', occupants: 4, rooms: [{ type: 'bunk', floor: 1, col: 1 }, { type: 'oxygen_store', floor: 1, col: 2 }, { type: 'water_tank', floor: 1, col: 3 }, { type: 'pantry', floor: 1, col: 4 }, { type: 'battery', floor: 1, col: 5 }] };
  const w = computeMidnight({ shelters: [life], world: calm, apocalypse: APOCALYPSES.atomic });
  assert.ok(w.shelters[0].life.p < 0.2); // 100 days of 730, no blast, poor seal
  assert.equal(w.grade.id, 'gerald');
});

test('Overtime: quota grows 30% a quarter and the 4 unused tracks open one per quarter', () => {
  const o = new Overtime({ baseQuota: 1_000_000 });
  assert.equal(o.pending.length, 4);
  for (const t of o.pending) assert.ok(APOCALYPSES[t] && !['atomic', 'bloom', 'superstorm', 'pitchforks', 'hush'].includes(t));
  const q13 = o.nextQuarter();
  assert.deepEqual([q13.quarter, q13.quota], [13, 1_300_000]);
  assert.ok(q13.opened);
  for (let i = 0; i < 4; i++) o.nextQuarter();
  assert.equal(o.opened.length, 4);
  assert.equal(o.quota, Math.round(1_000_000 * 1.3 ** 5));
});
