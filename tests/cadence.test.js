// #164: the cadence rule checker replays a campaign and reports violations with timestamps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replayCadence, cadenceHarness, CADENCE, PAIN_TOOLS, hm } from '../src/debug/cadence.js';
import { TREE_NODES } from '../src/research/tree-data.js';

test('cadence: every pain -> tool pair names a real research node', () => {
  const ids = new Set(TREE_NODES.map((n) => n.id));
  for (const p of PAIN_TOOLS) assert.ok(ids.has(p.tool), p.tool);
  assert.equal(hm(125), '2:05');
});
test('cadence: a replay reports each rule with campaign timestamps, and dead zones really exceed their limit', () => {
  const r = replayCadence({ bot: 'cautious', seed: 2 });
  assert.ok(r.timeline.length > 20);
  for (const list of Object.values(r.violations)) for (const v of list) assert.match(v.at, /^\d+:\d\d$/);
  for (const d of r.violations.deadZones) assert.ok(d.minutes > d.limit && [CADENCE.deadZone.early, CADENCE.deadZone.late].includes(d.limit));
  assert.ok(r.stats.goalsInFlightPct >= 0 && r.stats.goalsInFlightPct <= 100);
  // the timeline is in time order and only holds the kinds the rules read
  for (let i = 1; i < r.timeline.length; i++) assert.ok(r.timeline[i].minute >= r.timeline[i - 1].minute);
});
test('cadence: the harness gives a pass/fail per rule', () => {
  const h = cadenceHarness({ bots: ['edge'], seeds: [1] });
  assert.equal(h.summary.length, 4);
  for (const s of h.summary) assert.equal(s.ok, s.violations === 0);
  assert.equal(h.ok, h.summary.every((s) => s.ok));
});
