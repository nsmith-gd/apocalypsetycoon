// DOM for the pushback systems: choice cards for investigations / demands / blackmail / board,
// a client-leverage panel, and a ticker of consequences.
//
//   const pbui = createPushbackUI({ root, pushback });
//   await pbui.drain();   // shows every pending event one at a time; resolves when all are answered
//
// Events fired mid-quarter (investigation, raid, runaway) pop up on their own as they happen.
// Call pbui.hold() before pushback.endQuarter() so quarter-end events wait behind the ledger report.

import { fmt } from './pushback.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export function createPushbackUI({ root, pushback, autoShow = true }) {
  // ---------- client leverage panel ----------
  const panel = el('aside', 'pb-panel');
  const panelHead = el('div', 'pb-panel-head', 'CLIENTS · LEVERAGE');
  const list = el('ul', 'pb-clients');
  const ticker = el('div', 'pb-ticker');
  panel.append(panelHead, list, ticker);
  root.append(panel);

  function renderClients() {
    const L = pushback.cfg.leverage;
    if (!pushback.clients.length) {
      list.replaceChildren(el('li', 'pb-empty', 'No clients yet. Every buyer learns your secrets.'));
      return;
    }
    list.replaceChildren(
      ...pushback.clients.map((c) => {
        const li = el('li', 'pb-client');
        const zone = c.leverage >= L.blackmailAt ? 'blackmail' : c.leverage >= L.demandAt ? 'demand' : 'calm';
        li.dataset.zone = zone;
        const name = el('span', 'pb-client-name', c.name);
        const bar = el('span', 'pb-lev');
        const fill = el('span', 'pb-lev-fill');
        fill.style.width = `${Math.min(100, c.leverage)}%`;
        bar.append(fill);
        const word = el('span', 'pb-lev-word', zone === 'blackmail' ? 'DANGEROUS' : zone === 'demand' ? 'DEMANDING' : 'QUIET');
        li.title = `Leverage ${Math.round(c.leverage)}. Demands at ${L.demandAt}, blackmail at ${L.blackmailAt}. Grows with heat.`;
        li.append(name, bar, word);
        return li;
      }),
    );
  }

  let tickTimer = null;
  function tick(text, tone = 'bad') {
    const t = el('div', 'pb-tick', text);
    t.dataset.tone = tone;
    ticker.prepend(t);
    while (ticker.childElementCount > 4) ticker.lastChild.remove();
    clearTimeout(tickTimer);
  }

  // ---------- choice cards ----------
  let showing = null;
  let waiters = [];
  let held = false; // while held (e.g. the quarter report is open), new events wait for drain()

  function showNext() {
    if (showing) return;
    const evt = pushback.pending[0];
    if (!evt) {
      const w = waiters;
      waiters = [];
      w.forEach((fn) => fn());
      return;
    }
    showing = evt;
    const overlay = el('div', 'pb-overlay');
    const card = el('section', 'pb-card');
    card.dataset.type = evt.type;
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', evt.title);
    const icon = el('div', 'pb-icon', evt.icon ?? '!');
    const title = el('div', 'pb-title', evt.title);
    const body = el('p', 'pb-body', evt.body);
    const vitals = el('div', 'pb-vitals', `HEAT ${Math.round(pushback.heat)} · TENSION ${Math.round(pushback.tension)} · CASH ${fmt(pushback.cash)}`);
    const opts = el('div', 'pb-options');
    for (const o of evt.options) {
      const b = el('button', 'pb-option', o.label);
      b.type = 'button';
      b.dataset.option = o.id;
      b.addEventListener('click', () => {
        overlay.remove();
        showing = null;
        const res = pushback.resolve(evt.id, o.id);
        tick(res?.event ? `${evt.title}: ${o.label}` : evt.title, o.cost || o.heat > 0 ? 'bad' : 'ok');
        renderClients();
        showNext();
      });
      opts.append(b);
    }
    card.append(icon, title, body, vitals, opts);
    overlay.append(card);
    root.append(overlay);
    opts.firstChild?.focus();
  }

  /** Show all pending events; resolves when the player has answered every one. */
  function drain() {
    held = false;
    return new Promise((resolve) => {
      waiters.push(resolve);
      showNext();
    });
  }

  const offs = [
    pushback.on('change', renderClients),
    pushback.on('event', () => { if (autoShow && !held) queueMicrotask(showNext); }),
  ];
  renderClients();

  return {
    drain,
    /** Stop events popping up on their own until the next drain() — call before endQuarter(). */
    hold() { held = true; },
    tick,
    render: renderClients,
    get open() { return !!showing; },
    destroy() {
      offs.forEach((off) => off());
      panel.remove();
    },
  };
}
