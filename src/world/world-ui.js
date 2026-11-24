// World setup screen (Classic / Random / Custom roster at campaign start) and the in-game THREATS panel.
//
//   showWorldSetup({ root, firstCampaign, onStart(roster, mode), onBack })
//   const panel = createThreatsPanel({ root, getRoster, getMinutes });  panel.toggle(); panel.render();

import { TRACKS, TRACK_BY_ID, GDD_REGIONS, COUNTER_ROOMS, SWAPPABLE_SLOTS, tracksInSlot, selectRoster, CLASSIC_ROSTER } from './tracks.js';
import { schemesForRoster, SCHEME_GROUPS } from './schemeCatalog.js';
import { fmtTime } from './momentum.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const REGION_NAME = Object.fromEntries(GDD_REGIONS.map((r) => [r.id, r.name]));
const money = (n) => (n >= 1e6 ? `$${+(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1000)}K`);
const hotText = (t) => Object.entries(t.exposure).map(([r, l]) => `${REGION_NAME[r]} ${l}`).join(', ');

function trackCard(t, { minutes = null } = {}) {
  const c = el('div', 'tw-card');
  c.style.setProperty('--tw', t.color);
  c.dataset.classic = String(t.classic);
  const head = el('div', 'tw-card-head');
  head.append(el('span', 'tw-slot', `SLOT ${t.slot}`), el('b', 'tw-name', t.name), el('span', 'tw-kind', t.classic ? 'CLASSIC' : 'ALTERNATE'));
  c.append(head, el('div', 'tw-premise', t.premise));
  const open = minutes == null ? `Opens at ${fmtTime(t.opensAt)}` : minutes >= t.opensAt ? 'OPEN' : `Opens in ${fmtTime(t.opensAt - minutes)}`;
  const st = el('div', 'tw-open', open);
  if (minutes != null && minutes >= t.opensAt) st.dataset.open = 'true';
  c.append(st);
  c.append(el('div', 'tw-line', `Sells: ${t.sells}`));
  c.append(el('div', 'tw-line', `Hot: ${hotText(t)}`));
  const op = TRACKS && t.containmentOp;
  c.append(el('div', 'tw-line', `Containment: ${opName(op)}`));
  if (t.counterRooms) c.append(el('div', 'tw-line tw-rooms', `Counter rooms: ${t.counterRooms.map((r) => `${COUNTER_ROOMS[r].name} (${fmtTime(COUNTER_ROOMS[r].unlockAt)})`).join(', ')}`));
  return c;
}
let opNames = null;
function opName(id) {
  if (!opNames) opNames = Object.fromEntries(schemesForRoster(TRACKS.map((t) => t.id)).filter((s) => s.group === 'containment').map((s) => [s.id, s.name]));
  return opNames[id] ?? id;
}

