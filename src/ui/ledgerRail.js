// The shared ledger, always on screen (pillar 2: two canvases, one ledger).
//
//   createLedgerChip({ ledger, onOpen })        -> compact HUD chip: this quarter's net + last line
//   createLedgerRail({ ledger, onOpen })        -> docked side rail: category totals, board progress,
//                                                  live transaction feed. Stays put when the canvas switches.
//   createLedgerScreen({ root, ledger })        -> full ledger overlay (L): any quarter itemised + history.
//   renderStatement(summary)                    -> the itemised table, shared with the quarter report.
//
// Every one of them reads the same Ledger instance, so a build on the shelter grid and a sale
// on the world map land in the same numbers the moment they happen.

import { CATEGORIES, formatMoney } from '../ledger/ledger.js';
import { keyHint } from '../settings/settings.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** Which canvas each kind of money comes from. Shown as a tag so the player sees both feed one ledger. */
export const CATEGORY_CANVAS = Object.freeze({
  builds: 'grid',
  sales: 'map',
  schemes: 'map',
  fines: null,
  upkeep: null,
  other: null,
});
const CANVAS_TAG = { grid: 'SHELTER', map: 'MAP' };

// Rows the rail always shows, even at zero, so the layout doesn't jump around.
const RAIL_ROWS = ['sales', 'builds', 'schemes', 'fines', 'upkeep'];

// ---------------------------------------------------------------- chip
export function createLedgerChip({ ledger, onOpen }) {
  const chip = el('button', 'hud-stat ledger-chip');
  chip.type = 'button';
  chip.title = 'The ledger: every build, sale, scheme and fine. Click or press L for the full books.';
  chip.append(keyHint(el('span', 'hud-label'), 'LEDGER', 'ledger'));
  const net = el('span', 'hud-value');
  const last = el('span', 'ledger-chip-last');
  chip.append(net, last);
  chip.addEventListener('click', () => onOpen?.());

  function render(entry) {
    const s = ledger.summary(ledger.quarter);
    net.textContent = `Q${ledger.quarter} net ${formatMoney(s.net, { sign: true })}`;
    net.dataset.dir = s.net >= 0 ? 'up' : 'down';
    const e = entry ?? ledger.recent(1)[0];
    last.textContent = e ? `${formatMoney(e.amount, { sign: true })} ${e.label}` : 'No entries yet';
    if (entry) {
      chip.classList.remove('ping');
      void chip.offsetWidth;
      chip.classList.add('ping');
    }
  }
  const off = ledger.onChange((entry) => render(entry));
  render();
  return { el: chip, render, destroy: off };
}

