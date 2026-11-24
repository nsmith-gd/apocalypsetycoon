// Pressure gauge: all four pushback sources in one panel, each with what happens next, plus the
// paid relief buttons (Lay low, Fund disaster relief). Reads Pushback.pressures().
//
//   const gauge = createPressureGauge({ root, pushback, getQuarterProfit: () => ledger.summary(q).net });

import { fmt } from './pushback.js';
import { dockBelowHud } from './pushback-ui.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export function createPressureGauge({ root, pushback, getQuarterProfit = () => null, onRelief, getBoard = null }) {
  const panel = el('aside', 'pg-panel');
  panel.setAttribute('aria-label', 'Pressure');
  const head = el('div', 'pg-head', 'PRESSURE');
  const rows = {};
  const mkRow = (key, label) => {
    const r = el('div', 'pg-row');
    r.dataset.k = key;
    const top = el('div', 'pg-top');
    const name = el('span', 'pg-name', label);
    const val = el('span', 'pg-val');
    top.append(name, val);
    const bar = el('div', 'pg-bar');
    const fill = el('div', 'pg-fill');
    const mark = el('div', 'pg-mark');
    bar.append(fill, mark);
    const next = el('div', 'pg-next');
    r.append(top, bar, next);
    rows[key] = { r, val, fill, mark, next };
    return r;
  };
  const relief = el('div', 'pg-relief');
  const layLow = el('button', 'pg-btn');
  layLow.type = 'button';
  layLow.dataset.relief = 'layLow';
  const fundRelief = el('button', 'pg-btn');
  fundRelief.type = 'button';
  fundRelief.dataset.relief = 'fundRelief';
  relief.append(layLow, fundRelief);
  panel.append(head, mkRow('heat', 'HEAT'), mkRow('tension', 'TENSION'), mkRow('leverage', 'CLIENT LEVERAGE'), mkRow('board', 'BOARD'), relief);
  root.append(panel);
  dockBelowHud(panel, root);

  const act = (kind) => {
    const res = pushback[kind]();
    onRelief?.(res);
    render();
  };
  layLow.onclick = () => act('layLow');
  fundRelief.onclick = () => act('fundRelief');

  function setRow(key, { value, max = 100, zone, valText, mark, next }) {
    const row = rows[key];
    row.r.dataset.zone = zone;
    row.val.textContent = valText;
    row.fill.style.width = `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
    row.mark.hidden = mark == null;
    if (mark != null) row.mark.style.left = `${Math.max(0, Math.min(100, (mark / max) * 100))}%`;
    row.next.textContent = next;
  }

  function render() {
    const p = pushback.pressures({ quarterProfit: getQuarterProfit() });
    const h = p.heat;
    setRow('heat', {
      value: h.value, zone: h.zone, valText: `${Math.round(h.value)} ${h.zone.toUpperCase()}`, mark: h.next?.at,
      next: h.next ? `${h.next.what} at ${h.next.at}` : 'Maxed out',
    });
    const t = p.tension;
    setRow('tension', {
      value: t.value, zone: t.selfFeeding ? 'momentum' : t.value >= 60 ? 'edge' : 'contained',
      valText: `${Math.round(t.value)}${t.selfFeeding ? ' +6/Q' : ''}`, mark: t.next.at,
      next: t.selfFeeding ? `Feeding itself: runaway at ${t.runawayAt ?? 100}${t.runawayThisQuarter ? ' (already hit this quarter)' : ''}` : `${t.next.what} at ${t.next.at}`,
    });
    const l = p.leverage;
    const top = l.highest;
    setRow('leverage', {
      value: top?.leverage ?? 0, zone: l.zone, valText: top ? `${top.name} ${Math.round(top.leverage)}` : 'no clients',
      mark: top?.next?.at,
      next: top ? (top.next ? `${top.next.what} at ${top.next.at} · +${l.growthPerQuarter}/Q from heat` : 'Will blackmail you') : 'Every buyer learns your secrets',
    });
    // getBoard() (optional) supplies the GDD board's revenue quota instead of pushback's legacy target.
    const b = getBoard?.() ?? p.board;
    const prog = b.progress ?? 0;
    if (b.label) setRow('board', {
      value: Math.max(0, prog), max: Math.max(1, b.target), zone: b.zone, valText: `${fmt(prog)} / ${fmt(b.target)}`, mark: null,
      next: b.label,
    });
    else setRow('board', {
      value: Math.max(0, prog), max: Math.max(1, b.target), zone: b.zone,
      valText: `${fmt(prog)} / ${fmt(b.target)}  ${'X'.repeat(b.strikes)}`, mark: null,
      next: b.ousted ? 'Ousted' : `${b.onTrack ? 'On track. ' : ''}${b.next.what}${b.buildCostMultiplier > 1 ? ' · budget freeze' : ''}`,
    });
    layLow.textContent = `LAY LOW ${fmt(h.relief.cost)} · heat ${h.relief.effect}`;
    fundRelief.textContent = `FUND RELIEF ${fmt(t.relief.cost)} · tension ${t.relief.effect}`;
    layLow.disabled = fundRelief.disabled = b.ousted;
  }

  const off = pushback.on('change', render);
  render();
  return { render, el: panel, destroy() { off(); panel.remove(); } };
}
