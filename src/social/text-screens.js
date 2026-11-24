// PLACEHOLDER text-only screens for the social layer (#60). They only read the SocialSession
// view-model and call its actions, so the final screens (#19 and the art tasks) can replace this
// file wholesale. Number keys pick list items and dialogue choices.
//
//   const screens = createSocialScreens({ root: document.body, social });
//   screens.open() / screens.close() / screens.toggle()

import { formatMoney } from '../ledger/ledger.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export function createSocialScreens({ root = document.body, social, onClose } = {}) {
  const overlay = el('div', 'soc-overlay');
  overlay.hidden = true;
  const box = el('section', 'soc');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Events');
  overlay.append(box);
  root.append(overlay);
  let keyed = []; // actions bound to number keys on the current screen

  const btn = (label, fn, { cls = '', disabled = false, key = null, title = '' } = {}) => {
    const b = el('button', `soc-btn ${cls}`.trim());
    b.type = 'button';
    if (key != null) { b.append(el('span', 'soc-key', `${key}`)); keyed[key] = fn; }
    b.append(el('span', null, label));
    b.disabled = disabled;
    if (title) b.title = title;
    b.onclick = fn;
    return b;
  };
  const guard = (fn) => () => { try { fn(); } catch (e) { flash(e.message); } };
  let message = '';
  const flash = (m) => { message = m; render(); };

  function render() {
    keyed = [];
    box.replaceChildren();
    const s = social.screen;
    if (s === 'events') renderEvents();
    else if (s === 'guests') renderGuests();
    else if (s === 'dialogue') renderDialogue();
    else if (s === 'result') renderResult();
    else if (s === 'summary') renderSummary();
    if (message) { box.append(el('p', 'soc-err', message)); message = ''; }
    box.dataset.screen = s;
  }

  function header(title, sub) {
    const h = el('header', 'soc-head');
    h.append(el('h2', 'soc-h', title));
    if (sub) h.append(el('p', 'soc-sub', sub));
    box.append(h);
  }

  function renderEvents() {
    const v = social.eventsView();
    header(`EVENTS · Q${v.quarter}`, `Agenda: ${v.daysLeft}/${v.daysPerQuarter} days left this quarter${v.cash != null ? ` · Cash ${formatMoney(v.cash)}` : ''}. Go out, meet people, come back with leads.`);
    const list = el('ol', 'soc-list');
    let k = 1;
    for (const e of v.events) {
      const li = el('li', 'soc-item');
      li.dataset.open = String(e.canAttend);
      li.append(el('div', 'soc-title', `${e.name}`), el('div', 'soc-dim', `${e.kind} · ${e.region} · ${formatMoney(e.cost)} · ${e.days} day${e.days === 1 ? '' : 's'} · ${e.guests} guests · press ${Math.round(e.press * 100)}%${e.heat ? ` · heat +${e.heat}` : ''}`));
      if (e.blurb) li.append(el('div', 'soc-blurb', e.blurb));
      li.append(e.canAttend ? btn('ATTEND', guard(() => social.attend(e.id)), { key: k++ }) : el('div', 'soc-why', `Can't go: ${e.reason}`));
      list.append(li);
    }
    if (!v.events.length) list.append(el('li', 'soc-dim', 'Nothing on the calendar this quarter.'));
    box.append(list, el('div', 'soc-foot'));
    box.lastChild.append(btn('CLOSE', () => close(), { key: 0 }));
  }

  function renderGuests() {
    const v = social.guestsView();
    header(v.venue.name.toUpperCase(), `${v.guests.length} guests worth meeting${v.press ? ' · a journalist is in the room' : ''} · leads so far: ${v.leadsGained}`);
    const list = el('ol', 'soc-list');
    let k = 1;
    for (const g of v.guests) {
      const li = el('li', 'soc-item');
      li.dataset.status = g.status;
      li.append(el('div', 'soc-title', `${g.name} (${g.wealthClass})`), el('div', 'soc-dim', `${g.region} · afraid of ${g.fears.join(', ') || 'nothing yet'}${g.traits.length ? ` · ${g.traits.join(', ')}` : ''}`));
      if (g.status === 'new') li.append(btn('TALK', guard(() => social.talk(g.id)), { key: k++ }));
      else li.append(el('div', 'soc-why', g.result ? `${g.result.label}${g.result.lead ? `: ${g.result.lead.tier} lead (${g.result.lead.quality})` : ': no lead'}` : 'Already met'));
      list.append(li);
    }
    box.append(list, el('div', 'soc-foot'));
    box.lastChild.append(btn('LEAVE THE EVENT', guard(() => social.leave()), { key: 0 }));
  }

  function renderDialogue() {
    const v = social.dialogueView();
    header(`TALKING TO ${v.guest.name.toUpperCase()}`, `${v.guest.archetype ? `${v.guest.archetype} · ` : ''}${v.guest.wealthClass} · afraid of ${v.guest.fears.join(', ') || '?'}`);
    const log = el('div', 'soc-log');
    for (const t of v.transcript) log.append(el('p', `soc-line soc-${t.speaker}`, `${t.speaker === 'you' ? 'YOU' : t.speaker === 'guest' ? v.guest.name.toUpperCase() : ''}${t.speaker === 'narrator' ? '' : ': '}${t.text}`));
    if (v.line) log.append(el('p', `soc-line soc-${v.line.speaker} soc-now`, `${v.line.speaker === 'guest' ? `${v.guest.name.toUpperCase()}: ` : ''}${v.line.text}`));
    box.append(log);
    const list = el('ol', 'soc-choices');
    v.choices.forEach((c, i) => {
      const li = el('li');
      const b = btn(c.text, guard(() => social.choose(c.id)), { key: i + 1, cls: 'soc-choice' });
      if (c.tags.length) b.append(el('span', 'soc-tags', c.tags.join(' · ')));
      li.append(b);
      list.append(li);
    });
    box.append(list);
  }

  function renderResult() {
    const r = social.resultView();
    header(r.win ? `${r.label.toUpperCase()}` : r.label.toUpperCase(), r.blurb);
    const lines = el('ul', 'soc-results');
    for (const l of r.lines) lines.append(el('li', null, l));
    if (r.lead) lines.append(el('li', 'soc-good', `New ${r.lead.tier} lead: ${r.guest.name}, interest ${r.lead.quality}, good until the end of Q${r.lead.expiresQuarter}. Sell to them on the world map.`));
    box.append(lines, el('div', 'soc-foot'));
    box.lastChild.append(btn('BACK TO THE GUESTS', guard(() => social.backToGuests()), { key: 1 }));
  }

  function renderSummary() {
    const s = social.summaryView();
    header(`LEFT ${s.venue.name.toUpperCase()}`, `Spent ${formatMoney(s.cost.cash)} and ${s.cost.days} agenda day${s.cost.days === 1 ? '' : 's'}. Talked to ${s.talked} of ${s.guests}.`);
    const ul = el('ul', 'soc-results');
    if (!s.leads.length) ul.append(el('li', null, 'No leads tonight.'));
    for (const l of s.leads) ul.append(el('li', 'soc-good', `${l.name}: ${l.tier} lead (${l.quality}), until end of Q${l.expiresQuarter}`));
    if (s.heat) ul.append(el('li', 'soc-bad', `Heat ${s.heat > 0 ? '+' : ''}${s.heat}`));
    if (s.reputation) ul.append(el('li', s.reputation > 0 ? 'soc-good' : 'soc-bad', `Reputation ${s.reputation > 0 ? '+' : ''}${s.reputation}`));
    if (s.press) ul.append(el('li', 'soc-dim', 'A journalist was there.'));
    box.append(ul, el('div', 'soc-foot'));
    box.lastChild.append(btn('DONE', () => { social.close(); close(); }, { key: 1 }));
  }

  const onKey = (e) => {
    if (overlay.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
    const n = Number(e.key);
    if (Number.isInteger(n) && keyed[n]) { e.preventDefault(); e.stopPropagation(); keyed[n](); }
    else if (e.key === 'Escape' && social.screen === 'events') { e.preventDefault(); close(); }
  };
  addEventListener('keydown', onKey, true);
  const off = social.onChange(() => { if (!overlay.hidden) render(); });

  function open() { overlay.hidden = false; render(); }
  function close() {
    // Leaving the overlay mid-event is not allowed: you have to walk out of the event first.
    if (social.visit) { flash('Leave the event first.'); return; }
    if (social.screen === 'summary') social.close();
    overlay.hidden = true;
    onClose?.();
  }

  return {
    open, close, render,
    toggle() { if (overlay.hidden) open(); else close(); },
    get isOpen() { return !overlay.hidden; },
    destroy() { off(); removeEventListener('keydown', onKey, true); overlay.remove(); },
  };
}
