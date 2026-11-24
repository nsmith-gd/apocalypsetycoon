// Crisis-stoking schemes and the profit-at-the-edge curve (pillar 1: "profit lives at the edge").
// GDD: Schemes, Crises and tipping points.
//
// A SCHEME is funded in a REGION and pushes one crisis track. Uses the systems already in the game:
//   - Tension goes through CrisisSystem.addTension (#26), so its hidden tipping points, the Brink, breaches
//     (the runaway-crisis event: pause, containment window, heat, board, Doom Clock) all apply.
//   - Heat (and the world's runaway-tension meter) goes through Pushback.onScheme (#5).
//   - Cost is booked in the one ledger under 'schemes'.
//   - Local panic: the target region gets extra leads right away (LeadMarket.addLeads, #27).
// How hard a scheme lands depends on how exposed the region is to its crisis: REACH high 1 / medium 0.7 / low 0.4.
//
// THE EDGE. Every track has a hidden tipping point; the player sees only a range (visibleTip). Within
// `brinkMargin` (10) of the real tip the track is at the Brink: prices there get an EDGE BONUS on top of
// the panic premium (scaled by exposure), and research peaks. Cross the tip and the track breaches; the
// region whose scheme tipped it also sees its waiting buyers flee to rivals (RUNAWAY_FLIGHT).
//
//   const schemes = new SchemeBoard({ crisis, market, ledger, pushback, isUnlocked });
//   schemes.available(regionId)        -> [{ scheme, gain, cost, heat, locked, reason }]
//   schemes.run('memo', 'lat')         -> { gain, breached, fled, ... }
//   schemes.edgeBonus(region)          -> extra price multiplier from tracks at the Brink
//   schemes.trackView(trackId)         -> { tension, zone, visibleTip, edgeFrom, ... }
//   researchCrisis(crisis)             -> 0-100 crisis level for ResearchTree.tick (peaks below each real tip)

import { EXPOSURE } from '../demand/demand.js';
import { TIPPING_POINT as RESEARCH_TIP } from '../research/research.js';
import { TRACK_APOCALYPSE } from '../midnight/engineered.js';
import { TRACK_BY_ID } from '../world/tracks.js';

export const SCHEME_RULES = Object.freeze({
  reach: { high: 1, medium: 0.7, low: 0.4 },
  edgeBonus: 0.3, // +30% price at the Brink in a high-exposure region (half / quarter for medium / low)
  runawayFlight: 0.5, // share of the target region's waiting buyers that flee when your scheme tips a crisis
  repeatCost: 0.25, // each run of the same scheme in the same week costs 25% more
});

// Ids match the research tree's scheme unlocks. Numbers are provisional until the GDD tables are in the repo.
export const SCHEMES = Object.freeze([
  { id: 'podcast', name: 'Fund doom podcast', track: 'unrest', cost: 15_000, tension: 7, heat: 4, leads: 0.5, blurb: 'Three hours a day of "they don\'t want you to know".' },
  { id: 'memo', name: 'Leak pandemic memo', track: 'pandemic', cost: 30_000, tension: 14, heat: 12, leads: 1, blurb: 'A lab, a sneeze, a PDF.' },
  { id: 'astroturf', name: 'Astroturf think tank', track: 'climate', cost: 25_000, tension: 10, heat: 5, leads: 1, research: true, blurb: 'Experts agree: things look bad.' },
  { id: 'deepfake', name: 'Deepfake broadcast', track: 'war', cost: 60_000, tension: 20, heat: 18, leads: 1.5, research: true, blurb: 'A president says the quiet part loud.' },
  { id: 'shortage', name: 'Engineered shortage', track: 'markets', cost: 90_000, tension: 26, heat: 20, leads: 2, research: true, blurb: 'Empty shelves sell full bunkers.' },
  { id: 'blackout', name: 'Grid blackout', track: 'unrest', cost: 150_000, tension: 35, heat: 30, leads: 3, research: true, blurb: 'Lights out. Phones ring.' },
]);

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const r1 = (n) => Math.round(n * 10) / 10;

