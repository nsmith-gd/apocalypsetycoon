// World map screen: the eight regions on the pixel map, each with its crisis level and the
// buyers waiting there, and a side panel to sell a finished shelter to that region's best buyer.
//
//   const screen = createWorldMapScreen({ root, sales, onSold });
//   screen.refresh();   // after a week passes, tensions change, or stock changes
//   screen.select('eur');
//
// Draws on the shared art renderer (src/art/worldmap.js) and splits its placeholder "Asia" into
// Middle East / South Asia / East Asia, so all eight demand regions are clickable.

import { drawWorldMap, regionAt as artRegionAt, crisisOverlay, MAP_W, MAP_H, MAP_COLS, MAP_ROWS, CELL } from '../art/worldmap.js';
import { MAP_MARKERS, CRISIS_OVERLAYS } from '../art/sprites-map.js';
import { drawSprite } from '../art/render.js';
import { drawText, textWidth } from '../art/font.js';
import { HEX } from '../art/palette.js';
import { formatMoney } from '../ledger/ledger.js';
import { CLIENT_TYPES } from '../clients/clients.js';
import { ROOM_CATALOG } from '../clients/rooms.js';

// Short map labels (the 3x5 font is 4px a letter) and marker anchors, in cells.
export const MAP_PLACES = Object.freeze({
  nam: { short: 'N.AMERICA', at: [4, 5] },
  lat: { short: 'LATAM', at: [10, 13] },
  eur: { short: 'EUROPE', at: [18, 3] },
  afr: { short: 'AFRICA', at: [19, 11] },
  mea: { short: 'MID-EAST', at: [25, 7] },
  sas: { short: 'S.ASIA', at: [30, 10] },
  eas: { short: 'E.ASIA', at: [30, 3] },
  oce: { short: 'OCEANIA', at: [33, 16] },
});

const ART_TO_REGION = { na: 'nam', sa: 'lat', eu: 'eur', af: 'afr', oc: 'oce' };

/** Which of the eight demand regions a map cell belongs to (null for sea and ice). */
export function regionAtCell(col, row) {
  const art = artRegionAt(col, row);
  if (!art) return null;
  if (art.id !== 'as') return ART_TO_REGION[art.id];
  if (row >= 5 && col <= 29) return 'mea';
  if (row >= 7 && col >= 30 && col <= 34) return 'sas';
  return 'eas';
}

