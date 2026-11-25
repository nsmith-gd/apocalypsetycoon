// Accessibility and control settings (#94). GDD: Art, audio and UI > Accessibility.
// One persisted entry (localStorage "apocalypse-tycoon.settings"), separate from the campaign save, so
// options carry across campaigns.
//
//   import { settings } from '../settings/settings.js';
//   settings.get('trackPatterns')          settings.set('reducedFlash', true)
//   settings.matches(e, 'pause')           // does this keydown trigger the action? (input code uses this)
//   settings.keyLabel('pause')             // "SPACE" for buttons and hints
//   settings.rebind('pause', 'p')          // a key already used by another action swaps with it
//   settings.onChange(fn)
// Options are mirrored as classes on <html>: a11y-patterns, a11y-reduced-flash, a11y-clean-font.

export const STORAGE_KEY = 'apocalypse-tycoon.settings';

// Every rebindable action, its default key (KeyboardEvent.key, lower-cased; ' ' is Space) and label.
export const ACTIONS = Object.freeze([
  { id: 'pause', label: 'Pause / resume', key: ' ' },
  { id: 'speedUp', label: 'Speed up', key: '.' },
  { id: 'speedDown', label: 'Slow down', key: ',' },
  { id: 'endQuarter', label: 'End the quarter now', key: 'n' },
  { id: 'switchCanvas', label: 'Switch shelter / world map', key: 'tab' },
  { id: 'shelter', label: 'Shelter view', key: '1' },
  { id: 'map', label: 'World map view', key: '2' },
  { id: 'ledger', label: 'Ledger', key: 'l' },
  { id: 'research', label: 'Research', key: 'r' },
  { id: 'threats', label: 'Threat tracks', key: 't' },
  { id: 'events', label: 'Social events', key: 'e' },
  { id: 'press', label: 'Press desk', key: 'p' },
  { id: 'mute', label: 'Mute sound', key: 'm' },
  { id: 'settings', label: 'Settings', key: 'o' },
]);

export const DEFAULTS = Object.freeze({
  trackPatterns: false, // hatching on crisis gauges and map regions, so zones don't rely on colour
  reducedFlash: false, // no blinking or shaking; a calmer breach alert
  cleanFont: false, // a plain sans-serif font instead of the typewriter one
  reducedLighting: false, // #130: no flicker or vignette, half the mood grade, soft glows only
  keys: Object.fromEntries(ACTIONS.map((a) => [a.id, a.key])),
});

const OPTION_CLASSES = { trackPatterns: 'a11y-patterns', reducedFlash: 'a11y-reduced-flash', cleanFont: 'a11y-clean-font', reducedLighting: 'a11y-reduced-lighting' };
const ALIASES = { spacebar: ' ', space: ' ', '>': '.', '<': ',' }; // shifted variants keep working

/** Normalise a KeyboardEvent (or a key string) to the stored form. */
export function keyOf(eOrKey) {
  const k = typeof eOrKey === 'string' ? eOrKey : eOrKey.key;
  const low = String(k).toLowerCase();
  return ALIASES[low] ?? low;
}

export function labelOfKey(k) {
  if (k === ' ') return 'SPACE';
  if (k === 'tab') return 'TAB';
  if (k === 'escape') return 'ESC';
  if (k.startsWith('arrow')) return k.slice(5).toUpperCase();
  return k.toUpperCase();
}

const RESERVED = new Set(['escape', 'enter', 'shift', 'control', 'alt', 'meta', 'capslock', '`']);

export class Settings {
  constructor({ storage = (typeof localStorage !== 'undefined' ? localStorage : null), root = (typeof document !== 'undefined' ? document.documentElement : null) } = {}) {
    this.storage = storage;
    this.root = root;
    this.listeners = new Set();
    this.values = structuredClone(DEFAULTS);
    this.load();
    this.apply();
  }

  load() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      for (const k of Object.keys(OPTION_CLASSES)) if (typeof d[k] === 'boolean') this.values[k] = d[k];
      for (const a of ACTIONS) if (typeof d.keys?.[a.id] === 'string') this.values.keys[a.id] = d.keys[a.id];
    } catch { /* unreadable storage: defaults */ }
  }

  save() {
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.values)); } catch { /* storage blocked: settings last this session */ }
  }

  apply() {
    if (!this.root?.classList) return;
    for (const [k, cls] of Object.entries(OPTION_CLASSES)) this.root.classList.toggle(cls, !!this.values[k]);
  }

  get(k) { return this.values[k]; }
  set(k, v) {
    if (!(k in OPTION_CLASSES)) throw new Error(`Unknown setting ${k}`);
    this.values[k] = !!v;
    this._changed({ type: 'option', key: k });
  }

  keyFor(action) { return this.values.keys[action]; }
  keyLabel(action) { return labelOfKey(this.keyFor(action) ?? '?'); }

  /** Does this keydown trigger the action? Ignores typing in inputs and Ctrl/Cmd chords. */
  matches(e, action) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return false;
    return keyOf(e) === this.values.keys[action];
  }

  /** Bind a key to an action; if another action had it, they swap. Returns { ok, swapped? } */
  rebind(action, key) {
    const k = keyOf(key);
    if (!ACTIONS.some((a) => a.id === action)) return { ok: false, reason: 'Unknown action' };
    if (RESERVED.has(k)) return { ok: false, reason: `${labelOfKey(k)} is reserved` };
    const other = ACTIONS.find((a) => a.id !== action && this.values.keys[a.id] === k);
    if (other) this.values.keys[other.id] = this.values.keys[action];
    this.values.keys[action] = k;
    this._changed({ type: 'key', action, swapped: other?.id ?? null });
    return { ok: true, swapped: other?.id ?? null };
  }

  reset() { this.values = structuredClone(DEFAULTS); this._changed({ type: 'reset' }); }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _changed(e) { this.save(); this.apply(); for (const fn of this.listeners) fn(e, this); }
}

/** The game's one settings instance. */
export const settings = new Settings();

/** Keep a button's "[KEY]" hint in step with the rebinding table: keyHint(button, 'THREATS', 'threats'). */
export function keyHint(node, text, action, { title = false } = {}) {
  const put = () => {
    const s = `${text} [${settings.keyLabel(action)}]`;
    if (title) node.title = s; else node.textContent = s;
  };
  put();
  settings.onChange(put);
  return node;
}