// ---------------- World setup ----------------
export function showWorldSetup({ root, firstCampaign = false, onStart, onBack }) {
  const wrap = el('div', 'tw-setup at-ui');
  const box = el('section', 'tw-setup-box');
  box.append(el('div', 'tw-title', 'CHOOSE YOUR APOCALYPSE'),
    el('div', 'tw-sub', 'Six threat tracks run every campaign. Slots 1 and 6 never change; slots 2 to 5 can run an alternate apocalypse.'));
  if (firstCampaign) box.append(el('div', 'tw-note', 'Your first campaign is normally Classic. This setup screen lets you pick anyway (debug).'));

  let mode = 'classic';
  const picks = { 2: 'bloom', 3: 'superstorm', 4: 'optimizer', 5: 'hush' };
  let roster = [...CLASSIC_ROSTER];
  const modes = el('div', 'tw-modes');
  const modeBtns = {};
  for (const [m, label, tip] of [['classic', 'CLASSIC', 'The six original threats'], ['random', 'RANDOM', 'Each of slots 2-5 rolls Classic or its alternate'], ['custom', 'CUSTOM', 'Pick each slot yourself']]) {
    const b = el('button', 'tw-mode', label);
    b.type = 'button';
    b.title = tip;
    b.dataset.mode = m;
    b.onclick = () => { mode = m; roster = m === 'custom' ? selectRoster({ mode, picks }) : selectRoster({ mode }); render(); };
    modeBtns[m] = b;
    modes.append(b);
  }
  const reroll = el('button', 'tw-mode tw-reroll', 'REROLL');
  reroll.type = 'button';
  reroll.onclick = () => { roster = selectRoster({ mode: 'random' }); render(); };
  modes.append(reroll);
  const slots = el('div', 'tw-slots');
  const foot = el('div', 'tw-foot');
  const start = el('button', 'tw-start', 'START CAMPAIGN');
  start.type = 'button';
  start.onclick = () => { wrap.remove(); onStart?.(roster, mode); };
  const back = el('button', 'tw-back', 'BACK');
  back.type = 'button';
  back.onclick = () => { wrap.remove(); onBack?.(); };
  const count = el('div', 'tw-count');
  foot.append(back, count, start);
  box.append(modes, slots, foot);
  wrap.append(box);
  root.append(wrap);

  function render() {
    for (const [m, b] of Object.entries(modeBtns)) b.classList.toggle('on', m === mode);
    reroll.hidden = mode !== 'random';
    slots.replaceChildren(...roster.map((id) => {
      const t = TRACK_BY_ID[id];
      const card = trackCard(t);
      if (mode === 'custom' && SWAPPABLE_SLOTS.includes(t.slot)) {
        const swap = el('button', 'tw-swap', `SWAP TO ${tracksInSlot(t.slot).find((x) => x.id !== id).name.toUpperCase()}`);
        swap.type = 'button';
        swap.dataset.slot = String(t.slot);
        swap.onclick = () => { picks[t.slot] = tracksInSlot(t.slot).find((x) => x.id !== id).id; roster = selectRoster({ mode, picks }); render(); };
        card.append(swap);
      }
      return card;
    }));
    const alts = roster.filter((id) => !TRACK_BY_ID[id].classic).length;
    count.textContent = `${alts ? `${alts} alternate${alts > 1 ? 's' : ''}` : 'Classic world'} · ${schemesForRoster(roster).length} schemes in this world`;
  }
  render();
  start.focus();
  return { el: wrap, get roster() { return roster; } };
}

// ---------------- In-game THREATS panel ----------------
export function createThreatsPanel({ root, getRoster, getMinutes }) {
  const overlay = el('div', 'report-overlay tw-overlay');
  overlay.hidden = true;
  const box = el('section', 'tw-panel');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Threat tracks');
  overlay.append(box);
  root.append(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) toggle(false); });

  function render() {
    if (overlay.hidden) return;
    const roster = getRoster();
    const minutes = getMinutes();
    const close = el('button', 'tw-back', 'CLOSE [T]');
    close.type = 'button';
    close.onclick = () => toggle(false);
    const head = el('div', 'tw-panel-head');
    head.append(el('div', 'tw-title', `THREAT TRACKS · ${fmtTime(minutes)} played`), close);
    const cards = el('div', 'tw-slots');
    cards.append(...roster.map((id) => trackCard(TRACK_BY_ID[id], { minutes })));
    const list = el('div', 'tw-schemes');
    const all = schemesForRoster(roster);
    for (const g of SCHEME_GROUPS) {
      const rows = all.filter((s) => s.group === g).sort((a, b) => a.unlockAt - b.unlockAt);
      list.append(el('div', 'tw-group', `${g.toUpperCase()} · ${rows.length}`));
      for (const s of rows) {
        const r = el('div', 'tw-scheme');
        r.dataset.locked = String(s.unlockAt > minutes);
        const cost = s.rp ? `${s.rp} RP` : s.costPerBreach ? '$10M x breaches' : money(s.cost);
        r.append(el('b', null, s.name), el('span', 'tw-eff', s.effect), el('span', 'tw-cost', cost), el('span', 'tw-heat', `heat ${s.heat > 0 ? '+' : ''}${s.heat}`),
          el('span', 'tw-when', s.unlockAt > minutes ? fmtTime(s.unlockAt) : 'ready'));
        list.append(r);
      }
    }
    box.replaceChildren(head, el('div', 'tw-sub', 'Your world this campaign. Tracks open on schedule; schemes unlock as the company grows.'), cards, list);
  }
  function toggle(on = overlay.hidden) {
    overlay.hidden = !on;
    render();
  }
  const onKey = (e) => {
    if (e.target?.tagName === 'INPUT') return;
    if (e.key === 't' || e.key === 'T') toggle();
    else if (e.key === 'Escape' && !overlay.hidden) toggle(false);
  };
  addEventListener('keydown', onKey);
  return { toggle, render, get open() { return !overlay.hidden; }, destroy() { removeEventListener('keydown', onKey); overlay.remove(); } };
}
