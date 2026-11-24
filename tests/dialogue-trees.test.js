import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TREES } from '../src/dialogue/trees/index.js';
import { validateTree, validateTrees, ARCHETYPES, archetypeFor, treeFor, Conversation } from '../src/dialogue/trees.js';
import { ENDINGS, applyOutcome } from '../src/dialogue/outcomes.js';
import { parseVenueCatalog } from '../src/events/venues.js';
import { EventCircuit } from '../src/events/attend.js';
import { LeadInventory } from '../src/leads/leads.js';
import { readFileSync } from 'node:fs';

const catalog = parseVenueCatalog(JSON.parse(readFileSync(new URL('../data/venues.json', import.meta.url), 'utf8')));

test('at least 12 trees, one for every archetype, and all pass the validator', () => {
  assert.ok(TREES.length >= 12);
  assert.equal(validateTrees(TREES), true);
  for (const t of TREES) {
    const n = Object.keys(t.nodes).length;
    assert.ok(n >= 6 && n <= 10, `${t.id}: ${n} nodes`);
  }
});

test('the validator catches broken trees', () => {
  const t = TREES[0];
  const broken = { ...t, nodes: { ...t.nodes, [t.start]: { ...t.nodes[t.start], choices: [{ text: 'x', next: 'nowhere', effects: { fear: 'dragons' } }] } } };
  const bad = validateTree(broken);
  assert.ok(bad.some((b) => b.includes('nowhere')));
  assert.ok(bad.some((b) => b.includes('dragons')));
  assert.ok(bad.some((b) => b.includes('unreachable')));
  assert.throws(() => validateTrees([t]), /no tree for archetype/);
});

// Every distinct ending each tree can reach, with one path (list of choice indexes) to it.
function pathsToEndings(tree) {
  const out = new Map();
  const walk = (id, path) => {
    const n = tree.nodes[id];
    if (n.ending) { if (!out.has(n.ending)) out.set(n.ending, path); return; }
    n.choices.forEach((c, i) => walk(c.next, [...path, i]));
  };
  walk(tree.start, []);
  return out;
}

test('every tree has two ways to win a lead and one way to fail or backfire, and each plays through', () => {
  const guest = { id: 'g', name: 'Test Guest', wealthClass: 'C3', region: 'coastal', fears: ['bloom'], venueId: 'x' };
  for (const tree of TREES) {
    const ends = pathsToEndings(tree);
    const wins = [...ends.keys()].filter((e) => ENDINGS[e].win);
    assert.ok(wins.length >= 2, `${tree.id} wins: ${wins}`);
    assert.ok(ends.has('rebuffed') || ends.has('backfire'), `${tree.id} needs a fail`);
    for (const [ending, path] of ends) {
      const c = new Conversation({ guest, tree, rng: () => 0.5 });
      for (const i of path) { assert.ok(c.choices.length > 0); c.choose(i); }
      assert.equal(c.done, true);
      const r = c.finish();
      assert.equal(r.ending, ending);
      assert.equal(!!r.lead, ENDINGS[ending].win);
      assert.ok(!/\{\w+\}/.test(c.text), `${tree.id}: unfilled placeholder`);
    }
  }
});

test('the event flow reaches every tree: guests at the venues map onto all twelve archetypes', () => {
  const circuit = new EventCircuit({ catalog, seed: 3 });
  const seen = new Set();
  for (const v of catalog.venues) for (const g of circuit.pool(v)) {
    const a = archetypeFor(g);
    assert.ok(ARCHETYPES[a]);
    assert.ok(treeFor(g), `no tree for ${g.id}`);
    seen.add(a);
  }
  assert.deepEqual([...seen].sort(), Object.keys(ARCHETYPES).sort());
});

test('attend an event, talk to a guest, and the conversation lands a lead in the pipeline', () => {
  const circuit = new EventCircuit({ catalog, seed: 3 });
  const quarter = 4;
  const option = circuit.options(quarter).find((o) => o.canAttend);
  const visit = circuit.attend(option.venue.id, { quarter });
  const guest = visit.guests[0];
  const leads = new LeadInventory({ getQuarter: () => quarter });
  const conv = new Conversation({ guest, rng: () => 0.99 });
  // pick the first path to a winning ending
  const [, path] = [...pathsToEndings(conv.tree)].find(([e]) => ENDINGS[e].win);
  for (const i of path) conv.choose(i);
  const { lead } = applyOutcome(conv.finish({ context: { journalistPresent: visit.press } }), { leads, guest, venueId: visit.venueId });
  circuit.meet(guest.id);
  assert.ok(lead);
  assert.equal(lead.guest.name, guest.name);
  assert.equal(leads.open().length, 1);
});