// ---------------------------------------------------------------- rail
export function createLedgerRail({ ledger, onOpen, feedSize = 7 }) {
  const rail = el('aside', 'ledger-rail');
  rail.setAttribute('aria-label', 'Ledger');

  const head = el('div', 'lr-head');
  const title = el('div', 'lr-title');
  const collapse = el('button', 'lr-collapse', '–');
  collapse.type = 'button';
  collapse.title = 'Collapse the ledger rail';
  head.append(title, collapse);

  const netBox = el('div', 'lr-net');
  const netLabel = el('div', 'lr-net-label', 'NET THIS QUARTER');
  const netValue = el('div', 'lr-net-value');
  const target = el('div', 'lr-target');
  const targetBar = el('div', 'hud-bar');
  const targetFill = el('div', 'hud-bar-fill');
  targetBar.append(targetFill);
  netBox.append(netLabel, netValue, targetBar, target);

  const cats = el('table', 'lr-cats');
  const feedTitle = el('div', 'lr-sub', 'LATEST');
  const feed = el('ol', 'lr-feed');
  const cashRow = el('div', 'lr-cash');
  const open = el('button', 'lr-open', 'FULL LEDGER [L]');
  open.type = 'button';
  open.addEventListener('click', () => onOpen?.());

  const body = el('div', 'lr-body');
  body.append(netBox, cats, feedTitle, feed, cashRow, open);
  rail.append(head, body);

  let collapsed = false;
  collapse.addEventListener('click', () => setCollapsed(!collapsed));
  function setCollapsed(v) {
    collapsed = v;
    rail.dataset.collapsed = String(v);
    collapse.textContent = v ? '+' : '–';
    collapse.title = v ? 'Expand the ledger rail' : 'Collapse the ledger rail';
  }

  let boardTarget = 0;
  let boardProgress = null;
  let lastEntry = null;

  function render() {
    const q = ledger.quarter;
    const s = ledger.summary(q);
    title.textContent = `LEDGER · Q${q}`;
    netValue.textContent = formatMoney(s.net, { sign: true });
    netValue.dataset.dir = s.net >= 0 ? 'up' : 'down';

    const progress = boardProgress ?? s.closing; // same rule as the HUD board meter
    if (boardTarget > 0) {
      const pct = Math.max(0, Math.min(100, (progress / boardTarget) * 100));
      targetFill.style.width = `${pct}%`;
      const met = progress >= boardTarget;
      netBox.dataset.met = String(met);
      target.textContent = met ? `Board target ${formatMoney(boardTarget)} MET` : `${formatMoney(boardTarget - progress)} short of board target`;
    } else {
      targetFill.style.width = '0%';
      netBox.dataset.met = 'false';
      target.textContent = 'No board target set';
    }

    const totals = ledger.totalsByCategory(q);
    const keys = [...RAIL_ROWS, ...Object.keys(totals).filter((k) => !RAIL_ROWS.includes(k))];
    cats.replaceChildren(
      ...keys.map((k) => {
        const tr = el('tr', 'lr-cat');
        tr.dataset.category = k;
        const amount = totals[k] ?? 0;
        const name = el('td', 'lr-cat-name', `${CATEGORIES[k].icon} ${CATEGORIES[k].label}`);
        const tagCell = el('td', 'lr-cat-tag');
        const canvas = CATEGORY_CANVAS[k];
        if (canvas) {
          const tag = el('span', 'lr-tag', CANVAS_TAG[canvas]);
          tag.dataset.canvas = canvas;
          tagCell.append(tag);
        }
        const val = el('td', 'lr-cat-val', amount ? formatMoney(amount, { sign: true }) : '—');
        if (amount) val.dataset.dir = amount > 0 ? 'up' : 'down';
        if (lastEntry && lastEntry.category === k && lastEntry.quarter === q) tr.classList.add('hit');
        tr.append(name, tagCell, val);
        return tr;
      }),
    );

    const recent = ledger.recent(feedSize);
    feed.replaceChildren(
      ...(recent.length
        ? recent.map((e, i) => {
            const li = el('li', 'lr-line');
            if (i === 0 && e === lastEntry) li.classList.add('fresh');
            const canvas = CATEGORY_CANVAS[e.category];
            if (canvas) li.dataset.canvas = canvas;
            const amt = el('span', 'lr-line-amt', formatMoney(e.amount, { sign: true }));
            amt.dataset.dir = e.amount > 0 ? 'up' : 'down';
            const lbl = el('span', 'lr-line-label', e.label);
            lbl.title = `Q${e.quarter} · ${CATEGORIES[e.category].label} · ${e.label}`;
            li.append(amt, lbl);
            return li;
          })
        : [el('li', 'lr-line lr-empty', 'Nothing on the books yet.')]),
    );

    cashRow.replaceChildren(el('span', null, 'CASH ON HAND'), el('b', null, formatMoney(ledger.cash)));
    cashRow.dataset.negative = String(ledger.cash < 0);
  }

  const off = ledger.onChange((entry) => {
    if (entry) lastEntry = entry;
    render();
  });
  render();

  return {
    el: rail,
    render,
    setCollapsed,
    get collapsed() { return collapsed; },
    /** Board target and (optional) the board system's own progress number. */
    setBoard({ target: t = boardTarget, progress = null } = {}) {
      boardTarget = t || 0;
      boardProgress = progress;
      render();
    },
    destroy() { off(); rail.remove(); },
  };
}

