// HUD, view toggle and end-of-quarter report ("the one ledger").
// Plain DOM so it overlays whatever renders the grid and the world map.
//
// Usage:
//   const ui = createGameUI({ root, ledger, views: { grid: gridEl, map: mapEl } });
//   ui.update({ quarter, totalQuarters, heat, tension, boardTarget });
//   await ui.showQuarterReport({ quarter, boardTarget, heat, tension });

import { formatMoney } from '../ledger/ledger.js';
import { createLedgerChip, createLedgerRail, createLedgerScreen, renderStatement, CATEGORY_CANVAS } from './ledgerRail.js';
import { settings } from '../settings/settings.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

function meter(label, title, kind = '') {
  const wrap = el('div', `hud-stat hud-meter${kind ? ` hud-${kind}` : ''}`); // hud-heat / hud-tension: theme colours (#126)
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

// rail: an element to dock the always-on ledger rail into (optional). Without it the HUD's
// ledger chip still shows this quarter's net and the latest line at all times.
export function createGameUI({ root, ledger, views = {}, onViewChange, initialView = 'grid', rail = null }) {
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

  const heat = meter('HEAT', 'Heat: how closely regulators and press are watching you.', 'heat');
  const tension = meter('TENSION', 'World tension. Profit peaks just below the tipping point.', 'tension');

  const boardBox = el('div', 'hud-stat hud-board');
  boardBox.title = 'Profit the board expects this quarter. Miss it and you take a strike; three strikes and you are out.';
  boardBox.append(el('span', 'hud-label', 'BOARD TARGET'));
  const boardValue = el('span', 'hud-value');
  const boardStrikes = el('span', 'hud-strikes');
  boardBox.append(boardStrikes);
  const boardBar = el('div', 'hud-bar');
  const boardFill = el('div', 'hud-bar-fill');
  boardBar.append(boardFill);
  boardBox.append(boardValue, boardBar);

  // ---------- View toggle ----------
  const toggle = el('nav', 'view-toggle');
  const viewButtons = {};
  for (const [key, label, n] of [['grid', 'SHELTER', 1], ['map', 'WORLD MAP', 2]]) {
    const b = el('button', 'view-btn', label);
    b.type = 'button';
    b.dataset.view = key;
    b.title = `${label === 'SHELTER' ? 'Shelter grid: what you build' : 'World map: what you sell'} (${n} or TAB)`;
    b.append(el('i', 'view-badge'));
    b.addEventListener('click', () => setView(key));
    viewButtons[key] = b;
    toggle.append(b);
  }
  const hint = el('span', 'view-hint');
  const putHint = () => { hint.textContent = `[${settings.keyLabel('switchCanvas')}]`; };
  putHint();
  settings.onChange(putHint);
  toggle.append(hint);

  // ---------- Ledger: chip in the HUD, optional docked rail, full screen on L ----------
  const ledgerScreen = createLedgerScreen({ root, ledger });
  const ledgerChip = createLedgerChip({ ledger, onOpen: () => ledgerScreen.toggle() });
  const ledgerRail = rail ? createLedgerRail({ ledger, onOpen: () => ledgerScreen.toggle() }) : null;
  if (ledgerRail) { rail.append(ledgerRail.el); root.dataset.rail = 'true'; }

  hud.append(brand, cashBox, qBox, heat.wrap, tension.wrap, boardBox, ledgerChip.el, toggle);
  root.prepend(hud);
  // Docked panels (the ledger rail) stick just below the HUD, whatever height it wraps to.
  const syncHudHeight = () => root.style.setProperty('--hud-h', `${hud.offsetHeight}px`);
  const hudObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncHudHeight) : null;
  hudObserver?.observe(hud);
  syncHudHeight();

  let view = null;
  function setView(next) {
    if (next === view) return;
    view = next;
    for (const [key, node] of Object.entries(views)) if (node) node.hidden = key !== view;
    for (const [key, b] of Object.entries(viewButtons)) {
      b.classList.toggle('active', key === view);
      if (key === view) b.dataset.badge = 'false';
    }
    const shown = views[view];
    if (shown) { shown.classList.remove('view-in'); void shown.offsetWidth; shown.classList.add('view-in'); }
    root.dataset.view = view;
    onViewChange?.(view);
  }
  setView(initialView);

  const onKey = (e) => {
    if (reportOpen || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (settings.matches(e, 'ledger')) { e.preventDefault(); ledgerScreen.toggle(); return; }
    if (e.key === 'Escape' && ledgerScreen.open) { e.preventDefault(); ledgerScreen.toggle(false); return; }
    if (ledgerScreen.open) return;
    if (settings.matches(e, 'switchCanvas')) { e.preventDefault(); setView(view === 'grid' ? 'map' : 'grid'); }
    else if (settings.matches(e, 'shelter') && views.grid) setView('grid');
    else if (settings.matches(e, 'map') && views.map) setView('map');
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
    // boardProgress (this quarter's profit so far) wins over cash on hand when the board system supplies it.
    const progress = state.boardProgress ?? cash;
    const pct = target > 0 ? Math.max(0, Math.min(100, (progress / target) * 100)) : 0;
    boardFill.style.width = `${pct}%`;
    boardBox.dataset.met = target > 0 && progress >= target ? 'true' : 'false';
    if (state.boardTitle) boardBox.title = state.boardTitle;
    const strikes = state.boardStrikes ?? 0;
    boardStrikes.textContent = strikes ? 'X'.repeat(strikes) : '';
    boardStrikes.title = strikes ? `${strikes} strike${strikes > 1 ? 's' : ''} with the board` : '';
  }

  ledger.onChange((entry) => {
    render();
    if (!entry) return;
    // Money made on the other canvas lights that canvas's button: one ledger, two canvases.
    const from = CATEGORY_CANVAS[entry.category];
    if (from && from !== view && viewButtons[from] && views[from]) viewButtons[from].dataset.badge = 'true';
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
    ledgerRail?.setBoard({ target: state.boardTarget, progress: state.boardProgress ?? null });
    ledgerChip.render();
    render();
  }
  render();

  // ---------- Quarter report ----------
  let reportOpen = false;

  function showQuarterReport({ quarter = state.quarter, boardTarget = state.boardTarget, heat: h = state.heat, tension: t = state.tension, notes = [], board = null } = {}) {
    const s = ledger.summary(quarter);
    reportOpen = true;

    const overlay = el('div', 'report-overlay');
    const paper = el('section', 'report');
    paper.setAttribute('role', 'dialog');
    paper.setAttribute('aria-label', `Quarter ${quarter} report`);

    const head = el('div', 'report-head');
    head.append(el('div', 'report-company', 'LAST RESORT HOLDINGS'), el('div', 'report-title', `QUARTER ${quarter} LEDGER`), el('div', 'report-sub', 'Confidential. For the board only.'));
    paper.append(head);

    const table = renderStatement(s);
    paper.append(table);

    const verdict = el('div', 'report-verdict');
    if (board) {
      // Verdict supplied by the board system (quarterly profit vs target).
      verdict.dataset.met = String(board.met);
      if (board.revenue != null) verdict.append(
        el('div', 'v-stamp', board.met ? 'QUOTA MET' : 'QUOTA MISSED'),
        el('div', 'v-text', `Revenue ${formatMoney(board.revenue)} vs a ${formatMoney(board.target)} quota. Board confidence ${board.average}: ${board.state}.`),
      );
      else verdict.append(
        el('div', 'v-stamp', board.met ? 'TARGET MET' : 'TARGET MISSED'),
        el('div', 'v-text', `Operating profit ${formatMoney(board.profit)} vs board target ${formatMoney(board.target)}. ${board.met ? 'The board is pleased. For now.' : `Short by ${formatMoney(board.target - board.profit)}. Strike ${board.strikes}.`}`),
      );
    } else if (boardTarget > 0) {
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
    ledgerRail,
    ledgerScreen,
    destroy() {
      window.removeEventListener('keydown', onKey);
      hudObserver?.disconnect();
      hud.remove();
    },
  };
}
