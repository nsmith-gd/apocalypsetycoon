// HUD, view toggle and end-of-quarter report ("the one ledger").
// Plain DOM so it overlays whatever renders the grid and the world map.
//
// Usage:
//   const ui = createGameUI({ root, ledger, views: { grid: gridEl, map: mapEl } });
//   ui.update({ quarter, totalQuarters, heat, tension, boardTarget });
//   await ui.showQuarterReport({ quarter, boardTarget, heat, tension });

import { formatMoney } from '../ledger/ledger.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

function meter(label, title) {
  const wrap = el('div', 'hud-stat hud-meter');
  wrap.title = title;
  wrap.append(el('span', 'hud-label', label));
  const bar = el('div', 'hud-bar');
  const fill = el('div', 'hud-bar-fill');
  bar.append(fill);
  const value = el('span', 'hud-value');
  wrap.append(bar, value);
  return {
    wrap,
    set(v, zones) {
      const pct = Math.max(0, Math.min(100, v));
      fill.style.width = `${pct}%`;
      const zone = zones.find((z) => pct < z.below) ?? zones[zones.length - 1];
      wrap.dataset.zone = zone.name;
      value.textContent = `${Math.round(pct)} ${zone.word}`;
    },
  };
}

// Tension zones follow pillar 1: the richest zone sits just below the tipping point.
const TENSION_ZONES = [
  { below: 40, name: 'calm', word: 'CALM' },
  { below: 70, name: 'uneasy', word: 'UNEASY' },
  { below: 90, name: 'edge', word: 'EDGE $$$' },
  { below: 101, name: 'tipping', word: 'TIPPING' },
];
const HEAT_ZONES = [
  { below: 35, name: 'calm', word: 'LOW' },
  { below: 70, name: 'uneasy', word: 'WATCHED' },
  { below: 101, name: 'tipping', word: 'HOT' },
];