/** Crisis level to feed ResearchTree.tick: each track rescaled so ITS real tip lands on the research tip. */
export function researchCrisis(crisis) {
  let worst = 0;
  for (const t of Object.values(crisis.tracks)) {
    const tip = crisis.tippingPoint(t.id);
    const v = t.state === 'breach' || t.state === 'collapsed' ? Math.max(RESEARCH_TIP, t.tension) : t.tension * (RESEARCH_TIP / tip);
    worst = Math.max(worst, Math.min(100, v));
  }
  return Math.round(worst * 10) / 10;
}

export class SchemeBoard {
  constructor({ crisis, market = null, ledger = null, pushback = null, regions = market?.regions ?? [], isUnlocked = () => true, getHeatMultiplier = () => 1, schemes = SCHEMES, rules = {} } = {}) {
    this.crisis = crisis;
    this.market = market;
    this.ledger = ledger;
    this.pb = pushback;
    this.regions = regions;
    this.isUnlocked = isUnlocked;
    this.getHeatMultiplier = getHeatMultiplier; // research (#16): Spin doctors cut scheme heat
    this.schemes = schemes;
    this.rules = { ...SCHEME_RULES, ...rules };
    this.runsThisWeek = {}; // schemeId -> count, reset each crisis week
    this.log = [];
    this._listeners = new Set();
    this._offWeek = crisis.on?.('week', () => { this.runsThisWeek = {}; this._emit({ type: 'week' }); });
  }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit(e) { for (const fn of this._listeners) fn(e, this); }

  /** Save slot (#80). */
  toJSON() { return { runsThisWeek: { ...this.runsThisWeek }, log: this.log.map((x) => ({ ...x })) }; }
  load(d = {}) { this.runsThisWeek = { ...(d.runsThisWeek ?? {}) }; this.log = (d.log ?? []).map((x) => ({ ...x })); this._emit({ type: 'load' }); }

  region(id) { return this.regions.find((r) => r.id === id) ?? null; }
  scheme(id) { return this.schemes.find((s) => s.id === id) ?? null; }

  /**
   * The crisis track a scheme pushes in this world. Schemes name the old five crises; in a world running
   * the GDD roster (#69) each maps to the roster track in the same slot (war -> slot 1, pandemic -> 2...).
   */
  trackOf(scheme) {
    const direct = this.crisis.tracks[scheme.track];
    if (direct) return direct;
    const slot = TRACK_BY_ID[TRACK_APOCALYPSE[scheme.track]]?.slot;
    return Object.values(this.crisis.tracks).find((t) => TRACK_BY_ID[t.id]?.slot === slot) ?? null;
  }

  /** Tension this scheme adds to its track when run in this region. */
  gainIn(scheme, region) {
    const level = region?.exposure?.[this.trackOf(scheme)?.id ?? scheme.track] ?? 'low';
    return r1(scheme.tension * (this.rules.reach[level] ?? 0.4));
  }

  costOf(scheme) {
    return Math.round(scheme.cost * (1 + this.rules.repeatCost * (this.runsThisWeek[scheme.id] ?? 0)));
  }

  /** Everything the region panel needs to list schemes. */
  available(regionId) {
    const region = this.region(regionId);
    return this.schemes.map((s) => {
      const t = this.trackOf(s);
      if (!t) return null; // no such crisis in this world
      const locked = !!s.research && !this.isUnlocked(s.id);
      let reason = null;
      if (locked) reason = 'Research it in R&D';
      else if (!t.open) reason = `${t.name} hasn't opened yet`;
      else if (t.state === 'locked') reason = `${t.name} is recovering (${t.lockWeeks}wk)`;
      else if (t.state === 'collapsed') reason = `${t.name} has collapsed`;
      else if (t.state === 'breach') reason = `${t.name} has breached`;
      else if (this.crisis.paused) reason = 'World paused';
      const cost = this.costOf(s);
      if (!reason && this.ledger && this.ledger.cash < cost) reason = 'Not enough cash';
      return { scheme: s, gain: this.gainIn(s, region), exposure: region?.exposure?.[t.id] ?? 'low', cost, heat: Math.round(s.heat * this.getHeatMultiplier()), locked, reason, track: this.trackView(t.id) };
    }).filter(Boolean);
  }

