import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResearchTree, researchRate, TIPPING_POINT, weeklyGrants, validateTree, RESEARCH_NODES, STARTER, FUNDING } from '../src/research/research.js';
import { Ledger } from '../src/ledger/ledger.js';
import { OBJECTS, STRATA } from '../src/shelter/bunker-catalog.js';
import { SCHEMES } from '../src/schemes/schemes.js';

const node = (id) => RESEARCH_NODES.find((nd) => nd.id === id);

test('the tree data is valid and every effect points at something real', () => {
  assert.deepEqual(validateTree(), []);
  const schemeIds = new Set(SCHEMES.map((s) => s.id));
  for (const n of RESEARCH_NODES) for (const e of n.effects) {
    if (e.type === 'object') assert.ok(OBJECTS[e.id], `${n.id}: object ${e.id}`);
    if (e.type === 'stratum') assert.ok(STRATA.some((s) => s.id === e.id), `${n.id}: stratum ${e.id}`);
    if (e.type === 'scheme') assert.ok(schemeIds.has(e.id), `${n.id}: scheme ${e.id}`);
  }
  for (const id of STARTER.objects) assert.ok(OBJECTS[id], `starter ${id}`);
  // ungated objects are free; every luxury and every system machine beyond the starter kit is gated
  const t = new ResearchTree();
  for (const [id, o] of Object.entries(OBJECTS)) {
    if (STARTER.objects.includes(id)) continue;
    if (o.luxury || o.prestige || ['air', 'water', 'food', 'power', 'security', 'status'].includes(o.cat)) assert.ok(t.gates('object', id), `${id} (${o.cat}) should need research`);
  }
});

test('crisis grants: weekly RP by band, stacking, none from breached tracks', () => {
  const g = weeklyGrants([{ id: 'a', tension: 10 }, { id: 'b', tension: 30 }, { id: 'c', tension: 50 }, { id: 'd', tension: 80 }, { id: 'e', tension: 85, state: 'breach' }]);
  assert.equal(g.total, 2 + 6 + 15);
  assert.deepEqual(g.lines.map((l) => l.band), ['Simmer', 'Boil', 'Brink']);
  const two = weeklyGrants([{ id: 'x', tension: 75 }, { id: 'y', tension: 72 }]);
  assert.equal(two.total, 30, 'GDD: two tracks at Brink pay 30 RP a week');
});

test('a hotter world researches faster: weeks to finish Hydroponics', () => {
  const weeks = (tension) => {
    const t = new ResearchTree();
    t.start('a_hydro');
    let w = 0;
    while (!t.done.has('a_hydro') && w < 200) { t.fundWeek([{ id: 'p', tension }, { id: 'q', tension }]); w++; }
    return w;
  };
  assert.equal(weeks(10), 200, 'a calm world pays nothing');
  assert.ok(weeks(80) < weeks(50) && weeks(50) < weeks(25), `${weeks(80)} < ${weeks(50)} < ${weeks(25)}`);
});

test('spending: tier 1 costs cash only and lands at once; higher tiers pay cash then RP', () => {
  const clay = node('s1_clay');
  const hydro = node('a_hydro');
  assert.equal(clay.cash, 1_500_000, 'GDD scale: Clay digging costs $1.5M');
  const start = 10_000_000;
  const ledger = new Ledger({ startingCash: start });
  const t = new ResearchTree({ ledger });
  assert.equal(t.canDig('clay'), false);
  assert.equal(t.start('s1_clay'), true);
  assert.equal(t.done.has('s1_clay'), true);
  assert.equal(ledger.cash, start - clay.cash);
  assert.equal(ledger.entries[0].category, 'research');
  assert.equal(t.canDig('clay'), true);
  assert.equal(t.canBuild('sump'), true);
  // tier 2: cash now, RP later
  assert.equal(t.start('a_hydro'), true);
  assert.equal(ledger.cash, start - clay.cash - hydro.cash);
  assert.equal(t.status('a_hydro'), 'active');
  assert.match(t.blocker('l1_med'), /busy/);
  t.fundFromIncome((hydro.rp - 1) * FUNDING.dollarsPerRP, 'sale'); // one RP short
  assert.equal(t.done.has('a_hydro'), false);
  t.fundFromIncome(FUNDING.dollarsPerRP, 'sale'); // the last RP
  assert.equal(t.done.has('a_hydro'), true);
  assert.equal(t.canBuild('hydro'), true);
  assert.equal(t.isUnlocked('hydroponics'), true);
  assert.equal(t.sources.income, hydro.rp);
});

test('prerequisites and cash gate projects', () => {
  const cash = node('s1_clay').cash - 1; // a dollar short of the cheapest tier-1 project tried below
  const ledger = new Ledger({ startingCash: cash });
  const t = new ResearchTree({ ledger });
  assert.equal(t.status('a_water'), 'locked');
  assert.match(t.blocker('a_water'), /Needs HEPA Scrubber Bay/);
  assert.equal(t.start('a_water'), false);
  assert.match(t.blocker('s1_clay'), /cash/);
  assert.equal(t.start('s1_clay'), false);
  assert.equal(ledger.cash, cash);
});

test('unlocks apply to the shelter grid and the scheme systems', () => {
  const t = new ResearchTree();
  assert.equal(t.canBuild('bunk'), true, 'starter kit');
  assert.equal(t.canBuild('hepa'), false);
  assert.equal(t.canBuildStructure('spine'), false);
  assert.equal(t.canDig('topsoil'), true);
  assert.equal(t.isUnlocked('astroturf'), false);
  const schemes = [{ id: 'podcast', heat: 4 }, { id: 'astroturf', heat: 5, research: true }];
  assert.deepEqual(t.applyToSchemes(schemes).map((s) => s.id), ['podcast']);
  t.start('s_thinktank'); t.fundWeek([{ id: 'a', tension: 80 }, { id: 'b', tension: 80 }, { id: 'c', tension: 80 }]);
  assert.equal(t.isUnlocked('astroturf'), true);
  t.start('s_spin'); for (let i = 0; i < 4; i++) t.fundWeek([{ id: 'a', tension: 80 }, { id: 'b', tension: 80 }, { id: 'c', tension: 80 }]);
  assert.equal(t.done.has('s_spin'), true);
  assert.deepEqual(t.applyToSchemes(schemes).map((s) => s.heat), [3, 4]);
  t.start('c_crew2');
  assert.equal(t.crewCount, 2);
});

test('the older continuous trickle still climbs with crisis and drops past the tip', () => {
  assert.ok(researchRate(0) < researchRate(40) && researchRate(40) < researchRate(80));
  assert.ok(researchRate(TIPPING_POINT - 1) > researchRate(100));
});

test('save/load round-trips', () => {
  const ledger = new Ledger({ startingCash: node('c_crew2').cash + node('a_hydro').cash });
  const t = new ResearchTree({ ledger });
  t.start('c_crew2'); t.start('a_hydro'); t.fundFromIncome(10 * FUNDING.dollarsPerRP);
  const u = new ResearchTree();
  u.load(JSON.parse(JSON.stringify(t)));
  assert.equal(u.crewCount, 2);
  assert.equal(u.active, 'a_hydro');
  assert.equal(u.progress.get('a_hydro'), 10);
  assert.ok(u.paid.has('a_hydro'));
});
