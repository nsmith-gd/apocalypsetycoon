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
import { DoomClock } from '../doomclock/doomclock.js';
import { createDoomClockHud } from '../doomclock/doomclock-hud.js';
import { ResearchTree } from '../research/research.js';
import { createAudio, wireAudio, createSoundToggle, startOnFirstGesture, midnightTimes } from '../audio/audio.js';
import { computeMidnight } from '../midnight/midnight.js';
import { showMidnight, showClockStrike } from '../midnight/midnight-ui.js';
import { showSealOrder } from '../midnight/engineered-ui.js';
import { uncontrolledRoad, sealOrderClients, resolveUncontrolled } from '../midnight/uncontrolled.js';
import { REGIONS as SALES_REGIONS } from '../demand/demand.js';
import { BunkerSite } from '../shelter/bunker.js';
import { createBunkerUI } from '../shelter/bunker-ui.js';
import { CrisisSystem } from '../crisis/breach.js';
import { createContainmentUI } from '../crisis/breach-ui.js';
import { LeadMarket, attachCrisis } from '../demand/demand.js';
import { SchemeBoard } from '../schemes/schemes.js';
import { MapSales } from '../worldmap/sales.js';
import { createWorldMapScreen } from '../worldmap/worldmap-ui.js';
import { TRACK_BY_ID, CLASSIC_ROSTER, rosterLinks } from '../world/tracks.js';
import { showWorldSetup, createThreatsPanel } from '../world/world-ui.js';
import { CampaignClock, SPEEDS, formatClock, QUARTER_SECONDS } from './clock.js';
import { createSaveSlot, ledgerSaveable, pushbackSaveable, doomClockSaveable } from './save.js';
import { finaleArgs } from '../midnight/finale.js';
import { Company } from '../company/company.js';
import { createCompanyPanel } from '../company/company-panel.js';
import { LeadInventory } from '../leads/leads.js';
import { loadVenueCatalog } from '../events/venues.js';
import { EventCircuit } from '../events/attend.js';
import { WeeklyDeck, applyChoice } from '../events/weekly.js';
import { FirstBreachNudge } from '../crisis/first-breach.js';
import { showWeeklyCard } from '../events/weekly-ui.js';
import { SocialSession } from '../social/viewmodel.js';
import { worldState } from '../dialogue/world-state.js';
import { createSocialScreens } from '../social/text-screens.js';

export const STARTING_CASH = 400_000;
// A threat opens already simmering (GDD bands: Calm 0-19, Simmer 20-44). Provisional.
export const TRACK_OPEN_TENSION = 20;
export const CHAPTER_STARTS = Object.freeze({ 3: 2, 5: 3, 8: 4, 11: 5 });

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
  // The first campaign is always Classic; after one is finished, NEW CAMPAIGN opens the world setup.
  start.onclick = () => (campaignsFinished() > 0 ? openSetup() : startCampaign({ resume: false, roster: [...CLASSIC_ROSTER] }));
  const setup = el('button', 'mm-small', 'WORLD SETUP');
  setup.title = 'Choose Classic, Random or Custom threat tracks (debug start)';
  setup.onclick = () => openSetup();
  const openSetup = () => showWorldSetup({ root: document.body, firstCampaign: campaignsFinished() === 0,
    onStart: (roster) => startCampaign({ resume: false, roster }), onBack: () => start.focus() });
  cont.onclick = () => startCampaign({ resume: true });
  mm.append(sky, el('div', 'mm-title', 'APOCALYPSE TYCOON'), el('div', 'mm-tag', "You don't survive the apocalypse. You sell it."),
    start, cont, setup, sub, demos, el('div', 'mm-foot', 'LAST RESORT HOLDINGS · 12 QUARTERS TO MIDNIGHT'));
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

const FINISHED_KEY = 'apocalypse-tycoon.campaigns-finished';
function campaignsFinished() {
  try { return Number(localStorage.getItem(FINISHED_KEY)) || 0; } catch { return 0; }
}
function markCampaignFinished() {
  try { localStorage.setItem(FINISHED_KEY, String(campaignsFinished() + 1)); } catch { /* ignore */ }
}