  /** Fund a scheme in a region. Throws if it can't run. */
  run(schemeId, regionId) {
    const s = this.scheme(schemeId);
    const region = this.region(regionId);
    if (!s || !region) throw new Error('Unknown scheme or region.');
    const offer = this.available(regionId).find((o) => o.scheme === s);
    if (!offer) throw new Error(`No ${s.name} in this world.`);
    if (offer.reason) throw new Error(offer.reason);
    const t = this.trackOf(s);
    const before = t.tension;
    const wasBrink = t.state === 'brink';
    this.ledger?.record('schemes', `${s.name} (${region.name})`, -offer.cost);
    this.runsThisWeek[s.id] = (this.runsThisWeek[s.id] ?? 0) + 1;
    this.pb?.onScheme?.({ label: `${s.name} (${region.name})`, heat: offer.heat, tension: offer.gain });
    this.crisis.addTension(t.id, offer.gain, `${s.name} in ${region.name}`);
    // local panic: buyers appear in the target region right away
    const leads = r1(s.leads * (this.rules.reach[offer.exposure] ?? 0.4));
    this.market?.addLeads?.(regionId, leads);
    const breached = t.state === 'breach' && before < t.tension;
    let fled = 0;
    if (breached && this.market) fled = this.market.flee(regionId, this.rules.runawayFlight).length;
    const result = {
      scheme: s, region, track: t.id, cost: offer.cost, gain: offer.gain, before, after: t.tension, leads,
      enteredEdge: !wasBrink && t.state === 'brink', breached, fled,
    };
    this.log.push({ week: this.crisis.week, scheme: s.id, region: regionId, gain: offer.gain, breached });
    this._emit({ type: 'run', ...result });
    return result;
  }

  /** Extra price multiplier in a region from tracks at the Brink (0 when none). */
  edgeBonus(region) {
    if (typeof region === 'string') region = this.region(region);
    let best = 0;
    for (const [track, level] of Object.entries(region?.exposure ?? {})) {
      if (this.crisis.tracks[track]?.state === 'brink') best = Math.max(best, this.rules.edgeBonus * EXPOSURE[level]);
    }
    return Math.round(best * 1000) / 1000;
  }

  /** What the player can see about one track: tension, the visible tip, and where the edge starts. */
  trackView(trackId) {
    const t = this.crisis.tracks[trackId];
    const vis = this.crisis.visibleTip(trackId);
    const lo = Math.round(vis.exact ?? vis.range[0]); // fragility moves tips in quarter minutes; show whole points
    const hi = Math.round(vis.exact ?? vis.range[1]);
    const margin = this.crisis.cfg.brinkMargin;
    let zone = 'calm';
    if (t.state === 'collapsed') zone = 'collapsed';
    else if (t.state === 'breach') zone = 'breach';
    else if (t.state === 'locked') zone = 'locked';
    else if (t.state === 'brink') zone = 'edge';
    else if (t.tension >= lo - margin - 15) zone = 'uneasy';
    return {
      id: t.id, name: t.name, tension: Math.round(t.tension), state: t.state, zone,
      tipLow: lo, tipHigh: hi, exact: vis.exact ?? null,
      // the earliest the edge could start, given what the player knows
      edgeFrom: Math.max(0, lo - margin),
      lockWeeks: t.lockWeeks,
    };
  }

  destroy() { this._offWeek?.(); }
}
