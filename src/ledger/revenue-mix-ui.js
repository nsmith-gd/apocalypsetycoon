// Debug readout of the revenue mix (#161): income per revenue stream (this campaign and the current quarter) beside
// the GDD's chapter 3 targets (TUNING.revenueMix). Toggle with the $ key; `?debug=revenue` opens it on load.
//
//   const mix = createRevenueMixReadout({ root: document.body, ledger, getChapter: () => 3 });
//   mix.toggle(); mix.render();

import { STREAMS, formatMoney } from './ledger.js';
import { TUNING } from '../config/tuning.js';

const pct = (v) => `${Math.round(v * 100)}%`;

export function createRevenueMixReadout({ root = document.body, ledger, getChapter = () => null, targets = TUNING.revenueMix } = {}) {
  const box = document.createElement('section');
  box.className = 'rev-mix';
  box.hidden = !/[?&]debug=revenue\b/.test(globalThis.location?.search ?? '');
  root.append(box);

  function render() {
    if (box.hidden) return;
    const all = ledger.streamShares();
    const q = ledger.streamShares({ from: ledger.quarter, to: ledger.quarter });
    const rows = Object.entries(STREAMS).filter(([k]) => k !== 'other' || all.streams.other.amount).map(([k, meta]) => {
      const a = all.streams[k], t = targets[k];
      const off = t == null ? '' : a.share - t > 0.05 ? 'high' : t - a.share > 0.05 ? 'low' : 'ok';
      return `<tr data-off="${all.total ? off : ''}"><td>${meta.label}</td><td>${formatMoney(a.amount)}</td><td>${pct(a.share)}</td><td>${pct(q.streams[k].share)}</td><td>${t == null ? '-' : pct(t)}</td></tr>`;
    }).join('');
    box.innerHTML = `<div class="rev-head">REVENUE MIX <small>debug · $ to close</small></div>
      <table><tr><th>Stream</th><th>Campaign</th><th>Share</th><th>Q${ledger.quarter}</th><th>Ch.3 target</th></tr>${rows}</table>
      <div class="rev-foot">Income ${formatMoney(all.total)} · chapter ${getChapter() ?? '?'}${getChapter() === 3 ? ' (target chapter)' : ''}</div>`;
  }
  const off = ledger.onChange(() => render());
  const onKey = (e) => { if (e.key === '$' && !e.target.closest?.('input, textarea')) toggle(); };
  addEventListener('keydown', onKey);
  function toggle(force) { box.hidden = force === undefined ? !box.hidden : !force; render(); return !box.hidden; }
  render();
  return { el: box, render, toggle, get open() { return !box.hidden; }, destroy() { off(); removeEventListener('keydown', onKey); box.remove(); } };
}
