// Game entry: main menu -> campaign (HUD, shelter/world views, clock) -> Midnight.
//
// Systems that exist today are wired here: ledger, pushback (heat/tension/board), research,
// audio, the quarter report and the Midnight ending. The shelter grid and world map views
// are placeholders until their tasks land; they should replace drawGridView/drawMapView.

import { Ledger } from '../ledger/ledger.js';
import { MONEY } from '../config/tuning.js';
import { createGameUI } from '../ui/hud.js';
import { installTheme } from '../ui/theme.js';
import { installPixelPerfect, sizeCanvas, dpr } from '../ui/pixel-perfect.js';
import { createResearchPanel } from '../ui/researchPanel.js';
import { Pushback } from '../pushback/pushback.js';
import { Board, quarterRevenue } from '../board/board.js';
import { createPushbackUI } from '../pushback/pushback-ui.js';
import { createPressureGauge } from '../pushback/pressure-gauge.js';
import { Press } from '../pushback/press.js';
import { createPressDesk, createReputationChip, createFrontPage } from '../pushback/press-ui.js';
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
import { MegaprojectBoard } from '../shelter/megaprojects.js';
import { createMegaprojectScreen } from '../shelter/megaprojects-ui.js';
import { MEGAPROJECTS } from '../config/tuning.js';
import { moodOf } from '../art/atmosphere.js';
import { CrisisSystem } from '../crisis/breach.js';
import { CrisisConsequences } from '../crisis/consequences.js';
import { createContainmentUI } from '../crisis/breach-ui.js';
import { LeadMarket, attachCrisis } from '../demand/demand.js';
import { SchemeBoard, researchCrisis } from '../schemes/schemes.js';
import { MapSales } from '../worldmap/sales.js';
import { createWorldMapScreen } from '../worldmap/worldmap-ui.js';
import { TRACK_BY_ID, CLASSIC_ROSTER, rosterLinks, rosterPicksFromParams, slotOf, resolveTrack, hm } from '../world/tracks.js';
import { showWorldSetup, createThreatsPanel } from '../world/world-ui.js';
import { CampaignClock, SPEEDS, formatClock, QUARTER_SECONDS } from './clock.js';
import { createSaveSlot, ledgerSaveable, pushbackSaveable, doomClockSaveable } from './save.js';
import { finaleArgs } from '../midnight/finale.js';
import { EndingWatch } from '../midnight/endings.js';
import { epilogues, buildLedger } from '../midnight/epilogues.js';
import { showFinale } from '../midnight/endings-ui.js';
import { Company } from '../company/company.js';
import { createCompanyPanel } from '../company/company-panel.js';
import { StoryBeats } from '../story/beats.js';
import { showBeat } from '../story/beat-ui.js';
import { Telemetry } from '../telemetry/telemetry.js';
import { LeadInventory } from '../leads/leads.js';
import { DIFFICULTIES, DIFFICULTY_ORDER, DEFAULT_DIFFICULTY, difficultySettings } from '../config/difficulty.js';
import { loadVenueCatalog } from '../events/venues.js';
import { EventCircuit } from '../events/attend.js';
import { WeeklyDeck, applyChoice } from '../events/weekly.js';
import { FirstBreachNudge } from '../crisis/first-breach.js';
import { showWeeklyCard } from '../events/weekly-ui.js';
import { SocialSession } from '../social/viewmodel.js';
import { worldState } from '../dialogue/world-state.js';
import { createSocialScreens } from '../social/text-screens.js';
import { settings, keyHint } from '../settings/settings.js';
import { createSettingsPanel } from '../settings/settings-ui.js';

export const STARTING_CASH = MONEY.startingCash; // GDD $M scale (#91)
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
// The title screen's sound toggle writes the shared mute preference; it never starts audio itself.
const menuAudio = createAudio();
let menuKeyOff = null; // the title screen's M key, removed whenever the title screen goes away