const TRACK_NAMES = { pandemic: 'Pandemic', climate: 'Climate', unrest: 'Civil unrest', markets: 'Market crash', war: 'War' };
const ZONES = [
  { below: 40, name: 'calm', word: 'CALM' },
  { below: 70, name: 'uneasy', word: 'UNEASY' },
  { below: 90, name: 'edge', word: 'EDGE' },
  { below: 101, name: 'tipping', word: 'TIPPING' },
];
const zoneOf = (v) => ZONES.find((z) => v < z.below) ?? ZONES[ZONES.length - 1];
const crisisColor = (v) => ({ calm: HEX.W, uneasy: HEX.Y, edge: HEX.O, tipping: HEX.R }[zoneOf(v).name]);

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export function createWorldMapScreen({ root, sales, onSold, initial = null }) {
  root.classList.add('wm');
  const mapWrap = el('div', 'wm-map');
  const canvas = el('canvas');
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  canvas.setAttribute('aria-label', 'World map. Click a region to see its buyers.');
  const legend = el('div', 'wm-legend');
  legend.innerHTML = '<span><i class="wm-ico wm-ico-buyer"></i>buyers waiting</span><span><i class="wm-ico" style="background:var(--at-gold)"></i>uneasy 40+</span><span><i class="wm-ico" style="background:var(--at-amber)"></i>edge 70+</span><span><i class="wm-ico" style="background:var(--at-red)"></i>tipping 90+</span>';
  mapWrap.append(canvas, legend);

  const panel = el('aside', 'wm-panel');
  root.append(mapWrap, panel);

  const ctx = canvas.getContext('2d');
  let selected = initial;
  let hover = null;
  let rows = [];
  let frame = 0;
  let floaters = []; // { text, x, y, color, t }
  let flash = null; // { msg, kind }

  // ---------- map ----------
  function cellFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * MAP_W;
    const y = ((e.clientY - r.top) / r.height) * MAP_H;
    return [Math.floor(x / CELL), Math.floor(y / CELL)];
  }
  function regionFromEvent(e) {
    const [c, r] = cellFromEvent(e);
    const direct = regionAtCell(c, r);
    if (direct) return direct;
    // clicking a marker or label that sits over water still picks its region
    for (const [id, p] of Object.entries(MAP_PLACES)) {
      const [ac, ar] = p.at;
      if (c >= ac - 1 && c <= ac + Math.ceil((textWidth(p.short) + 6) / CELL) && r >= ar - 1 && r <= ar + 1) return id;
    }
    return null;
  }
  canvas.addEventListener('mousemove', (e) => { hover = regionFromEvent(e); canvas.style.cursor = hover ? 'pointer' : 'default'; });
  canvas.addEventListener('mouseleave', () => { hover = null; });
  canvas.addEventListener('click', (e) => { const id = regionFromEvent(e); if (id) select(id); });

  function drawMap() {
    const anim = Math.floor(frame / 20) % 2;
    ctx.fillStyle = HEX.K;
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    drawWorldMap(ctx, { frame: anim, labels: false });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    // crisis overlays + selection/hover per cell of each of the eight regions
    for (let r = 0; r < MAP_ROWS; r++) for (let c = 0; c < MAP_COLS; c++) {
      const id = regionAtCell(c, r);
      if (!id) continue;
      const ov = crisisOverlay(byId[id]?.crisis ?? 0);
      if (ov) drawSprite(ctx, CRISIS_OVERLAYS[ov], c * CELL, r * CELL, { frame: anim });
      if (id === selected || id === hover) {
        if (id === selected) drawSprite(ctx, CRISIS_OVERLAYS.selected, c * CELL, r * CELL, { frame: anim });
        // outline the region's edge
        ctx.fillStyle = id === selected ? HEX.L : HEX.S;
        const other = (dc, dr) => regionAtCell(c + dc, r + dr) !== id;
        if (other(0, -1)) ctx.fillRect(c * CELL, r * CELL, CELL, 1);
        if (other(0, 1)) ctx.fillRect(c * CELL, r * CELL + CELL - 1, CELL, 1);
        if (other(-1, 0)) ctx.fillRect(c * CELL, r * CELL, 1, CELL);
        if (other(1, 0)) ctx.fillRect(c * CELL + CELL - 1, r * CELL, 1, CELL);
      }
    }
    // sold bunkers
    const soldIn = {};
    for (const s of sales.sold) soldIn[s.region] = (soldIn[s.region] ?? 0) + 1;
    // markers: name + crisis on top, buyer icon + count below
    for (const row of rows) {
      const p = MAP_PLACES[row.id];
      if (!p) continue;
      const x = p.at[0] * CELL;
      const y = p.at[1] * CELL;
      const nameColor = row.id === selected ? HEX.L : HEX.W;
      drawText(ctx, p.short, x, y - 7, nameColor);
      drawText(ctx, String(row.crisis), x + textWidth(p.short) + 4, y - 7, crisisColor(row.crisis));
      const bob = row.buyers > 0 && anim ? -1 : 0;
      drawSprite(ctx, MAP_MARKERS.client, x, y + bob);
      drawText(ctx, `${row.buyers}`, x + 10, y + 2, row.buyers > 0 ? HEX.G : HEX.S);
      if (soldIn[row.id]) {
        const bx = x + 10 + textWidth(String(row.buyers)) + 4;
        drawSprite(ctx, MAP_MARKERS.bunker, bx, y - 1);
        if (soldIn[row.id] > 1) drawText(ctx, `${soldIn[row.id]}`, bx + 11, y + 2, HEX.Y);
      }
    }
    // floating sale text
    floaters = floaters.filter((f) => f.t < 70);
    for (const f of floaters) {
      f.t += 1;
      drawText(ctx, f.text, Math.round(f.x), Math.round(f.y - f.t / 3), f.color);
    }
  }

  let raf = 0;
  const loop = () => { frame += 1; drawMap(); raf = requestAnimationFrame(loop); };

  // ---------- panel ----------
  function renderPanel() {
    panel.replaceChildren();
    if (!selected) {
      panel.append(el('h2', 'wm-h', 'WORLD MARKET'));
      panel.append(el('p', 'wm-dim', 'Click a region to see who is buying.'));
      const list = el('div', 'wm-rows');
      for (const r of [...rows].sort((a, b) => b.buyers - a.buyers || b.crisis - a.crisis)) {
        const b = el('button', 'wm-row');
        b.type = 'button';
        b.innerHTML = `<span>${r.name}</span><span class="wm-c" data-zone="${zoneOf(r.crisis).name}">${r.crisis}</span><span class="wm-b">${r.buyers} waiting</span>`;
        b.onclick = () => select(r.id);
        list.append(b);
      }
      panel.append(list, stockBlock(null));
      return;
    }
    const v = sales.regionView(selected);
    const head = el('div', 'wm-head');
    const title = el('h2', 'wm-h', v.name.toUpperCase());
    const back = el('button', 'wm-x', 'ALL');
    back.type = 'button';
    back.title = 'All regions';
    back.onclick = () => select(null);
    head.append(title, back);
    panel.append(head);

    // crisis
    const z = zoneOf(v.crisis);
    const crisis = el('div', 'wm-crisis');
    crisis.dataset.zone = z.name;
    crisis.innerHTML = `<div class="wm-lbl">CRISIS <b>${v.crisis}</b> ${z.word}${v.crisisTrack ? ` · worst: ${TRACK_NAMES[v.crisisTrack]}` : ''}</div><div class="wm-bar"><i style="width:${v.crisis}%"></i></div>`;
    panel.append(crisis);

    // demand
    const demand = el('div', 'wm-demand');
    demand.innerHTML = `<div class="wm-big"><span class="wm-num" data-n="${v.buyers}">${v.buyers}</span> BUYER${v.buyers === 1 ? '' : 'S'} WAITING</div>
      <div class="wm-dim">New leads ${v.leadsPerWeek.toFixed(1)}/week · prices x${v.panicPremium.toFixed(2)}${v.siteOwned ? ' · you have a site here' : ''}</div>`;
    panel.append(demand);
    const buyers = el('ul', 'wm-buyers');
    for (const [i, l] of v.buyerList.slice(0, 5).entries()) {
      const li = el('li');
      const weeksLeft = 4 - (sales.market.weekNo - l.week);
      li.innerHTML = `<span>${i === 0 ? '▶ ' : ''}${CLIENT_TYPES[l.type]?.label ?? l.type} <em class="wm-w-${l.wealth}">${l.wealth}</em></span><small data-late="${weeksLeft <= 1}">${weeksLeft}wk</small>`;
      buyers.append(li);
    }
    if (v.buyerList.length > 5) buyers.append(el('li', 'wm-dim', `+${v.buyerList.length - 5} more`));
    if (!v.buyerList.length) buyers.append(el('li', 'wm-dim', "Nobody here is scared enough to buy. Calm worlds don't buy bunkers."));
    panel.append(buyers);
    panel.append(stockBlock(v));
    if (flash) {
      const f = el('div', `wm-flash wm-flash-${flash.kind}`, flash.msg);
      panel.append(f);
    }
  }

  function stockBlock(v) {
    const wrap = el('div', 'wm-stock');
    wrap.append(el('h3', 'wm-h3', `FINISHED SHELTERS · ${sales.stock.length} IN STOCK`));
    if (!sales.stock.length) {
      wrap.append(el('p', 'wm-dim', 'Nothing to sell. Finish a shelter on the build screen.'));
      return wrap;
    }
    for (const s of sales.stock) {
      const card = el('div', 'wm-card');
      const rooms = summarizeRooms(s.rooms);
      const quote = v ? v.quotes.find((q) => q.shelter === s) : null;
      card.innerHTML = `<div class="wm-card-name">${s.name}</div><div class="wm-dim">${s.occupants} people · ${rooms}</div>`;
      if (v) {
        const btn = el('button', 'wm-sell');
        btn.type = 'button';
        if (quote?.price) {
          btn.innerHTML = `SELL <b>${formatMoney(quote.price)}</b>`;
          btn.title = `Sell to the ${CLIENT_TYPES[v.best.type]?.label ?? 'client'} (${v.best.wealth})`;
          btn.onclick = () => sell(s.id);
        } else {
          btn.disabled = true;
          btn.textContent = 'NO BUYER';
        }
        card.append(btn);
      } else {
        card.append(el('div', 'wm-dim', `list value ${formatMoney(s.value)}`));
      }
      wrap.append(card);
    }
    return wrap;
  }

  function summarizeRooms(ids) {
    const counts = {};
    for (const id of ids) counts[id] = (counts[id] ?? 0) + 1;
    return Object.entries(counts).map(([id, n]) => `${n > 1 ? `${n}x ` : ''}${ROOM_CATALOG[id]?.name ?? id}`).join(', ');
  }

  function sell(shelterId) {
    try {
      const rec = sales.sell(selected, shelterId);
      const p = MAP_PLACES[selected];
      floaters.push({ text: formatMoney(rec.price), x: p.at[0] * CELL, y: p.at[1] * CELL - 10, color: HEX.L, t: 0 });
      floaters.push({ text: '-1', x: p.at[0] * CELL + 10, y: p.at[1] * CELL + 10, color: HEX.R, t: 0 });
      flash = { kind: 'ok', msg: `Sold ${rec.name} to ${rec.owner} (${CLIENT_TYPES[rec.clientType]?.label ?? rec.clientType}) for ${formatMoney(rec.price)}.` };
      onSold?.(rec);
    } catch (err) {
      flash = { kind: 'err', msg: err.message };
    }
    refresh();
  }

  function select(id) {
    selected = id;
    flash = null;
    refresh();
  }

  function refresh() {
    rows = sales.overview();
    renderPanel();
  }

  const off = sales.onChange((e) => { if (e.type !== 'sale') refresh(); });
  const offMarket = sales.market.on('week', () => { flash = null; refresh(); });
  refresh();
  raf = requestAnimationFrame(loop);

  return {
    refresh,
    select,
    get selected() { return selected; },
    canvas,
    destroy() { cancelAnimationFrame(raf); off(); offMarket(); root.replaceChildren(); },
  };
}
