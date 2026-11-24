// Shelter grid screen: room palette, the click-to-build cross-section and the shelter stat sheet.
//
//   const gridUI = createGridUI({ mount, grid, getFrame });
//   gridUI.render();          // redraw canvas + stat sheet (call on a timer for animation)
//   gridUI.fit(maxW, maxH);   // integer-scale the canvas into the space available
//
// Controls: pick a room in the palette, click a cell to order it (the cost comes off at once and
// the shovel crew digs and fits it out). Right-click, or the DEMOLISH tool, removes a room:
// unfinished jobs are cancelled with a full refund, finished rooms are salvaged for half.
// Keys: X demolish tool, Esc drop the tool.

import { drawShelter, TILE } from '../art/shelterView.js';
import { AMENITIES, TILES } from '../art/sprites-shelter.js';
import { spriteCanvas, drawSprite } from '../art/render.js';
import { ROOM_STATS } from '../midnight/midnight.js';
import { formatMoney } from '../ledger/ledger.js';
import { depthOfRow } from './grid.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const k = (n) => formatMoney(n);
const mmss = (s) => `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`;

// Short palette labels (full names show in tooltips and the info line).
const SHORT = { bunk: 'Bunk room', water_recycler: 'Recycler', mil_scrubber: 'Mil. scrubber', cryo_pod: 'Cryo pods', wine_cellar: 'Wine cellar', ai_butler: 'AI butler', hydroponics: 'Hydroponics', water_tank: 'Water tank', air_vent: 'Air vent' };

/** What a room is for, in one tag: LUXURY, AIR, WATER, FOOD or BEDS. */
function roomTag(id, def) {
  const s = ROOM_STATS[id] ?? {};
  if (id === 'bunk') return { text: 'BEDS +4', cls: 'beds' };
  if (def.kind === 'luxury') return { text: `LUXURY +${s.prestige ?? 0}`, cls: 'lux' };
  const best = ['air', 'water', 'food'].reduce((a, x) => ((s[x] ?? 0) > (s[a] ?? 0) ? x : a), 'air');
  return { text: `${best.toUpperCase()} +${s[best] ?? 0}`, cls: best };
}

