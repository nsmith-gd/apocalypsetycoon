// Game entry: main menu -> campaign (HUD, shelter/world views, clock) -> Midnight.
//
// Systems that exist today are wired here: ledger, pushback (heat/tension/board), research,
// audio, the quarter report and the Midnight ending. The shelter grid and world map views
// are placeholders until their tasks land; they should replace drawGridView/drawMapView.

import { Ledger } from '../ledger/ledger.js';
import { createGameUI } from '../ui/hud.js';
import { createResearchPanel } from '../ui/researchPanel.js';
import { Pushback } from '../pushback/pushback.js';
import { createPushbackUI } from '../pushback/pushback-ui.js';
import { createPressureGauge } from '../pushback/pressure-gauge.js';
import { DoomClock, attachPushback } from '../doomclock/doomclock.js';
import { createDoomClockHud } from '../doomclock/doomclock-hud.js';
import { ResearchTree } from '../research/research.js';
import { createAudio, wireAudio, createSoundToggle, startOnFirstGesture, midnightTimes } from '../audio/audio.js';
import { computeMidnight } from '../midnight/midnight.js';
import { showMidnight, showClockStrike } from '../midnight/midnight-ui.js';
import { ShelterGrid } from '../shelter/grid.js';
import { createGridUI } from '../shelter/grid-ui.js';
import { CrisisSystem } from '../crisis/breach.js';
import { createContainmentUI } from '../crisis/breach-ui.js';
import { LeadMarket, attachCrisis } from '../demand/demand.js';
import { SchemeBoard } from '../schemes/schemes.js';
import { MapSales } from '../worldmap/sales.js';
import { createWorldMapScreen } from '../worldmap/worldmap-ui.js';
import { CampaignClock, SPEEDS, formatClock, QUARTER_SECONDS } from './clock.js';
import { createSaveSlot, ledgerSaveable, pushbackSaveable, doomClockSaveable } from './save.js';

export const STARTING_CASH = 400_000;

const params = new URLSearchParams(location.search);
// ?qs=20 makes each quarter 20 seconds long (testing). Default is the full 27-minute quarter.
const QS = Number(params.get('qs')) > 0 ? Number(params.get('qs')) : QUARTER_SECONDS;
const app = document.getElementById('app');
const slot = createSaveSlot();

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// ======================= Main menu =======================
function showMainMenu() {
  app.replaceChildren();
  const mm = el('div', 'mm');
  const sky = el('canvas', 'mm-sky');
  sky.width = 320; sky.height = 180;
  drawMenuSky(sky.getContext('2d'));
  const save = slot.peek();
  const start = el('button', null, 'NEW CAMPAIGN');
  const cont = el('button', null, 'CONTINUE');
  const sub = el('div', 'mm-sub', save ? describeSave(save) : 'No saved campaign');
  cont.disabled = !save;
  const demos = el('a', 'mm-link', 'System demos');
  demos.href = 'demos.html';
  start.onclick = () => startCampaign({ resume: false });
  cont.onclick = () => startCampaign({ resume: true });
  mm.append(sky, el('div', 'mm-title', 'APOCALYPSE TYCOON'), el('div', 'mm-tag', "You don't survive the apocalypse. You sell it."),
    start, cont, sub, demos, el('div', 'mm-foot', 'LAST RESORT HOLDINGS · 12 QUARTERS TO MIDNIGHT'));
  app.append(mm);
  start.focus();
}

function describeSave(save) {
  const c = save.parts?.clock;
  const when = new Date(save.savedAt).toLocaleString();
  return c ? `Quarter ${c.quarter}/12 · saved ${when}` : `Saved ${when}`;
}

function drawMenuSky(c) {
  c.fillStyle = '#14110f'; c.fillRect(0, 0, 320, 180);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) { c.fillStyle = rnd() > 0.7 ? '#f2e6c9' : '#6a5d4a'; c.fillRect(Math.floor(rnd() * 320), Math.floor(rnd() * 110), 1, 1); }
  c.fillStyle = '#ff5a4f'; c.fillRect(0, 128, 320, 1); // the glow on the horizon
  c.fillStyle = '#241f1a';
  for (let x = 0; x < 320;) { const w = 8 + Math.floor(rnd() * 18); const h = 14 + Math.floor(rnd() * 34); c.fillRect(x, 145 - h, w - 1, h); x += w; }
  c.fillStyle = '#3b2a1e'; c.fillRect(0, 145, 320, 35);
  c.fillStyle = '#5a7a3a'; c.fillRect(0, 145, 320, 2);
  // bunker hatch
  c.fillStyle = '#4a3f33'; c.fillRect(152, 140, 16, 6);
  c.fillStyle = '#a8977a'; c.fillRect(154, 137, 12, 3);
  c.fillStyle = '#f5c542'; c.fillRect(159, 141, 2, 3);
}

