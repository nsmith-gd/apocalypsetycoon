// Midnight ending screen: a pixel scene of the world above and every shelter below (lit if its
// people made it), the ending title, AIR / WATER / FOOD grades and a per-shelter breakdown.
//
//   await showMidnight({ root, result: computeMidnight(...), onRestart })

import { STATS } from './midnight.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const money = (n) => {
  const a = Math.abs(Math.round(n));
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(0)}K` : String(a);
  return `${n < 0 ? '-' : ''}$${s}`;
};
const STAT_LABEL = { air: 'AIR', water: 'WATER', food: 'FOOD' };
const OUTCOME_LABEL = { survived: 'ALL SURVIVED', rationing: 'RATIONING', lost: 'LOST' };

// ---------- pixel scene ----------
function drawScene(canvas, result, t) {
  const c = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const failed = result.type === 'failed';
  const ground = 46;
  // sky bands
  const sky = failed ? ['#2a0806', '#4a0e08', '#7a1a0a', '#b8360e', '#ff6a1a'] : ['#0c0a1e', '#1a1440', '#2c1f5e', '#4a2f7a', '#8a5ab8'];
  sky.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i * 9, W, 9); });
  // the event on the horizon
  if (failed) {
    for (let i = 0; i < 6; i++) {
      const x = (i * 29 + 11) % W;
      const h = 6 + ((i * 7 + Math.floor(t / 120)) % 5);
      c.fillStyle = i % 2 ? '#ffb02e' : '#ff5a1a';
      c.fillRect(x, ground - h - 4, 4, h);
      c.fillStyle = '#ffe08a';
      c.fillRect(x + 1, ground - h - 2, 2, 2);
    }
  } else {
    // a single, very deliberate mushroom cloud
    const pulse = Math.floor(t / 200) % 2;
    c.fillStyle = '#e8d0ff';
    c.fillRect(W / 2 - 2, 18, 4, ground - 18);
    c.fillStyle = pulse ? '#f5e6ff' : '#d8b8ff';
    c.fillRect(W / 2 - 12, 10, 24, 9);
    c.fillRect(W / 2 - 8, 6, 16, 4);
    c.fillStyle = '#ffffff';
    c.fillRect(W / 2 - 6, 8, 12, 2);
  }
  // skyline
  c.fillStyle = '#05040a';
  for (let x = 0; x < W; x += 7) {
    const h = 4 + ((x * 13) % 11);
    c.fillRect(x, ground - h, 6, h);
  }
  // earth
  c.fillStyle = '#3b2a1e';
  c.fillRect(0, ground, W, H - ground);
  c.fillStyle = '#2a1d14';
  for (let x = 0; x < W; x += 4) c.fillRect(x, ground + ((x * 7) % 5) + 2, 2, 1);
  // shelters
  const n = result.shelters.length;
  const cols = Math.max(1, Math.min(n, 12));
  const cell = Math.floor(W / cols);
  result.shelters.forEach((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cell + Math.floor(cell / 2) - 5;
    const y = ground + 5 + row * 9;
    c.fillStyle = '#0a0807';
    c.fillRect(x - 1, y - 1, 12, 8);
    const lit = s.outcome === 'survived' ? '#7ed957' : s.outcome === 'rationing' ? ((Math.floor(t / 300) + i) % 2 ? '#ff9f1c' : '#7a4a10') : '#2a1010';
    c.fillStyle = lit;
    c.fillRect(x, y, 10, 6);
    if (s.outcome === 'lost') {
      c.fillStyle = '#ff5a4f';
      c.fillRect(x + 2, y + 1, 1, 1); c.fillRect(x + 3, y + 2, 1, 1); c.fillRect(x + 4, y + 3, 1, 1); c.fillRect(x + 5, y + 4, 1, 1);
      c.fillRect(x + 5, y + 1, 1, 1); c.fillRect(x + 2, y + 4, 1, 1);
    }
    // little shaft to the surface
    c.fillStyle = '#1a120c';
    c.fillRect(x + 4, ground, 2, y - ground - 1);
  });
}

export function showMidnight({ root = document.body, result, onRestart } = {}) {
  const overlay = el('div', 'mn-overlay');
  overlay.dataset.type = result.type;
  const screen = el('section', 'mn-screen');
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-label', `Midnight: ${result.ending.title}`);

  const clock = el('div', 'mn-clock', '00:00  MIDNIGHT');
  const canvas = el('canvas', 'mn-scene');
  canvas.width = 192;
  canvas.height = 64 + Math.max(0, Math.ceil(result.shelters.length / 12) - 1) * 9;
  const kind = el('div', 'mn-kind', result.endingName ? `${result.endingName}${result.apocalypse ? ` · ${result.apocalypse.name.toUpperCase()}` : ''}` : result.type === 'engineered' ? 'AN ENGINEERED MIDNIGHT' : 'MIDNIGHT, FAILED TO CONTAIN');
  const kindWhy = el(
    'div',
    'mn-kind-why',
    result.cause
      ? `${result.cause}${result.needMultiplier > 1 ? ` Every shelter needed ${Math.round((result.needMultiplier - 1) * 100)}% more to survive.` : ''}`
      : result.type === 'engineered'
      ? `Control ${result.control}/100: the end of the world arrived on your schedule.`
      : `Control ${result.control}/100: ${result.world.runaways} runaway cris${result.world.runaways === 1 ? 'is' : 'es'} got there first. Every shelter needed ${Math.round((result.needMultiplier - 1) * 100)}% more to survive.`,
  );
  const title = el('h1', 'mn-title', result.ending.title);
  const line = el('p', 'mn-line', result.ending.line);
  const gradeEl = result.grade ? el('div', 'mn-grade', `GRADE: ${result.grade.name.toUpperCase()}${result.type === 'failed' ? ' (UNCONTROLLED, -1)' : ''}`) : null;
  if (gradeEl) gradeEl.dataset.grade = result.grade.id;

  // grade tiles
  const tiles = el('div', 'mn-tiles');
  for (const k of STATS) {
    const o = result.overall[k];
    const tile = el('div', 'mn-tile');
    tile.dataset.grade = o.grade;
    tile.append(el('div', 'mn-tile-label', STAT_LABEL[k]), el('div', 'mn-tile-grade', o.grade), el('div', 'mn-tile-sub', `${o.passing}/${o.of} shelters fully supplied`));
    tiles.append(tile);
  }
  const surv = el('div', 'mn-tile mn-tile-wide');
  const pct = Math.round(result.survivalRate * 100);
  surv.dataset.grade = pct >= 85 ? 'A' : pct >= 50 ? 'C' : 'F';
  surv.append(el('div', 'mn-tile-label', 'SURVIVORS'), el('div', 'mn-tile-grade', `${pct}%`), el('div', 'mn-tile-sub', `${result.totals.survivors}/${result.totals.occupants} people`));
  tiles.append(surv);

  // per-shelter table
  const table = el('table', 'mn-table');
  const head = el('tr');
  for (const h of ['SHELTER', 'PEOPLE', 'AIR', 'WATER', 'FOOD', 'LUXURY', 'OUTCOME']) head.append(el('th', null, h));
  table.append(head);
  for (const s of result.shelters) {
    const tr = el('tr');
    tr.dataset.outcome = s.outcome;
    const name = el('td', 'mn-name', s.name);
    if (s.owner) name.append(el('span', 'mn-owner', s.sold ? ` sold to ${s.owner}` : ` ${s.owner}`));
    if (s.pickup === 'late' || s.pickup === 'lost') name.append(el('span', 'mn-pickup', s.pickup === 'late' ? ' ARRIVED LATE' : ' NEVER ARRIVED'));
    tr.append(name, el('td', 'mn-num', `${s.survivors}/${s.occupants}`));
    for (const k of STATS) {
      const g = el('td', 'mn-g', s.grades[k]);
      g.dataset.grade = s.grades[k];
      if (k === s.weakest && s.outcome !== 'survived') g.classList.add('mn-weak');
      tr.append(g);
    }
    tr.append(el('td', 'mn-num', s.prestige ? '★'.repeat(Math.min(5, Math.ceil(s.prestige / 2))) : '-'), el('td', 'mn-out', OUTCOME_LABEL[s.outcome]));
    table.append(tr);
  }
  if (!result.shelters.length) {
    const tr = el('tr');
    const td = el('td', 'mn-empty', 'You never built or sold a single shelter.');
    td.colSpan = 7;
    tr.append(td);
    table.append(tr);
  }
  const tableWrap = el('div', 'mn-table-wrap');
  tableWrap.append(table);

  const facts = el('ul', 'mn-facts');
  const fact = (t) => facts.append(el('li', null, t));
  fact(`Shelters: ${result.outcomes.survived} held, ${result.outcomes.rationing} rationing, ${result.outcomes.lost} lost.`);
  if (result.wasted) fact(`${result.wasted} shelter${result.wasted === 1 ? '' : 's'} full of luxury still fell short. Midnight does not grade gold taps.`);
  fact(`World at Midnight: tension ${Math.round(result.world.tension)}, heat ${Math.round(result.world.heat)}.`);
  if (result.apocalypse) fact(`The apocalypse: ${result.apocalypse.name}${result.apocalypse.reason ? ` (${result.apocalypse.reason})` : ''}. Shelters needed ${result.apocalypse.days} days sealed.`);
  const pickups = result.shelters.filter((s) => s.pickup && s.pickup !== 'on_time');
  if (pickups.length) fact(`Seal Order: ${pickups.filter((s) => s.pickup === 'late').length} client parties arrived late, ${pickups.filter((s) => s.pickup === 'lost').length} never arrived.`);
  if (result.payout) fact(`Engineering fee: ${money(result.payout)} (${result.grade.name} grade).`);
  fact(`Last Resort Holdings closes the books on ${money(result.cash)}.`);

  const actions = el('div', 'mn-actions');
  const again = el('button', 'mn-btn', 'START A NEW CAMPAIGN');
  again.type = 'button';
  actions.append(again);

  screen.append(clock, canvas, kind, kindWhy, title, ...(gradeEl ? [gradeEl] : []), line, tiles, tableWrap, facts, actions);
  overlay.append(screen);
  root.append(overlay);

  let raf = 0;
  const loop = (t) => { drawScene(canvas, result, t); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  drawScene(canvas, result, 0);

  return new Promise((resolve) => {
    again.addEventListener('click', () => {
      cancelAnimationFrame(raf);
      overlay.remove();
      onRestart?.();
      resolve();
    });
    again.focus();
  });
}

/**
 * Black "the clock strikes twelve" interstitial to sit under the Midnight stinger.
 * `tolls` = seconds at which each of the twelve bells lands (audio's midnightTimes()); `duration` = when the boom lands.
 */
export function showClockStrike({ root = document.body, tolls, duration = 6 } = {}) {
  const overlay = el('div', 'mn-strike');
  const time = el('div', 'mn-strike-time', '11:59');
  const tollsEl = el('div', 'mn-strike-tolls');
  overlay.append(time, tollsEl);
  root.append(overlay);
  const at = tolls ?? Array.from({ length: 12 }, (_, i) => duration * 0.33 + (i + 1) * ((duration * 0.6) / 12));
  const timers = at.map((sec, i) => setTimeout(() => {
    tollsEl.textContent = '|'.repeat(i + 1);
    if (i === 11) { time.textContent = '00:00'; overlay.classList.add('mn-strike-final'); }
  }, sec * 1000));
  return new Promise((resolve) => setTimeout(() => { timers.forEach(clearTimeout); overlay.remove(); resolve(); }, duration * 1000));
}
