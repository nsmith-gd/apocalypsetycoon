// GREYBOX story beat popup (#76): text only, holds the game while open. Resolves when dismissed.
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

export function showBeat({ root = document.body, beat, clockLabel = '' }) {
  return new Promise((resolve) => {
    const overlay = el('div', 'sb-overlay');
    const box = el('section', 'sb');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', beat.title);
    box.append(el('div', 'sb-time', clockLabel), el('h2', 'sb-title', beat.title), el('div', 'sb-who', `${beat.speaker}${beat.role ? ` · ${beat.role}` : ''}`));
    for (const l of beat.lines) box.append(el('p', 'sb-line', l));
    if (beat.footer) box.append(el('p', 'sb-foot', beat.footer));
    const ok = el('button', 'sb-ok', 'CONTINUE');
    ok.type = 'button';
    box.append(ok);
    overlay.append(box);
    root.append(overlay);
    ok.focus();
    const done = () => { removeEventListener('keydown', onKey, true); overlay.remove(); resolve(beat); };
    const onKey = (e) => { if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); done(); } };
    addEventListener('keydown', onKey, true);
    ok.onclick = done;
  });
}
