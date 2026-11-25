// Greybox screen for the megaprojects (#143): the Compound's three sites and tunnels, and the Ark.
//
//   const mp = createMegaprojectScreen({ root, board, getFrame, onToast });
//   mp.open('compound' | 'ark'); mp.close(); mp.toggle();
//
// Each site is a full bunker editor (the same one as the main shelter), so a Compound site or the Ark is built
// with the same tools: dig the footprint, wall it, set doors, fill it.

import { createBunkerUI } from './bunker-ui.js';
import { MEGAPROJECTS } from '../config/tuning.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const money = (n) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`);
const days = (d) => (d >= 9_999 ? '∞' : d);

export function createMegaprojectScreen({ root = document.body, board, getFrame = () => 0, onToast = () => {} }) {
  const overlay = el('div', 'mp-overlay');
  overlay.hidden = true;
  const panel = el('section', 'mp-panel');
  const head = el('div', 'mp-head');
  const title = el('div', 'mp-title', 'MEGAPROJECTS');
  const tabs = el('div', 'mp-tabs');
  const close = el('button', 'mp-btn', 'CLOSE [ESC]');
  close.onclick = () => api.close();
  head.append(title, tabs, close);
  const body = el('div', 'mp-body');
  const side = el('div', 'mp-side');
  const mount = el('div', 'mp-mount');
  body.append(mount, side);
  panel.append(head, body);
  overlay.append(panel);
  root.append(overlay);

  let view = 'compound';
  let site = 'A';
  const uis = new Map(); // key -> bunker UI
  function uiFor(key, bunker) {
    if (!uis.has(key)) {
      const m = el('div', 'mp-editor');
      const ui = createBunkerUI({ mount: m, grid: bunker, getFrame, onToast });
      uis.set(key, { ui, m });
    }
    return uis.get(key);
  }

  function renderTabs() {
    tabs.replaceChildren();
    for (const [id, label] of [['compound', 'COMPOUND'], ['ark', 'THE ARK']]) {
      const b = el('button', `mp-btn${id === view ? ' on' : ''}`, label);
      b.onclick = () => { view = id; render(); };
      tabs.append(b);
    }
  }

  function showEditor(key, bunker) {
    const { ui, m } = uiFor(key, bunker);
    if (mount.firstChild !== m) mount.replaceChildren(m);
    ui.fit(Math.max(400, innerWidth - 560), innerHeight - 220);
    ui.refresh();
  }

  function renderCompound() {
    const cp = board.compound;
    side.replaceChildren();
    if (!cp) {
      mount.replaceChildren(el('div', 'mp-empty', 'No Compound yet.'));
      const p = el('p', 'mp-dim', `Three linked bunkers joined by tunnels: the risk is spread across sites, but tunnels below the water table (${MEGAPROJECTS.compound.waterTable} m) can flood, and a besieged site's tunnels can be breached. Unlocks at ${MEGAPROJECTS.compound.unlockAt}.`);
      const b = el('button', 'mp-btn mp-go', 'START A COMPOUND');
      b.onclick = () => { const r = board.startCompound(); onToast(r.ok ? 'Compound started: three plots surveyed.' : r.reason); render(); };
      side.append(el('h3', 'mp-h3', 'COMPOUND'), p, b);
      return;
    }
    const siteTabs = el('div', 'mp-sites');
    const sum = cp.summary();
    for (const id of cp.ids) {
      const s = sum.sites[id];
      const b = el('button', `mp-btn${id === site ? ' on' : ''}`, `SITE ${id} · ${s.occupants} ppl · ${days(s.days)}d`);
      b.onclick = () => { site = id; render(); };
      siteTabs.append(b);
    }
    showEditor(`compound-${site}`, cp.sites[site]);
    mount.prepend(siteTabs);
    side.append(el('h3', 'mp-h3', 'COMPOUND'));
    side.append(el('div', 'mp-big', `${sum.occupants} people · ${days(sum.daysSealed)} days sealed`));
    side.append(el('p', 'mp-dim', sum.linked ? 'All three sites linked: they pool their stores.' : `${sum.groups.length} separate groups: ${sum.groups.map((g) => g.sites.join('+')).join(' / ')}. Each lasts on its own stores.`));
    side.append(el('h3', 'mp-h3', 'TUNNELS'));
    for (const t of cp.tunnels) {
      const row = el('div', 'mp-tunnel');
      row.dataset.state = t.state;
      row.append(el('div', 'mp-t-name', `${t.a} ⟷ ${t.b}`), el('div', 'mp-t-state', t.state === 'planned' ? 'not dug' : `${t.state.toUpperCase()} · ${t.depth} m${t.depth > cp.cfg.waterTable ? ' · can flood' : ''}`));
      const acts = el('div', 'mp-t-acts');
      if (t.state === 'planned') {
        for (const d of [8, 20]) {
          const b = el('button', 'mp-btn', `DIG AT ${d} M ${money(cp.tunnelCost(d))}`);
          b.title = d > cp.cfg.waterTable ? 'Below the water table: cheaper to reach deep sites, but it can flood' : 'Above the water table: stays dry';
          b.onclick = () => { const r = cp.digTunnel(t.id, d); onToast(r.ok ? `Tunnel ${t.a}-${t.b} dug at ${d} m.` : r.reason); render(); };
          acts.append(b);
        }
      } else if (t.state === 'flooded' || t.state === 'breached') {
        const b = el('button', 'mp-btn mp-warn', `${t.state === 'flooded' ? 'PUMP OUT' : 'RESEAL'} ${money(cp.cfg.pumpOutCost)}`);
        b.onclick = () => { cp.repairTunnel(t.id); render(); };
        acts.append(b);
      }
      row.append(acts);
      side.append(row);
    }
    const besiege = el('button', 'mp-btn', cp.besieged.has(site) ? `LIFT SIEGE ON ${site}` : `SIEGE SITE ${site} (TEST)`);
    besiege.title = 'Greybox: mark this site as besieged by The Pitchforks so its tunnels risk a breach';
    besiege.onclick = () => { if (cp.besieged.has(site)) cp.besieged.delete(site); else cp.besieged.add(site); render(); };
    side.append(besiege);
    side.append(el('div', 'mp-log', cp.log.slice(-5).map((l) => `W${l.week}: ${l.text}`).join('\n')));
  }

  function renderArk() {
    const ark = board.ark;
    side.replaceChildren();
    if (!ark) {
      mount.replaceChildren(el('div', 'mp-empty', 'No Ark yet.'));
      side.append(el('h3', 'mp-h3', 'THE ARK'), el('p', 'mp-dim', `A ${MEGAPROJECTS.ark.width}-wide consortium build to the Abyss for ${MEGAPROJECTS.ark.occupants.min}-${MEGAPROJECTS.ark.occupants.max} people. Only The Table commissions it: open a Table (C5) lead on the world map and choose BEGIN THE ARK. Unlocks at ${MEGAPROJECTS.ark.unlockAt}.`));
      return;
    }
    showEditor('ark', ark.site);
    const c = ark.checklist();
    side.append(el('h3', 'mp-h3', 'THE ARK'));
    side.append(el('div', 'mp-dim', `Consortium: ${ark.consortium.map((m) => m.name).join(', ')}`));
    side.append(el('div', 'mp-big', `${c.occupants} beds · pays ${money(ark.price())}`));
    const list = el('ul', 'mp-check');
    for (const i of c.items) { const li = el('li', null, `${i.done ? '■' : '□'} ${i.label}${i.detail ? ` · ${i.detail}` : ''}`); li.dataset.done = String(i.done); list.append(li); }
    side.append(list);
    const hand = el('button', 'mp-btn mp-go', ark.handedOver ? 'HANDED OVER' : 'HAND OVER TO THE TABLE');
    hand.disabled = ark.handedOver || !c.done;
    hand.onclick = () => { const r = ark.handOver(); onToast(r.ok ? `The Ark is handed over: ${money(r.price)}.` : r.reason); render(); };
    side.append(hand);
  }

  function render() {
    if (overlay.hidden) return;
    renderTabs();
    if (view === 'compound') renderCompound(); else renderArk();
  }

  const onKey = (e) => { if (e.key === 'Escape' && !overlay.hidden) { e.stopPropagation(); api.close(); } };
  addEventListener('keydown', onKey, true);
  let raf = 0;
  // Only the editor on screen redraws, a few times a second (an Ark is 64 x 130 tiles).
  let tickN = 0;
  const loop = () => {
    tickN += 1;
    if (!overlay.hidden && tickN % 6 === 0) for (const { ui, m } of uis.values()) if (m.isConnected) ui.render?.();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  board.onChange(() => render());

  const api = {
    el: overlay,
    get open_() { return !overlay.hidden; },
    open(which = view) { view = which; overlay.hidden = false; render(); },
    close() { overlay.hidden = true; },
    toggle() { if (overlay.hidden) api.open(); else api.close(); },
    refresh: render,
    destroy() { cancelAnimationFrame(raf); removeEventListener('keydown', onKey, true); for (const { ui } of uis.values()) ui.destroy?.(); overlay.remove(); },
  };
  return api;
}
