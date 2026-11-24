// Research panel: a HUD chip showing RP income and the active project, a full tree overlay
// (toggle with the chip or the R key), and toasts for unlocks and crisis-profit deposits.
//
//   const panel = createResearchPanel({ root, tree, getCrisis, mode: 'weekly' });
//   hudElement.insertBefore(panel.chip, someNode);
// mode 'weekly': RP arrives as weekly crisis grants (the campaign, #16). 'continuous': the older
// per-second trickle from tree.tick() (demos).

import { BRANCHES, researchZone, effectLabel } from '../research/research.js';
import { OBJECTS } from '../shelter/bunker-catalog.js';
import { formatMoney } from '../ledger/ledger.js';
import { settings, keyHint } from '../settings/settings.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const rp = (n) => `${Math.floor(n)} RP`;
const OBJECT_NAMES = Object.fromEntries(Object.entries(OBJECTS).map(([id, o]) => [id, o.name]));
const fxText = (node) => (node.effects ?? []).map((e) => effectLabel(e, OBJECT_NAMES)).join(' · ') || node.unlocks?.label || '';

export function createResearchPanel({ root, tree, getCrisis = () => 0, mode = 'continuous' }) {
  const weekly = mode === 'weekly';
  // ---------- HUD chip ----------
  const chip = el('button', 'hud-stat research-chip');
  chip.type = 'button';
  chip.title = 'Research (R). Crises fund your labs: every track at Simmer, Boil or Brink pays research grants each week.';
  const chipLabel = keyHint(el('span', 'hud-label'), 'RESEARCH', 'research');
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
  const close = keyHint(el('button', 'research-close'), 'CLOSE', 'research');
  close.type = 'button';
  close.addEventListener('click', () => toggle(false));
  head.append(el('div', 'research-title', 'R&D: CRISIS-FUNDED LABS'), close);

  const funding = el('div', 'research-funding rf2');
  const fundRate = el('div', 'rf-rate');
  const fundZone = el('div', 'rf-zone');
  const fundGrants = el('div', 'rf-grants');
  const fundPool = el('div', 'rf-pool');
  const fundSources = el('div', 'rf-sources');
  const fundLog = el('div', 'rf-log');
  funding.append(fundRate, fundZone, fundGrants, fundPool, fundSources, fundLog);
  const msg = el('div', 'rf-msg');

  const cols = el('div', 'research-cols');
  const cards = new Map();
  for (const [branch, label] of Object.entries(BRANCHES)) {
    const nodes = tree.nodes.filter((n) => n.branch === branch);
    if (!nodes.length) continue;
    const col = el('div', 'research-col');
    col.append(el('div', 'research-col-title', label.toUpperCase()));
    for (const node of nodes) {
      const card = el('button', 'research-card');
      card.type = 'button';
      card.dataset.id = node.id;
      const name = el('div', 'rc-name', node.name);
      const cost = el('div', 'rc-cost', `T${node.tier ?? '?'} · ${node.rp ?? node.cost ?? 0} RP${node.cash ? ` + ${formatMoney(node.cash)}` : ''}`);
      const meta = el('div', 'rc-meta');
      const fx = el('div', 'rc-effects', fxText(node));
      const blurb = el('div', 'rc-blurb', node.blurb);
      const bar = el('div', 'hud-bar');
      const fill = el('div', 'hud-bar-fill');
      bar.append(fill);
      card.append(name, cost, meta, fx, blurb, bar);
      card.addEventListener('click', () => {
        const why = tree.blocker?.(node.id);
        if (why && tree.status(node.id) !== 'active') { msg.textContent = `${node.name}: ${why}.`; return; }
        msg.textContent = '';
        if (!tree.buy?.(node.id)) tree.start(node.id);
      });
      cards.set(node.id, { card, meta, fill });
      col.append(card);
    }
    cols.append(col);
  }
  panel.append(head, funding, msg, cols);
  overlay.append(panel);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) toggle(false); });
  root.append(overlay);

  // ---------- Toasts ----------
  const toasts = el('div', 'toast-stack');
  root.append(toasts);
  const toast = (title, body, cls = '') => {
    const t = el('div', `toast ${cls}`.trim());
    t.append(el('div', 'toast-title', title), el('div', 'toast-body', body));
    toasts.append(t);
    setTimeout(() => t.remove(), 3500);
  };
  tree.onFund?.((e) => { if (e.dollars) toast('CRISIS PROFITS → R&D', `+${e.rp} RP from ${formatMoney(e.dollars)} of panic premium`, 'toast-fund'); });
  tree.onUnlock((node) => toast('RESEARCH COMPLETE', `${node.name}: ${fxText(node)}`));

  // ---------- Render ----------
  function render() {
    const crisis = getCrisis();
    const zone = researchZone(crisis);
    const lastWeek = tree.lastWeek?.total ?? 0;
    chip.dataset.zone = weekly ? (lastWeek >= 15 ? 'edge' : lastWeek > 0 ? 'uneasy' : 'calm') : zone.name;
    chipRate.textContent = weekly ? `+${lastWeek} RP/week` : `+${tree.rate.toFixed(1)} RP/s`;
    const active = tree.active ? tree.byId.get(tree.active) : null;
    chipFill.style.width = active ? `${tree.fraction(active.id) * 100}%` : '0%';
    chipProject.textContent = active ? active.name : `Idle: ${rp(tree.pool)} banked`;
    chip.dataset.idle = active ? 'false' : 'true';

    if (overlay.hidden) return;
    if (weekly) {
      fundRate.textContent = `+${lastWeek} RP last week`;
      fundZone.textContent = lastWeek ? 'CRISIS GRANTS: the hotter the world, the faster you unlock' : 'CALM WORLD: no grants. Stoke a crisis to Simmer or hotter.';
      fundZone.dataset.zone = lastWeek >= 15 ? 'edge' : lastWeek ? 'uneasy' : 'calm';
      fundGrants.replaceChildren(...(tree.lastWeek?.lines ?? []).map((l) => el('span', `rf-grant rf-${l.band.toLowerCase()}`, `${l.name} ${l.band.toUpperCase()} +${l.rp}`)));
    } else {
      fundRate.textContent = `+${tree.rate.toFixed(1)} RP/s`;
      fundZone.textContent = `Crisis ${Math.round(crisis)}: ${zone.label}`;
      fundZone.dataset.zone = zone.name;
      fundGrants.replaceChildren();
    }
    fundPool.textContent = `Banked ${rp(tree.pool)} · Crews ${tree.crewCount}`;
    const src = tree.sources ?? { grants: tree.totalEarned, income: 0 };
    const total = Math.max(1, src.grants + src.income);
    fundSources.replaceChildren(
      el('span', 'rf-src grants', `Crisis grants ${rp(src.grants)} (${Math.round((src.grants / total) * 100)}%)`),
      el('span', 'rf-src income', `Panic-premium profits ${rp(src.income)} (${Math.round((src.income / total) * 100)}%)`),
    );
    fundLog.replaceChildren(...(tree.incomeLog ?? []).filter((e) => e.dollars).slice(0, 2).map((e) => el('div', 'rf-log-row', `+${e.rp} RP ← ${formatMoney(e.dollars)}: ${e.label}`)));
    for (const [id, { card, meta, fill }] of cards) {
      const node = tree.byId.get(id);
      const s = tree.status(id);
      const why = tree.blocker?.(id);
      card.dataset.status = s;
      card.dataset.afford = String(s === 'available' && !why);
      card.disabled = s === 'locked' || s === 'done';
      fill.style.width = `${tree.fraction(id) * 100}%`;
      if (s === 'done') meta.textContent = 'DONE';
      else if (s === 'locked') meta.textContent = `LOCKED · ${why ?? ''}`;
      else if (s === 'active') meta.textContent = `RESEARCHING · ${Math.floor(tree.progress.get(id) ?? 0)}/${node.rp ?? node.cost} RP`;
      else if (why) meta.textContent = why.toUpperCase();
      else meta.textContent = (node.rp ?? node.cost) ? 'Click to fund and start' : 'Click to buy: lands at once';
    }
  }

  function toggle(force) {
    overlay.hidden = force != null ? !force : !overlay.hidden;
    msg.textContent = '';
    render();
  }

  tree.onChange(render);
  tree.ledger?.onChange?.(() => { if (!overlay.hidden) render(); });
  const onKey = (e) => {
    if (settings.matches(e, 'research')) toggle();
    if (e.key === 'Escape' && !overlay.hidden) toggle(false);
  };
  window.addEventListener('keydown', onKey);
  render();

  return { chip, toggle, render, get open() { return !overlay.hidden; }, destroy() { window.removeEventListener('keydown', onKey); overlay.remove(); toasts.remove(); } };
}