// ======================= Campaign =======================
let session = null;

function startCampaign({ resume }) {
  session?.destroy();
  app.replaceChildren();
  const root = el('div', 'gs');
  const gridView = el('main', 'stage');
  const mapView = el('main', 'stage-map');
  root.append(gridView, mapView);
  app.append(root);

  const ledger = new Ledger({ startingCash: STARTING_CASH });
  const pb = new Pushback({ ledger, seed: Number(params.get('seed') ?? Date.now() % 100000) });
  const tree = new ResearchTree();
  const clock = new CampaignClock({ quarterSeconds: QS });
  const ui = createGameUI({ root, ledger, views: { grid: gridView, map: mapView } });
  const pbui = createPushbackUI({ root, pushback: pb });
  // Doom Clock: world tension and runaways move it; a Final Countdown can bring Midnight early.
  const doom = new DoomClock();
  attachPushback(doom, pb);
  createDoomClockHud({ clock: doom, hud: root.querySelector('.hud') });
  const gauge = createPressureGauge({ root, pushback: pb, getQuarterProfit: () => ledger.summary(ledger.quarter).net,
    onRelief: (r) => r && pbui.tick(`${r.kind === 'layLow' ? 'Laid low' : 'Funded relief'}: -$${Math.round(r.cost / 1000)}K`, 'ok') });
  const research = createResearchPanel({ root, tree, getCrisis: () => pb.tension });
  root.querySelector('.hud')?.insertBefore(research.chip, root.querySelector('.view-toggle'));
  const audio = createAudio();
  wireAudio(audio, { ledger, pushback: pb });
  startOnFirstGesture(audio);
  root.querySelector('.view-toggle')?.append(createSoundToggle(audio));

  slot.register('clock', clock);
  slot.register('ledger', ledgerSaveable(ledger));
  slot.register('pushback', pushbackSaveable(pb, Pushback));
  slot.register('doom', doomClockSaveable(doom, DoomClock));
  slot.register('research', tree);
  // The shelter grid: your HQ shelter. Board budget freezes raise build costs; research adds crews and rooms.
  let frame = 0;
  const grid = new ShelterGrid({ ledger, costMultiplier: () => pb.board.buildCostMultiplier, crews: () => tree.crewCount, isUnlocked: (id) => tree.isUnlocked(id) });
  const gridUI = createGridUI({ mount: gridView, grid, getFrame: () => frame, onHandOver: (sh) => { mapSales.addFinished(sh); mapScreen.refresh(); } });
  slot.register('grid', grid);

  // ---------- the world: crisis tracks, weekly leads, schemes and map sales ----------
  const worldSeed = Number(params.get('seed') ?? 11);
  const crisis = new CrisisSystem({ seed: worldSeed, pushback: pb, doomClock: doom, ledger, shelters: () => mapSales.sheltersForMidnight() });
  const START_TENSION = { pandemic: 30, climate: 22, unrest: 18, markets: 26, war: 10 };
  for (const [id, v] of Object.entries(START_TENSION)) crisis.setTension(id, v);
  const tensions = () => Object.fromEntries(Object.values(crisis.tracks).map((t) => [t.id, t.tension]));
  const market = new LeadMarket({ seed: worldSeed + 1, reputation: () => crisis.reputation });
  market.ownSite('nam'); // HQ
  market.week({ tensions: Object.fromEntries(Object.entries(START_TENSION).map(([k, v]) => [k, Math.round(v / 2)])) });
  market.week({ tensions: tensions() });
  attachCrisis(market, crisis); // a market week runs after every crisis week
  const schemes = new SchemeBoard({ crisis, market, ledger, pushback: pb, isUnlocked: (id) => tree.isUnlocked(id) });
  const mapSales = new MapSales({ market, ledger, pushback: pb, getTensions: tensions, getBreachMultiplier: () => crisis.panicMultiplier,
    getEdgeBonus: (id) => schemes.edgeBonus(id), getQuarter: () => clock.quarter });
  const mapScreen = createWorldMapScreen({ root: mapView, sales: mapSales, schemes, initial: 'nam', onScheme: () => ui.update(hudState()), onSold: () => ui.update(hudState()) });
  createContainmentUI({ root: document.body, crisis, onAdvanceWeek: () => crisis.advanceWeek() });
  crisis.on('week', () => mapScreen.refresh());
  slot.register('sales', mapSales);
  const WEEK_SECONDS = clock.quarterSeconds / 13; // 13 in-game weeks a quarter
  let weekAcc = 0;
  tree.onUnlock?.(() => { gridUI.refresh(); mapScreen.refresh(); });
  if (resume) slot.load(); else slot.clear();
  ledger.setQuarter(clock.quarter);

  // Midnight grades the HQ grid alongside every shelter sold (sold ones join this list from the map/clients).
  const shelters = () => [...(grid.built.length ? [grid.toShelter()] : []), ...mapSales.sheltersForMidnight()];

  const hudState = () => ({ quarter: clock.quarter, totalQuarters: clock.totalQuarters, heat: pb.heat, tension: pb.tension,
    boardTarget: pb.board.target, boardProgress: ledger.summary(clock.quarter).net, boardStrikes: pb.board.strikes });

  // ---------- clock bar ----------
  const bar = el('footer', 'cb');
  const label = el('span', 'cb-label');
  const time = el('span', 'cb-time');
  const track = el('div', 'cb-track');
  const segs = Array.from({ length: clock.totalQuarters }, (_, i) => { const s = el('div', 'cb-q'); s.title = `Quarter ${i + 1}`; s.append(el('i')); track.append(s); return s; });
  track.append(el('span', 'cb-mid', 'MIDNIGHT'));
  const speeds = el('div', 'cb-group');
  const speedBtns = SPEEDS.map((s) => {
    const b = el('button', null, s === 0 ? 'II' : `x${s}`);
    b.title = s === 0 ? 'Pause (Space)' : `Speed x${s} (, and . step speed)`;
    b.onclick = () => clock.setSpeed(s);
    speeds.append(b);
    return b;
  });
  const saveBtn = el('button', null, 'SAVE');
  saveBtn.onclick = () => toast(slot.save() ? 'Campaign saved.' : 'Could not save: browser storage is unavailable.');
  const menuBtn = el('button', null, 'MENU');
  menuBtn.onclick = () => { slot.save(); session.destroy(); showMainMenu(); };
  const endBtn = el('button', null, 'END QUARTER');
  endBtn.title = 'Close the books now (N)';
  endBtn.onclick = () => clock.skipQuarter();
  bar.append(label, time, track, speeds, endBtn, saveBtn, menuBtn);
  root.append(bar);

  function renderBar() {
    label.textContent = clock.label;
    time.textContent = clock.midnight ? '00:00' : clock.ending ? 'BOOKS CLOSING' : clock.paused ? `PAUSED ${formatClock(clock.secondsLeft)}` : `${formatClock(clock.secondsLeft)} left`;
    segs.forEach((s, i) => {
      const q = i + 1;
      s.dataset.state = q < clock.quarter || clock.midnight ? 'done' : q === clock.quarter ? 'now' : 'todo';
      s.firstChild.style.width = q === clock.quarter && !clock.midnight ? `${clock.quarterProgress * 100}%` : '';
    });
    speedBtns.forEach((b, i) => b.classList.toggle('on', SPEEDS[i] === clock.speed));
  }

  // ---------- views (placeholders) ----------
  function drawViews() {
    if (!gridView.hidden) gridUI.render();
  }
  const fit = () => {
    const hudH = root.querySelector('.hud')?.offsetHeight ?? 150;
    const sideW = innerWidth >= 1100 ? 540 : 40; // the pressure and client panels sit on both sides
    // On narrow screens the page scrolls, so size the grid by width only.
    gridUI.fit(innerWidth < 600 ? innerWidth - 40 : Math.min(innerWidth - sideW, 740) - 60, innerWidth < 700 ? Infinity : innerHeight - hudH - gridUI.chromeHeight() - (root.querySelector('.cb')?.offsetHeight ?? 44) - 20);
  };
  fit();
  requestAnimationFrame(fit);
  addEventListener('resize', fit);

  // ---------- end of quarter ----------
  clock.onQuarterEnd(async ({ quarter, isFinal }) => {
    ledger.record('upkeep', `Shovel crew payroll x${tree.crewCount}`, -45_000 * tree.crewCount);
    pbui.hold();
    const r = pb.endQuarter({ quarter, profit: ledger.summary(quarter).net });
    if (r.board.met) audio.play('boardMet');
    await ui.showQuarterReport({ quarter, board: r.board, heat: pb.heat, tension: pb.tension, notes: r.lines.slice(1) });
    await pbui.drain();
    if (pb.board.ousted) { clock.hold('ousted'); slot.clear(); showOusted(quarter); return; }
    if (!isFinal) toast(`Quarter ${quarter + 1} begins. The board wants growth.`);
  });
  clock.onQuarterStart(({ quarter }) => {
    ledger.setQuarter(quarter);
    doom.advanceWeeks(13);
    if ((quarter - 1) % 3 === 0) doom.chapterStart((quarter - 1) / 3 + 1);
    slot.save(); // autosave at every quarter close
    ui.update(hudState());
  });
  let midnightStarted = false;
  async function midnight(cause = null) {
    if (midnightStarted) return;
    midnightStarted = true;
    clock.hold('midnight');
    slot.clear();
    renderBar();
    const result = computeMidnight({ shelters: shelters(), world: { tension: pb.tension, heat: pb.heat, runaways: pb.runaways }, cash: ledger.cash,
      ...(cause ? { forceType: 'failed', cause } : {}) });
    const { tolls, boom } = midnightTimes();
    audio.midnight(result.type);
    await showClockStrike({ root: document.body, tolls: tolls.map((s) => s + 0.05), duration: boom + 0.05 });
    await showMidnight({ root: document.body, result, onRestart: () => { document.querySelectorAll('.mn-overlay').forEach((n) => n.remove()); session.destroy(); showMainMenu(); } });
  }
  clock.onMidnight(() => midnight());
  // The Doom Clock can strike before Q12 ends.
  doom.on('midnight', (e) => midnight(e.reason === 'clock' ? 'The Doom Clock struck zero before you were ready.' : 'Two collapses started a Final Countdown you could not stop.'));
  clock.onChange(renderBar);
  pb.on('change', () => ui.update(hudState()));
  ledger.onChange(() => { ui.update(hudState()); gauge.render(); });

  // Modals hold the clock: quarter report and choice cards pause time.
  const modalOpen = () => !!document.querySelector('.report-overlay:not([hidden]), .br-overlay:not([hidden]), .pb-overlay, .mn-overlay, .mn-strike');

  // ---------- keys ----------
  const onKey = (e) => {
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); clock.togglePause(); }
    else if (e.key === '.' || e.key === '>') clock.setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(clock.speed) + 1)] ?? 1);
    else if (e.key === ',' || e.key === '<') clock.setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(clock.speed) - 1)] ?? 1);
    else if (e.key === 'n' || e.key === 'N') { if (!modalOpen()) clock.skipQuarter(); }
  };
  addEventListener('keydown', onKey);

  // ---------- loop ----------
  let last = performance.now();
  let raf = 0;
  let acc = 0;
  const loop = (now) => {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (modalOpen()) clock.hold('modal'); else clock.release('modal');
    if (clock.running) {
      const g = dt * clock.speed;
      tree.tick(g, pb.tension);
      grid.tick(g);
      weekAcc += g;
      while (weekAcc >= WEEK_SECONDS) { weekAcc -= WEEK_SECONDS; crisis.advanceWeek(); }
    }
    clock.tick(dt);
    acc += dt;
    if (acc > 0.25) { acc = 0; frame++; drawViews(); }
    renderBar();
    raf = requestAnimationFrame(loop);
  };
  drawViews();
  ui.update(hudState());
  renderBar();
  raf = requestAnimationFrame(loop);

  // Game over before Midnight: three missed board targets.
  function showOusted(quarter) {
    const o = el('div', 'mm');
    o.style.background = 'rgba(20,17,15,.94)';
    o.style.zIndex = '200';
    const back = el('button', null, 'MAIN MENU');
    back.onclick = () => { o.remove(); session.destroy(); showMainMenu(); };
    o.append(el('div', 'mm-title', 'OUSTED'), el('div', 'mm-tag', `The board voted you out after quarter ${quarter}. Midnight will come without you.`), back);
    document.body.append(o);
  }

  function toast(msg) {
    const t = el('div', 'cb-toast', msg);
    document.body.append(t);
    setTimeout(() => { t.style.opacity = '0'; }, 2200);
    setTimeout(() => t.remove(), 2800);
  }

  session = {
    clock, doom, gauge, ledger, pb, tree, ui, grid, gridUI, shelters, crisis, market, schemes, mapSales, mapScreen, slot,
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener('keydown', onKey);
      removeEventListener('resize', fit);
      gridUI.destroy();
      ui.destroy();
      app.replaceChildren();
      session = null;
    },
  };
  window.__game = session;
}

showMainMenu();
window.__menu = { showMainMenu, startCampaign };