function startCampaign({ resume, roster = [...CLASSIC_ROSTER] }) {
  session?.destroy();
  app.replaceChildren();
  const root = el('div', 'gs');
  const gridView = el('main', 'stage');
  const mapView = el('main', 'stage-map');
  root.append(gridView, mapView);
  app.append(root);

  const ledger = new Ledger({ startingCash: STARTING_CASH });
  const pb = new Pushback({ ledger, seed: Number(params.get('seed') ?? Date.now() % 100000) });
  const tree = new ResearchTree({ ledger }); // R&D costs cash up front; RP comes from crisis grants (#16)
  const clock = new CampaignClock({ quarterSeconds: QS });
  const ui = createGameUI({ root, ledger, views: { grid: gridView, map: mapView } });
  const pbui = createPushbackUI({ root, pushback: pb });
  // Doom Clock: fed by the crisis system's open roster tracks (below); a Final Countdown can bring Midnight early.
  const doom = new DoomClock();
  createDoomClockHud({ clock: doom, hud: root.querySelector('.hud') });
  const gauge = createPressureGauge({ root, pushback: pb, getQuarterProfit: () => ledger.summary(ledger.quarter).net,
    onRelief: (r) => r && pbui.tick(`${r.kind === 'layLow' ? 'Laid low' : 'Funded relief'}: -$${Math.round(r.cost / 1000)}K`, 'ok') });
  const research = createResearchPanel({ root, tree, getCrisis: () => pb.tension, mode: 'weekly' });
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
  // Tile-level bunker (RimWorld-style): dig, wall, wire and furnish; rooms form from what you enclose.
  // Company tier and departments (#73, L0): Startup = 1 site, 2 crews, department cap 2. Engineering speeds crews.
  const company = new Company({ ledger, getPlayMinutes: () => (clock.total / clock.quarterSeconds) * 27 });
  slot.register('company', company);
  const workingCrews = () => company.crews(1 + tree.crewCount); // the tier's crews, research adds more, the tier caps them
  const companyPanel = createCompanyPanel({ root, company, getWorkingCrews: workingCrews });
  root.querySelector('.hud')?.insertBefore(companyPanel.chip, root.querySelector('.view-toggle'));
  const grid = new BunkerSite({ ledger, costMultiplier: () => pb.board.buildCostMultiplier, crews: workingCrews, crewSpeed: () => company.crewSpeed, research: tree });
  const gridUI = createBunkerUI({ mount: gridView, grid, getFrame: () => frame, onHandOver: (sh) => { mapSales.addFinished(sh); mapScreen.refresh(); } });
  slot.register('grid', grid);

  // ---------- the world: crisis tracks, weekly leads, schemes and map sales ----------
  const worldSeed = Number(params.get('seed') ?? 11);
  // The six roster tracks (#33) are the world's crises (#69). Each rolls its hidden tipping point now and stays
  // closed until its opening time; Doom Clock fragility lowers that roll from day one, so a late track opens fragile.
  if (resume) roster = slot.peek()?.parts?.world?.roster ?? roster;
  const crisis = new CrisisSystem({
    seed: worldSeed, pushback: pb, doomClock: doom, ledger, shelters: () => mapSales.sheltersForMidnight(),
    tracks: roster.map((id) => ({ id, name: TRACK_BY_ID[id].name, open: false })),
    links: rosterLinks(roster).map((l) => [l.from, l.to, l.strength]),
  });
  const tensions = () => Object.fromEntries(Object.values(crisis.tracks).map((t) => [t.id, t.tension]));
  const market = new LeadMarket({ seed: worldSeed + 1, reputation: () => crisis.reputation });
  market.ownSite('nam'); // HQ
  market.week({ tensions: tensions() });
  attachCrisis(market, crisis); // a market week runs after every crisis week
  const schemes = new SchemeBoard({ crisis, market, ledger, pushback: pb, isUnlocked: (id) => tree.isUnlocked(id), getHeatMultiplier: () => tree.schemeHeatMult });
  // The crisis dividend (#16): every week each track pays research grants by its band (Simmer/Boil/Brink).
  crisis.on('week', () => tree.fundWeek(Object.values(crisis.tracks)));
  const mapSales = new MapSales({ market, ledger, pushback: pb, getTensions: tensions, getBreachMultiplier: () => crisis.panicMultiplier,
    getEdgeBonus: (id) => schemes.edgeBonus(id), getQuarter: () => clock.quarter });
  // Your leads: people met at events (director note D2). Redeemed on the world map for better sales (#58).
  const leads = new LeadInventory({ getQuarter: () => clock.quarter, getReputation: () => crisis.reputation });
  slot.register('leads', leads);

  // Social events (director note D2, #60): go to events, talk to guests, come home with leads.
  // Placeholder text-only screens over the SocialSession view-model; the catalog loads async.
  const social = { session: null, screens: null };
  const eventsBtn = el('button', 'view-btn', 'EVENTS');
  eventsBtn.type = 'button';
  eventsBtn.disabled = true;
  eventsBtn.title = 'Go to social events and meet buyers (E)';
  eventsBtn.onclick = () => social.screens?.toggle();
  root.querySelector('.view-toggle')?.prepend(eventsBtn);
  loadVenueCatalog().then((catalog) => {
    if (session?.ledger !== ledger) return; // campaign was replaced while loading
    const circuit = new EventCircuit({ catalog, ledger, seed: worldSeed, clock,
      addHeat: (n, why) => pb.addHeat(n, why), addReputation: (n) => { crisis.reputation = Math.max(0, Math.min(100, crisis.reputation + n)); } });
    slot.register('events', circuit);
    if (resume) { const saved = slot.peek(); if (saved?.parts?.events) circuit.load(saved.parts.events); }
    social.session = new SocialSession({ circuit, leads, getQuarter: () => clock.quarter, getCash: () => ledger.cash, getWorld: () => worldState({ crisis, schemes }),
      addHeat: (n, why) => pb.addHeat(n, why), addReputation: (n) => { crisis.reputation = Math.max(0, Math.min(100, crisis.reputation + n)); } });
    social.screens = createSocialScreens({ root: document.body, social: social.session, onClose: () => { ui.update(hudState()); mapScreen.refresh(); } });
    social.session.onChange(() => ui.update(hudState()));
    eventsBtn.disabled = false;
  }).catch((err) => { eventsBtn.title = `Events unavailable: ${err.message}`; });
  const mapScreen = createWorldMapScreen({ root: mapView, sales: mapSales, schemes, leads, initial: 'nam', onScheme: () => ui.update(hudState()), onSold: () => ui.update(hudState()) });
  createContainmentUI({ root: document.body, crisis, onAdvanceWeek: () => crisis.advanceWeek() });
  crisis.on('week', () => mapScreen.refresh());
  slot.register('sales', mapSales);
  // Crisis profits fund the labs too: the panic-premium share of every map sale becomes RP (#16).
  mapSales.onChange((e) => { if (e.type === 'sale' && e.record.premium > 1) tree.fundFromIncome(e.record.price * (1 - 1 / e.record.premium), `${e.record.owner}'s panic premium`); });
  const WEEK_SECONDS = clock.quarterSeconds / 13; // 13 in-game weeks a quarter
  let weekAcc = 0;
  tree.onUnlock?.(() => { gridUI.refresh(); mapScreen.refresh(); });
  // The threat roster this campaign runs (6 slots; alternates chosen at the world setup screen).
  const world = { roster: [...roster], opened: [] };
  slot.register('crisis', crisis);
  slot.register('world', { toJSON: () => ({ roster: world.roster, opened: world.opened }), load: (d) => { if (d.roster?.length === 6) world.roster = d.roster; world.opened = d.opened ?? []; } });
  if (resume) slot.load(); else slot.clear();
  delete doom.tensions.world; // saves from before #69 carried pushback's stand-in track
  for (const id of world.opened) crisis.openTrack(id); // already a no-op for tracks the crisis save reopened
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
  const threatsBtn = el('button', null, 'THREATS [T]');
  threatsBtn.title = 'The six threat tracks in this world, when they open, and every scheme';
  threatsBtn.onclick = () => threats.toggle();
  bar.append(label, time, track, speeds, threatsBtn, endBtn, saveBtn, menuBtn);
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
    ledger.record('upkeep', `Shovel crew payroll x${workingCrews()}`, -45_000 * workingCrews());
    pbui.hold();
    const r = pb.endQuarter({ quarter, profit: ledger.summary(quarter).net });
    if (r.board.met) audio.play('boardMet');
    await ui.showQuarterReport({ quarter, board: r.board, heat: pb.heat, tension: pb.tension, notes: r.lines.slice(1) });
    await pbui.drain();
    if (pb.board.ousted) { clock.hold('ousted'); slot.clear(); showOusted(quarter); return; }
    if (!isFinal) toast(`Quarter ${quarter + 1} begins. The board wants growth.`);
  });
  // Campaign play time in minutes at x1 (27 per quarter), the scale the GDD's opening times use.
  const campaignMinutes = () => (clock.total / clock.quarterSeconds) * 27;
  const threats = createThreatsPanel({ root: document.body, getRoster: () => world.roster, getMinutes: campaignMinutes });
  function openDueTracks() {
    const m = campaignMinutes();
    for (const id of world.roster) {
      const t = TRACK_BY_ID[id];
      if (t.opensAt <= m && !world.opened.includes(id)) {
        world.opened.push(id);
        crisis.openTrack(id, { tension: TRACK_OPEN_TENSION });
        toast(`THREAT OPENS: ${t.name}. ${t.premise}.`);
      }
    }
  }
  // The Doom Clock counts real in-game weeks (13 a quarter), so a Final Countdown runs week by week.
  // Synced from the campaign clock, so skipped quarters and loaded saves land on the right week.
  const syncDoomWeeks = () => {
    const target = (clock.quarter - 1) * 13 + Math.floor(clock.elapsed / WEEK_SECONDS);
    if (target > doom.week) doom.advanceWeeks(target - doom.week);
  };
  clock.onQuarterStart(({ quarter }) => {
    syncDoomWeeks();
    ledger.setQuarter(quarter);
    leads.expire(quarter); // unused leads go cold on schedule
    const chapter = CHAPTER_STARTS[quarter]; // GDD Pacing: chapters 2-5 start at Q3, Q5, Q8 and Q11
    if (chapter) doom.chapterStart(chapter);
    slot.save(); // autosave at every quarter close
    ui.update(hudState());
  });
  let midnightStarted = false;
  // road: null = the end of Q12 (still graded straight away); an uncontrolledRoad = the Doom Clock struck zero or
  // the Final Countdown ran out, which runs the Midnight sequence: the strike, the Seal Order, the grade (#70).
  async function midnight(road = null) {
    if (midnightStarted) return;
    midnightStarted = true;
    markCampaignFinished();
    clock.hold('midnight');
    slot.clear();
    renderBar();
    const world = { tension: pb.tension, heat: pb.heat, runaways: pb.runaways, collapses: doom.collapses.length };
    const { tolls, boom } = midnightTimes();
    let result;
    if (road) {
      const clients = sealOrderClients({ sold: mapSales.sold, pushback: pb, crisis, regions: SALES_REGIONS });
      const run = resolveUncontrolled({ road, shelters: shelters(), clients, world, cash: ledger.cash, seed: worldSeed });
      result = run.result;
      audio.midnight(result.type);
      await showClockStrike({ root: document.body, tolls: tolls.map((s) => s + 0.05), duration: boom + 0.05 });
      if (run.seal.length) await showSealOrder({ root: document.body, results: run.seal });
    } else {
      // #17: quarter 12 ran out. The apocalypse is the one the world was heading for (collapsed > breached >
      // Brink > hottest), and control counts the crisis tracks' real breaches and collapses.
      const fin = finaleArgs({ crisis, pushback: pb, shelters: shelters(), cash: ledger.cash });
      result = computeMidnight({ ...fin, world: { ...fin.world, collapses: Math.max(fin.world.collapses, world.collapses) } });
      audio.midnight(result.type);
      await showClockStrike({ root: document.body, tolls: tolls.map((s) => s + 0.05), duration: boom + 0.05 });
    }
    session && (session.midnightResult = result);
    await showMidnight({ root: document.body, result, onRestart: () => { document.querySelectorAll('.mn-overlay').forEach((n) => n.remove()); session.destroy(); showMainMenu(); } });
  }
  clock.onMidnight(() => midnight());
  // The Doom Clock can strike before Q12 ends: that is the uncontrolled road.
  doom.on('midnight', (e) => midnight(uncontrolledRoad({ reason: e.reason, crisis, doom })));
  clock.onChange(renderBar);
  pb.on('change', () => ui.update(hudState()));
  ledger.onChange(() => { ui.update(hudState()); gauge.render(); });

  // Modals hold the clock: quarter report and choice cards pause time.
  // ---------- weekly headline card (#74, L0): one card every in-game week; the clock holds while it's open ----------
  const deck = new WeeklyDeck({ seed: worldSeed + 7 });
  slot.register('weekly', deck);
  // First-breach nudge (#68): no breach by 2:30, and a wildcard pushes a Brink track over.
  const firstBreach = new FirstBreachNudge({ crisis, minutes: () => campaignMinutes() });
  slot.register('firstBreach', firstBreach);
  if (resume) { const saved = slot.peek(); if (saved?.parts?.firstBreach) firstBreach.load(saved.parts.firstBreach); }
  const cardQueue = [];
  let cardOpen = false;
  const campaignWeek = () => (clock.quarter - 1) * 13 + Math.floor(clock.elapsed / WEEK_SECONDS);
  const trackName = (id) => TRACK_BY_ID[id]?.name ?? id;
  const cardHooks = {
    addTension: (track, n, why) => {
      if (track && crisis.tracks[track]?.open) crisis.addTension(track, n, why);
      else pb.addTension(n, why); // general cards, or a track not in play: the world's tension takes it
    },
    addHeat: (n, why) => pb.addHeat(n, why),
    addCash: (label, n) => ledger.record('other', label, n),
    addReputation: (n) => { crisis.reputation = Math.max(0, Math.min(100, crisis.reputation + n)); },
    addResearch: (n) => { tree.pool += n; },
    note: (text) => toast(text),
  };
  async function pumpCards() {
    if (cardOpen || !cardQueue.length || modalOpen() || midnightStarted) return;
    cardOpen = true;
    const { card, week, special } = cardQueue.shift();
    const pick = await showWeeklyCard({ root: document.body, card, week, trackName, canAfford: (cost) => ledger.cash >= cost });
    if (!special) deck.chose(week, pick);
    const r = applyChoice(card, pick, cardHooks, trackName);
    pb._changed?.();
    ui.update(hudState());
    toast(`${card.title}: ${r.choice.label}${r.applied.length ? ` (${r.applied.join(', ')})` : ''}`);
    cardOpen = false;
  }
  function drawWeeklyCard() {
    const week = campaignWeek();
    if (week < 1) return;
    const card = deck.draw(week);
    if (card) cardQueue.push({ card, week });
  }

  const modalOpen = () => !!document.querySelector('.report-overlay:not([hidden]), .br-overlay:not([hidden]), .pb-overlay, .mn-overlay, .mn-strike, .soc-overlay:not([hidden]), .cp-overlay:not([hidden])');

  // ---------- keys ----------
  const onKey = (e) => {
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); clock.togglePause(); }
    else if (e.key === '.' || e.key === '>') clock.setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(clock.speed) + 1)] ?? 1);
    else if (e.key === ',' || e.key === '<') clock.setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(clock.speed) - 1)] ?? 1);
    else if (e.key === 'n' || e.key === 'N') { if (!modalOpen()) clock.skipQuarter(); }
    else if ((e.key === 'e' || e.key === 'E') && social.screens && !modalOpen()) social.screens.toggle();
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
      openDueTracks();
      grid.tick(g);
      weekAcc += g;
      while (weekAcc >= WEEK_SECONDS) { weekAcc -= WEEK_SECONDS; crisis.advanceWeek(); }
      syncDoomWeeks();
      drawWeeklyCard();
      const wild = firstBreach.check();
      if (wild) cardQueue.unshift({ card: wild, week: campaignWeek(), special: true });
    }
    clock.tick(dt);
    pumpCards();
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
    clock, doom, gauge, ledger, pb, tree, ui, grid, gridUI, shelters, world, threats, campaignMinutes, crisis, market, schemes, mapSales, mapScreen, slot, leads, social, company, firstBreach,
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener('keydown', onKey);
      social.screens?.destroy();
      companyPanel.destroy();
      removeEventListener('resize', fit);
      gridUI.destroy();
      ui.destroy();
      threats.destroy();
      app.replaceChildren();
      session = null;
    },
  };
  window.__game = session;
  // Debug presets for a NEW campaign: ?preset=countdown | clockzero (add &qs=26 for 2-second weeks).
  const preset = DEBUG_PRESETS[params.get('preset')];
  if (!resume && preset) preset(session);
}

