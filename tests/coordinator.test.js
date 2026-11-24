import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the proposed-ticket queue is well formed and capped at L1', () => {
  const tickets = JSON.parse(readFileSync(new URL('../.ballast/proposed-tickets.json', import.meta.url), 'utf8'));
  const ids = new Set();
  for (const t of tickets) {
    for (const k of ['id', 'section', 'kind', 'level', 'title', 'done', 'start_here']) assert.ok(t[k], `${t.id ?? '?'} missing ${k}`);
    assert.ok(!ids.has(t.id), `duplicate ${t.id}`); ids.add(t.id);
    assert.match(t.level, /^L[01]$/, `${t.id} is above L1`);
    assert.ok(['gameplay', 'art'].includes(t.kind));
  }
  for (const t of tickets) if (t.after) assert.ok(ids.has(t.after), `${t.id} waits on unknown ${t.after}`);
});

test('COORDINATOR.md states the pickup, claim, blocked and merge rules', () => {
  const md = readFileSync(new URL('../COORDINATOR.md', import.meta.url), 'utf8');
  for (const h of ['Choose the next ticket', 'Claim it', 'When you\'re blocked', 'Merging and conflicts', 'Report']) assert.ok(md.includes(h), h);
});