export function createGameUI({ root, ledger, views = {}, onViewChange, initialView = 'grid' }) {
  root.classList.add('at-ui');

  // ---------- HUD ----------
  const hud = el('header', 'hud');
  const brand = el('div', 'hud-brand', 'LAST RESORT HOLDINGS');

  const cashBox = el('div', 'hud-stat hud-cash');
  cashBox.append(el('span', 'hud-label', 'CASH'));
  const cashValue = el('span', 'hud-value hud-big');
  const cashDelta = el('span', 'hud-delta');
  cashBox.append(cashValue, cashDelta);

  const qBox = el('div', 'hud-stat hud-quarter');
  qBox.append(el('span', 'hud-label', 'QUARTER'));
  const qValue = el('span', 'hud-value hud-big');
  const qPips = el('div', 'hud-pips');
  qBox.append(qValue, qPips);

  const heat = meter('HEAT', 'Heat: how closely regulators and press are watching you.');
  const tension = meter('TENSION', 'World tension. Profit peaks just below the tipping point.');

  const boardBox = el('div', 'hud-stat hud-board');
  boardBox.title = 'Cash the board expects you to hold at the end of this quarter.';
  boardBox.append(el('span', 'hud-label', 'BOARD TARGET'));
  const boardValue = el('span', 'hud-value');
  const boardBar = el('div', 'hud-bar');
  const boardFill = el('div', 'hud-bar-fill');
  boardBar.append(boardFill);
  boardBox.append(boardValue, boardBar);

  // ---------- View toggle ----------
  const toggle = el('nav', 'view-toggle');
  const viewButtons = {};
  for (const [key, label] of [['grid', 'SHELTER'], ['map', 'WORLD MAP']]) {
    const b = el('button', 'view-btn', label);
    b.type = 'button';
    b.addEventListener('click', () => setView(key));
    viewButtons[key] = b;
    toggle.append(b);
  }
  const hint = el('span', 'view-hint', '[TAB]');
  toggle.append(hint);

  hud.append(brand, cashBox, qBox, heat.wrap, tension.wrap, boardBox, toggle);
  root.prepend(hud);

  let view = null;
  function setView(next) {
    if (next === view) return;
    view = next;
    for (const [key, node] of Object.entries(views)) if (node) node.hidden = key !== view;
    for (const [key, b] of Object.entries(viewButtons)) b.classList.toggle('active', key === view);
    root.dataset.view = view;
    onViewChange?.(view);
  }
  setView(initialView);

  const onKey = (e) => {
    if (e.key !== 'Tab' || reportOpen) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    setView(view === 'grid' ? 'map' : 'grid');
  };
  window.addEventListener('keydown', onKey);

  // ---------- Updates ----------
  let state = { quarter: 1, totalQuarters: 12, heat: 0, tension: 0, boardTarget: 0 };
  let deltaTimer = null;

  function render() {
    const cash = ledger.cash;
    cashValue.textContent = formatMoney(cash);
    cashBox.dataset.negative = cash < 0 ? 'true' : 'false';

    qValue.textContent = `Q${state.quarter}/${state.totalQuarters}`;
    qPips.replaceChildren(
      ...Array.from({ length: state.totalQuarters }, (_, i) => {
        const p = el('i', 'pip');
        if (i + 1 < state.quarter) p.classList.add('done');
        if (i + 1 === state.quarter) p.classList.add('now');
        return p;
      }),
    );

    heat.set(state.heat, HEAT_ZONES);
    tension.set(state.tension, TENSION_ZONES);

    const target = state.boardTarget || 0;
    boardValue.textContent = target ? formatMoney(target) : '—';
    const pct = target > 0 ? Math.max(0, Math.min(100, (cash / target) * 100)) : 0;
    boardFill.style.width = `${pct}%`;
    boardBox.dataset.met = target > 0 && cash >= target ? 'true' : 'false';
  }

  ledger.onChange((entry) => {
    render();
    if (!entry) return;
    cashDelta.textContent = formatMoney(entry.amount, { sign: true });
    cashDelta.dataset.dir = entry.amount > 0 ? 'up' : 'down';
    cashDelta.classList.remove('flash');
    void cashDelta.offsetWidth; // restart CSS animation
    cashDelta.classList.add('flash');
    clearTimeout(deltaTimer);
    deltaTimer = setTimeout(() => cashDelta.classList.remove('flash'), 1200);
  });

  function update(patch) {
    state = { ...state, ...patch };
    if (patch.quarter != null) ledger.setQuarter(patch.quarter);
    render();
  }
  render();

  // ---------- Quarter report ----------
  let reportOpen = false;

  function showQuarterReport({ quarter = state.quarter, boardTarget = state.boardTarget, heat: h = state.heat, tension: t = state.tension, notes = [] } = {}) {
    const s = ledger.summary(quarter);
    reportOpen = true;

    const overlay = el('div', 'report-overlay');
    const paper = el('section', 'report');
    paper.setAttribute('role', 'dialog');
    paper.setAttribute('aria-label', `Quarter ${quarter} report`);

    const head = el('div', 'report-head');
    head.append(el('div', 'report-company', 'LAST RESORT HOLDINGS'), el('div', 'report-title', `QUARTER ${quarter} LEDGER`), el('div', 'report-sub', 'Confidential. For the board only.'));
    paper.append(head);

    const table = el('table', 'report-table');
    const addRow = (cls, label, amount, count) => {
      const tr = el('tr', cls);
      const l = el('td', 'r-label', label);
      if (count > 1) l.append(el('span', 'r-count', ` x${count}`));
      const a = el('td', 'r-amount', amount == null ? '' : formatMoney(amount, { sign: true }));
      if (amount != null) a.dataset.dir = amount >= 0 ? 'up' : 'down';
      tr.append(l, a);
      table.append(tr);
    };

    addRow('r-opening', 'Opening cash', null);
    table.lastChild.lastChild.textContent = formatMoney(s.opening);

    if (!s.groups.length) addRow('r-empty', 'No transactions this quarter.', null);
    for (const g of s.groups) {
      addRow('r-group', `${g.icon} ${g.label.toUpperCase()}`, g.total);
      for (const line of g.lines) addRow('r-line', line.label, line.amount, line.count);
    }
    addRow('r-total', 'Total income', s.income);
    addRow('r-total', 'Total expenses', s.expenses);
    addRow('r-net', 'NET THIS QUARTER', s.net);
    addRow('r-closing', 'Closing cash', null);
    table.lastChild.lastChild.textContent = formatMoney(s.closing);
    paper.append(table);

    const verdict = el('div', 'report-verdict');
    if (boardTarget > 0) {
      const met = s.closing >= boardTarget;
      verdict.dataset.met = String(met);
      verdict.append(
        el('div', 'v-stamp', met ? 'TARGET MET' : 'TARGET MISSED'),
        el('div', 'v-text', `Board target ${formatMoney(boardTarget)}. ${met ? 'The board is pleased. For now.' : `Short by ${formatMoney(boardTarget - s.closing)}. The board has noticed.`}`),
      );
    }
    const vitals = el('div', 'v-vitals', `Heat ${Math.round(h)}  ·  Tension ${Math.round(t)}`);
    verdict.append(vitals);
    for (const n of notes) verdict.append(el('div', 'v-note', n));
    paper.append(verdict);

    const btn = el('button', 'report-continue', quarter >= state.totalQuarters ? 'FACE MIDNIGHT' : `BEGIN Q${quarter + 1}`);
    btn.type = 'button';
    paper.append(btn);
    overlay.append(paper);
    root.append(overlay);
    btn.focus();

    return new Promise((resolve) => {
      const close = () => {
        overlay.remove();
        reportOpen = false;
        window.removeEventListener('keydown', onEnter);
        resolve(s);
      };
      const onEnter = (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); close(); }
      };
      btn.addEventListener('click', close);
      window.addEventListener('keydown', onEnter);
    });
  }

  return {
    update,
    setView,
    get view() { return view; },
    showQuarterReport,
    destroy() {
      window.removeEventListener('keydown', onKey);
      hud.remove();
    },
  };
}
