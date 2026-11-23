// Research panel: a HUD chip showing RP income and the active project, a full tree
// overlay (toggle with the chip or the R key), and an unlock toast.
//
//   const panel = createResearchPanel({ root, tree, getCrisis: () => state.tension });
//   hudElement.insertBefore(panel.chip, someNode);

import { BRANCHES, researchRate, researchZone, TIPPING_POINT } from '../research/research.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const rp = (n) => `${Math.floor(n)} RP`;

export function createResearchPanel({ root, tree, getCrisis = () => 0 }) {
  // ---------- HUD chip ----------
  const chip = el('button', 'hud-stat research-chip');
  chip.type = 'button';
  chip.title = 'Research (R). Crises fund your labs: more crisis, more RP, until the world tips.';
  const chipLabel = el('span', 'hud-label', 'RESEARCH [R]');
  const chipRate = el('span', 'hud-value');
  const chipBar = el('div', 'hud-bar');
  const chipFill = el('div', 'hud-bar-fill');
  chipBar.append(chipFill);
  const chipProject = el('span', 'research-chip-project');
  chip.append(chipLabel, chipRate, chipBar, chipProject);
  chip.addEventListener('click', () => toggle());

  // ---------- Overlay ----------
  const overlay = el('div', 'report-overlay research-overlay');
  overlay.hidden = true;
  const panel = el('section', 'research-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Research');
  const head = el('div', 'research-head');
  const title = el('div', 'research-title', 'R&D: CRISIS-FUNDED LABS');
  const close = el('button', 'research-close', 'CLOSE [R]');
  close.type = 'button';
  close.addEventListener('click', () => toggle(false));
  head.append(title, close);

  const funding = el('div', 'research-funding');
  const fundRate = el('div', 'rf-rate');
  const fundZone = el('div', 'rf-zone');
  const fundCurve = el('div', 'rf-curve');
  const fundPool = el('div', 'rf-pool');
  funding.append(fundRate, fundZone, fundCurve, fundPool);

  const cols = el('div', 'research-cols');
  const cards = new Map();
  for (const [branch, label] of Object.entries(BRANCHES)) {
    const col = el('div', 'research-col');
    col.append(el('div', 'research-col-title', label.toUpperCase()));
    for (const node of tree.nodes.filter((n) => n.branch === branch)) {
      const card = el('button', 'research-card');
      card.type = 'button';
      card.dataset.id = node.id;
      const name = el('div', 'rc-name', node.name);
      const meta = el('div', 'rc-meta');
      const blurb = el('div', 'rc-blurb', node.blurb);
      const bar = el('div', 'hud-bar');
      const fill = el('div', 'hud-bar-fill');
      bar.append(fill);
      card.append(name, meta, blurb, bar);
      card.addEventListener('click', () => tree.start(node.id));
      cards.set(node.id, { card, meta, fill });
      col.append(card);
    }
    cols.append(col);
  }
  panel.append(head, funding, cols);
  overlay.append(panel);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) toggle(false); });
  root.append(overlay);

  // Mini curve: 21 bars of RP rate across crisis 0..100, current crisis highlighted.
  const curveBars = [];
  for (let i = 0; i <= 20; i++) {
    const b = el('i', 'rf-bar');
    curveBars.push(b);
    fundCurve.append(b);
  }

  // ---------- Toast ----------
  const toasts = el('div', 'toast-stack');
  root.append(toasts);
  tree.onUnlock((node) => {
    const t = el('div', 'toast');
    t.append(el('div', 'toast-title', 'RESEARCH COMPLETE'), el('div', 'toast-body', `${node.unlocks.label}${node.unlocks.type === 'amenity' ? ' added to the build palette' : node.unlocks.type === 'scheme' ? ' added to your schemes' : ' hired'}`));
    toasts.append(t);
    setTimeout(() => t.remove(), 4000);
  });

  // ---------- Render ----------
  function render() {
    const crisis = getCrisis();
    const zone = researchZone(crisis);
    chip.dataset.zone = zone.name;
    chipRate.textContent = `+${tree.rate.toFixed(1)} RP/s`;
    const active = tree.active ? tree.byId.get(tree.active) : null;
    chipFill.style.width = active ? `${tree.fraction(active.id) * 100}%` : '0%';
    chipProject.textContent = active ? active.name : `Idle: ${rp(tree.pool)} banked`;
    chip.dataset.idle = active ? 'false' : 'true';

    if (overlay.hidden) return;
    fundRate.textContent = `+${tree.rate.toFixed(1)} RP/s`;
    fundZone.textContent = `Crisis ${Math.round(crisis)}: ${zone.label}`;
    fundZone.dataset.zone = zone.name;
    fundPool.textContent = `Banked ${rp(tree.pool)} · Crews ${tree.crewCount}`;
    curveBars.forEach((b, i) => {
      const c = i * 5;
      b.style.height = `${(researchRate(c) / researchRate(TIPPING_POINT - 2)) * 100}%`;
      b.classList.toggle('now', Math.abs(c - crisis) < 2.5);
      b.classList.toggle('tipped', c >= TIPPING_POINT);
    });
    for (const [id, { card, meta, fill }] of cards) {
      const node = tree.byId.get(id);
      const s = tree.status(id);
      card.dataset.status = s;
      card.disabled = s === 'locked' || s === 'done';
      fill.style.width = `${tree.fraction(id) * 100}%`;
      if (s === 'done') meta.textContent = `DONE · ${node.unlocks.label}`;
      else if (s === 'locked') meta.textContent = `LOCKED · needs ${node.requires.map((r) => tree.byId.get(r).name).join(' + ')}`;
      else if (s === 'active') meta.textContent = `RESEARCHING · ${Math.floor(tree.progress.get(id) ?? 0)}/${node.cost} RP`;
      else meta.textContent = `${node.cost} RP · click to research`;
    }
  }

  function toggle(force) {
    overlay.hidden = force != null ? !force : !overlay.hidden;
    render();
  }

  tree.onChange(render);
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) toggle();
    if (e.key === 'Escape' && !overlay.hidden) toggle(false);
  });
  render();

  return { chip, toggle, render, get open() { return !overlay.hidden; } };
}
