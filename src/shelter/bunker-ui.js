// Bunker editor: the tile-level shelter canvas. Same surface as the old grid UI, so the campaign can
// swap it in: createBunkerUI({ mount, grid: BunkerSite, getFrame, onToast, onHandOver })
//   -> { el, canvas, render, refresh, fit(maxW, maxH), chromeHeight(), destroy }
//
// Tools: DIG (drag a box), WALL (drag; hold Shift for an outline), SPINE, conduits AIR / WATER / POWER
// (drag a line), any object from the palette (click; ghost shows where and why not), REMOVE (right-click
// anywhere also removes). Overlays: rooms, air, water, power, noise.

import { OBJECTS, STRUCTURES, CONDUITS, STRATA, TIER_COLORS, WATER_TABLE_M } from './bunker-catalog.js';
import { drawText } from '../art/font.js';

const T = 16;
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const k = (n) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1e3)}K`);
const fmtDays = (d) => (d === Infinity ? '∞' : d >= 100 ? Math.round(d) : d);

const CAT_COLORS = { door: '#9a8a70', sleep: '#8a6a4a', air: '#bfe3ff', water: '#3a8ad8', food: '#c8743a', power: '#f5c542', kitchen: '#e0a060', bath: '#7ac8d8', medical: '#f2f2f2', security: '#8a2a2a', comfort: '#a0703a', decor: '#7a9a5a', status: '#3aa070' };
const CATS = [
  ['ESSENTIALS', ['door', 'airlock', 'bunk', 'bed', 'shelf', 'fridge', 'tank', 'toilet', 'shower', 'stove']],
  ['LIFE SUPPORT', ['crank_scrubber', 'hepa', 'o2_rack', 'recycler', 'sump', 'hydro', 'grow_light', 'vat', 'aquifer']],
  ['POWER', ['diesel', 'fuel', 'battery', 'solar', 'geothermal', 'reactor']],
  ['DEFENCE', ['blast_1', 'blast_2', 'blast_3', 'decon', 'gun_locker', 'camera', 'guard_post', 'decoy']],
  ['COMFORT', ['sofa', 'tv', 'bookshelf', 'led_sky', 'gym_rig', 'med_bed', 'plant', 'lamp']],
  ['STATUS', ['king_bed', 'gold_taps', 'painting', 'statue', 'wine_rack', 'chef_range', 'cinema_seats', 'cinema_screen', 'cryo_pod']],
];
const TOOLS = [['dig', 'DIG', 'D'], ['wall', 'WALL', 'W'], ['spine', 'SPINE', 'S'], ['air', 'AIR DUCT', '1'], ['water', 'WATER PIPE', '2'], ['power', 'POWER CABLE', '3'], ['remove', 'REMOVE', 'X']];
const OVERLAYS = [['rooms', 'ROOMS'], ['air', 'AIR'], ['water', 'WATER'], ['power', 'POWER'], ['noise', 'NOISE'], ['none', 'PLAIN']];

export function createBunkerUI({ mount, grid: site, getFrame = () => 0, onToast = null, onHandOver = null }) {
  const W = site.W, H = site.H, S = site.S;
  const wrap = el('div', 'bk');
  // ---------- toolbar ----------
  const toolbar = el('div', 'bk-tools');
  let tool = 'dig';
  let overlay = 'rooms';
  const toolBtns = {};
  for (const [id, label, key] of TOOLS) {
    const b = el('button', 'bk-tool', label);
    b.title = `${label} [${key}]`;
    b.onclick = () => { tool = id; sync(); };
    toolBtns[id] = b;
    toolbar.append(b);
  }
  const overlaySel = el('select', 'bk-overlay');
  for (const [id, label] of OVERLAYS) { const o = el('option', null, `VIEW: ${label}`); o.value = id; overlaySel.append(o); }
  overlaySel.onchange = () => { overlay = overlaySel.value; draw(); };
  toolbar.append(overlaySel);

  // ---------- palette ----------
  const pal = el('div', 'bk-pal');
  const palBtns = {};
  for (const [group, ids] of CATS) {
    pal.append(el('div', 'bk-grp', group));
    for (const id of ids) {
      const o = OBJECTS[id];
      const b = el('button', 'bk-obj');
      b.innerHTML = `<i style="background:${CAT_COLORS[o.cat]}"></i><span>${o.name}</span><small>${o.w}x${o.h} ${k(o.cost)}${o.minDepth ? ` ${o.minDepth}m+` : o.surface ? ' top' : ''}</small>`;
      b.title = describe(o);
      b.onclick = () => { tool = id; sync(); };
      palBtns[id] = b;
      pal.append(b);
    }
  }
  function describe(o) {
    const bits = [];
    if (o.beds) bits.push(`sleeps ${o.beds}`);
    if (o.air) bits.push(`air ${o.air} m³/h`);
    if (o.airStock) bits.push(`${o.airStock} m³ reserve`);
    if (o.waterStock) bits.push(`stores ${o.waterStock.toLocaleString()} L`);
    if (o.water < 0) bits.push(`uses ${-o.water} L/day`);
    if (o.recycle) bits.push(`recycles ${o.recycle * 100}% of water`);
    if (o.foodStock) bits.push(`stores ${o.foodStock} meals`);
    if (o.food) bits.push(`${o.food} meals/day`);
    if (o.power > 0) bits.push(`+${o.power} kW${o.solar ? ' by day' : ''}`);
    if (o.power < 0) bits.push(`draws ${-o.power} kW`);
    if (o.fuelUse) bits.push(`burns ${o.fuelUse} L fuel/day`);
    if (o.fuelStock) bits.push(`holds ${o.fuelStock} L fuel`);
    if (o.battery) bits.push(`${o.battery} kWh`);
    if (o.seal) bits.push(`seal +${o.seal}`);
    if (o.blast) bits.push(`blast +${o.blast}`);
    if (o.security) bits.push(`security +${o.security}`);
    if (o.noise) bits.push(`noise ${o.noise}`);
    if (o.beauty) bits.push(`beauty ${o.beauty}`);
    if (o.prestige) bits.push(`prestige ${o.prestige}`);
    if (o.net) bits.push(`needs ${o.net.join(' + ')}`);
    return `${o.name} (${o.w}x${o.h}): ${bits.join(', ')}`;
  }

  // ---------- canvas ----------
  const scroller = el('div', 'bk-scroll');
  const canvas = el('canvas', 'bk-canvas');
  canvas.width = W * T;
  canvas.height = (H + S) * T;
  scroller.append(canvas);
  const info = el('div', 'bk-info', 'Drag to dig. Rooms form wherever walls enclose a space; what you put inside decides what it is.');
  const centre = el('div', 'bk-centre');
  centre.append(toolbar, scroller, info);

  // ---------- side panel ----------
  const side = el('div', 'bk-side');
  wrap.append(pal, centre, side);
  mount.append(wrap);
  const ctx = canvas.getContext('2d');

  // ---------- input ----------
  let hover = null;
  let drag = null;
  let selectedRoom = null;
  const tileAt = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * W);
    const y = Math.floor(((e.clientY - r.top) / r.height) * (H + S)) - S;
    return { x, y };
  };
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => {
    const t = tileAt(e);
    if (e.button === 2) { act('remove', t, t); return; }
    drag = { from: t, to: t, shift: e.shiftKey };
  });
  canvas.addEventListener('mousemove', (e) => { hover = tileAt(e); if (drag) drag.to = hover; describeHover(); draw(); });
  canvas.addEventListener('mouseleave', () => { hover = null; draw(); });
  addEventListener('mouseup', onUp);
  function onUp(e) {
    if (!drag) return;
    const { from, to, shift } = drag;
    drag = null;
    act(tool, from, to, shift || e.shiftKey);
  }
  function toast(msg) { info.textContent = msg; onToast?.(msg); }
  function act(which, a, b, outline = false) {
    if (OBJECTS[which]) {
      const r = site.place(which, b.x, b.y);
      toast(r.ok ? `${OBJECTS[which].name} ordered. A crew will fit it once the space is dug.` : `Can't place: ${r.reason}.`);
    } else if (which === 'dig') {
      const n = site.digRect(a.x, a.y, b.x, b.y);
      toast(n ? `${n} tile${n > 1 ? 's' : ''} ordered dug. Crews dig down from the surface or the spine.` : 'Nothing new to dig there.');
    } else if (which === 'wall' || which === 'spine') {
      const n = which === 'spine' ? site.buildRect('spine', a.x, a.y, a.x + (b.x >= a.x ? Math.min(1, b.x - a.x) : 0), b.y) : site.buildRect('wall', a.x, a.y, b.x, b.y, { outline });
      toast(n ? `${n} ${STRUCTURES[which].name.toLowerCase()} tile${n > 1 ? 's' : ''} ordered.` : 'Dig those tiles first (or they are taken).');
    } else if (CONDUITS[which]) {
      const n = site.conduitLine(which, a.x, a.y, b.x, b.y);
      toast(n ? `${n} m of ${CONDUITS[which].name.toLowerCase()} ordered.` : 'Nothing new to lay there.');
    } else if (which === 'remove') {
      for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) site.remove(x, y);
      toast('Removed (queued jobs refunded; installed objects return half their price).');
    }
    const sim = site.simulate();
    if (a && a.y >= 0) { const rid = sim.roomOf[site.idx(Math.max(0, Math.min(W - 1, b.x)), Math.max(0, Math.min(H - 1, b.y)))]; if (rid >= 0) selectedRoom = rid; }
    render();
  }
  function describeHover() {
    if (!hover || !site.inside(hover.x, hover.y)) return;
    const { x, y } = hover;
    const parts = [`${x}, ${y} m`];
    if (y >= 0) {
      const s = site.stratum(y);
      parts.push(s.name);
      if (!site.isDug(x, y)) parts.push(`dig ${k(s.digCost)}, ${s.speed} tiles/crew-day`);
      if (y >= WATER_TABLE_M) parts.push('below the water table');
    } else parts.push('surface');
    const o = site.objectAt(x, y);
    if (o) parts.push(OBJECTS[o.kind].name + (site.simulate().online.has(o.id) ? ' (on)' : ' (OFF: check its conduits/power)'));
    if (OBJECTS[tool]) { const c = site.canPlace(tool, x, y); parts.push(c.ok ? `place ${OBJECTS[tool].name} here: ${k(OBJECTS[tool].cost)}` : c.reason); }
    info.textContent = parts.join(' · ');
  }

  const onKey = (e) => {
    if (mount.hidden || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)) return;
    const t = TOOLS.find(([, , key]) => key.toLowerCase() === e.key.toLowerCase());
    if (t) { tool = t[0]; sync(); }
    if (e.key === 'Escape') { tool = 'dig'; sync(); }
  };
  addEventListener('keydown', onKey);

  function sync() {
    for (const [id, b] of Object.entries(toolBtns)) b.classList.toggle('on', id === tool);
    for (const [id, b] of Object.entries(palBtns)) b.classList.toggle('on', id === tool);
    syncLocks();
    draw();
  }

  // Research locks (#16): locked objects stay visible but greyed, with what unlocks them.
  function syncLocks() {
    const r = site.research;
    for (const [id, b] of Object.entries(palBtns)) {
      const locked = !!r && !r.canBuild(id);
      b.dataset.locked = String(locked);
      b.title = locked ? (r.lockedReason?.('object', id) ?? 'Needs research') : describe(OBJECTS[id]);
    }
    if (toolBtns.spine) { const locked = !!r && !r.canBuildStructure('spine'); toolBtns.spine.dataset.locked = String(locked); if (locked) toolBtns.spine.title = r.lockedReason?.('structure', 'spine') ?? 'Needs research'; }
    if (r && OBJECTS[tool] && !r.canBuild(tool)) tool = 'dig';
  }

  // ---------- drawing ----------
  const PX = (x) => x * T;
  const PY = (y) => (y + S) * T;
  function draw() {
    const frame = getFrame();
    const sim = site.simulate();
    ctx.imageSmoothingEnabled = false;
    // sky
    for (let y = -S; y < 0; y++) { ctx.fillStyle = ['#1a1430', '#241a40', '#30204c', '#3c2a58', '#4c3866'][y + S] ?? '#4c3866'; ctx.fillRect(0, PY(y), W * T, T); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = site.idx(x, y);
      if (!site.dug[i]) {
        const s = site.stratum(y);
        ctx.fillStyle = s.color; ctx.fillRect(PX(x), PY(y), T, T);
        ctx.fillStyle = 'rgba(0,0,0,.18)';
        const h = (x * 73 + y * 151) % 17;
        ctx.fillRect(PX(x) + (h % 11), PY(y) + ((h * 3) % 12), 3, 2);
        if (y === 0) { ctx.fillStyle = '#4a7a2a'; ctx.fillRect(PX(x), PY(y), T, 3); }
      } else {
        ctx.fillStyle = '#16120f'; ctx.fillRect(PX(x), PY(y), T, T);
        ctx.fillStyle = '#1e1914'; if ((x + y) % 2 === 0) ctx.fillRect(PX(x), PY(y), T, T);
      }
      const st = site.structure[i];
      if (st === 'wall') {
        ctx.fillStyle = '#8a8680'; ctx.fillRect(PX(x), PY(y), T, T);
        ctx.fillStyle = '#a8a49c'; ctx.fillRect(PX(x), PY(y), T, 2);
        ctx.fillStyle = '#6a6660'; ctx.fillRect(PX(x), PY(y) + T - 2, T, 2);
      } else if (st === 'spine') {
        ctx.fillStyle = '#2a2420'; ctx.fillRect(PX(x), PY(y), T, T);
        ctx.fillStyle = '#f5c542'; ctx.fillRect(PX(x) + 2, PY(y), 2, T); ctx.fillRect(PX(x) + T - 4, PY(y), 2, T);
        if (y % 4 === 3) { ctx.fillStyle = '#5a5048'; ctx.fillRect(PX(x), PY(y) + T - 3, T, 3); }
      }
    }
    // water table
    ctx.fillStyle = 'rgba(90,170,255,.45)';
    for (let x = 0; x < W; x += 2) ctx.fillRect(PX(x), PY(WATER_TABLE_M), T, 1);
    // room overlay
    if (overlay === 'rooms') {
      for (const r of sim.rooms) {
        if (r.touchesSky) continue;
        const col = TIER_COLORS[r.type.tier] ?? '#888';
        ctx.fillStyle = col + (r.id === selectedRoom ? '40' : '1c');
        for (const [x, y] of r.tiles) ctx.fillRect(PX(x), PY(y), T, T);
        drawText(ctx, r.type.name.toUpperCase(), PX(r.minX) + 2, PY(r.minY) + 2, col);
      }
    }
    // conduits
    const netShow = { air: overlay === 'air' || overlay === 'rooms' || overlay === 'none', water: overlay === 'water' || overlay === 'rooms' || overlay === 'none', power: overlay === 'power' || overlay === 'rooms' || overlay === 'none' };
    const off = { air: 4, water: 8, power: 12 };
    for (const net of ['air', 'water', 'power']) {
      if (!netShow[net]) continue;
      const bit = { air: 1, water: 2, power: 4 }[net];
      ctx.fillStyle = CONDUITS[net].color;
      for (let y = -S; y < H; y++) for (let x = 0; x < W; x++) {
        const i = site.idx(x, y);
        if (!(site.conduits[i] & bit)) continue;
        const o = off[net];
        ctx.fillRect(PX(x) + o - 1, PY(y) + o - 1, 3, 3);
        if (x + 1 < W && (site.conduits[site.idx(x + 1, y)] & bit || site.structure[site.idx(x + 1, y)] === 'spine')) ctx.fillRect(PX(x) + o, PY(y) + o - 1, T, 2);
        if (y + 1 < H && (site.conduits[site.idx(x, y + 1)] & bit || site.structure[site.idx(x, y + 1)] === 'spine')) ctx.fillRect(PX(x) + o - 1, PY(y) + o, 2, T);
      }
    }
    // network overlay: highlight the selected network's tiles and powered/unpowered machines
    if (['air', 'water', 'power'].includes(overlay)) {
      for (const comp of sim.nets[overlay]) {
        ctx.fillStyle = CONDUITS[overlay].color + '22';
        for (const t of comp.tiles) { const x = t % W, y = Math.floor(t / W) - S; ctx.fillRect(PX(x), PY(y), T, T); }
      }
    }
    // objects
    for (const obj of site.objects.values()) drawObject(obj, 1, sim.online.has(obj.id), frame);
    // noise overlay
    if (overlay === 'noise') {
      for (const obj of site.objects.values()) {
        const o = OBJECTS[obj.kind];
        if (!o.noise) continue;
        const cx = PX(obj.x) + (o.w * T) / 2, cy = PY(obj.y) - (o.h * T) / 2 + T;
        ctx.fillStyle = 'rgba(255,90,79,.12)';
        ctx.beginPath(); ctx.arc(cx, cy, 6 * T, 0, Math.PI * 2); ctx.fill();
        drawText(ctx, `NOISE ${o.noise}`, cx - 14, cy - 3, '#ff5a4f');
      }
    }
    // queued jobs
    for (const j of site.jobs) {
      if (j.type === 'object') { drawObject({ kind: j.kind, x: j.x, y: j.y }, 0.35, true, frame); continue; }
      const x = PX(j.x), y = PY(j.y);
      ctx.strokeStyle = j.type === 'dig' ? 'rgba(245,197,66,.9)' : j.type === 'build' ? 'rgba(220,220,220,.8)' : CONDUITS[j.net].color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3);
      if (j.type === 'dig') { ctx.fillStyle = 'rgba(245,197,66,.25)'; for (let d = 0; d < T; d += 4) ctx.fillRect(x + d, y + (T - 1 - d), 2, 2); }
      if (j.progress > 0) { ctx.fillStyle = '#7ed957'; ctx.fillRect(x + 1, y + T - 3, Math.round((T - 2) * (j.progress / j.days)), 2); }
    }
    // crews
    for (const c of site.crewAt ?? []) {
      if (!c) continue;
      const bob = Math.floor(frame / 8) % 2;
      const x = PX(c.x) + 4, y = PY(c.y) + 3 - bob;
      ctx.fillStyle = '#f5c542'; ctx.fillRect(x + 1, y, 6, 3); // hard hat
      ctx.fillStyle = '#e0b090'; ctx.fillRect(x + 2, y + 3, 4, 3);
      ctx.fillStyle = '#ff9f1c'; ctx.fillRect(x + 1, y + 6, 6, 4);
      ctx.fillStyle = '#3a3a5a'; ctx.fillRect(x + 1, y + 10, 2, 3); ctx.fillRect(x + 5, y + 10, 2, 3);
    }
    // hover ghost
    if (hover && site.inside(hover.x, hover.y)) {
      if (OBJECTS[tool]) {
        const ok = site.canPlace(tool, hover.x, hover.y).ok;
        drawObject({ kind: tool, x: hover.x, y: hover.y }, 0.55, true, frame);
        const o = OBJECTS[tool];
        ctx.strokeStyle = ok ? '#7ed957' : '#ff5a4f'; ctx.lineWidth = 2;
        ctx.strokeRect(PX(hover.x) + 1, PY(hover.y - o.h + 1) + 1, o.w * T - 2, o.h * T - 2);
      } else {
        const a = drag ? drag.from : hover, b = drag ? drag.to : hover;
        ctx.strokeStyle = tool === 'remove' ? '#ff5a4f' : '#f2e6c9'; ctx.lineWidth = 1;
        if (CONDUITS[tool] && drag) {
          ctx.strokeRect(PX(Math.min(a.x, b.x)) + 0.5, PY(a.y) + 0.5, (Math.abs(b.x - a.x) + 1) * T - 1, T - 1);
          ctx.strokeRect(PX(b.x) + 0.5, PY(Math.min(a.y, b.y)) + 0.5, T - 1, (Math.abs(b.y - a.y) + 1) * T - 1);
        } else ctx.strokeRect(PX(Math.min(a.x, b.x)) + 0.5, PY(Math.min(a.y, b.y)) + 0.5, (Math.abs(b.x - a.x) + 1) * T - 1, (Math.abs(b.y - a.y) + 1) * T - 1);
      }
    }
  }

  function drawObject(obj, alpha, on, frame) {
    const o = OBJECTS[obj.kind];
    const x = PX(obj.x), y = PY(obj.y - o.h + 1), w = o.w * T, h = o.h * T;
    ctx.globalAlpha = alpha;
    const c = CAT_COLORS[o.cat];
    if (o.door) {
      ctx.fillStyle = o.blast ? '#5a5a66' : o.seal ? '#7a8a9a' : '#6a5038';
      ctx.fillRect(x + 3, y, w - 6, h);
      ctx.fillStyle = o.blast ? '#f5c542' : '#c8b890';
      for (let i = 0; i < (o.blast ?? 1); i++) ctx.fillRect(x + 4, y + 6 + i * 8, w - 8, 2);
    } else if (o.cat === 'sleep') {
      for (let row = 0; row < o.h; row++) {
        const by = y + row * T;
        ctx.fillStyle = '#5a4030'; ctx.fillRect(x + 1, by + 9, w - 2, 5);
        ctx.fillStyle = o.luxury ? '#b0306a' : '#5a7ab0'; ctx.fillRect(x + 2, by + 6, w - 4, 4);
        ctx.fillStyle = '#f2e6c9'; ctx.fillRect(x + 2, by + 4, 5, 3);
      }
      if (obj.kind === 'cryo_pod') { ctx.fillStyle = '#8fd3ff'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4); }
    } else {
      ctx.fillStyle = '#0a0807'; ctx.fillRect(x + 1, y + 1, w - 2, h - 1);
      ctx.fillStyle = c; ctx.fillRect(x + 2, y + 2, w - 4, h - 3);
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x + 2, y + 2, w - 4, 2);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      if (o.cat === 'water' || o.waterStock) for (let i = 1; i < o.h; i++) ctx.fillRect(x + 2, y + i * T, w - 4, 2);
      if (o.cat === 'food' && o.foodStock) for (let i = 0; i < o.h * 2; i++) ctx.fillRect(x + 2, y + 4 + i * 8, w - 4, 1);
      if ((o.air || o.power > 0) && on) { const blink = Math.floor(frame / 10) % 2; ctx.fillStyle = blink ? '#7ed957' : '#2a5a2a'; ctx.fillRect(x + w - 6, y + 4, 3, 3); }
      if (o.power < 0 && !on) { ctx.fillStyle = '#ff5a4f'; ctx.fillRect(x + w - 6, y + 4, 3, 3); }
      if (o.h * T >= 16) drawText(ctx, o.name.split(' ')[0].slice(0, 5).toUpperCase(), x + 3, y + h - 8, '#0a0807', null);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- side panel ----------
  function renderSide() {
    const s = site.simulate();
    const ph = site.phase();
    const r = s.rooms.find((x) => x.id === selectedRoom);
    const sys = (label, days, line) => `<div class="bk-sys" data-limit="${days !== Infinity && days === s.daysSealed}"><b>${label}</b><span>${fmtDays(days)}d</span><small>${line}</small></div>`;
    const f = s.flows;
    side.innerHTML = `
      <div class="bk-days"><span>${fmtDays(s.daysSealed)}</span><small>DAYS SEALED · ${s.occupants} occupant${s.occupants === 1 ? '' : 's'} · ${s.limiting.toUpperCase()} first</small></div>
      ${sys('AIR', s.days.air, `${f.air.supply} of ${f.air.need} m³/h · ${f.air.buffer} m³ buffer`)}
      ${sys('WATER', s.days.water, `${f.water.stock.toLocaleString()} L · uses ${f.water.net} L/day${f.water.recycle ? ` (${f.water.recycle * 100}% recycled)` : ''}`)}
      ${sys('FOOD', s.days.food, `${f.food.stock.toLocaleString()} meals · grows ${f.food.production} of ${f.food.need}/day`)}
      ${sys('POWER', s.days.power, `${f.power.supply ?? 0} kW for ${f.power.demand} kW · ${f.power.fuel ?? 0} L fuel · ${f.power.battery ?? 0} kWh`)}
      <div class="bk-rat">${['seal', 'blast', 'security'].map((key) => `<span>${key.toUpperCase()} <b>${s.ratings[key]}</b>/5</span>`).join('')}<span>MORALE <b>${s.ratings.morale}</b></span><span>PRESTIGE <b>${s.prestige}</b></span></div>
      ${r ? `<div class="bk-room"><b style="color:${TIER_COLORS[r.type.tier]}">${r.type.name.toUpperCase()}</b> ${r.width}x${r.height} m · ${r.size} tiles<br>
        Impressiveness <b>${r.impressiveness}</b> · beauty ${r.beauty} · prestige ${Math.round(r.prestige)}${r.beds ? ` · beds ${r.beds}` : ''}<br>
        ${[r.noise ? `noise -${r.noise}` : '', r.rough ? 'raw rock walls -3' : '', r.cramped ? `cramped (needs ${r.type.minW} wide)` : '', r.seeps ? 'SEEPING' : ''].filter(Boolean).join(' · ') || 'No complaints.'}<br>
        <small>${Object.entries(r.counts).map(([kk, n]) => `${n}x ${OBJECTS[kk].name}`).join(', ') || 'Empty'}</small></div>` : '<div class="bk-room"><small>Click inside a room to inspect it.</small></div>'}
      <div class="bk-phase"><b>${ph.name.toUpperCase()}</b> · ${ph.detail}<br><small>${site.crews()} crew${site.crews() === 1 ? '' : 's'} · ${site.jobs.length} job${site.jobs.length === 1 ? '' : 's'} queued${site.jobs.some((j) => !site._workable(j, site.reachable())) ? ' · some unreachable: dig a way in' : ''}</small>
        <div class="bk-actions"><button class="bk-test" ${ph.id === 'ready' || ph.id === 'walkthrough' ? '' : 'disabled'}>30-DAY PRESSURE TEST</button>${onHandOver ? `<button class="bk-hand" ${site.jobs.length || !site.objects.size ? 'disabled' : ''}>HAND OVER</button>` : ''}</div></div>
      <div class="bk-notes">${s.notes.slice(0, 6).map((n) => `<div>${n}</div>`).join('')}</div>`;
    side.querySelector('.bk-test').onclick = () => { const res = site.startPressureTest(); toast(res.ok ? 'Pressure test running: 30 days sealed.' : res.reason); render(); };
    const hb = side.querySelector('.bk-hand');
    if (hb) hb.onclick = () => { const res = site.handOver(`Shelter #${site.handedOver + 1}`); if (res.ok) { onHandOver?.(res.shelter); toast('Handed over. A fresh plot is being surveyed.'); } else toast(res.reason); render(); };
  }

  let dirty = true;
  const offChange = site.onChange(() => { dirty = true; });
  function render() {
    draw();
    if (dirty) { renderSide(); dirty = false; }
  }
  function fit(maxW, maxH) {
    const scale = Math.max(1, Math.floor(maxW / canvas.width));
    canvas.style.width = `${canvas.width * scale}px`;
    canvas.style.height = `${canvas.height * scale}px`;
    scroller.style.maxHeight = `${Math.max(240, maxH)}px`;
    return scale;
  }
  sync();
  render();
  return {
    el: wrap,
    canvas,
    render,
    fit,
    select: (id) => { tool = id; sync(); },
    chromeHeight: () => toolbar.offsetHeight + info.offsetHeight + 24,
    refresh() { dirty = true; syncLocks(); render(); },
    destroy() { offChange(); removeEventListener('keydown', onKey); removeEventListener('mouseup', onUp); wrap.remove(); },
  };
}
