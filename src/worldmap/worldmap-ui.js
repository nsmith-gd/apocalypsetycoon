// World map screen: the eight regions on the pixel map, each with its crisis level and the
// buyers waiting there, and a side panel to sell a finished shelter to that region's best buyer.
//
//   const screen = createWorldMapScreen({ root, sales, schemes, onSold, onScheme });
//   (`schemes` is an optional SchemeBoard from src/schemes: adds the CRISES HERE bars and the SCHEMES list.)
//   screen.refresh();   // after a week passes, tensions change, or stock changes
//   screen.select('eur');
//
// Draws on the shared art renderer (src/art/worldmap.js) and splits its placeholder "Asia" into
// Middle East / South Asia / East Asia, so all eight demand regions are clickable.

import { quoteLead, redeemLead } from '../leads/redeem.js';
import { drawWorldMap, regionAt as artRegionAt, crisisOverlay, MAP_W, MAP_H, MAP_COLS, MAP_ROWS, CELL, WORLD_LAYOUT } from '../art/worldmap.js';
import { MAP_MARKERS, CRISIS_OVERLAYS } from '../art/sprites-map.js';
import { drawSprite } from '../art/render.js';
import { drawText, textWidth } from '../art/font.js';
import { HEX } from '../art/palette.js';
import { formatMoney } from '../ledger/ledger.js';
import { CLIENT_TYPES } from '../clients/clients.js';
import { ROOM_CATALOG } from '../clients/rooms.js';
import { settings } from '../settings/settings.js';
import { buildRegionMask, drawRegionLayer } from '../art/map-regions.js';
import { mapBase } from '../art/map-base.js';
import { drawMarker, drawLabelPlate, drawCountTag } from '../art/map-markers.js';
import { drawHeatLayer } from '../art/map-heat.js';

let MASK = null;
/** Per-pixel region mask from the clickable hit areas (built once). */
// Borders hug the painted coastline of the base layer (#100), inside the same clickable cells.
export const regionMask = () => (MASK ??= buildRegionMask({ w: MAP_W, h: MAP_H, cell: CELL, regionAtCell, isLandPx: mapBase().isLandPx }));

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

