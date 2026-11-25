// SETTINGS panel (#94): accessibility toggles and the key rebinding table. Opens from the clock bar
// or its key (O by default); the clock holds while it is open.

import { settings, ACTIONS, labelOfKey, keyHint } from './settings.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

const OPTIONS = [
  ['trackPatterns', 'Crisis patterns', 'Hatching on crisis gauges and world-map regions (dots = uneasy, stripes = edge, crosshatch = tipping or breached), so no zone relies on colour alone.'],
  ['reducedFlash', 'Reduced flashing', 'No blinking or shaking anywhere. The breach alert arrives as a steady dark card instead of a flashing red screen.'],
  ['reducedLighting', 'Reduced lighting', 'Turns the lighting and mood down: no flickering power or dark vignette as tension rises, a lighter colour shift, softer lamp glows.'],
  ['cleanFont', 'Clean font', 'A plain sans-serif font instead of the typewriter one.'],
];

export function createSettingsPanel({ root = document.body } = {}) {
  const overlay = el('div', 'report-overlay set-overlay');
  overlay.hidden = true;
  const box = el('section', 'set-panel');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Settings');
  overlay.append(box);
  root.append(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) toggle(false); });
  let waiting = null; // action id waiting for a key press
  let note = '';

  function render() {
    if (overlay.hidden) return;
    const head = el('div', 'set-head');
    const close = el('button', 'set-btn', `CLOSE [${settings.keyLabel('settings')}]`);
    close.type = 'button';
    close.onclick = () => toggle(false);
    head.append(el('div', 'set-title', 'SETTINGS'), close);
    const opts = el('div', 'set-opts');
    for (const [id, label, help] of OPTIONS) {
      const row = el('label', 'set-opt');
      const box2 = el('input');
      box2.type = 'checkbox';
      box2.checked = settings.get(id);
      box2.onchange = () => { settings.set(id, box2.checked); render(); };
      const txt = el('span');
      txt.append(el('b', null, label), el('small', null, help));
      row.append(box2, txt);
      opts.append(row);
    }
    const keys = el('div', 'set-keys');
    keys.append(el('div', 'set-sub', 'CONTROLS · click a key, then press the new one (Esc cancels)'));
    for (const a of ACTIONS) {
      const row = el('div', 'set-key');
      const b = el('button', 'set-btn set-keybtn', waiting === a.id ? 'PRESS A KEY…' : labelOfKey(settings.keyFor(a.id)));
      b.type = 'button';
      b.dataset.waiting = String(waiting === a.id);
      b.onclick = () => { waiting = waiting === a.id ? null : a.id; note = ''; render(); };
      row.append(el('span', null, a.label), b);
      keys.append(row);
    }
    const foot = el('div', 'set-foot');
    const reset = el('button', 'set-btn', 'RESET TO DEFAULTS');
    reset.type = 'button';
    reset.onclick = () => { settings.reset(); note = 'Defaults restored.'; render(); };
    foot.append(el('span', 'set-note', note), reset);
    box.replaceChildren(head, opts, keys, foot, el('div', 'set-later', 'Subtitles and configurable auto-pause come with the voice lines and the pause rules.'));
  }

  // Capture phase, so the key being bound never reaches the game.
  const onKeyCapture = (e) => {
    if (overlay.hidden || !waiting) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { waiting = null; render(); return; }
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    const action = waiting;
    const r = settings.rebind(action, e.key);
    waiting = null;
    note = r.ok ? `${ACTIONS.find((x) => x.id === action).label}: ${settings.keyLabel(action)}${r.swapped ? ` (swapped with ${ACTIONS.find((x) => x.id === r.swapped).label})` : ''}.` : r.reason;
    render();
  };
  const onKey = (e) => {
    if (settings.matches(e, 'settings')) { e.preventDefault(); toggle(); }
    else if (e.key === 'Escape' && !overlay.hidden) toggle(false);
  };
  addEventListener('keydown', onKeyCapture, true);
  addEventListener('keydown', onKey);

  function toggle(on = overlay.hidden) { overlay.hidden = !on; waiting = null; note = ''; render(); }
  const button = keyHint(el('button'), 'SETTINGS', 'settings');
  button.type = 'button';
  button.title = 'Accessibility options and key bindings';
  button.onclick = () => toggle();
  return { toggle, render, button, get open() { return !overlay.hidden; }, destroy() { removeEventListener('keydown', onKeyCapture, true); removeEventListener('keydown', onKey); overlay.remove(); } };
}
