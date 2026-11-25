// Bunker editor: the tile-level shelter canvas. Same surface as the old grid UI, so the campaign can
// swap it in: createBunkerUI({ mount, grid: BunkerSite, getFrame, onToast, onHandOver })
//   -> { el, canvas, render, refresh, fit(maxW, maxH), chromeHeight(), destroy }
//
// Tools: DIG (drag a box), WALL (drag; hold Shift for an outline), SPINE, conduits AIR / WATER / POWER
// (drag a line), any object from the palette (click; ghost shows where and why not), REMOVE (right-click
// anywhere also removes). Overlays: rooms, air, water, power, noise.

import { OBJECTS, STRUCTURES, CONDUITS, STRATA, TIER_COLORS, WATER_TABLE_M, FINISHES, variantsFor, layerOf, STYLE_KITS } from './bunker-catalog.js';
import { drawWallPiece, drawFloorPiece } from '../art/finish-art.js';
import { drawText } from '../art/font.js';
import { drawRoomTile, ROOM_TILE_IDS, DESIGN_STYLES } from '../art/hd/room-tiles.js'; // the room card shows the room in its style (#120)
import { drawStratumTile, drawDigStage, drawShellStage, drawFitoutStage } from '../art/bunker-tiles.js';
import { drawObjectSprite, drawResident, drawThought, hasSprite } from './bunker-sprites.js';
import { daysSealedCanvas } from '../art/hd/shelter-life64.js';
import { NEED_IDS } from './bunker-catalog.js';
import { drawGaze, drawPhoto, gazeLevel, PHOTO_ASSETS, PHOTO_CARD_WINDOW } from '../art/hd/gaze-photo.js'; // #121

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
  ['LIVING ROOM', ['sofa', 'armchair', 'coffee_table', 'tv', 'fireplace', 'piano', 'bookshelf', 'aquarium', 'lamp', 'plant', 'plant_tall', 'statue']],
  ['DINING + BAR', ['dining_table', 'dining_chair', 'espresso', 'bar_counter', 'wine_rack', 'chef_range']],
  ['BEDROOM + BATH', ['king_bed', 'wardrobe', 'nightstand', 'desk', 'bathtub', 'sink', 'vanity', 'gold_taps', 'cryo_pod']],
  ['PLAY', ['pool_table', 'arcade', 'gym_rig', 'cinema_seats', 'cinema_screen', 'med_bed']],
  ['RUGS', ['rug', 'rug_persian']],
  ['ON THE WALL', ['painting', 'mirror', 'faux_window', 'led_sky', 'sconce', 'wall_shelf', 'neon_sign', 'trophy']],
  ['CEILING', ['chandelier', 'pendant']],
];
const TOOLS = [['look', 'INSPECT', 'Q'], ['dig', 'DIG', 'D'], ['wall', 'WALL', 'W'], ['spine', 'SPINE', 'S'], ['air', 'AIR DUCT', '1'], ['water', 'WATER PIPE', '2'], ['power', 'POWER CABLE', '3'], ['style', 'STYLE', 'Y'], ['paint', 'PAINT', 'P'], ['recolor', 'RECOLOUR', 'C'], ['flip', 'FLIP', 'F'], ['remove', 'REMOVE', 'X']];
const OVERLAYS = [['rooms', 'ROOMS'], ['decor', 'INTERIOR'], ['air', 'AIR'], ['water', 'WATER'], ['power', 'POWER'], ['noise', 'NOISE'], ['gaze', 'CLIENT GAZE'], ['none', 'PLAIN']];
const DECOR_TOOLS = new Set(['style', 'paint', 'recolor', 'flip', 'look']);
const NEED_NAMES = { energy: 'ENERGY', hunger: 'HUNGER', bladder: 'BLADDER', hygiene: 'HYGIENE', fun: 'FUN', social: 'SOCIAL' };
const needColor = (v) => (v < 25 ? '#ff5a4f' : v < 50 ? '#ff9f1c' : '#7ed957');

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
  const photoBtn = el('button', 'bk-tool bk-photo-btn', 'PHOTO');
  photoBtn.title = 'Photo mode: hide the interface and frame the cutaway [O]. ENTER takes the shot, ESC leaves.';
  photoBtn.onclick = () => enterPhoto();
  toolbar.append(overlaySel, photoBtn);
  // swatches: colour of the piece being placed, or the finish being painted
  const swatches = el('div', 'bk-sw');
  const chosenVariant = {};
  let flipNext = false;
  let paintKind = 'wall';
  const paintFinish = { wall: 'marble', floor: 'oak', light: 'warm' };
  let styleKit = 'gilded';
  const chip = (a, b) => `<i style="background:linear-gradient(135deg, ${a} 60%, ${b ?? a} 60%)"></i>`;
  function renderSwatches() {
    swatches.innerHTML = '';
    const btn = (html, on, title, fn) => { const b = el('button'); b.innerHTML = html; b.title = title; b.classList.toggle('on', on); b.onclick = fn; swatches.append(b); };
    if (OBJECTS[tool]) {
      swatches.append(el('span', 'lbl', 'COLOUR'));
      const list = variantsFor(tool);
      const cur = chosenVariant[tool] ?? list[0].id;
      for (const v of list) btn(`${chip(v.a, v.b)}${v.name}${v.beauty ? ' +' + v.beauty : ''}`, v.id === cur, v.beauty ? `${v.name}: +${v.beauty} beauty` : v.name, () => { chosenVariant[tool] = v.id; renderSwatches(); draw(); });
      btn(flipNext ? 'MIRRORED' : 'MIRROR', flipNext, 'Face the other way [F]', () => { flipNext = !flipNext; renderSwatches(); draw(); });
    } else if (tool === 'paint') {
      for (const [kk, label] of [['wall', 'WALLS'], ['floor', 'FLOORS'], ['light', 'LIGHTING']]) btn(label, kk === paintKind, `Paint ${label.toLowerCase()}`, () => { paintKind = kk; renderSwatches(); });
      swatches.append(el('span', 'lbl', '·'));
      for (const [id, f] of Object.entries(FINISHES[paintKind])) {
        const sw = f.tint !== undefined ? chip(f.tint ? f.tint.replace(/,[.\d]+\)$/, ',1)') : '#8a8680') : chip(f.a, f.b);
        btn(`${sw}${f.name}${f.cost ? ` ${k(f.cost)}/m²` : ''}`, id === paintFinish[paintKind], `${f.name}: beauty ${f.beauty}, ${k(f.cost)} per m². Click a room to finish all of it; Shift-click for one tile.`, () => { paintFinish[paintKind] = id; renderSwatches(); });
      }
    } else if (tool === 'style') {
      for (const [id, kitDef] of Object.entries(STYLE_KITS)) {
        const w = FINISHES.wall[kitDef.wall];
        btn(`${chip(w.a, w.b)}${kitDef.name.toUpperCase()}`, id === styleKit, `${kitDef.name}: ${kitDef.blurb}. Walls: ${w.name}; floor: ${FINISHES.floor[kitDef.floor].name}; light: ${FINISHES.light[kitDef.light].name}; furniture recoloured to match.`, () => { styleKit = id; renderSwatches(); });
      }
      swatches.append(el('span', 'lbl', 'CLICK A ROOM TO DRESS IT: WALLS, FLOOR, LIGHT AND FURNITURE COLOURS. CHANGE ANY PIECE AFTER WITH PAINT OR RECOLOUR.'));
    } else if (tool === 'recolor') swatches.append(el('span', 'lbl', 'CLICK ANY PIECE TO CYCLE ITS COLOUR (FREE)'));
    else if (tool === 'flip') swatches.append(el('span', 'lbl', 'CLICK ANY PIECE TO TURN IT AROUND'));
    else if (tool === 'look') swatches.append(el('span', 'lbl', 'CLICK A RESIDENT TO SEE WHAT THEY NEED, OR A ROOM TO INSPECT IT'));
  }

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
  centre.append(toolbar, swatches, scroller, info);

  // ---------- side panel ----------
  const side = el('div', 'bk-side');
  wrap.append(pal, centre, side);
  mount.append(wrap);
  const ctx = canvas.getContext('2d');

  // ---------- input ----------
  let hover = null;
  let drag = null;
  let selectedRoom = null;
  let selectedResident = null;
  const people = () => site.people?.residents ?? [];
  const residentAt = (e) => {
    const r = canvas.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    const fy = ((e.clientY - r.top) / r.height) * (H + S) - S;
    return people().find((p) => Math.abs(p.x + 0.5 - fx) < 0.6 && fy > p.y - 0.4 && fy < p.y + 1);
  };
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
    if (tool === 'look') { const p = residentAt(e); if (p) { selectedResident = p.id; dirty = true; render(); return; } }
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
      const r = site.place(which, b.x, b.y, { variant: chosenVariant[which], flip: flipNext });
      toast(r.ok ? `${OBJECTS[which].name} ordered. A crew will fit it once the space is dug.` : `Can't place: ${r.reason}.`);
    } else if (which === 'paint') {
      const f = FINISHES[paintKind][paintFinish[paintKind]];
      const r = site.paint(paintKind, paintFinish[paintKind], b.x, b.y, { single: outline });
      toast(!r.ok ? `${r.reason}.` : r.tiles ? `${f.name}: ${r.tiles} m² for ${k(f.cost * r.tiles)}.` : `Already ${f.name.toLowerCase()}.`);
    } else if (which === 'style') {
      const r = site.applyStyle(styleKit, b.x, b.y);
      toast(!r.ok ? `${r.reason}.` : `${STYLE_KITS[styleKit].name} room: walls, floor and light${r.cost ? ` for ${k(r.cost)}` : ''}${r.recoloured ? `, ${r.recoloured} piece${r.recoloured > 1 ? 's' : ''} recoloured` : ''}.`);
    } else if (which === 'recolor' || which === 'flip') {
      const obj = pieceAt(b.x, b.y);
      if (!obj) toast('Nothing there to change.');
      else if (which === 'flip') { site.flip(obj); toast(`${OBJECTS[obj.kind].name} turned around.`); }
      else { const v = site.recolor(obj); toast(`${OBJECTS[obj.kind].name}: ${variantsFor(obj.kind).find((x) => x.id === v).name}.`); }
    } else if (which === 'look') {
      selectedResident = null;
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
  /** The topmost piece (installed or ordered) under a tile. */
  function pieceAt(x, y) {
    const j = [...site.jobs].reverse().find((q) => q.type === 'object' && x >= q.x && x < q.x + OBJECTS[q.kind].w && y <= q.y && y > q.y - OBJECTS[q.kind].h);
    return j ?? site.objectsAt(x, y)[0] ?? null;
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
    for (const o of site.objectsAt(x, y)) parts.push(OBJECTS[o.kind].name + (OBJECTS[o.kind].net ? (site.simulate().online.has(o.id) ? ' (on)' : ' (OFF: check its conduits/power)') : ''));
    const fin = ['wall', 'floor', 'light'].map((kk) => site.finish?.[kk]?.[site.idx(x, y)] && FINISHES[kk][site.finish[kk][site.idx(x, y)]].name).filter(Boolean);
    if (fin.length) parts.push(fin.join(', '));
    if (OBJECTS[tool]) { const c = site.canPlace(tool, x, y); parts.push(c.ok ? `place ${OBJECTS[tool].name} here: ${k(OBJECTS[tool].cost)}` : c.reason); }
    info.textContent = parts.join(' · ');
  }

  const onKey = (e) => {
    if (mount.hidden || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)) return;
    if (photo) { if (e.key === 'Escape' || e.key.toLowerCase() === 'o') leavePhoto(); else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); snap(); } return; }
    if (e.key.toLowerCase() === 'o') { enterPhoto(); return; }
    if (e.key.toLowerCase() === 'f' && OBJECTS[tool]) { flipNext = !flipNext; renderSwatches(); draw(); return; }
    const t = TOOLS.find(([, , key]) => key.toLowerCase() === e.key.toLowerCase());
    if (t) { tool = t[0]; sync(); }
    if (e.key === 'Escape') { tool = 'dig'; sync(); }
  };
  addEventListener('keydown', onKey);

  function sync() {
    for (const [id, b] of Object.entries(toolBtns)) b.classList.toggle('on', id === tool);
    for (const [id, b] of Object.entries(palBtns)) b.classList.toggle('on', id === tool);
    syncLocks();
    if ((DECOR_TOOLS.has(tool) && tool !== 'look') && overlay === 'rooms') { overlay = 'decor'; overlaySel.value = 'decor'; }
    renderSwatches();
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
        drawStratumTile(ctx, site.stratum(y).id, PX(x), PY(y), x, y); // R32 strata tiles
        if (y === 0) { ctx.fillStyle = '#4a7a2a'; ctx.fillRect(PX(x), PY(y), T, 3); }
      } else if (site.finish?.wall[i]) wallFinish(x, y, FINISHES.wall[site.finish.wall[i]]);
      else {
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
    // floor finishes: laid on the slab under each finished tile
    if (site.finish) for (let y = 0; y < H - 1; y++) for (let x = 0; x < W; x++) {
      const f = site.finish.floor[site.idx(x, y)];
      if (!f || site.passable(x, y + 1)) continue;
      const d = FINISHES.floor[f];
      if (drawFloorPiece(ctx, f, PX(x), PY(y + 1), x, T, 4)) continue;
      ctx.fillStyle = d.a; ctx.fillRect(PX(x), PY(y + 1), T, 4);
      ctx.fillStyle = d.b;
      if (f === 'checker') { ctx.fillRect(PX(x) + (x % 2 ? 0 : 8), PY(y + 1), 8, 4); }
      else if (f === 'oak') { ctx.fillRect(PX(x) + ((x * 5) % 12), PY(y + 1), 1, 4); ctx.fillRect(PX(x), PY(y + 1) + 3, T, 1); }
      else if (f === 'terrazzo') { for (let q = 0; q < 4; q++) ctx.fillRect(PX(x) + ((x * 7 + q * 5) % 15), PY(y + 1) + (q % 3), 1, 1); }
      else ctx.fillRect(PX(x), PY(y + 1) + 3, T, 1);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(PX(x), PY(y + 1), T, 1);
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
        for (const [x, y] of r.tiles) if (!site.finish?.wall[site.idx(x, y)] || r.id === selectedRoom) ctx.fillRect(PX(x), PY(y), T, T);
        drawText(ctx, r.type.name.toUpperCase(), PX(r.minX) + 2, PY(r.minY) + 2, col);
      }
    }
    // conduits
    const netShow = { air: overlay === 'air' || overlay === 'rooms', water: overlay === 'water' || overlay === 'rooms', power: overlay === 'power' || overlay === 'rooms' };
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
    // objects, back to front: wall hangings, rugs, furniture, ceiling fittings
    const byLayer = { wall: [], rug: [], floor: [], ceiling: [] };
    for (const obj of site.objects.values()) byLayer[layerOf(OBJECTS[obj.kind])].push(obj);
    // door states (#122): sealed while the pressure test runs; open while someone stands in the doorway
    doorSealed = !!(site.pressureTest && site.pressureTest.daysLeft > 0);
    doorBusy = new Set(people().map((p) => `${Math.round(p.x)},${Math.round(p.y)}`));
    for (const l of ['wall', 'rug', 'floor', 'ceiling']) for (const obj of byLayer[l]) drawObject(obj, 1, sim.online.has(obj.id), frame);
    // lighting
    if (site.finish) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const f = site.finish.light[site.idx(x, y)];
      if (f) { ctx.fillStyle = FINISHES.light[f].tint; ctx.fillRect(PX(x), PY(y), T, T); }
    }
    // residents
    const clock = site.people?.clock ?? 0;
    // Client Gaze (#121): what a client looks at on a walkthrough. Status and Delusion always (gold brackets and a
    // wide eye), Comfort half the time (dashed amber, a heavy-lidded eye), Survive never (dimmed, eye shut).
    if (overlay === 'gaze') {
      const f = Math.floor(frame / 30) % 2;
      for (const r of sim.rooms) {
        if (r.touchesSky) continue;
        const lvl = gazeLevel(r.type.tier);
        if (lvl === 'skip') { for (const [x, y] of r.tiles) drawGaze(ctx, 'veil', PX(x), PY(y), { tile: T }); }
        else {
          const br = lvl === 'look' ? 'bracket' : 'bracket_maybe';
          const x0 = PX(r.minX), y0 = PY(r.minY), x1 = PX(r.maxX + 1) - T, y1 = PY(r.maxY + 1) - T;
          drawGaze(ctx, br, x0, y0, { tile: T, frame: f }); drawGaze(ctx, br, x1, y0, { tile: T, frame: f, flipX: true });
          drawGaze(ctx, br, x0, y1, { tile: T, frame: f, flipY: true }); drawGaze(ctx, br, x1, y1, { tile: T, frame: f, flipX: true, flipY: true });
        }
        drawGaze(ctx, lvl, PX(r.minX) + 2, PY(r.minY) + 2, { tile: T, frame: f });
      }
    }
    for (const p of people()) {
      drawResident(ctx, p, PX(p.x) + T / 2, PY(p.y) + T, frame, { selected: p.id === selectedResident });
      if (p.thought && p.thought.until > clock && !(p.action?.admire && p.action.started)) drawThought(ctx, PX(p.x) + 9, PY(p.y) - 9, p.thought.good);
    }
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
      const t = j.days ? Math.min(1, j.progress / j.days) : 0;
      if (j.type === 'object') {
        const o = OBJECTS[j.kind];
        drawObject(j, 0.4 + 0.5 * t, true, frame);
        drawFitoutStage(ctx, PX(j.x), PY(j.y - o.h + 1), o.w * T, o.h * T, t, frame); // R32 fit-out stage
        if (t > 0) { ctx.fillStyle = '#7ed957'; ctx.fillRect(PX(j.x) + 1, PY(j.y) + T - 3, Math.round((o.w * T - 2) * t), 2); }
        continue;
      }
      const x = PX(j.x), y = PY(j.y);
      if (j.type === 'dig') { drawDigStage(ctx, x, y, t, site.stratum(j.y).id, j.x, j.y); if (t > 0) { ctx.fillStyle = '#7ed957'; ctx.fillRect(x + 1, y + T - 3, Math.round((T - 2) * t), 2); } continue; }
      if (j.type === 'build') { drawShellStage(ctx, x, y, t, j.kind ?? j.structure); if (t > 0) { ctx.fillStyle = '#7ed957'; ctx.fillRect(x + 1, y + T - 3, Math.round((T - 2) * t), 2); } continue; }
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
        drawObject({ kind: tool, x: hover.x, y: hover.y, variant: chosenVariant[tool], flip: flipNext }, 0.6, true, frame);
        const o = OBJECTS[tool];
        ctx.strokeStyle = ok ? '#7ed957' : '#ff5a4f'; ctx.lineWidth = 2;
        ctx.strokeRect(PX(hover.x) + 1, PY(hover.y - o.h + 1) + 1, o.w * T - 2, o.h * T - 2);
      } else if (tool === 'recolor' || tool === 'flip') {
        const obj = pieceAt(hover.x, hover.y);
        if (obj) { const o = OBJECTS[obj.kind]; ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 1; ctx.strokeRect(PX(obj.x) + 0.5, PY(obj.y - o.h + 1) + 0.5, o.w * T - 1, o.h * T - 1); }
      } else if (tool === 'paint' || tool === 'style') {
        const sim2 = site.simulate();
        const rid = hover.y >= 0 ? sim2.roomOf[site.idx(hover.x, hover.y)] : -1;
        const tiles = drag?.shift || !(rid >= 0) ? [[hover.x, hover.y]] : sim2.rooms[rid].tiles;
        ctx.fillStyle = 'rgba(245,197,66,.16)';
        for (const [x, y] of tiles) ctx.fillRect(PX(x), PY(y), T, T);
      } else if (tool !== 'look') {
        const a = drag ? drag.from : hover, b = drag ? drag.to : hover;
        ctx.strokeStyle = tool === 'remove' ? '#ff5a4f' : '#f2e6c9'; ctx.lineWidth = 1;
        if (CONDUITS[tool] && drag) {
          ctx.strokeRect(PX(Math.min(a.x, b.x)) + 0.5, PY(a.y) + 0.5, (Math.abs(b.x - a.x) + 1) * T - 1, T - 1);
          ctx.strokeRect(PX(b.x) + 0.5, PY(Math.min(a.y, b.y)) + 0.5, T - 1, (Math.abs(b.y - a.y) + 1) * T - 1);
        } else ctx.strokeRect(PX(Math.min(a.x, b.x)) + 0.5, PY(Math.min(a.y, b.y)) + 0.5, (Math.abs(b.x - a.x) + 1) * T - 1, (Math.abs(b.y - a.y) + 1) * T - 1);
      }
    }
  }

  let doorSealed = false;
  let doorBusy = new Set();
  function doorState(obj, o) {
    if (!o.door) return 'closed';
    if (doorSealed) return 'sealed';
    for (let dy = 0; dy < o.h; dy++) if (doorBusy.has(`${obj.x},${obj.y - dy}`)) return 'open';
    return 'closed';
  }
  function drawObject(obj, alpha, on, frame) {
    const o = OBJECTS[obj.kind];
    const x = PX(obj.x), y = PY(obj.y - o.h + 1), w = o.w * T, h = o.h * T;
    ctx.globalAlpha = alpha;
    if (hasSprite(obj.kind)) {
      const list = variantsFor(obj.kind);
      const v = list.find((q) => q.id === obj.variant) ?? list[0];
      drawObjectSprite(ctx, obj.kind, x, y, v, { on, frame, flip: obj.flip, state: doorState(obj, o) });
      ctx.globalAlpha = 1;
      return;
    }
    // machines: a labelled block in their system colour
    const c = CAT_COLORS[o.cat];
    ctx.fillStyle = '#0a0807'; ctx.fillRect(x + 1, y + 1, w - 2, h - 1);
    ctx.fillStyle = c; ctx.fillRect(x + 2, y + 2, w - 4, h - 3);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x + 2, y + 2, w - 4, 2);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    if (o.cat === 'water' || o.waterStock) for (let i = 1; i < o.h; i++) ctx.fillRect(x + 2, y + i * T, w - 4, 2);
    if (o.cat === 'food' && o.foodStock) for (let i = 0; i < o.h * 2; i++) ctx.fillRect(x + 2, y + 4 + i * 8, w - 4, 1);
    if ((o.air || o.power > 0) && on) { const blink = Math.floor(frame / 10) % 2; ctx.fillStyle = blink ? '#7ed957' : '#2a5a2a'; ctx.fillRect(x + w - 6, y + 4, 3, 3); }
    if (o.power < 0 && !on) { ctx.fillStyle = '#ff5a4f'; ctx.fillRect(x + w - 6, y + 4, 3, 3); }
    if (o.h * T >= 16) drawText(ctx, o.name.split(' ')[0].slice(0, 5).toUpperCase(), x + 3, y + h - 8, '#0a0807', null);
    ctx.globalAlpha = 1;
  }

  function wallFinish(x, y, f) {
    const px = PX(x), py = PY(y);
    const id = Object.keys(FINISHES.wall).find((kk) => FINISHES.wall[kk] === f);
    if (drawWallPiece(ctx, id, px, py, x, y, T)) return;
    ctx.fillStyle = f.a; ctx.fillRect(px, py, T, T);
    ctx.fillStyle = f.b;
    switch (f.pattern) {
      case 'brick': for (let r = 0; r < 4; r++) { ctx.fillRect(px, py + r * 4 + 3, T, 1); ctx.fillRect(px + ((r + y) % 2 ? 4 : 12), py + r * 4, 1, 3); } break;
      case 'panel': ctx.fillRect(px, py, 1, T); ctx.fillRect(px + 8, py, 1, T); if (y % 4 === 3) ctx.fillRect(px, py + 10, T, 2); break;
      case 'grid': ctx.fillRect(px, py, T, 1); ctx.fillRect(px, py, 1, T); break;
      case 'vein': { const h = (x * 31 + y * 17) % 13; ctx.fillRect(px + h, py, 1, 5); ctx.fillRect(px + h + 1, py + 5, 1, 4); ctx.fillRect(px + h + 3, py + 9, 1, 6); break; }
      case 'damask': if ((x + y) % 2 === 0) { ctx.fillRect(px + 7, py + 4, 2, 8); ctx.fillRect(px + 5, py + 6, 6, 4); } else { ctx.fillRect(px + 1, py + 1, 2, 2); ctx.fillRect(px + 13, py + 13, 2, 2); } break;
      case 'stripe': ctx.fillRect(px + 2, py, 3, T); ctx.fillRect(px + 10, py, 3, T); break;
      default: break;
    }
  }

  // ---------- side panel ----------
  const resBox = el('div', 'bk-res');
  resBox.addEventListener('mousedown', (e) => {
    const row = e.target.closest('[data-res]');
    if (!row) return;
    selectedResident = selectedResident === row.dataset.res ? null : row.dataset.res;
    if (selectedResident) { tool = 'look'; sync(); }
    renderResidents();
  });
  function renderResidents() {
    const list = people();
    if (!list.length) { resBox.innerHTML = '<b>RESIDENTS</b><br><small>Nobody lives here yet. Every bed you fit brings in a billionaire (a king bed brings two).</small>'; return; }
    const sel = list.find((p) => p.id === selectedResident);
    const sim = site.people;
    if (sel) {
      resBox.innerHTML = `<b>${sel.name.toUpperCase()}</b> <small>${sel.cls} · ${sel.trait}</small><br>
        <small>MOOD</small> <b style="color:${needColor(sel.mood)}">${sel.mood}</b> · ${sim.doing(sel)}
        ${NEED_IDS.map((n) => `<div class="bk-need"><span>${NEED_NAMES[n]}</span><div><i style="width:${Math.round(sel.needs[n])}%;background:${needColor(sel.needs[n])}"></i></div></div>`).join('')}
        ${sel.thoughts.slice(0, 4).map((t) => `<div class="th ${t.good ? 'good' : 'bad'}">${t.text}</div>`).join('')}
        <div class="who" data-res="${sel.id}"><small>‹ ALL RESIDENTS</small></div>`;
      return;
    }
    resBox.innerHTML = `<b>RESIDENTS</b> · happiness <b style="color:${needColor(sim.averageMood)}">${sim.averageMood}</b>
      ${list.map((p) => `<div class="who" data-res="${p.id}"><span>${p.name}</span><b style="color:${needColor(p.mood)}">${p.mood}</b><small>${sim.doing(p)}</small></div>`).join('')}
      ${sim.complaints.slice(0, 3).map((c) => `<div class="th bad">${c}</div>`).join('')}`;
  }
  function renderSide() {
    const s = site.simulate();
    const ph = site.phase();
    const r = s.rooms.find((x) => x.id === selectedRoom);
    const sys = (label, days, line) => `<div class="bk-sys" data-limit="${days !== Infinity && days === s.daysSealed}"><b>${label}</b><span>${fmtDays(days)}d</span><small>${line}</small></div>`;
    const f = s.flows;
    side.innerHTML = `
      <div class="bk-days"><canvas class="bk-days-emblem" width="64" height="64" title="Days Sealed: the ring fills toward twice the 30-day pressure test"></canvas><span>${fmtDays(s.daysSealed)}</span><small>DAYS SEALED · ${s.occupants} occupant${s.occupants === 1 ? '' : 's'} · ${s.limiting.toUpperCase()} first</small></div>
      ${sys('AIR', s.days.air, `${f.air.supply} of ${f.air.need} m³/h · ${f.air.buffer} m³ buffer`)}
      ${sys('WATER', s.days.water, `${f.water.stock.toLocaleString()} L · uses ${f.water.net} L/day${f.water.recycle ? ` (${f.water.recycle * 100}% recycled)` : ''}`)}
      ${sys('FOOD', s.days.food, `${f.food.stock.toLocaleString()} meals · grows ${f.food.production} of ${f.food.need}/day`)}
      ${sys('POWER', s.days.power, `${f.power.supply ?? 0} kW for ${f.power.demand} kW · ${f.power.fuel ?? 0} L fuel · ${f.power.battery ?? 0} kWh`)}
      <div class="bk-rat">${['seal', 'blast', 'security'].map((key) => `<span>${key.toUpperCase()} <b>${s.ratings[key]}</b>/5</span>`).join('')}<span>MORALE <b>${s.ratings.morale}</b></span><span>PRESTIGE <b>${s.prestige}</b></span></div>
      ${r ? `<div class="bk-room"><div class="bk-room-tile"><canvas data-room="${r.type.id}" data-style="${r.style ?? ''}" title="${r.type.name}${r.style ? ` · ${STYLE_KITS[r.style].name}` : ''}"></canvas></div><b style="color:${TIER_COLORS[r.type.tier]}">${r.type.name.toUpperCase()}</b> ${r.width}x${r.height} m · ${r.size} tiles<br>
        Style <b>${r.style ? STYLE_KITS[r.style].name : 'none'}</b>${r.styleVotes ? ` <small>(${Object.entries(r.styleVotes).filter(([, v]) => v).map(([sid, v]) => `${STYLE_KITS[sid].name} ${v}`).join(' · ') || 'no style pieces'})</small>` : ''}<br>
        Impressiveness <b>${r.impressiveness}</b> · beauty ${r.beauty}${r.finishBeauty ? ` (finishes +${r.finishBeauty})` : ''} · prestige ${Math.round(r.prestige)}${r.beds ? ` · beds ${r.beds}` : ''}<br>
        ${[r.noise ? `noise -${r.noise}` : '', r.rough ? 'raw rock walls -3' : '', r.cramped ? `cramped (needs ${r.type.minW} wide)` : '', r.seeps ? 'SEEPING' : ''].filter(Boolean).join(' · ') || 'No complaints.'}<br>
        <small>${Object.entries(r.counts).map(([kk, n]) => `${n}x ${OBJECTS[kk].name}`).join(', ') || 'Empty'}</small>${r.hint ? `<br><small class="bk-hint">Add ${r.hint.missing.map((m) => m.orAny ? m.orAny.filter((o) => OBJECTS[o]).map((o) => OBJECTS[o].name).join(' or ') : `${m.count}x ${OBJECTS[m.object]?.name ?? m.object}`).join(' and ')} to make it ${/^[AEIOU]/.test(r.hint.name) ? 'an' : 'a'} ${r.hint.name}.</small>` : ''}</div>` : '<div class="bk-room"><small>Click inside a room to inspect it.</small></div>'}
      <div class="bk-phase"><b>${ph.name.toUpperCase()}</b> · ${ph.detail}<br><small>${site.crews()} crew${site.crews() === 1 ? '' : 's'} · ${site.jobs.length} job${site.jobs.length === 1 ? '' : 's'} queued${site.jobs.some((j) => !site._workable(j, site.reachable())) ? ' · some unreachable: dig a way in' : ''}</small>
        <div class="bk-actions"><button class="bk-test" ${ph.id === 'ready' || ph.id === 'walkthrough' ? '' : 'disabled'}>30-DAY PRESSURE TEST</button>${onHandOver ? `<button class="bk-hand" ${site.jobs.length || !site.objects.size ? 'disabled' : ''}>HAND OVER</button>` : ''}</div></div>
      <div class="bk-notes">${s.notes.slice(0, 6).map((n) => `<div>${n}</div>`).join('')}</div>`;
    const tileCv = side.querySelector('.bk-room-tile canvas'); // #117: the room's 64 px tile
    if (tileCv) { const id = tileCv.dataset.room; const design = DESIGN_STYLES.includes(tileCv.dataset.style) ? tileCv.dataset.style : null; if (ROOM_TILE_IDS.includes(id)) { const t = drawRoomTile(tileCv.getContext('2d'), id, 0, 0, { frame: Math.floor(getFrame() / 30), design }); if (tileCv.width !== t.width) { tileCv.width = t.width; tileCv.height = t.height; drawRoomTile(tileCv.getContext('2d'), id, 0, 0, { frame: Math.floor(getFrame() / 30), design }); } } else tileCv.parentElement.remove(); }
    side.querySelector('.bk-rat').after(resBox);
    renderResidents();
    // Days Sealed emblem (#122): 64 px native, the ring fills toward twice the 30-day pressure test
    const emblem = side.querySelector('.bk-days-emblem');
    if (emblem) { const ec = emblem.getContext('2d'); ec.imageSmoothingEnabled = false; ec.clearRect(0, 0, 64, 64); ec.drawImage(daysSealedCanvas(s.daysSealed, 30), 0, 0); }
    side.querySelector('.bk-test').onclick = () => { const res = site.startPressureTest(); toast(res.ok ? 'Pressure test running: 30 days sealed.' : res.reason); render(); };
    const hb = side.querySelector('.bk-hand');
    if (hb) hb.onclick = () => { const res = site.handOver(`Shelter #${site.handedOver + 1}`); if (res.ok) { onHandOver?.(res.shelter); toast('Handed over. A fresh plot is being surveyed.'); } else toast(res.reason); render(); };
  }

  let dirty = true;
  const offChange = site.onChange(() => { dirty = true; });
  let lastRes = 0;
  // ---------- photo mode (#121): hides the interface and frames the cutaway ----------
  let photo = null;
  function enterPhoto() {
    if (photo) return;
    const layer = el('canvas', 'bk-photo-layer');
    document.body.append(layer);
    photo = { layer, start: performance.now(), shotAt: -1, card: null, raf: 0 };
    wrap.classList.add('bk-photo'); document.body.classList.add('at-photo');
    const tick = () => { if (!photo) return; paintPhoto(); photo.raf = requestAnimationFrame(tick); };
    tick();
    // frame the built part of the shelter: scroll its middle to the middle of the screen
    requestAnimationFrame(() => {
      if (!photo) return;
      const [mx, my] = subject(), sc = canvas.getBoundingClientRect().width / canvas.width;
      scroller.scrollLeft = Math.max(0, mx * sc - scroller.clientWidth / 2); scroller.scrollTop = Math.max(0, my * sc - scroller.clientHeight / 2);
    });
  }
  /** The middle of the rooms (canvas px): what the photo is of. Falls back to the middle of the dig. */
  function subject() {
    const rooms = site.simulate().rooms.filter((r) => !r.touchesSky);
    if (!rooms.length) return [canvas.width / 2, PY(0) + T * 4];
    const x0 = Math.min(...rooms.map((r) => r.minX)), x1 = Math.max(...rooms.map((r) => r.maxX + 1));
    const y0 = Math.min(...rooms.map((r) => r.minY)), y1 = Math.max(...rooms.map((r) => r.maxY + 1));
    return [(PX(x0) + PX(x1)) / 2, (PY(y0) + PY(y1)) / 2];
  }
  function leavePhoto() {
    if (!photo) return;
    cancelAnimationFrame(photo.raf); photo.layer.remove(); photo = null;
    wrap.classList.remove('bk-photo'); document.body.classList.remove('at-photo');
  }
  function snap() {
    if (!photo) return;
    if (photo.card) { photo.card = null; return; } // ENTER again: back to framing
    photo.shotAt = performance.now();
    // the shot: the middle of the cutaway as the player framed it, at 1 art pixel per pixel
    const w = PHOTO_CARD_WINDOW.w, h = PHOTO_CARD_WINDOW.h;
    const [cx, cy] = subject();
    const card = el('canvas'); card.width = PHOTO_ASSETS.card.w; card.height = PHOTO_ASSETS.card.h;
    const c2 = card.getContext('2d'); c2.imageSmoothingEnabled = false;
    c2.fillStyle = '#0a0807'; c2.fillRect(PHOTO_CARD_WINDOW.x, PHOTO_CARD_WINDOW.y, w, h);
    c2.drawImage(canvas, Math.round(Math.max(0, Math.min(canvas.width - w, cx - w / 2))), Math.round(Math.max(0, Math.min(canvas.height - h, cy - h / 2))), w, h, PHOTO_CARD_WINDOW.x, PHOTO_CARD_WINDOW.y, w, h);
    drawPhoto(c2, 'card', 0, 0);
    photo.card = card;
  }
  function paintPhoto() {
    const L = photo.layer, dpr = 1;
    if (L.width !== innerWidth * dpr || L.height !== innerHeight * dpr) { L.width = innerWidth * dpr; L.height = innerHeight * dpr; }
    const g = L.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, L.width, L.height);
    const t = performance.now(), f = Math.floor((t - photo.start) / 500) % 2, m = 24;
    drawPhoto(g, 'viewfinder', m, m); drawPhoto(g, 'viewfinder', L.width - m - 64, m, { flipX: true });
    drawPhoto(g, 'viewfinder', m, L.height - m - 64, { flipY: true }); drawPhoto(g, 'viewfinder', L.width - m - 64, L.height - m - 64, { flipX: true, flipY: true });
    // rule-of-thirds guides, faint
    g.fillStyle = 'rgba(242,230,201,.14)';
    for (const k of [1, 2]) { g.fillRect(Math.round((L.width * k) / 3), m + 64, 1, L.height - 2 * m - 128); g.fillRect(m + 64, Math.round((L.height * k) / 3), L.width - 2 * m - 128, 1); }
    drawPhoto(g, 'label', m + 72, m + 4, { frame: f });
    drawPhoto(g, 'iris', L.width - m - 64 - 72, m + 4, { frame: photo.shotAt > 0 && t - photo.shotAt < 180 ? 1 : 0 });
    const since = photo.shotAt > 0 ? t - photo.shotAt : Infinity;
    if (since < 260) { // shutter flash
      g.fillStyle = `rgba(255,243,208,${(0.85 * (1 - since / 260)).toFixed(3)})`; g.fillRect(0, 0, L.width, L.height);
      drawPhoto(g, 'flash', Math.round(L.width / 2 - 32), Math.round(L.height / 2 - 32), { frame: since < 120 ? 0 : 1 });
    } else if (photo.card) { // the share card, at the largest whole scale that fits
      const c = photo.card, s = Math.max(1, Math.min(3, Math.floor(Math.min((L.width - 160) / c.width, (L.height - 200) / c.height))));
      g.drawImage(c, Math.round((L.width - c.width * s) / 2), Math.round((L.height - c.height * s) / 2) + 20, c.width * s, c.height * s);
    } else drawPhoto(g, 'camera', Math.round(L.width / 2 - 32), L.height - m - 72, { frame: f });
  }

  function render() {
    draw();
    if (dirty) { renderSide(); dirty = false; lastRes = getFrame(); }
    else if (Math.abs(getFrame() - lastRes) >= 20) { renderResidents(); lastRes = getFrame(); }
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
    destroy() { leavePhoto(); offChange(); removeEventListener('keydown', onKey); removeEventListener('mouseup', onUp); wrap.remove(); },
  };
}