// ======================= Debug presets (#70) =======================
// Both set up a world with every threat open and three shelters sold (one built for the end of the world, one full
// of gold taps, one in between), then take the uncontrolled road to Midnight.
const PRESET_SHELTERS = [
  { region: 'nam', name: 'The Deep Vault', occupants: 6, rooms: ['bunk', 'bunk', 'air_vent', 'water_tank', 'pantry', 'hydroponics', 'water_recycler', 'mil_scrubber'], sealed: { daysSealed: 1500, ratings: { seal: 5, blast: 5, security: 4, morale: 3 } } },
  { region: 'eur', name: 'Gold Tap Grotto', occupants: 6, rooms: ['bunk', 'bunk', 'gold_taps', 'gold_taps', 'cryo_pod', 'wine_cellar', 'air_vent'], sealed: { daysSealed: 60, ratings: { seal: 1, blast: 1, security: 1, morale: 4 } } },
  { region: 'eas', name: 'Silo No. 7', occupants: 8, rooms: ['bunk', 'bunk', 'bunk', 'air_vent', 'air_vent', 'water_tank', 'water_tank', 'pantry', 'pantry'], sealed: { daysSealed: 500, ratings: { seal: 3, blast: 3, security: 2, morale: 2 } } },
];
function presetWorld(g) {
  for (const id of g.world.roster) { if (!g.world.opened.includes(id)) g.world.opened.push(id); g.crisis.openTrack(id, { tension: 45 }); }
  for (const sh of PRESET_SHELTERS) {
    const s = g.mapSales.addFinished(sh);
    g.market.addLeads(sh.region, 1);
    g.mapSales.sell(sh.region, s.id);
  }
  g.mapScreen.refresh();
}
function collapseTrack(g, id) {
  g.crisis.setTension(id, 100);
  for (let i = 0; i < 8 && g.crisis.tracks[id].state === 'breach'; i++) g.crisis.advanceWeek();
}
const DEBUG_PRESETS = {
  // Two collapses: the Final Countdown starts, and Midnight comes 4 in-game weeks later.
  countdown(g) {
    presetWorld(g);
    for (const id of g.world.roster.slice(2)) g.crisis.setTension(id, 25); // low enough that the dominoes don't tip a third
    collapseTrack(g, g.world.roster[0]);
    collapseTrack(g, g.world.roster[1]);
  },
  // The floor falls to zero a few seconds in: the Doom Clock strikes.
  clockzero(g) {
    presetWorld(g);
    for (const id of g.world.roster) g.crisis.setTension(id, 70);
    setTimeout(() => g.doom._drop(g.doom.floor, 'debug', 'preset: clock zero'), 3000);
  },
};

showMainMenu();
window.__menu = { showMainMenu, startCampaign };
