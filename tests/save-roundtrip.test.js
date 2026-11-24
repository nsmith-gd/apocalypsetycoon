import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../src/campaign/rng.js';
import { LeadMarket } from '../src/demand/demand.js';
import { createSaveSlot } from '../src/campaign/save.js';

test('a restored RNG rolls exactly the same future', () => {
  const a = seededRng(9);
  for (let i = 0; i < 5; i++) a();
  const s = a.state;
  const next = [a(), a(), a()];
  const b = seededRng(1);
  b.state = s;
  assert.deepEqual([b(), b(), b()], next);
});

test('the lead market saves and resumes identically, dice included', () => {
  const m = new LeadMarket({ seed: 4 });
  m.week({ tensions: { pandemic: 10 } });
  m.week({ tensions: { pandemic: 60, war: 40 } });
  const saved = JSON.parse(JSON.stringify(m.toJSON()));
  m.week({ tensions: { pandemic: 70, war: 50 } });
  const resumed = new LeadMarket({ seed: 99 });
  resumed.load(saved);
  resumed.week({ tensions: { pandemic: 70, war: 50 } });
  assert.deepEqual(resumed.toJSON(), m.toJSON());
});

test('the slot: snapshot equals what save writes; load restores every registered part', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const slot = createSaveSlot({ storage });
  const part = { v: 1, toJSON() { return { v: this.v }; }, load(d) { this.v = d.v; } };
  slot.register('p', part);
  part.v = 7;
  assert.equal(slot.save(), true);
  part.v = 99;
  slot.load();
  assert.equal(part.v, 7);
  assert.deepEqual(slot.snapshot().parts, JSON.parse(mem.get('apocalypse-tycoon.slot1')).parts);
});