function showMainMenu() {
  menuKeyOff?.();
  app.replaceChildren();
  const mm = el('div', 'mm');
  const sky = el('canvas', 'mm-sky');
  // #127: the sky is painted at the window's size divided by a whole device scale, so it is never stretched
  // (it was a 320x180 picture stretched to the window: 10.75 x 8 pixels on an ultrawide)
  const paintSky = () => {
    const k = Math.max(1, Math.round((innerHeight * dpr()) / 180));
    sky.width = Math.ceil((innerWidth * dpr()) / k); sky.height = Math.ceil((innerHeight * dpr()) / k);
    sizeCanvas(sky, sky.width, sky.height, k);
    drawMenuSky(sky.getContext('2d'), sky.width, sky.height);
  };
  paintSky();
  addEventListener('resize', paintSky);
  const save = slot.peek();
  const start = el('button', null, 'NEW CAMPAIGN');
  const cont = el('button', null, 'CONTINUE');
  const sub = el('div', 'mm-sub', save ? describeSave(save) : 'No saved campaign');
  cont.disabled = !save;
  const demos = el('a', 'mm-link', 'System demos');
  demos.href = 'demos.html';
  // The first campaign is always Classic; after one is finished, NEW CAMPAIGN opens the world setup.
  const begin = () => (campaignsFinished() > 0 ? openSetup() : (leave(), startCampaign({ resume: false, roster: [...CLASSIC_ROSTER] })));
  // One save slot (#80): starting over replaces it, so ask first (#81).
  const confirmBox = el('div', 'mm-confirm');
  confirmBox.hidden = true;
  start.onclick = () => {
    if (!save) return begin();
    confirmBox.hidden = false;
    confirmBox.replaceChildren(el('div', null, `Start over? Your saved campaign (${describeSave(save)}) will be replaced.`));
    const yes = el('button', null, 'START OVER');
    const no = el('button', 'mm-small', 'KEEP MY SAVE');
    yes.onclick = () => begin();
    no.onclick = () => { confirmBox.hidden = true; cont.focus(); };
    confirmBox.append(yes, no);
    no.focus();
  };
  // Sound (#81): the same saved preference the in-game SOUND toggle uses. Nothing plays on the title screen.
  const sound = el('button', 'mm-small mm-sound');
  const renderSound = () => { sound.textContent = menuAudio.muted ? 'SOUND: OFF' : 'SOUND: ON'; sound.setAttribute('aria-pressed', String(!menuAudio.muted)); };
  sound.title = 'Mute or unmute the game [M]';
  sound.onclick = () => { menuAudio.setMuted(!menuAudio.muted); renderSound(); };
  renderSound();
  const onKey = (e) => { if (settings.matches(e, 'mute')) sound.click(); };
  addEventListener('keydown', onKey);
  const leave = () => { removeEventListener('keydown', onKey); menuKeyOff = null; };
  menuKeyOff = leave;
  // Difficulty (#92): applies to the next NEW CAMPAIGN; remembered between visits.
  const diffRow = el('div', 'mm-diff');
  const renderDiff = () => {
    diffRow.replaceChildren(el('span', 'mm-diff-label', 'DIFFICULTY'));
    for (const id of DIFFICULTY_ORDER) {
      const d = DIFFICULTIES[id];
      const b = el('button', 'mm-small mm-diff-btn', d.label.toUpperCase());
      b.setAttribute('aria-pressed', String(chosenDifficulty() === id));
      b.title = `${d.for}. Tipping points ${d.tipRange[0]}-${d.tipRange[1]}, Brink drift +${d.brinkDrift}/week, heat cools ${d.heatDecayPerWeek}/week, quota +${Math.round(d.quotaGrowth * 100)}% a quarter.`;
      b.onclick = () => { chooseDifficulty(id); renderDiff(); };
      diffRow.append(b);
    }
    const d = DIFFICULTIES[chosenDifficulty()];
    diffRow.append(el('div', 'mm-diff-note', `${d.for}: tipping points ${d.tipRange[0]}-${d.tipRange[1]}, quota +${Math.round(d.quotaGrowth * 100)}% a quarter.`));
  };
  renderDiff();
  const setup = el('button', 'mm-small', 'WORLD SETUP');
  setup.title = 'Choose Classic, Random or Custom threat tracks (debug start)';
  setup.onclick = () => openSetup();
  const openSetup = () => showWorldSetup({ root: document.body, firstCampaign: campaignsFinished() === 0,
    onStart: (roster) => { leave(); startCampaign({ resume: false, roster }); }, onBack: () => start.focus() });
  cont.onclick = () => { leave(); startCampaign({ resume: true }); };
  mm.append(sky, el('div', 'mm-title', 'APOCALYPSE TYCOON'), el('div', 'mm-tag', "You don't survive the apocalypse. You sell it."),
    start, cont, confirmBox, diffRow, setup, sound, sub, demos, el('div', 'mm-foot', 'LAST RESORT HOLDINGS · 12 QUARTERS TO MIDNIGHT'));
  app.append(mm);
  (save ? cont : start).focus();
}

function describeSave(save) {
  const c = save.parts?.clock;
  const when = new Date(save.savedAt).toLocaleString();
  return c ? `Quarter ${c.quarter}/12 · saved ${when}` : `Saved ${when}`;
}

function drawMenuSky(c, W = 320, H = 180) {
  // laid out on a 180-high scene (ground at 145) anchored to the bottom, as wide as the window
  const oy = H - 180, cx = Math.floor(W / 2);
  c.fillStyle = '#14110f'; c.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stars = Math.round((90 * W * (110 + oy)) / (320 * 110));
  for (let i = 0; i < stars; i++) { c.fillStyle = rnd() > 0.7 ? '#f2e6c9' : '#6a5d4a'; c.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * (110 + oy)), 1, 1); }
  c.fillStyle = '#ff5a4f'; c.fillRect(0, oy + 128, W, 1); // the glow on the horizon
  c.fillStyle = '#241f1a';
  for (let x = 0; x < W;) { const w = 8 + Math.floor(rnd() * 18); const h = 14 + Math.floor(rnd() * 34); c.fillRect(x, oy + 145 - h, w - 1, h); x += w; }
  c.fillStyle = '#3b2a1e'; c.fillRect(0, oy + 145, W, 35);
  c.fillStyle = '#5a7a3a'; c.fillRect(0, oy + 145, W, 2);
  // bunker hatch, centred
  c.fillStyle = '#4a3f33'; c.fillRect(cx - 8, oy + 140, 16, 6);
  c.fillStyle = '#a8977a'; c.fillRect(cx - 6, oy + 137, 12, 3);
  c.fillStyle = '#f5c542'; c.fillRect(cx - 1, oy + 141, 2, 3);
}

// ======================= Campaign =======================
let session = null;

const DIFFICULTY_KEY = 'apocalypse-tycoon.difficulty';
function chosenDifficulty() {
  const fromUrl = params.get('difficulty');
  if (DIFFICULTIES[fromUrl]) return fromUrl;
  try { const v = localStorage.getItem(DIFFICULTY_KEY); return DIFFICULTIES[v] ? v : DEFAULT_DIFFICULTY; } catch { return DEFAULT_DIFFICULTY; }
}
function chooseDifficulty(id) { try { localStorage.setItem(DIFFICULTY_KEY, id); } catch { /* private mode */ } }

const FINISHED_KEY = 'apocalypse-tycoon.campaigns-finished';
function campaignsFinished() {
  try { return Number(localStorage.getItem(FINISHED_KEY)) || 0; } catch { return 0; }
}
function markCampaignFinished() {
  try { localStorage.setItem(FINISHED_KEY, String(campaignsFinished() + 1)); } catch { /* ignore */ }
}