export function createWorldMapScreen({ root, sales, schemes = null, leads = null, onSold, onScheme, initial = null }) {
  root.classList.add('wm');
  const mapWrap = el('div', 'wm-map');
  const canvas = el('canvas');
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  canvas.setAttribute('aria-label', 'World map. Click a region to see its buyers.');
  const legend = el('div', 'wm-legend');
  legend.innerHTML = '<span><i class="wm-ico wm-ico-buyer"></i>buyers waiting</span><span><i class="wm-ico" style="background:var(--at-gold)"></i>uneasy 40+</span><span><i class="wm-ico" style="background:var(--at-amber)"></i>edge 70+</span><span><i class="wm-ico" style="background:var(--at-red)"></i>tipping 90+</span>';
  const toast = el('div', 'wm-toast');
  toast.hidden = true;
  mapWrap.append(canvas, toast, legend);
  // #102 legibility + #105: the map shows at a whole-number zoom (2x, 3x...) so every pixel of the labels and
  // icons stays crisp; fractional scales smear the 3x5 font. fitMap() below does it (width AND height, so the
  // aspect and the click mapping stay exact).

  const panel = el('aside', 'wm-panel');
  root.append(mapWrap, panel);

  // Whole-number scaling (#105): the 320x192 map is shown at the largest integer scale that fits its column and
  // the window height, so every map pixel is the same size on screen (fractional scales draw pixels 1 and 2
  // screen pixels wide: seams and shimmer on hand-placed art). The frame is an outline, so it takes no layout.
  function fitMap() {
    const availW = mapWrap.clientWidth || MAP_W;
    const top = mapWrap.getBoundingClientRect().top;
    const availH = Math.max(MAP_H, (window.innerHeight || 0) - Math.max(0, top) - 70); // legend + breathing room
    const scale = Math.max(1, Math.floor(Math.min(availW / MAP_W, availH / MAP_H)));
    const w = `${MAP_W * scale}px`;
    const h = `${MAP_H * scale}px`;
    if (canvas.style.width !== w || canvas.style.height !== h) { canvas.style.width = w; canvas.style.height = h; } // always both: aspect = click mapping
    canvas.dataset.scale = String(scale);
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fitMap()) : null;
  ro?.observe(mapWrap);
  addEventListener('resize', fitMap);

  const ctx = canvas.getContext('2d');
  let selected = initial;
  let hover = null;
  let rows = [];
  let frame = 0;
  let floaters = []; // { text, x, y, color, t }
  let flash = null; // { msg, kind }
  let toastTimer = 0;

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
    // demand heat (#103): veil + wash + texture + rim per region, readable on busy terrain. The textures
    // are always on now; Crisis patterns (#94) makes them bolder, Reduced flashing stops the tipping pulse.
    const levels = Object.fromEntries(rows.map((r) => [r.id, crisisOverlay(r.crisis ?? 0)]));
    drawHeatLayer(ctx, regionMask(), levels, { frame: Math.floor(frame / 10), strong: settings.get('trackPatterns'), steady: settings.get('reducedFlash') });
    // cities (#102): a skyline icon over each city cell, sitting on its cell's bottom edge
    for (let r = 0; r < MAP_ROWS; r++) for (let c = 0; c < MAP_COLS; c++) if (WORLD_LAYOUT[r][c] === 'c') drawMarker(ctx, 'city', c * CELL - 1, r * CELL - 2);
    // region borders and idle / hover / selected states (#101), on the region hit areas
    drawRegionLayer(ctx, regionMask(), { hover, selected, frame: Math.floor(frame / 3) });
    // sold bunkers
    const soldIn = {};
    for (const s of sales.sold) soldIn[s.region] = (soldIn[s.region] ?? 0) + 1;
    // markers: name + crisis on top, buyer icon + count below
    for (const row of rows) {
      const p = MAP_PLACES[row.id];
      if (!p) continue;
      const x = p.at[0] * CELL;
      const y = p.at[1] * CELL;
      // #102: name + crisis on a plate; below it the buyer icon and count, sold shelters, your site flag
      drawLabelPlate(ctx, p.short, x - 2, y - 11, { num: row.crisis, numColor: crisisColor(row.crisis), selected: row.id === selected });
      const bob = row.buyers > 0 && anim ? -1 : 0;
      let cx = x;
      drawMarker(ctx, 'client', cx, y + bob);
      cx += 9 + drawCountTag(ctx, row.buyers, cx + 9, y + 1, row.buyers > 0 ? HEX.G : HEX.S);
      if (soldIn[row.id]) {
        drawMarker(ctx, 'bunker', cx + 2, y - 1);
        cx += 13;
        if (soldIn[row.id] > 1) cx += drawCountTag(ctx, soldIn[row.id], cx, y + 1, HEX.Y);
      }
      if (row.siteOwned) drawMarker(ctx, 'site', cx + 2, y - 2);
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
    crisis.innerHTML = `<div class="wm-lbl">CRISIS <b>${v.crisis}</b> ${z.word}${v.crisisTrack ? ` · worst: ${schemes?.crisis.tracks[v.crisisTrack]?.name ?? TRACK_NAMES[v.crisisTrack] ?? v.crisisTrack}` : ''}</div><div class="wm-bar"><i style="width:${v.crisis}%"></i></div>`;
    panel.append(crisis);
    if (schemes) panel.append(tracksBlock(v));

    // demand
    const demand = el('div', 'wm-demand');
    demand.innerHTML = `<div class="wm-big"><span class="wm-num" data-n="${v.buyers}">${v.buyers}</span> BUYER${v.buyers === 1 ? '' : 'S'} WAITING</div>
      <div class="wm-dim">New leads ${v.leadsPerWeek.toFixed(1)}/week · prices x${v.premium.toFixed(2)}${v.edgeBonus ? ' <b class="wm-edge">EDGE BONUS</b>' : ''}${v.siteOwned ? ' · you have a site here' : ''}</div>`;
    panel.append(demand);
    const buyers = el('ul', 'wm-buyers');
    const shown = schemes ? 3 : 5;
    for (const [i, l] of v.buyerList.slice(0, shown).entries()) {
      const li = el('li');
      const weeksLeft = sales.market.cfg.rivalAfterWeeks - (sales.market.weekNo - l.week);
      li.innerHTML = `<span>${i === 0 ? '▶ ' : ''}${CLIENT_TYPES[l.type]?.label ?? l.type} <em class="wm-w-${l.wealth}">${l.wealth}</em></span><small data-late="${weeksLeft <= 1}">${weeksLeft}wk</small>`;
      buyers.append(li);
    }
    if (v.buyerList.length > shown) buyers.append(el('li', 'wm-dim', `+${v.buyerList.length - shown} more`));
    if (!v.buyerList.length) buyers.append(el('li', 'wm-dim', "Nobody here is scared enough to buy. Calm worlds don't buy bunkers."));
    panel.append(buyers);
    if (schemes) panel.append(schemesBlock(v));
    if (leads) panel.append(leadsBlock(v));
    panel.append(stockBlock(v));
  }

  // One bar per crisis track, most exposed first: tension, the edge band and the visible tipping range.
  const EXPO_ORDER = { high: 0, medium: 1, low: 2 };
  function tracksBlock(v) {
    const region = sales.region(v.id);
    const wrap = el('div', 'wm-tracks');
    wrap.append(el('h3', 'wm-h3', 'CRISES HERE · $$$ = THE EDGE, JUST BELOW THE TIPPING POINT'));
    // only the crises in play in this world (a roster track shows once it has opened)
    const ids = Object.keys(region.exposure).filter((id) => schemes.crisis.tracks[id]?.open)
      .sort((a, b) => EXPO_ORDER[region.exposure[a]] - EXPO_ORDER[region.exposure[b]]);
    if (!ids.length) wrap.append(el('div', 'wm-dim', 'No threat has opened yet. The world is calm, and calm worlds don\'t buy bunkers.'));
    for (const id of ids) {
      const tv = schemes.trackView(id);
      const row = el('div', 'wm-track');
      row.dataset.zone = tv.zone;
      const tipTxt = tv.zone === 'breach' ? 'BREACHED' : tv.zone === 'collapsed' ? 'COLLAPSED' : tv.zone === 'locked' ? `recovering ${tv.lockWeeks}wk` : tv.exact != null ? `tips at ${tv.exact}` : `tips ${tv.tipLow}-${tv.tipHigh}?`;
      row.innerHTML = `<div class="wm-track-lbl"><span>${tv.name} <em data-x="${region.exposure[id]}">${region.exposure[id].toUpperCase()}</em></span><span><b>${tv.tension}</b> · ${tipTxt}</span></div>
        <div class="wm-tbar"><span class="wm-tedge" style="left:${tv.edgeFrom}%;width:${tv.tipLow - tv.edgeFrom}%"></span><span class="wm-ttip" style="left:${tv.tipLow}%;width:${Math.max(1, tv.tipHigh - tv.tipLow)}%"></span><i style="width:${tv.tension}%"></i></div>`;
      // Controlled burn (#93): at the Brink you may tip it on purpose for a window of doubled premiums.
      if (tv.state === 'brink' && schemes.crisis.controlledBurn) {
        const t = schemes.crisis.tracks[id];
        const next = schemes.crisis.cfg.windowWeeks[Math.min(t.breaches + 2, schemes.crisis.cfg.windowWeeks.length) - 1];
        const now = schemes.crisis.cfg.windowWeeks[Math.min(t.breaches + 1, schemes.crisis.cfg.windowWeeks.length) - 1];
        const burn = el('button', 'wm-burn', 'CONTROLLED BURN');
        burn.type = 'button';
        burn.title = `Tip ${tv.name} on purpose: panic premiums double for the breach (${now} weeks to contain it). Costs heat +${schemes.crisis.cfg.controlledBurnHeat ?? 10}, a scar when contained, and a ${next}-week window next time.`;
        burn.onclick = () => {
          const r = schemes.crisis.controlledBurn(id);
          flash = r.ok ? { kind: 'err', msg: `CONTROLLED BURN: ${tv.name} breached on your schedule. Panic premiums doubled for up to ${r.weeks} weeks. Heat +${r.heat}. Next time it breaches you'll get ${r.nextWindow} weeks.` } : { kind: 'err', msg: r.reason };
          onScheme?.(r);
          refresh();
        };
        row.append(burn);
      }
      wrap.append(row);
    }
    const burning = ids.some((id) => schemes.crisis.tracks[id]?.state === 'breach');
    if (v.edgeBonus) wrap.append(el('div', 'wm-edge-note', burning
      ? `BREACH: premiums doubled while it burns (edge +${Math.round(v.edgeBonus * 100)}%, prices x${v.premium.toFixed(2)}). Contain it before the window closes.`
      : `AT THE EDGE: prices here +${Math.round(v.edgeBonus * 100)}%. One more push could tip it.`));
    return wrap;
  }

  function schemesBlock(v) {
    const wrap = el('div', 'wm-schemes');
    wrap.append(el('h3', 'wm-h3', `SCHEMES IN ${v.name.toUpperCase()}`));
    for (const o of schemes.available(v.id)) {
      if (o.locked && !o.scheme.research) continue;
      const row = el('div', 'wm-scheme');
      row.dataset.locked = String(o.locked);
      const risky = !o.reason && o.track.tension + o.gain >= o.track.tipLow;
      row.innerHTML = `<div><div class="wm-card-name">${o.scheme.name}</div><div class="wm-dim">${o.track.name} <b class="wm-gain">+${o.gain}</b> here (${o.exposure}) · heat +${o.heat}${risky ? ' · <b class="wm-risk">MAY TIP IT</b>' : ''}</div></div>`;
      const b = el('button', 'wm-fund');
      b.type = 'button';
      if (o.reason) { b.disabled = true; b.textContent = o.locked ? 'R&D' : 'BLOCKED'; b.title = o.reason; }
      else { b.innerHTML = `FUND <b>${formatMoney(o.cost)}</b>`; b.onclick = () => runScheme(o.scheme.id); }
      row.append(b);
      wrap.append(row);
    }
    return wrap;
  }

  function runScheme(id) {
    const before = sales.regionView(selected);
    try {
      const r = schemes.run(id, selected);
      const after = sales.regionView(selected);
      const p = MAP_PLACES[selected];
      floaters.push({ text: `${r.track.toUpperCase()} ${Math.round(r.gain)}`, x: p.at[0] * CELL, y: p.at[1] * CELL - 12, color: HEX.O, t: 0 });
      if (r.breached) {
        flash = { kind: 'err', msg: `RUNAWAY CRISIS! ${r.scheme.name} tipped ${schemes.crisis.tracks[r.track].name} past its tipping point.${r.fled ? ` ${r.fled} buyer${r.fled === 1 ? '' : 's'} in ${r.region.name} fled to rivals.` : ''}` };
        floaters.push({ text: 'RUNAWAY!', x: p.at[0] * CELL, y: p.at[1] * CELL + 12, color: HEX.R, t: 0 });
      } else {
        const up = Math.round((after.premium - before.premium) * 100);
        flash = { kind: r.enteredEdge ? 'edge' : 'ok', msg: `${r.scheme.name}: ${schemes.crisis.tracks[r.track].name} ${Math.round(r.before)} → ${Math.round(r.after)}. Prices here x${after.premium.toFixed(2)}${up > 0 ? ` (+${up}%)` : ''}${after.buyers > before.buyers ? `, ${after.buyers - before.buyers} new buyer${after.buyers - before.buyers === 1 ? '' : 's'}` : ''}.${r.enteredEdge ? ' You are at the EDGE: prices peak here.' : ''}` };
      }
      onScheme?.(r);
    } catch (err) {
      flash = { kind: 'err', msg: err.message };
    }
    refresh();
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

  // #58: your own leads (people met at events) in this region, redeemable for a better sale.
  function leadsBlock(v) {
    const wrap = el('div', 'wm-leads');
    const mine = leads.open({ salesRegion: v.id });
    wrap.append(el('h3', 'wm-h3', `YOUR LEADS HERE · ${mine.length}`));
    if (!mine.length) {
      wrap.append(el('p', 'wm-dim', 'Nobody you have met lives here. Go to events to meet buyers.'));
      return wrap;
    }
    const q = leads.getQuarter();
    for (const l of mine) {
      const card = el('div', 'wm-lead');
      card.dataset.tier = l.tier;
      const left = l.expiresQuarter - q;
      const expiry = left <= 0 ? 'goes cold after this quarter' : `good until end of Q${l.expiresQuarter}`;
      card.innerHTML = `<div class="wm-card-name">${l.guest.name} <em class="wm-tier" data-tier="${l.tier}">${l.tier.toUpperCase()}</em> <em class="wm-w-${l.salesWealth}">${l.salesWealth}</em></div>
        <div class="wm-dim">${l.wealthClass} · met at ${l.source?.venueName ?? venueName(l.source?.venueId)} · ${expiry}${l.fears.length ? ` · fears ${l.fears.join(', ')}` : ''}</div>`;
      for (const s of sales.stock) {
        const qt = quoteLead(sales, leads, l.id, s.id);
        if (qt.error) continue;
        const btn = el('button', 'wm-sell wm-sell-lead');
        btn.type = 'button';
        btn.dataset.lead = l.id;
        btn.dataset.shelter = s.id;
        const vs = qt.walkIn ? `${qt.price >= qt.walkIn.price ? '+' : ''}${formatMoney(qt.price - qt.walkIn.price)} vs walk-in` : 'only buyer here';
        btn.innerHTML = `SELL ${s.name} <b>${formatMoney(qt.price)}</b> <small>${vs}</small>`;
        btn.title = [...qt.bonus.lines.map((x) => `${x.label} +${Math.round(x.bonus * 100)}%`), qt.tierUp ? `${qt.tierUp} wealth tier${qt.tierUp > 1 ? 's' : ''} above walk-ins` : null, qt.referrals ? `brings ${qt.referrals === 1 ? 'a referral' : 'half a referral'}` : null].filter(Boolean).join(' · ') || 'normal price';
        btn.onclick = () => redeem(l.id, s.id);
        card.append(btn);
      }
      if (!sales.stock.length) card.append(el('div', 'wm-dim', 'Finish a shelter to sell to them.'));
      wrap.append(card);
    }
    return wrap;
  }

  const venueName = (id) => (id ? id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'an event');

  function redeem(leadId, shelterId) {
    try {
      const { record, quote, referrals } = redeemLead(sales, leads, leadId, shelterId);
      const p = MAP_PLACES[selected];
      floaters.push({ text: formatMoney(record.price), x: p.at[0] * CELL, y: p.at[1] * CELL - 10, color: HEX.L, t: 0 });
      if (referrals) floaters.push({ text: `+${referrals}`, x: p.at[0] * CELL + 10, y: p.at[1] * CELL + 10, color: HEX.G, t: 0 });
      const extra = quote.walkIn ? `, ${formatMoney(record.price - quote.walkIn.price)} more than a walk-in` : '';
      flash = { kind: 'ok', msg: `Sold ${record.name} to ${record.owner}, your lead, for ${formatMoney(record.price)}${extra}.${referrals ? ` They told a friend: +${referrals} buyer here.` : ''}` };
      onSold?.(record);
    } catch (err) {
      flash = { kind: 'err', msg: err.message };
    }
    refresh();
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
    toast.hidden = !flash;
    if (flash && toast.textContent !== flash.msg) {
      toast.className = `wm-toast wm-flash-${flash.kind}`;
      toast.textContent = flash.msg;
      clearTimeout(toastTimer);
      const shown = flash;
      toastTimer = setTimeout(() => { if (flash === shown) { flash = null; toast.hidden = true; toast.textContent = ''; } }, 7000);
    }
  }

  const off = sales.onChange((e) => { if (e.type !== 'sale') refresh(); });
  const offLeads = leads?.onChange?.(() => refresh());
  const offMarket = sales.market.on('week', () => { flash = null; refresh(); });
  const offSchemes = schemes?.onChange((e) => { if (e.type !== 'run') refresh(); });
  refresh();
  raf = requestAnimationFrame(loop);
  requestAnimationFrame?.(() => fitMap());
  fitMap();

  return {
    refresh,
    select,
    get selected() { return selected; },
    canvas,
    destroy() { cancelAnimationFrame(raf); ro?.disconnect(); removeEventListener('resize', fitMap); off(); offLeads?.(); offMarket(); offSchemes?.(); root.replaceChildren(); },
  };
}