export function createGridUI({ mount, grid, getFrame = () => 0, onToast = null }) {
  const wrap = el('div', 'sg');

  // ---------- palette ----------
  const pal = el('div', 'sg-palette');
  pal.append(el('div', 'sg-title', 'BUILD · click a cell to dig and fit out · right-click removes'));
  const palButtons = new Map();
  let selected = 'bunk';
  let demolish = false;
  for (const item of grid.palette()) {
    const b = el('button', 'sg-room');
    b.type = 'button';
    b.dataset.id = item.id;
    const icon = spriteCanvas(AMENITIES[item.id]);
    const ic = el('canvas', 'sg-icon');
    ic.width = 16; ic.height = 16;
    ic.getContext('2d').drawImage(spriteCanvas(TILES.roomEmpty), 0, 0);
    ic.getContext('2d').drawImage(icon, 0, 0);
    const tag = roomTag(item.id, item);
    const t = el('span', `sg-tag sg-${tag.cls}`, tag.text);
    b.append(ic, el('span', 'sg-name', SHORT[item.id] ?? item.name), t, el('span', 'sg-cost', k(item.cost)));
    b.onclick = () => select(item.id);
    pal.append(b);
    palButtons.set(item.id, b);
  }
  const demo = el('button', 'sg-room sg-demolish', 'DEMOLISH [X]');
  demo.type = 'button';
  demo.onclick = () => { demolish = !demolish; refreshPalette(); };
  pal.append(demo);

  function select(id) {
    selected = id;
    demolish = false;
    refreshPalette();
    renderInfo();
  }
  function refreshPalette() {
    const palette = grid.palette();
    for (const item of palette) {
      const b = palButtons.get(item.id);
      b.classList.toggle('on', !demolish && item.id === selected);
      b.dataset.locked = String(item.locked);
      b.title = item.locked ? `${item.name}: research it first (R)` : `${item.name}: ${k(item.cost)} plus digging`;
      b.querySelector('.sg-cost').textContent = item.locked ? 'R&D' : k(Math.round(item.cost * (grid.costMultiplier() || 1)));
    }
    demo.classList.toggle('on', demolish);
    wrap.dataset.tool = demolish ? 'demolish' : 'build';
  }

  // ---------- canvas ----------
  const centre = el('div', 'sg-centre');
  const canvas = el('canvas', 'sg-canvas');
  canvas.width = grid.cols * TILE;
  canvas.height = grid.rows * TILE;
  const info = el('div', 'sg-info');
  const depthScale = el('div', 'sg-depth');
  const canvasRow = el('div', 'sg-canvas-row');
  canvasRow.append(depthScale, canvas);
  centre.append(canvasRow, info);
  let hover = null;

  const cellAt = (e) => {
    const r = canvas.getBoundingClientRect();
    const col = Math.floor(((e.clientX - r.left) / r.width) * grid.cols);
    const row = Math.floor(((e.clientY - r.top) / r.height) * grid.rows);
    return col >= 0 && row >= 0 && col < grid.cols && row < grid.rows ? { col, row } : null;
  };
  canvas.addEventListener('mousemove', (e) => { hover = cellAt(e); render(); });
  canvas.addEventListener('mouseleave', () => { hover = null; render(); });
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); const c = cellAt(e); if (c) removeAt(c); });
  canvas.addEventListener('click', (e) => {
    const c = cellAt(e);
    if (!c) return;
    if (demolish || (grid.at(c.col, c.row) && !e.shiftKey)) return removeOrSay(c);
    const r = grid.place(c.col, c.row, selected);
    if (r.ok) float(c, `-${k(r.cost)}`, 'down');
    else say(r.reason);
    render();
  });
  function removeOrSay(c) {
    if (!grid.at(c.col, c.row)) return say('Nothing to demolish there');
    if (!demolish) return say('Occupied. Right-click or use DEMOLISH to clear it.');
    removeAt(c);
  }
  function removeAt(c) {
    const r = grid.remove(c.col, c.row);
    if (r.ok && r.refund) float(c, `+${k(r.refund)}`, 'up');
    if (r.ok) say(r.cancelled ? 'Job cancelled, full refund.' : 'Demolished: half the price salvaged.');
    render();
  }

  // Floating cost text over the cell.
  function float(c, text, dir) {
    const f = el('div', `sg-float sg-${dir}`, text);
    const r = canvas.getBoundingClientRect();
    const box = centre.getBoundingClientRect();
    f.style.left = `${r.left - box.left + ((c.col + 0.5) / grid.cols) * r.width}px`;
    f.style.top = `${r.top - box.top + (c.row / grid.rows) * r.height}px`;
    centre.append(f);
    setTimeout(() => f.remove(), 1100);
  }
  let msg = '';
  let msgTimer = null;
  function say(text) {
    msg = text;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { msg = ''; renderInfo(); }, 2200);
    renderInfo();
    onToast?.(text);
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    const frame = getFrame();
    const rooms = grid.rooms.map((r) => ({ col: r.col, row: r.row, amenity: r.id }));
    drawShelter(ctx, { cols: grid.cols, rows: grid.rows, rooms: rooms.filter((r) => grid.at(r.col, r.row).built), frame, shaftCol: grid.cfg.shaftCol });
    // Jobs: dimmed room with scaffolding and a progress bar; the crew's current job blinks.
    const queue = grid.queue;
    const crews = grid.crews();
    queue.forEach((job, i) => {
      const x = job.col * TILE;
      const y = job.row * TILE;
      const digging = job.digPaid && job.progress < (grid.cfg.digSeconds[grid.stratum(job.row).id] ?? 0);
      if (!digging) { drawSprite(ctx, TILES.roomEmpty, x, y); drawSprite(ctx, AMENITIES[job.id], x, y); }
      ctx.fillStyle = 'rgba(10,8,7,0.55)';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#ff9f1c';
      for (let d = 0; d < TILE; d += 4) { ctx.fillRect(x + d, y, 2, 1); ctx.fillRect(x + d + 2, y + TILE - 1, 2, 1); }
      ctx.fillStyle = '#0a0807'; ctx.fillRect(x + 2, y + 6, 12, 4);
      ctx.fillStyle = i < crews ? '#f5c542' : '#6a5d4a';
      ctx.fillRect(x + 3, y + 7, Math.max(1, Math.round(10 * (job.progress / job.need))), 2);
      if (i < crews && frame % 2 === 0) { ctx.fillStyle = '#f2e6c9'; ctx.fillRect(x + 7, y + 2, 2, 3); } // shovel glint
    });
    // Hover
    if (hover) {
      const q = demolish ? null : grid.quote(hover.col, hover.row, selected);
      const occupied = grid.at(hover.col, hover.row);
      const ok = demolish ? !!occupied : q?.ok;
      ctx.strokeStyle = ok ? '#7ed957' : '#ff5a4f';
      ctx.lineWidth = 1;
      ctx.strokeRect(hover.col * TILE + 0.5, hover.row * TILE + 0.5, TILE - 1, TILE - 1);
      if (!demolish && q?.ok) {
        ctx.globalAlpha = 0.5;
        drawSprite(ctx, AMENITIES[selected], hover.col * TILE, hover.row * TILE);
        ctx.globalAlpha = 1;
      }
    }
  }

  function renderDepth() {
    const scale = canvas.getBoundingClientRect().height / grid.rows;
    depthScale.replaceChildren(...Array.from({ length: grid.rows }, (_, row) => {
      const d = el('div', 'sg-depth-row', row === 0 ? 'SURFACE' : `${depthOfRow(row)} m`);
      d.style.height = `${scale}px`;
      d.title = row === 0 ? '' : `${grid.stratum(row).name}: digging costs ${k(grid.stratum(row).digCost)}`;
      return d;
    }));
  }

  function renderInfo() {
    if (msg) { info.textContent = msg; info.dataset.kind = 'msg'; return; }
    info.dataset.kind = '';
    if (!hover) { info.textContent = demolish ? 'DEMOLISH: click a room to clear it.' : 'Pick a room, then click a cell to dig and build. Right-click removes.'; return; }
    const occupied = grid.at(hover.col, hover.row);
    if (occupied) {
      const name = grid.palette().find((p) => p.id === occupied.id).name;
      info.textContent = occupied.built
        ? `${name} · demolish for ${k(Math.round(occupied.paid * grid.cfg.salvage))} salvage`
        : `${name} · under construction ${Math.round((occupied.progress / occupied.need) * 100)}% · cancel for a full refund`;
      return;
    }
    if (demolish) { info.textContent = 'Nothing here to demolish.'; return; }
    const q = grid.quote(hover.col, hover.row, selected);
    const name = grid.palette().find((p) => p.id === selected).name;
    if (!q.ok) { info.textContent = `${name}: ${q.reason}${q.cost ? ` (${k(q.cost)})` : ''}`; info.dataset.kind = 'bad'; return; }
    info.textContent = `${name} · ${k(q.cost)}${q.dig ? ` (dig ${k(q.dig)} through ${q.stratum.name.toLowerCase()}, ${depthOfRow(hover.row)} m)` : ' (already dug)'} · ${mmss(q.seconds)} for one crew`;
  }

  // ---------- stat sheet ----------
  const sheet = el('aside', 'sg-sheet');
  function renderSheet() {
    const s = grid.stats();
    const bar = (label, key, icon) => {
      const row = el('div', 'sg-stat');
      row.dataset.grade = s.grades[key];
      const need = s.occupants;
      const have = s.supply[key];
      const pct = need > 0 ? Math.max(0, Math.min(100, (have / need) * 100)) : 100;
      const head = el('div', 'sg-stat-head');
      head.append(el('span', null, `${icon} ${label}`), el('b', 'sg-grade', s.grades[key]));
      const b = el('div', 'hud-bar');
      const f = el('div', 'hud-bar-fill');
      f.style.width = `${pct}%`;
      b.append(f);
      row.append(head, b, el('div', 'sg-stat-sub', `${Math.round(have * 10) / 10} of ${need} people supplied`));
      return row;
    };
    const job = grid.queue[0];
    const jobName = job ? grid.palette().find((p) => p.id === job.id).name : null;
    const col = (...kids) => { const c = el('div', 'sg-col'); c.append(...kids); return c; };
    const prestige = el('div', 'sg-prestige');
    prestige.dataset.lux = String(s.isLuxury);
    prestige.append(el('span', null, 'PRESTIGE'), el('b', null, `${s.prestige}${s.isLuxury ? ' LUX' : ''}`));
    sheet.replaceChildren(
      col(el('div', 'sg-title', 'LAST RESORT HQ'), el('div', 'sg-people', `${s.occupants} PEOPLE`), el('div', 'sg-line', `Midnight: ${s.survivors}/${s.occupants} survive`)),
      bar('AIR', 'air', '~'),
      bar('WATER', 'water', '%'),
      bar('FOOD', 'food', '#'),
      col(prestige, el('div', 'sg-line', `Rooms ${s.rooms} · lux ${s.luxury} · survival ${s.survival}`), el('div', 'sg-line', `Invested ${k(s.invested)}`)),
      col(el('div', 'sg-crew', `${s.crews} SHOVEL CREW${s.crews === 1 ? '' : 'S'}`),
        el('div', 'sg-line', job ? `Building ${jobName} ${Math.round((job.progress / job.need) * 100)}%` : 'Idle. Order a room.'),
        el('div', 'sg-line', `${s.underConstruction} job${s.underConstruction === 1 ? '' : 's'} queued`)),
    );
  }

  wrap.append(pal, centre, sheet);
  mount.append(wrap);

  const onKey = (e) => {
    if (mount.hidden || e.target?.tagName === 'INPUT') return;
    if (e.key === 'x' || e.key === 'X') { demolish = !demolish; refreshPalette(); render(); }
    else if (e.key === 'Escape' && demolish) { demolish = false; refreshPalette(); render(); }
  };
  addEventListener('keydown', onKey);

  let sheetDirty = true;
  const off = grid.onChange(() => { sheetDirty = true; });
  function render() {
    draw();
    renderInfo();
    if (sheetDirty) { renderSheet(); refreshPalette(); sheetDirty = false; }
  }
  function fit(maxW, maxH) {
    const scale = Math.max(1, Math.floor(Math.min(maxW / canvas.width, maxH / canvas.height)));
    canvas.style.width = `${canvas.width * scale}px`;
    canvas.style.height = `${canvas.height * scale}px`;
    renderDepth();
    return scale;
  }
  refreshPalette();
  render();

  return {
    el: wrap,
    /** Height taken by everything except the canvas (palette, info line, stat sheet, gaps). */
    chromeHeight: () => pal.offsetHeight + sheet.offsetHeight + info.offsetHeight + 40,
    canvas,
    render,
    fit,
    select,
    refresh() { sheetDirty = true; render(); },
    destroy() { off(); removeEventListener('keydown', onKey); wrap.remove(); },
  };
}