function startCampaign({ resume, roster = [...CLASSIC_ROSTER], difficulty = chosenDifficulty() }) {
  session?.destroy();
  app.replaceChildren();
  const root = el('div', 'gs');
  const gridView = el('main', 'stage');
  const mapView = el('main', 'stage-map');
  root.append(gridView, mapView);
  app.append(root);

  const ledger = new Ledger({ startingCash: STARTING_CASH });
  // Seeds (#80): a resumed campaign reuses the seeds it was started with, whatever the address says now.
  const savedMeta = resume ? slot.peek()?.parts?.meta : null;
  const seeds = savedMeta?.seeds ?? { pushback: Number(params.get('seed') ?? Date.now() % 100000), world: Number(params.get('seed') ?? 11) };
  // Difficulty (#92): chosen on the title screen, kept in the save; a resumed campaign keeps its own.
  if (savedMeta) difficulty = savedMeta.difficulty ?? DEFAULT_DIFFICULTY;
  const diff = difficultySettings(difficulty);
  slot.register('meta', { toJSON: () => ({ seeds, difficulty: diff.id, savedAtQuarter: clock.quarter }), load: () => {} });
  const pb = new Pushback({ ledger, seed: seeds.pushback, config: { board: { enabled: false }, heat: diff.pushback.heat } });
  // The board (#18): five members, a revenue quota +30% a quarter, two directives per meeting.
  // Replaces pushback's legacy three-strikes target in the campaign.
  const board = new Board({ ledger, seed: seeds.world, config: diff.board,
    supports: ['revenue', 'heat', 'tensions', 'brinkTracks', 'breaches', 'handovers', 'schemesRun'] });
  board.onChange(() => { pb.schemeHeatMultiplier = board.schemeHeatMultiplier; });
  const qStats = { handovers: 0, breaches: 0, schemesAtStart: 0, crisisConfidence: null };
  const tree = new ResearchTree({ ledger }); // R&D costs cash up front; RP comes from crisis grants (#16)
  const clock = new CampaignClock({ quarterSeconds: QS });
  let fitRef = null; // set once the canvases exist; re-fit when the player switches canvas (the map needs a visible width)
  const ui = createGameUI({ root, ledger, views: { grid: gridView, map: mapView }, onViewChange: () => requestAnimationFrame(() => fitRef?.()) });
  const pbui = createPushbackUI({ root, pushback: pb });
  // Doom Clock: fed by the crisis system's open roster tracks (below); a Final Countdown can bring Midnight early.
  const doom = new DoomClock();
  // #130: the mood of the whole game (lighting and colour grade): tension and the Doom Clock, or a forced preset
  // for comparisons (?mood=calm|edge|runaway, or __game.setMood('edge') from the console; null goes back to live).
  let moodForce = new URLSearchParams(location.search).get('mood');
  const mood = () => moodOf({ tension: pb.tension, minutes: doom.minutes, startMinutes: doom.cfg.startMinutes, force: moodForce });
  createDoomClockHud({ clock: doom, hud: root.querySelector('.hud') });
  const gauge = createPressureGauge({ root, pushback: pb, getQuarterProfit: () => ledger.summary(ledger.quarter).net,
    getBoard: () => ({ progress: quarterRevenue(ledger, ledger.quarter), target: board.quota, ousted: board.ousted,
      zone: { bullish: 'content', steady: 'content', scrutiny: 'displeased', probation: 'last-chance', ousted: 'ousted' }[board.state.id],
      label: `Revenue quota · confidence ${Math.round(board.average)} ${board.state.label}` }),
    onRelief: (r) => r && pbui.tick(`${r.kind === 'layLow' ? 'Laid low' : 'Funded relief'}: -$${(r.cost / 1e6).toFixed(2)}M`, 'ok') });
  // Research reads the crisis tracks (#90): each track rescaled so it peaks just below its own tipping point.
  const research = createResearchPanel({ root, tree, getCrisis: () => (pb.crisis ? researchCrisis(pb.crisis) : 0), mode: 'weekly' });
  root.querySelector('.hud')?.insertBefore(research.chip, root.querySelector('.view-toggle'));
  const audio = createAudio();
  wireAudio(audio, { ledger, pushback: pb });
  startOnFirstGesture(audio);
  root.querySelector('.view-toggle')?.append(createSoundToggle(audio));

  slot.register('clock', clock);
  slot.register('ledger', ledgerSaveable(ledger));
  slot.register('pushback', pushbackSaveable(pb, Pushback));
  slot.register('board', board);
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
  const grid = new BunkerSite({ ledger, costMultiplier: () => pb.board.buildCostMultiplier, crews: workingCrews, crewSpeed: () => company.crewSpeed, research: tree,
    catalog: { minutes: () => (clock.total / clock.quarterSeconds) * 27, roster: () => roster } }); // #140 catalog rooms on schedule
  const gridUI = createBunkerUI({ mount: gridView, grid, getFrame: () => frame, getMood: () => mood(), onHandOver: (sh) => { qStats.handovers += 1; mapSales.addFinished(sh); mapScreen.refresh(); } });
  slot.register('grid', grid);

  // ---------- the world: crisis tracks, weekly leads, schemes and map sales ----------
  const worldSeed = seeds.world;
  // The six roster tracks (#33) are the world's crises (#69). Each rolls its hidden tipping point now and stays
  // closed until its opening time; Doom Clock fragility lowers that roll from day one, so a late track opens fragile.
  if (resume) roster = slot.peek()?.parts?.world?.roster ?? roster;
  // Debug roster swap (#75): ?greygoo puts The Grey Goo in slot 2; ?slot3=longshade etc. New campaigns only.
  else { const picks = rosterPicksFromParams(params); roster = roster.map((id) => picks[slotOf(id)] ?? id); }
  const crisis = new CrisisSystem({
    seed: worldSeed, pushback: pb, doomClock: doom, ledger, shelters: () => mapSales.sold, // live records: breaches can cost occupants
    // the HQ grid is the site under construction (in North America, where the HQ site is)
    construction: () => (grid.jobs.length ? [{ id: 'hq', name: grid.name, region: 'nam', delay: (d) => grid.delay(d) }] : []),
    tracks: roster.map((id) => ({ id, name: TRACK_BY_ID[id].name, open: false })),
    links: rosterLinks(roster).map((l) => [l.from, l.to, l.strength]),
    rdLevel: () => company.level('rnd'), // crash research needs R&D level 2 (#64)
    spendRp: (rp) => (tree.pool >= rp ? ((tree.pool -= rp), true) : false), // ...and costs 40 RP a breach week
    config: diff.crisis, // tipping-point range and Brink drift by difficulty (#92)
  });
  // One tension model (#90): pushback's world meter is retired; its tension is the hottest crisis track, its
  // runaways are collapsed tracks, and the HUD, audio, quarter report and Midnight all read that.
  pb.useCrisis(crisis);
  // Heat (#148): decays 1 a week (difficulty base) + 1 per Communications level, never below Notoriety (0/5/10/20/30
  // by company tier); the GDD heat levels run their effects in weekTick.
  pb.getCommsLevel = () => company.level('comms');
  pb.getTierIndex = () => company.tierIndex;
  crisis.on('week', () => pb.weekTick()); // heat cools weekly by difficulty (#92)
  let auditSecondsLeft = 0; // Investigation: one site audited a quarter, construction stops for a week
  pb.on('audit', (e) => { auditSecondsLeft = e.weeks * WEEK_SECONDS; toast('INVESTIGATION: regulators audit the site. Construction stops for a week.'); });
  pb.on('hearing', (e) => {
    crisis.reputation = Math.max(0, Math.min(100, crisis.reputation + e.reputation));
    for (const id of Object.keys(board.confidence ?? {})) board.react(id, e.boardConfidence, 'Public hearing');
    toast(`PUBLIC HEARING: reputation ${e.reputation}, board confidence ${e.boardConfidence}, new leads ${Math.round(e.newLeads * 100)}%.`);
  });
  pb.on('indictment', (e) => { if (e.weeksLeft > 0) toast(`EXPOSED: indictment proceedings. ${e.weeksLeft} week${e.weeksLeft === 1 ? '' : 's'} to get heat below 95.`); });

  // ---------- journalists (#149) ----------
  // Iris Kemp and Gil Marsh build stories every week: 2% + 1% per 10 heat (Gil 2.5x as fast). At 100% the story
  // runs: heat +25, reputation -15, every client +10 leverage, and Gil's scare also pushes a random open track +5.
  // Reputation is the crisis system's, the one that sets lead quality. Nobody digs before 1:00, when Iris calls for
  // comment (GDD unlock row 12). Counters are paid from the ledger. Sieges come with #150.
  // Sieges (#150): once The Pitchforks opens, every site in its hot regions faces the mob each week:
  // strength = Pitchforks tension / 20 + visible surface features, against the site's security rating.
  const PITCHFORKS_REGIONS = SALES_REGIONS.filter((r) => ['high', 'medium'].includes(r.exposure.pitchforks)).map((r) => r.id);
  const siegeSites = () => {
    const hq = grid.objects.size ? (() => { const sim = grid.simulate(); return [{ id: 'hq', name: `${grid.name} (HQ)`, region: 'nam', security: sim.ratings.security,
      visible: Math.max(0, sim.visibility ?? 0), decoy: [...grid.objects.values()].some((o) => o.kind === 'decoy') }]; })() : [];
    // Sold shelters keep the ratings they were handed over with; prefab ones (no grid) count as security 1, 1 feature.
    return [...hq, ...mapSales.sold.map((r) => ({ id: r.id, name: `${r.name} (${r.owner})`, region: r.region, clientName: r.owner,
      security: r.sealed?.ratings?.security ?? 1, visible: r.sealed?.visibility ?? 1, decoy: !!r.sealed?.decoy }))];
  };
  const press = new Press({ pushback: pb, crisis, seed: seeds.world + 7, reputationStore: crisis,
    getMinutes: () => (clock.total / clock.quarterSeconds) * 27,
    siegeWatch: { getSites: siegeSites, getTension: () => crisis.tracks.pitchforks?.tension ?? 0, hotRegions: PITCHFORKS_REGIONS } });
  crisis.on('open', (e) => { if (e.track === 'pitchforks') press.openPitchforks(); });
  press.on('pitchforks', () => toast('THE PITCHFORKS: mobs now march on your sites in North America and the Middle East every week. Keep them hidden and guarded.'));
  press.on('siege', (r) => toast(r.decoy ? `SIEGE at ${r.name}: the mob stormed the decoy entrance. Next loss this quarter is real.`
    : r.occupied ? `SIEGE: ${r.name} is OCCUPIED (mob ${r.strength.toFixed(1)} vs security ${r.defence}). Retake it from the press desk (P).`
      : `Siege repelled at ${r.name} (mob ${r.strength.toFixed(1)} vs security ${r.defence}): reputation +1.`));
  pb.press = press; // endings read Iris's trust from here
  crisis.on('week', () => press.tickWeek());
  pb.on('whispers', () => { const who = press.startStory(); toast(`WHISPERS: ${who ? `${who === 'iris' ? 'Iris Kemp' : 'Gil Marsh'} has started a story about you` : 'the press is asking questions'}. Schemes cost 10% more.`); });
  const pressOverlay = el('div', 'report-overlay press-overlay');
  pressOverlay.hidden = true;
  const pressClose = el('button', 'report-continue', 'CLOSE [P]');
  pressClose.type = 'button';
  const pressDesk = createPressDesk({ press, pushback: pb,
    onAction: (r) => { if (r && !r.ok) toast(r.reason); else if (r?.notes?.length) toast(r.notes.join(' ')); ui.update(hudState()); } });
  pressOverlay.append(pressDesk.el, pressClose);
  document.body.append(pressOverlay);
  const togglePress = (open = pressOverlay.hidden) => { pressOverlay.hidden = !open; if (open) pressDesk.render(); };
  pressClose.onclick = () => togglePress(false);
  const repChip = createReputationChip({ press, onOpen: () => togglePress(true) });
  root.querySelector('.hud')?.insertBefore(repChip.el, root.querySelector('.view-toggle'));
  crisis.on('week', () => repChip.render()); // reputation also moves outside the press (events, breaches)
  createFrontPage({ root: document.body, press });
  press.on('call', (c) => showPressCall(c));
  function showPressCall(c) {
    const overlay = el('div', 'report-overlay pr-fp-overlay');
    const paper = el('section', 'pr-fp pr-fp-iris pr-call');
    paper.setAttribute('role', 'dialog');
    paper.append(el('div', 'pr-fp-mast', c.outlet.toUpperCase()), el('div', 'pr-fp-date', `${c.name} is on the line`),
      el('h2', 'pr-fp-head', `"${c.angle}"`),
      el('div', 'pr-fp-sub', `${c.name} is calling for comment. She has started a story. Every week it grows (faster when your heat is high); at 100% it runs: heat +25, reputation -15, every client +10 leverage. Answer her now, or manage it from the press desk (P).`));
    const row = el('div', 'pr-call-actions');
    const close = () => { overlay.remove(); ui.update(hudState()); };
    const talk = el('button', 'report-continue', 'TAKE THE INTERVIEW');
    talk.type = 'button';
    talk.onclick = () => { const r = press.counter('iris', 'interview'); close(); toast(r.ok ? r.notes.join(' ') : r.reason); };
    const none = el('button', 'report-continue', 'NO COMMENT');
    none.type = 'button';
    none.onclick = close;
    const desk = el('button', 'report-continue', 'PRESS DESK');
    desk.type = 'button';
    desk.onclick = () => { close(); togglePress(true); };
    row.append(talk, none, desk);
    paper.append(row);
    overlay.append(paper);
    document.body.append(overlay);
    talk.focus();
  }
  const tensions = () => Object.fromEntries(Object.values(crisis.tracks).map((t) => [t.id, t.tension]));
  const market = new LeadMarket({ seed: worldSeed + 1, reputation: () => crisis.reputation, leadMultiplier: () => pb.leadMultiplier });
  market.ownSite('nam'); // HQ
  market.week({ tensions: tensions() });
  attachCrisis(market, crisis); // a market week runs after every crisis week
  const schemes = new SchemeBoard({ crisis, market, ledger, pushback: pb, isUnlocked: (id) => tree.isUnlocked(id), getHeatMultiplier: () => tree.schemeHeatMult });
  // Board Probation (#18): the Minder vetoes the first scheme you try each quarter (no cost, no effect).
  const runScheme = schemes.run.bind(schemes);
  schemes.run = (...args) => {
    if (board.minderVeto()) throw new Error('VETOED by the board’s Minder. Probation allows one veto a quarter; try again.');
    return runScheme(...args);
  };
  // The crisis dividend (#16): every week each track pays research grants by its band (Simmer/Boil/Brink).
  crisis.on('week', () => {
    tree.fundWeek(Object.values(crisis.tracks));
    if (company.rpPerWeek) tree._deposit(company.rpPerWeek, 'grants', { label: 'R&D department', rp: company.rpPerWeek, lines: [] }); // #72
  });
  const mapSales = new MapSales({ market, ledger, pushback: pb, getTensions: tensions, getBreachMultiplier: () => crisis.panicMultiplier,
    getEdgeBonus: (id) => schemes.edgeBonus(id), getQuarter: () => clock.quarter });
  // The twelve endings (#32): mid-campaign triggers are checked every in-game week.
  const endingWatch = new EndingWatch();
  slot.register('endings', endingWatch);
  const chapterOf = (q) => (q >= 11 ? 5 : q >= 8 ? 4 : q >= 5 ? 3 : q >= 3 ? 2 : 1);
  crisis.on('week', () => {
    if (midnightStarted) return;
    const id = endingWatch.week({
      chapter: chapterOf(clock.quarter), heat: pb.heat, boardConfidence: board.average, boardOusted: board.ousted,
      quotaOnTrack: quarterRevenue(ledger, ledger.quarter) >= board.quota * clock.quarterProgress * 0.9,
      tracks: Object.values(crisis.tracks), collapses: doom.collapses, irisTrust: pb.press?.journalists?.iris?.trust ?? 0,
      roster: world.roster, midnightDateSet: false, // the engineered road isn't wired into the campaign yet (#29 demo only)
    });
    if (id) endCampaign(id);
  });
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
    const circuit = new EventCircuit({ catalog, ledger, seed: worldSeed, clock, roster: () => world.roster,
      addHeat: (n, why) => pb.addHeat(n, why), addReputation: (n) => { crisis.reputation = Math.max(0, Math.min(100, crisis.reputation + n)); } });
    slot.register('events', circuit);
    if (resume) { const saved = slot.peek(); if (saved?.parts?.events) circuit.load(saved.parts.events); }
    social.session = new SocialSession({ circuit, leads, getQuarter: () => clock.quarter, getCash: () => ledger.cash, getWorld: () => worldState({ crisis, schemes }),
      addHeat: (n, why) => pb.addHeat(n, why), addReputation: (n) => { crisis.reputation = Math.max(0, Math.min(100, crisis.reputation + n)); } });
    social.screens = createSocialScreens({ root: document.body, social: social.session, onClose: () => { ui.update(hudState()); mapScreen.refresh(); } });
    social.session.onChange(() => ui.update(hudState()));
    eventsBtn.disabled = false;
  }).catch((err) => { eventsBtn.title = `Events unavailable: ${err.message}`; });
  // Megaprojects (#143): the Compound (4:20) and the Ark (5:00, commissioned from a Table lead).
  const megaUnlocked = (id) => params.has('megaprojects') || (clock.total / clock.quarterSeconds) * 27 >= hm(MEGAPROJECTS[id].unlockAt);
  const megas = new MegaprojectBoard({ ledger, isUnlocked: megaUnlocked, seed: worldSeed + 13, crews: workingCrews, siteOpts: { crewSpeed: () => company.crewSpeed, research: tree } });
  slot.register('megaprojects', megas);
  const megaScreen = createMegaprojectScreen({ root: document.body, board: megas, getFrame: () => frame, onToast: (m) => toast(m) });
  const projectsBtn = el('button', 'view-btn', 'PROJECTS');
  projectsBtn.type = 'button';
  projectsBtn.title = `Compound (unlocks ${MEGAPROJECTS.compound.unlockAt}) and the Ark (${MEGAPROJECTS.ark.unlockAt}, from a Table lead)`;
  projectsBtn.onclick = () => megaScreen.toggle();
  root.querySelector('.view-toggle')?.prepend(projectsBtn);
  const mapScreen = createWorldMapScreen({ root: mapView, sales: mapSales, schemes, leads, initial: 'nam', getMood: () => mood(), onScheme: () => ui.update(hudState()), onSold: () => ui.update(hudState()),
    onTableLead: (lead) => { const r = megas.startArk(lead); if (r.ok) toast(r.joined ? `${lead.guest.name} joins the Ark consortium.` : 'THE ARK IS COMMISSIONED. Open PROJECTS to build it.'); return r; } });
  createContainmentUI({ root: document.body, crisis, onAdvanceWeek: () => crisis.advanceWeek() });
  crisis.on('week', () => mapScreen.refresh());
  crisis.on('breach', () => { qStats.breaches += 1; });
  slot.register('sales', mapSales);
  // Crisis consequences (#67): board members react to contained breaches; collapses ruin sites in hot regions.
  const consequences = new CrisisConsequences({ crisis, board, sites: () => mapSales.sold, seed: worldSeed + 67 });
  consequences.on('evacuation', (e) => toast(`EVACUATION: ${e.owner} demands to be got out of ${e.name}.`));
  consequences.on('reaction', () => ui.update(hudState()));
  slot.register('consequences', consequences);
  slot.register('market', market);
  slot.register('schemes', schemes);
  // Telemetry (#78): weekly meters and every event, exportable as CSV (TELEMETRY button).
  const telemetry = new Telemetry({ getTime: () => ({ quarter: clock.quarter, week: crisis.week, minutes: (clock.total / clock.quarterSeconds) * 27 }) });
  telemetry.attach({ crisis, pushback: pb, ledger, tree, schemes, mapSales });
  slot.register('telemetry', telemetry);
  // Crisis profits fund the labs too: the panic-premium share of every map sale becomes RP (#16).
  mapSales.onChange((e) => { if (e.type === 'sale' && e.record.premium > 1) tree.fundFromIncome(e.record.price * (1 - 1 / e.record.premium), `${e.record.owner}'s panic premium`); });
  const WEEK_SECONDS = clock.quarterSeconds / 13; // 13 in-game weeks a quarter
  let weekAcc = 0;
  tree.onUnlock?.(() => { gridUI.refresh(); mapScreen.refresh(); });
  // The threat roster this campaign runs (6 slots; alternates chosen at the world setup screen).
  const world = { roster: [...roster], opened: [] };
  slot.register('crisis', crisis);
  slot.register('press', press);
  slot.register('world', { toJSON: () => ({ roster: world.roster, opened: world.opened }), load: (d) => { if (d.roster?.length === 6) world.roster = d.roster; world.opened = d.opened ?? []; } });
  delete doom.tensions.world; // saves from before #69 carried pushback's stand-in track
  for (const id of world.opened) crisis.openTrack(id); // already a no-op for tracks the crisis save reopened
  if (crisis.tracks.pitchforks?.open) press.openPitchforks();
  ledger.setQuarter(clock.quarter);

  // Midnight grades the HQ grid alongside every shelter sold (sold ones join this list from the map/clients).
  const shelters = () => [...(grid.built.length ? [grid.toShelter()] : []), ...mapSales.sheltersForMidnight()];

  const hudState = () => ({ quarter: clock.quarter, totalQuarters: clock.totalQuarters, heat: pb.heat, tension: pb.tension,
    boardTarget: board.quota, boardProgress: quarterRevenue(ledger, clock.quarter), boardStrikes: 0,
    boardTitle: `Revenue quota this quarter. Board confidence ${Math.round(board.average)} (${board.state.label}).` });

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
  const telemetryBtn = el('button', null, 'TELEMETRY');
  telemetryBtn.title = 'Download this campaign\'s weekly meters and event log as CSV';
  telemetryBtn.onclick = () => { telemetry.download(); toast(`Telemetry: ${telemetry.weeks.length} weeks, ${telemetry.events.length} events saved as CSV.`); };
  const menuBtn = el('button', null, 'MENU');
  menuBtn.title = 'Back to the title screen. Your campaign autosaves at the start of every quarter; Continue resumes from there.';
  menuBtn.onclick = () => { session.destroy(); showMainMenu(); };
  const endBtn = el('button', null, 'END QUARTER');
  endBtn.title = 'Close the books now (N)';
  endBtn.onclick = () => clock.skipQuarter();
  const settingsPanel = createSettingsPanel({ root: document.body }); // #94 accessibility + key bindings
  const threatsBtn = keyHint(el('button'), 'THREATS', 'threats');
  threatsBtn.title = 'The six threat tracks in this world, when they open, and every scheme';
  threatsBtn.onclick = () => threats.toggle();
  bar.append(label, time, track, speeds, settingsPanel.button, threatsBtn, endBtn, telemetryBtn, menuBtn);
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

    // The world map sizes itself at whole-number scales (style guide; #100, #102, #105): createWorldMapScreen's
    // fitMap sets width AND height together. A second sizer here set the width alone, which squashed the map
    // vertically and sent clicks to the wrong region.
  };
  fit();
  requestAnimationFrame(fit);
  addEventListener('resize', fit);
  fitRef = fit;

  // ---------- end of quarter ----------
  clock.onQuarterEnd(async ({ quarter, isFinal }) => {
    ledger.record('upkeep', `Shovel crew payroll x${workingCrews()}`, -MONEY.crewPerWeek * 13 * workingCrews()); // GDD $0.1M a crew a week
    pbui.hold();
    // The quarterly meeting, on the quarter as it ended (before heat cools off).
    const trackList = Object.values(crisis.tracks);
    if (qStats.crisisConfidence == null) qStats.crisisConfidence = crisis.boardConfidence;
    const review = board.review({
      quarter, heat: pb.heat, tensions: tensions(),
      openTracks: trackList.filter((t) => t.state !== 'locked' && t.open !== false).map((t) => t.id),
      brinkTracks: trackList.filter((t) => t.state === 'brink' || t.state === 'breach').length,
      breaches: qStats.breaches, handovers: qStats.handovers, schemesRun: schemes.log.length - qStats.schemesAtStart,
      // Breach weeks and containment heroics already dent the crisis system's board confidence: pass that on.
      confidenceShift: Math.round(crisis.boardConfidence - qStats.crisisConfidence),
    });
    crisis.boardConfidence = Math.round(board.average);
    Object.assign(qStats, { handovers: 0, breaches: 0, schemesAtStart: schemes.log.length, crisisConfidence: crisis.boardConfidence });
    const r = pb.endQuarter({ quarter, profit: ledger.summary(quarter).net });
    telemetry.quota(quarter, { met: review.met, target: review.quota, profit: review.revenue, strikes: 0 });
    audio.play(review.met ? 'boardMet' : 'boardMiss');
    await ui.showQuarterReport({ quarter, heat: pb.heat, tension: pb.tension, notes: [...consequences.drainNotes(), ...review.lines.slice(1), ...r.lines],
      board: { met: review.met, revenue: review.revenue, target: review.quota, state: review.stateLabel, average: review.average } });
    await pbui.drain();
    if (board.ousted) { endCampaign('ousted'); return; } // #32: the Ousted ending card (was showOusted)
    if (!isFinal) toast(`Quarter ${quarter + 1} begins. Quota $${(board.quota / 1e6).toFixed(1)}M. ${board.directives.map((d) => d.text).join('. ')}.`);
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
    slot.save(); // autosave at every quarter start: the one checkpoint Continue resumes from (#80)
    ui.update(hudState());
  });
  let midnightStarted = false;
  // road: null = the end of Q12 (still graded straight away); an uncontrolledRoad = the Doom Clock struck zero or
  // the Final Countdown ran out, which runs the Midnight sequence: the strike, the Seal Order, the grade (#70).
  async function midnight(road = null, endingOverride = null) {
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
    telemetry.ending(result);
    await showMidnight({ root: document.body, result });
    // #32: epilogues, The Ledger and the ending card
    const endingId = endingOverride ?? endingWatch.atMidnight({ road: road || result.type === 'failed' ? 'uncontrolled' : 'engineered' });
    await finale(endingId, result);
  }
  async function finale(endingId, result = null) {
    const sold = mapSales.sold;
    await showFinale({ root: document.body, epilogues: epilogues({ result, sold, endingId }),
      ledger: buildLedger({ result, endingId, ledger, tree, pushback: pb, crisis, doom, company, quartersSurvived: Math.max(0, clock.quarter - 12) }),
      onRestart: () => { document.querySelectorAll('.mn-overlay').forEach((n) => n.remove()); session.destroy(); showMainMenu(); } });
  }
  // An ending reached before Midnight (#32). Those that still end the world grade it as it stands.
  async function endCampaign(endingId) {
    if (midnightStarted) return;
    if (['under_new_management', 'locked_out'].includes(endingId)) return midnight(null, endingId);
    if (endingId === 'somebody_else') return midnight(uncontrolledRoad({ reason: 'countdown', crisis, doom }), endingId);
    midnightStarted = true;
    markCampaignFinished();
    clock.hold('ending');
    slot.clear();
    renderBar();
    telemetry.ending({ ending: { id: endingId }, type: 'ending' });
    await finale(endingId, null);
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
  const cardQueue = [];
  let cardOpen = false;
  const campaignWeek = () => (clock.quarter - 1) * 13 + Math.floor(clock.elapsed / WEEK_SECONDS);
  const trackName = (id) => TRACK_BY_ID[resolveTrack(world.roster, id) ?? id]?.name ?? id;
  const cardHooks = {
    addTension: (track, n, why) => {
      track = resolveTrack(world.roster, track) ?? track; // cards name Classic tracks: read them by slot (#75)
      if (track && crisis.tracks[track]?.open) crisis.addTension(track, n, why);
      else pb.addTension(n, why); // general cards, or a track not in play: the world's tension takes it
    },
    addHeat: (n, why) => pb.addHeat(n, why),
    addCash: (label, n) => ledger.record('other', label, n),
    addReputation: (n) => { crisis.reputation = Math.max(0, Math.min(100, crisis.reputation + n)); },
    addResearch: (n) => { tree.pool += n; },
    note: (text) => toast(text),
  };
  // ---------- story beats (#76, L0): timed text popups that pause the game ----------
  const story = new StoryBeats();
  slot.register('story', story);
  const beatQueue = [];
  let beatOpen = false;
  async function pumpBeats() {
    if (beatOpen || !beatQueue.length || modalOpen() || midnightStarted) return;
    beatOpen = true;
    const beat = beatQueue.shift();
    const m = Math.round(campaignMinutes());
    await showBeat({ root: document.body, beat, clockLabel: `Y1 Q${clock.quarter} · ${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} played` });
    beatOpen = false;
  }
  async function pumpCards() {
    if (beatOpen || beatQueue.length || cardOpen || !cardQueue.length || modalOpen() || midnightStarted) return;
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

  const modalOpen = () => !!document.querySelector('.report-overlay:not([hidden]), .br-overlay:not([hidden]), .pb-overlay, .mn-overlay, .mn-strike, .soc-overlay:not([hidden]), .cp-overlay:not([hidden]), .sb-overlay');

  // ---------- keys ----------
  const onKey = (e) => {
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
    // keys come from the rebinding table (#94, Settings)
    if (settings.matches(e, 'pause')) { e.preventDefault(); clock.togglePause(); }
    else if (settings.matches(e, 'speedUp')) clock.setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(clock.speed) + 1)] ?? 1);
    else if (settings.matches(e, 'speedDown')) clock.setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(clock.speed) - 1)] ?? 1);
    else if (settings.matches(e, 'endQuarter')) { if (!modalOpen()) clock.skipQuarter(); }
    else if (settings.matches(e, 'events') && social.screens && !modalOpen()) social.screens.toggle();
    else if (settings.matches(e, 'press') && (!modalOpen() || !pressOverlay.hidden)) togglePress();
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
      if (auditSecondsLeft > 0) auditSecondsLeft -= g; else grid.tick(g); // an audit week stops construction
      megas.tick(g);
      weekAcc += g;
      while (weekAcc >= WEEK_SECONDS) { weekAcc -= WEEK_SECONDS; crisis.advanceWeek(); megas.week(); }
      syncDoomWeeks();
      beatQueue.push(...story.due({ minutes: campaignMinutes(), quarter: clock.quarter, crisis, pushback: pb }));
      drawWeeklyCard();
      const wild = firstBreach.check();
      if (wild) cardQueue.unshift({ card: wild, week: campaignWeek(), special: true });
    }
    clock.tick(dt);
    pumpBeats();
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

  function toast(msg) {
    const t = el('div', 'cb-toast', msg);
    document.body.append(t);
    setTimeout(() => { t.style.opacity = '0'; }, 2200);
    setTimeout(() => t.remove(), 2800);
  }

  session = {
    mood, setMood: (m) => { moodForce = m; }, // #130
    difficulty: diff, clock, doom, gauge, ledger, pb, tree, ui, grid, gridUI, megas, megaScreen, shelters, world, threats, campaignMinutes, crisis, press, board, consequences, market, schemes, mapSales, mapScreen, slot, leads, social, company, story, telemetry, firstBreach,
    endings: { watch: endingWatch, end: (id) => endCampaign(id) }, // #32 debug: __game.endings.end('indicted')
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener('keydown', onKey);
      social.screens?.destroy();
      pressOverlay.remove();
      document.querySelectorAll('.pr-fp-overlay').forEach((n) => n.remove());
      companyPanel.destroy();
      removeEventListener('resize', fit);
      gridUI.destroy();
      ui.destroy();
      threats.destroy();
      settingsPanel.destroy();
      app.replaceChildren();
      session = null;
    },
  };
  window.__game = session;
  // Debug presets for a NEW campaign: ?preset=countdown | clockzero | breach (add &qs=26 for 2-second weeks).
  // ---------- save slot (#80): every system is registered by now ----------
  // RNG positions: the dice a resumed campaign rolls next are the ones it would have rolled.
  slot.register('rng', {
    toJSON: () => ({ pushback: pb.rng.state, crisis: crisis.rng.state, deck: deck.rng.state }),
    load: (d) => { if (d.pushback != null) pb.rng.state = d.pushback; if (d.crisis != null) crisis.rng.state = d.crisis; if (d.deck != null) deck.rng.state = d.deck; },
  });
  if (resume) slot.load();
  else { slot.clear(); slot.save(); } // a new campaign's first checkpoint is the start of Q1
  qStats.schemesAtStart = schemes.log.length;
  pb.schemeHeatMultiplier = board.schemeHeatMultiplier;
  ledger.setQuarter(clock.quarter);
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
  // Shelter-in-place (#66): two shelters in the Middle East (Atomic Standoff's high-exposure region), one built
  // for it and one that isn't, a third in Europe out of the blast zone; then Atomic Standoff breaches.
  // Sieges (#150): The Pitchforks opens at tension 80 with three shelters in its regions: a guarded, hidden one
  // that holds, an exposed one that falls, and an exposed one with a Decoy Entrance that absorbs the first loss.
  pitchforks(g) {
    const shelters = [
      { region: 'nam', name: 'The Quiet Keep', occupants: 6, rooms: ['bunk', 'air_vent', 'water_tank', 'pantry'], sealed: { daysSealed: 600, ratings: { seal: 3, blast: 3, security: 5, morale: 3 }, visibility: 0 } },
      { region: 'mea', name: 'Helipad Palace', occupants: 6, rooms: ['bunk', 'gold_taps', 'wine_cellar'], sealed: { daysSealed: 90, ratings: { seal: 1, blast: 1, security: 1, morale: 4 }, visibility: 3 } },
      { region: 'mea', name: 'Decoy Manor', occupants: 6, rooms: ['bunk', 'air_vent', 'pantry'], sealed: { daysSealed: 300, ratings: { seal: 2, blast: 2, security: 2, morale: 3 }, visibility: 2, decoy: true } },
    ];
    for (const sh of shelters) { const s = g.mapSales.addFinished(sh); g.market.addLeads(sh.region, 1); g.mapSales.sell(sh.region, s.id); }
    if (!g.world.opened.includes('pitchforks')) g.world.opened.push('pitchforks');
    g.crisis.openTrack('pitchforks', { tension: 80 });
    g.crisis.setTension('pitchforks', 80, 'debug preset');
    g.mapScreen.refresh();
  },
  breach(g) {
    for (const id of g.world.roster) { if (!g.world.opened.includes(id)) g.world.opened.push(id); g.crisis.openTrack(id, { tension: 30 }); }
    const shelters = [
      { region: 'mea', name: 'The Granite Keep', occupants: 8, rooms: ['bunk', 'bunk', 'air_vent', 'water_tank', 'pantry', 'mil_scrubber'], sealed: { daysSealed: 900, ratings: { seal: 4, blast: 4, security: 3, morale: 3 } } },
      { region: 'mea', name: 'Marble Folly', occupants: 8, rooms: ['bunk', 'bunk', 'gold_taps', 'gold_taps', 'wine_cellar'], sealed: { daysSealed: 90, ratings: { seal: 1, blast: 1, security: 1, morale: 4 } } },
      { region: 'eur', name: 'Alpine Retreat', occupants: 6, rooms: ['bunk', 'air_vent', 'water_tank', 'pantry'], sealed: { daysSealed: 200, ratings: { seal: 2, blast: 2, security: 2, morale: 2 } } },
    ];
    for (const sh of shelters) { const s = g.mapSales.addFinished(sh); g.market.addLeads(sh.region, 1); g.mapSales.sell(sh.region, s.id); }
    g.mapScreen.refresh();
    setTimeout(() => g.crisis.setTension('atomic', 100, 'debug preset'), 1500);
  },
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

installPixelPerfect(); // #127: whole device pixels everywhere (theme units, canvas snapping)
installTheme(); // #126: pixel font + nine-slice frames (theme.css)
showMainMenu();
window.__menu = { showMainMenu, startCampaign };
