// In-game debug panel: fast-forward with a bot, and the live per-quarter pacing log.
// Toggle with the ` (backquote) key.
//
//   const panel = createDebugPanel({ root, log, game, endQuarter });
//     log        a PacingLog attached to the game's ledger / pushback
//     game       the verbs the bots need (see sim.js createSimGame): pb, ledger, hq, shelters,
//                schemesAvailable(), scheme(s), sell(kind), build(room), demand(), capacity(), quarter
//     endQuarter the game's own async end-quarter (report, cards, Midnight)

import { BOTS, botQuarter, botChoice } from './sim.js';
import { PACING } from './pacing.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const k = (n) => (n == null ? '' : Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${Math.round(n / 1e3)}K`);

const COLS = [
  ['Q', (r) => r.quarter], ['HRS', (r) => r.hours.toFixed(2)], ['REAL', (r) => `${r.wallMinutes}m`], ['CASH', (r) => k(r.cash)],
  ['NET', (r) => k(r.net)], ['CRISIS', (r) => r.crisis], ['HEAT', (r) => r.heat], ['SALES', (r) => r.sales],
  ['REV', (r) => k(r.salesRevenue)], ['SCHEMES', (r) => r.schemes], ['FINES', (r) => k(r.fines)],
  ['BOARD', (r) => (r.boardMet == null ? '' : r.boardMet ? 'MET' : 'MISS')], ['X', (r) => r.strikes], ['RUNAWAY', (r) => r.runaways],
];

export function createDebugPanel({ root = document.body, log, game, endQuarter, totalQuarters = PACING.quarters }) {
  const panel = el('section', 'dbg-panel');
  panel.hidden = true;
  const head = el('div', 'dbg-head');
  head.append(el('b', null, 'DEBUG · PACING'), el('span', 'dbg-hint', '[`] to close'));
  const controls = el('div', 'dbg-controls');
  const botSel = el('select', 'dbg-bot');
  for (const [id, b] of Object.entries(BOTS)) {
    const o = el('option', null, b.label);
    o.value = id;
    botSel.append(o);
  }
  botSel.value = 'edge';
  const btn = (label, fn, id) => { const b = el('button', 'dbg-btn', label); b.type = 'button'; if (id) b.id = id; b.onclick = fn; controls.append(b); return b; };
  controls.append(botSel);
  const status = el('div', 'dbg-status');
  const tableWrap = el('div', 'dbg-table-wrap');
  const table = el('table', 'dbg-table');
  tableWrap.append(table);
  const totals = el('div', 'dbg-totals');
  panel.append(head, controls, status, tableWrap, totals);
  root.append(panel);

  let auto = false;
  let busy = false;

  // While auto-playing, answer cards the way the bot would and click through reports.
  function autoClicker() {
    const timer = setInterval(() => {
      if (!auto) return clearInterval(timer);
      const cont = document.querySelector('.report-continue');
      if (cont) { cont.click(); return; }
      const card = document.querySelector('.pb-card');
      if (card) {
        const evt = game.pb.pending[0];
        const want = evt ? botChoice(evt, BOTS[botSel.value]) : null;
        const b = (want && card.querySelector(`.pb-option[data-option="${want}"]`)) || card.querySelector('.pb-option');
        b?.click();
      }
    }, 40);
  }

  async function playQuarter() {
    if (busy || game.pb.board.ousted || game.quarter > totalQuarters) return false;
    busy = true;
    auto = true;
    autoClicker();
    try {
      botQuarter(game, botSel.value);
      await endQuarter();
    } finally {
      auto = false;
      busy = false;
      render();
    }
    return true;
  }

  btn('AUTO-PLAY 1 QUARTER', () => playQuarter(), 'dbg-play-one');
  btn('AUTO-PLAY TO MIDNIGHT', async () => {
    while (game.quarter <= totalQuarters && !game.pb.board.ousted && !document.querySelector('.mn-overlay, .mn-strike')) {
      const before = game.quarter;
      if (!(await playQuarter())) break;
      if (game.quarter === before) break; // final quarter: Midnight takes over
    }
  }, 'dbg-play-all');
  btn('DOWNLOAD CSV', () => {
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([log.toCSV()], { type: 'text/csv' }));
    a.download = 'apocalypse-tycoon-pacing.csv';
    a.click();
  });

  function render() {
    const s = log.summary();
    status.textContent = `Q${game.quarter > totalQuarters ? totalQuarters : game.quarter}/${totalQuarters} · crisis ${Math.round(game.pb.tension)} · heat ${Math.round(game.pb.heat)} · cash ${k(game.ledger.cash)} · bot: ${BOTS[botSel.value].label}`;
    const hr = el('tr');
    for (const [h] of COLS) hr.append(el('th', null, h));
    table.replaceChildren(hr, ...log.rows.map((r) => {
      const tr = el('tr');
      if (r.boardMet === false) tr.dataset.miss = 'true';
      for (const [, f] of COLS) tr.append(el('td', null, String(f(r))));
      return tr;
    }));
    const [lo, hi] = PACING.targetHours;
    const projected = log.rows.length ? (s.hours / log.rows.length) * totalQuarters + PACING.midnightMinutes / 60 : 0;
    totals.textContent = log.rows.length
      ? `Modelled time ${s.hours.toFixed(2)} h after ${log.rows.length} quarters · projected full run ${projected.toFixed(2)} h (target ${lo}-${hi} h) · player-paced estimate ${s.pacedHours.toFixed(2)} h · sales ${s.totalSales}`
      : 'No quarters logged yet. Play, or auto-play with a bot.';
    totals.dataset.ok = String(!log.rows.length || (projected >= lo && projected <= hi));
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === '`' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) { panel.hidden = !panel.hidden; render(); }
  });
  game.pb.on('change', () => { if (!panel.hidden) render(); });
  render();
  return { render, playQuarter, show() { panel.hidden = false; render(); }, el: panel };
}
