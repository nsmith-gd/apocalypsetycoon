import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Settings, ACTIONS, STORAGE_KEY, keyOf } from '../src/settings/settings.js';

const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
const fakeRoot = () => { const set = new Set(); return { classList: { toggle: (c, on) => (on ? set.add(c) : set.delete(c)) }, set }; };
const key = (k, extra = {}) => ({ key: k, target: { tagName: 'BODY' }, ...extra });

test('options persist in one settings entry and show up as classes on the page', () => {
  const storage = memStorage();
  const root = fakeRoot();
  const s = new Settings({ storage, root });
  assert.equal(s.get('trackPatterns'), false);
  s.set('trackPatterns', true);
  s.set('reducedFlash', true);
  assert.ok(root.set.has('a11y-patterns') && root.set.has('a11y-reduced-flash'));
  assert.ok(!root.set.has('a11y-clean-font'));
  const again = new Settings({ storage, root: fakeRoot() });
  assert.equal(again.get('trackPatterns'), true);
  assert.equal(again.get('reducedFlash'), true);
  assert.ok(JSON.parse(storage.getItem(STORAGE_KEY)).keys.pause);
});

test('every action has a default key and they are all different', () => {
  const s = new Settings({ storage: memStorage(), root: fakeRoot() });
  const keys = ACTIONS.map((a) => s.keyFor(a.id));
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(s.matches(key(' '), 'pause'));
  assert.ok(s.matches(key('T'), 'threats'), 'case-insensitive');
  assert.ok(s.matches(key('>'), 'speedUp'), 'shifted . still speeds up');
  assert.ok(!s.matches(key('t', { ctrlKey: true }), 'threats'), 'Ctrl chords are left alone');
  assert.ok(!s.matches(key('t', { target: { tagName: 'INPUT' } }), 'threats'), 'typing is left alone');
});

test('rebinding: the new key works, the old one stops, a clash swaps, reserved keys are refused', () => {
  const storage = memStorage();
  const s = new Settings({ storage, root: fakeRoot() });
  assert.deepEqual(s.rebind('pause', 'P'), { ok: true, swapped: null });
  assert.ok(s.matches(key('p'), 'pause'));
  assert.ok(!s.matches(key(' '), 'pause'));
  assert.equal(s.keyLabel('pause'), 'P');
  const r = s.rebind('threats', 'r'); // research had R
  assert.equal(r.swapped, 'research');
  assert.equal(s.keyFor('research'), 't');
  assert.equal(s.rebind('pause', 'Escape').ok, false);
  assert.equal(new Settings({ storage, root: fakeRoot() }).keyFor('pause'), 'p', 'bindings persist');
  s.reset();
  assert.equal(s.keyFor('pause'), ' ');
  assert.equal(keyOf('Spacebar'), ' ');
});

test('works with no storage at all (private mode)', () => {
  const s = new Settings({ storage: { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } }, root: null });
  s.set('cleanFont', true);
  assert.equal(s.get('cleanFont'), true);
});
