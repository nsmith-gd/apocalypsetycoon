// The end of the campaign after the grade (#32; GDD "The Midnight sequence" steps 4-6):
// Epilogues (one card per client) -> The Ledger (company totals and a final line) -> the ending card.
// For endings without a Midnight (Ousted, Indicted, Regrettably Stable...) the same three screens run, with the
// world still standing.
//
//   await showFinale({ root, epilogues, ledger, onRestart })

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const money = (v) => (Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : `$${(v / 1e6).toFixed(1)}M`);
const people = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} billion` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} million` : n.toLocaleString());

export function showFinale({ root = document.body, epilogues = [], ledger, onRestart = null } = {}) {
  return new Promise((resolve) => {
    const overlay = el('div', 'mn-overlay mn-finale');
    overlay.dataset.ending = ledger.ending.id;
    const screen = el('div', 'mn-screen');
    overlay.append(screen);
    root.append(overlay);
    const steps = [epiloguesStep, ledgerStep, endingStep];
    let i = 0;
    const next = () => {
      screen.replaceChildren();
      steps[i]();
      const last = i === steps.length - 1;
      const btn = el('button', 'mn-btn mn-next', last ? (onRestart ? 'MAIN MENU' : 'CLOSE') : 'CONTINUE');
      btn.onclick = () => { if (last) { overlay.remove(); resolve(); onRestart?.(); } else { i += 1; next(); } };
      screen.append(btn);
      btn.focus();
    };
    function epiloguesStep() {
      screen.append(el('div', 'mn-kind', 'EPILOGUES'), el('h1', 'mn-title mn-title-s', 'WHAT HAPPENED UNDER SEAL'));
      const list = el('div', 'mn-epis');
      epilogues.forEach((c, k) => {
        const card = el('div', 'mn-epi');
        card.dataset.outcome = c.outcome;
        card.style.animationDelay = `${Math.min(k, 12) * 0.12}s`;
        card.append(el('div', 'mn-epi-who', `${c.client.toUpperCase()}${c.type ? ` · ${c.type}` : ''}`), el('div', 'mn-epi-line', c.line));
        list.append(card);
      });
      screen.append(list);
    }
    function ledgerStep() {
      const L = ledger;
      screen.append(el('div', 'mn-kind', 'THE LEDGER'), el('h1', 'mn-title mn-title-s', 'LAST RESORT HOLDINGS: FINAL ACCOUNTS'));
      const rows = [
        ['Clients saved', `${L.clientsSaved.toLocaleString()} of ${L.clientsTotal.toLocaleString()}`],
        ['Staff saved', `${L.staffSaved}`], ['Staff left outside', `${L.staffOutside}`],
        ['Revenue, all time', money(L.revenue)], ['Research earned', `${L.rp.toLocaleString()} RP`],
        ['Final heat', `${L.heat}`], ['World population remaining', people(L.population)],
      ];
      const t = el('table', 'mn-ledger');
      for (const [k, v] of rows) { const tr = el('tr'); tr.append(el('th', null, k.toUpperCase()), el('td', null, v)); t.append(tr); }
      const scars = el('div', 'mn-scars');
      scars.append(el('div', 'mn-tile-label', 'SCARS'), ...(L.scars.length ? L.scars.map((s) => el('div', 'mn-scar', s)) : [el('div', 'mn-scar mn-scar-none', 'None. Suspiciously.')]));
      screen.append(t, scars, el('p', 'mn-closing', L.closing));
    }
    function endingStep() {
      const E = ledger.ending;
      screen.append(el('div', 'mn-kind', E.secret ? 'SECRET ENDING' : 'ENDING'), el('h1', 'mn-title', E.title), el('p', 'mn-line', E.happens));
      if (E.grade) screen.append(el('div', 'mn-grade-final', `GRADE: ${String(E.grade).toUpperCase()}`));
      screen.append(el('div', 'mn-kind-why', `Reached by: ${E.trigger}.`));
    }
    next();
  });
}