// ---------------------------------------------------------------- statement (shared)
export function renderStatement(s) {
  const table = el('table', 'report-table');
  const addRow = (cls, label, amount, count) => {
    const tr = el('tr', cls);
    const l = el('td', 'r-label', label);
    if (count > 1) l.append(el('span', 'r-count', ` x${count}`));
    const a = el('td', 'r-amount', amount == null ? '' : formatMoney(amount, { sign: true }));
    if (amount != null) a.dataset.dir = amount >= 0 ? 'up' : 'down';
    tr.append(l, a);
    table.append(tr);
    return a;
  };
  addRow('r-opening', 'Opening cash', null).textContent = formatMoney(s.opening);
  if (!s.groups.length) addRow('r-empty', 'No transactions this quarter.', null);
  for (const g of s.groups) {
    addRow('r-group', `${g.icon} ${g.label.toUpperCase()}`, g.total);
    for (const line of g.lines) addRow('r-line', line.label, line.amount, line.count);
  }
  addRow('r-total', 'Total income', s.income);
  addRow('r-total', 'Total expenses', s.expenses);
  addRow('r-net', 'NET THIS QUARTER', s.net);
  addRow('r-closing', 'Closing cash', null).textContent = formatMoney(s.closing);
  return table;
}

// ---------------------------------------------------------------- full screen
export function createLedgerScreen({ root, ledger }) {
  const overlay = el('div', 'report-overlay ledger-overlay');
  overlay.hidden = true;
  const paper = el('section', 'report ledger-screen');
  paper.setAttribute('role', 'dialog');
  paper.setAttribute('aria-label', 'Ledger');
  const head = el('div', 'report-head');
  head.append(el('div', 'report-company', 'LAST RESORT HOLDINGS'), el('div', 'report-title', 'THE LEDGER'), el('div', 'report-sub', 'Shelter and world, one set of books.'));
  const tabs = el('div', 'ledger-tabs');
  const history = el('div', 'ledger-history');
  const statement = el('div', 'ledger-statement');
  const close = el('button', 'report-continue', 'CLOSE [L]');
  close.type = 'button';
  close.addEventListener('click', () => toggle(false));
  paper.append(head, history, tabs, statement, close);
  overlay.append(paper);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) toggle(false); });
  root.append(overlay);

  let shownQuarter = null;

  function render() {
    const rows = ledger.history();
    const q = shownQuarter ?? ledger.quarter;
    const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
    history.replaceChildren(
      el('div', 'lh-label', 'NET PER QUARTER'),
      ...rows.map((r) => {
        const col = el('button', 'lh-col');
        col.type = 'button';
        col.title = `Q${r.quarter}: net ${formatMoney(r.net, { sign: true })}, closing ${formatMoney(r.closing)}`;
        col.dataset.active = String(r.quarter === q);
        const bar = el('i', 'lh-bar');
        bar.style.height = `${Math.max(2, Math.round((Math.abs(r.net) / maxAbs) * 40))}px`;
        bar.dataset.dir = r.net >= 0 ? 'up' : 'down';
        col.append(bar, el('span', 'lh-q', `Q${r.quarter}`));
        col.addEventListener('click', () => { shownQuarter = r.quarter; render(); });
        return col;
      }),
    );
    tabs.replaceChildren(
      ...rows.map((r) => {
        const b = el('button', 'ledger-tab', `Q${r.quarter}${r.quarter === ledger.quarter ? ' (NOW)' : ''}`);
        b.type = 'button';
        b.dataset.active = String(r.quarter === q);
        b.addEventListener('click', () => { shownQuarter = r.quarter; render(); });
        return b;
      }),
    );
    statement.replaceChildren(renderStatement(ledger.summary(q)));
  }

  ledger.onChange(() => { if (!overlay.hidden) render(); });

  function toggle(force) {
    const show = force ?? overlay.hidden;
    overlay.hidden = !show;
    if (show) { shownQuarter = null; render(); close.focus(); }
    return show;
  }

  return { toggle, get open() { return !overlay.hidden; }, render };
}
