// Fear and weekly lead demand.
// GDD: Core loop > The Fear meter, World canvas > Demand.
//
// FEAR (per crisis track, 0-100): last week's Fear decays 15%, then +2 per point of tension GAINED
// this week and +10 on a breach week (capped at 100). Tension that just sits there, even at the Brink, stops scaring people.
//
// LEADS (per region, per week) = 0.5 (only where you own a site)
//                               + sum over tracks of (Fear x exposure) / 50
//                               + Influencer referrals
//   exposure: high 1, medium 0.5, low 0.25. Fractions carry over week to week.
// Each lead is a client from the region's pool. It moves up one wealth class when your site there
// has Showroom prestige AND your reputation is above 40. Unworked leads go to a rival after 4 weeks.
// PANIC PREMIUM per region scales the same way: full / half / quarter by exposure.
//
// Pure rules, no DOM. #3 owns the world map; it reads `regionDemand()` and calls `ownSite()`.
// #4's schemes call `addLeads()` (local panic) and `flee()` (runaway crisis).
// Feed tensions weekly with `week({ tensions, breaching })`, or `attachCrisis(market, crisisSystem)`.

import { TRACKS as GDD_TRACKS } from '../world/tracks.js';
import { DEMAND } from '../config/tuning.js';
import { seededRng } from '../campaign/rng.js';

export const EXPOSURE = Object.freeze({ high: 1, medium: 0.5, low: 0.25 });
export const WEALTH = Object.freeze(['comfortable', 'rich', 'ultra', 'apex']);

export { DEMAND }; // lives in the single tuning table (#77)

// The eight regions. Exposure (h/m/l) per crisis track, client pool weights, site cost.
// `art` maps each to the six-region placeholder world map until #3's map lands. Provisional
// until the GDD tables are in the repo.
const h = 'high', m = 'medium', l = 'low';
export const REGIONS = Object.freeze([
  { id: 'nam', name: 'North America', art: 'na', siteCost: 2_500_000, exposure: { pandemic: m, climate: m, unrest: h, markets: h, war: l }, pool: { tech_founder: 4, celebrity: 3, oil_heir: 1, politician: 2, prepper: 3 }, wealth: 'rich' },
  { id: 'lat', name: 'Latin America', art: 'sa', siteCost: 1_200_000, exposure: { pandemic: h, climate: h, unrest: h, markets: m, war: l }, pool: { politician: 3, celebrity: 2, oil_heir: 2, prepper: 1, tech_founder: 1 }, wealth: 'comfortable' },
  { id: 'eur', name: 'Europe', art: 'eu', siteCost: 2_200_000, exposure: { pandemic: m, climate: m, unrest: m, markets: h, war: m }, pool: { oil_heir: 2, politician: 3, celebrity: 2, tech_founder: 2, prepper: 2 }, wealth: 'rich' },
  { id: 'mea', name: 'Middle East', art: 'as', siteCost: 3_000_000, exposure: { pandemic: l, climate: h, unrest: m, markets: m, war: h }, pool: { oil_heir: 5, politician: 2, celebrity: 1, prepper: 1, tech_founder: 1 }, wealth: 'ultra' },
  { id: 'afr', name: 'Africa', art: 'af', siteCost: 900_000, exposure: { pandemic: h, climate: h, unrest: m, markets: l, war: m }, pool: { politician: 3, oil_heir: 2, prepper: 2, celebrity: 1, tech_founder: 1 }, wealth: 'comfortable' },
  { id: 'sas', name: 'South Asia', art: 'as', siteCost: 1_100_000, exposure: { pandemic: h, climate: h, unrest: m, markets: m, war: m }, pool: { tech_founder: 3, politician: 2, celebrity: 2, oil_heir: 1, prepper: 1 }, wealth: 'comfortable' },
  { id: 'eas', name: 'East Asia', art: 'as', siteCost: 2_800_000, exposure: { pandemic: h, climate: m, unrest: l, markets: h, war: m }, pool: { tech_founder: 4, celebrity: 2, oil_heir: 1, politician: 2, prepper: 2 }, wealth: 'ultra' },
  { id: 'oce', name: 'Oceania', art: 'oc', siteCost: 1_800_000, exposure: { pandemic: l, climate: h, unrest: l, markets: m, war: l }, pool: { prepper: 4, tech_founder: 2, celebrity: 1, oil_heir: 1, politician: 1 }, wealth: 'rich' },
]);

export const TRACK_IDS = Object.freeze(['pandemic', 'climate', 'unrest', 'markets', 'war']);

// The GDD's threat tracks (src/world/tracks.js) have their exposure on the GDD's eight regions. Each map
// region takes the exposure of its GDD region (the pairing src/leads uses), so the campaign's six roster
// tracks drive Fear, leads and prices here too (#69). Provisional until the map moves to the GDD regions.
export const SALES_TO_GDD_REGION = Object.freeze({ nam: 'heartland', eur: 'coastal', eas: 'tech', mea: 'capitals', sas: 'north', afr: 'equator', oce: 'islands', lat: 'frontier' });
for (const r of REGIONS) {
  const gdd = SALES_TO_GDD_REGION[r.id];
  for (const t of GDD_TRACKS) if (!(t.id in r.exposure)) r.exposure[t.id] = t.exposure[gdd] ?? 'low';
}

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const r2 = (n) => Math.round(n * 100) / 100;

const rngFrom = seededRng; // saveable state (#80)

/** One week of Fear for one track. */
export function nextFear(fear, tensionGained, breachWeek, cfg = DEMAND) {
  // Last week's Fear decays 15%, then this week's gains land (capped at 100).
  return r2(clamp(fear * (1 - cfg.fearDecay) + Math.max(0, tensionGained) * cfg.fearPerTension + (breachWeek ? cfg.fearBreachWeek : 0)));
}

/** Weekly leads for one region (before fractions carry over). */
export function regionLeads(region, fear, { siteOwned = false, referrals = 0 } = {}, cfg = DEMAND) {
  let fearTerm = 0;
  for (const [track, level] of Object.entries(region.exposure)) fearTerm += (fear[track] ?? 0) * EXPOSURE[level];
  return r2((siteOwned ? cfg.baseLeadsWithSite : 0) + fearTerm / cfg.fearDivisor + referrals);
}

/** Panic premium multiplier for a region: each track's premium scaled by exposure (full/half/quarter). */
export function panicPremium(region, tensions, { breachMultiplier = 1 } = {}, cfg = DEMAND) {
  let best = 0;
  for (const [track, level] of Object.entries(region.exposure)) {
    best = Math.max(best, ((tensions[track] ?? 0) / 100) * cfg.maxPanicPremium * EXPOSURE[level]);
  }
  return Math.round((1 + best * breachMultiplier) * 1000) / 1000;
}

export class LeadMarket {
  constructor({ seed = 1, regions = REGIONS, config = {}, reputation = () => 50 } = {}) {
    this.cfg = { ...DEMAND, ...config };
    this.regions = regions;
    this.rng = rngFrom(seed);
    this.getReputation = typeof reputation === 'function' ? reputation : () => reputation;
    this.fear = Object.fromEntries(TRACK_IDS.map((t) => [t, 0]));
    this.lastTension = null;
    this.sites = {}; // regionId -> { prestige }
    this.referrals = {}; // regionId -> leads/week from Influencers
    this.carry = Object.fromEntries(regions.map((r) => [r.id, 0]));
    this.leads = []; // open leads
    this.lost = []; // leads that went to a rival
    this.worked = [];
    this.weekNo = 0;
    this.history = []; // { week, fear: {...}, leads: {...}, total }
    this._ids = 0;
    this._listeners = new Map();
  }

  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
    return () => this._listeners.get(type).delete(fn);
  }
  _emit(type, p) { for (const fn of this._listeners.get(type) ?? []) fn(p, this); }

  ownSite(regionId, { prestige = 0 } = {}) { this.sites[regionId] = { prestige }; }
  setShowroom(regionId, prestige) { if (this.sites[regionId]) this.sites[regionId].prestige = prestige; }
  setReferrals(regionId, perWeek) { this.referrals[regionId] = perWeek; }
  region(id) { return this.regions.find((r) => r.id === id); }

  /** This week's demand for every region (what the map ticker shows). */
  regionDemand({ tensions = this.lastTension ?? {}, breachMultiplier = 1 } = {}) {
    return this.regions.map((r) => ({
      id: r.id, name: r.name, art: r.art,
      leadsPerWeek: regionLeads(r, this.fear, { siteOwned: !!this.sites[r.id], referrals: this.referrals[r.id] ?? 0 }, this.cfg),
      panicPremium: panicPremium(r, tensions, { breachMultiplier }, this.cfg),
      siteOwned: !!this.sites[r.id],
      open: this.leads.filter((x) => x.region === r.id).length,
    }));
  }

  _wealthFor(region) {
    let i = WEALTH.indexOf(region.wealth);
    const site = this.sites[region.id];
    if (site && site.prestige >= this.cfg.showroomPrestigeForUpgrade && this.getReputation() > this.cfg.reputationForUpgrade) i += 1;
    return WEALTH[Math.min(WEALTH.length - 1, i)];
  }

  _pickType(region) {
    const entries = Object.entries(region.pool);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let x = this.rng() * total;
    for (const [type, w] of entries) { x -= w; if (x <= 0) return type; }
    return entries[0][0];
  }

  /**
   * One in-game week. `tensions`: { track: 0-100 } as they stand now; `breaching`: track ids with
   * an open breach this week. Returns { fear, leads (new), expired }.
   */
  week({ tensions = {}, breaching = [] } = {}) {
    this.weekNo += 1;
    const prev = this.lastTension ?? tensions;
    for (const t of new Set([...TRACK_IDS, ...Object.keys(tensions)])) {
      this.fear[t] ??= 0;
      const gained = (tensions[t] ?? 0) - (prev[t] ?? 0);
      this.fear[t] = nextFear(this.fear[t], gained, breaching.includes(t), this.cfg);
    }
    this.lastTension = { ...tensions };

    // Leads, with fractions carried over.
    const fresh = [];
    const perRegion = {};
    for (const r of this.regions) {
      const n = regionLeads(r, this.fear, { siteOwned: !!this.sites[r.id], referrals: this.referrals[r.id] ?? 0 }, this.cfg);
      this.carry[r.id] += n;
      perRegion[r.id] = n;
      fresh.push(...this._spawn(r));
    }
    // Unworked leads go to a rival after 4 weeks.
    const expired = this.leads.filter((x) => this.weekNo - x.week >= this.cfg.rivalAfterWeeks);
    if (expired.length) {
      this.leads = this.leads.filter((x) => !expired.includes(x));
      this.lost.push(...expired);
      this._emit('lost', expired);
    }
    const total = r2(Object.values(perRegion).reduce((s, v) => s + v, 0));
    this.history.push({ week: this.weekNo, fear: { ...this.fear }, leads: perRegion, total, open: this.leads.length, lost: expired.length });
    this._emit('week', { fear: { ...this.fear }, fresh, expired, total });
    return { fear: { ...this.fear }, leads: fresh, expired, total };
  }

  _spawn(r) {
    const out = [];
    while (this.carry[r.id] >= 1) {
      this.carry[r.id] -= 1;
      const lead = { id: ++this._ids, region: r.id, type: this._pickType(r), wealth: this._wealthFor(r), week: this.weekNo };
      this.leads.push(lead);
      out.push(lead);
    }
    this.carry[r.id] = r2(this.carry[r.id]);
    return out;
  }

  /** Extra leads right now (local panic from a scheme, #4). Fractions carry over. Returns the new leads. */
  addLeads(regionId, n) {
    const r = this.region(regionId);
    if (!r || !(n > 0)) return [];
    this.carry[r.id] += n;
    const fresh = this._spawn(r);
    if (fresh.length) this._emit('leads', { region: regionId, fresh });
    return fresh;
  }

  /** A share of a region's open leads flee to rivals at once (runaway crisis, #4). Returns them. */
  flee(regionId, share = 0.5) {
    const here = this.leads.filter((x) => x.region === regionId);
    const gone = here.slice(0, Math.ceil(here.length * share));
    if (!gone.length) return [];
    this.leads = this.leads.filter((x) => !gone.includes(x));
    this.lost.push(...gone);
    this._emit('lost', gone);
    return gone;
  }

  /** The player works a lead (a sales call); it leaves the inbox. */
  work(leadId) {
    const i = this.leads.findIndex((x) => x.id === leadId);
    if (i < 0) return null;
    const [lead] = this.leads.splice(i, 1);
    this.worked.push(lead);
    this._emit('worked', lead);
    return lead;
  }

  /** Save slot (#80): everything that changes as weeks pass, plus the RNG position. */
  toJSON() {
    return { v: 1, fear: { ...this.fear }, lastTension: this.lastTension ? { ...this.lastTension } : null, sites: JSON.parse(JSON.stringify(this.sites)),
      referrals: { ...this.referrals }, carry: { ...this.carry }, leads: this.leads.map((x) => ({ ...x })), lost: this.lost.map((x) => ({ ...x })),
      worked: this.worked.map((x) => ({ ...x })), weekNo: this.weekNo, history: this.history, ids: this._ids, rng: this.rng.state };
  }

  load(d) {
    if (!d || d.v !== 1) return;
    this.fear = { ...d.fear }; this.lastTension = d.lastTension; this.sites = d.sites; this.referrals = { ...d.referrals }; this.carry = { ...d.carry };
    this.leads = d.leads.map((x) => ({ ...x })); this.lost = d.lost.map((x) => ({ ...x })); this.worked = d.worked.map((x) => ({ ...x }));
    this.weekNo = d.weekNo; this.history = d.history ?? []; this._ids = d.ids; if (d.rng != null) this.rng.state = d.rng;
    this._emit('load', {});
  }

  snapshot() {
    return { week: this.weekNo, fear: { ...this.fear }, open: this.leads.map((x) => ({ ...x })), lost: this.lost.length, worked: this.worked.length, carry: { ...this.carry } };
  }
}

/** Drive Fear from the breach system (#26): call after crisis.advanceWeek() each week. */
export function attachCrisis(market, crisis) {
  return crisis.on('week', () => {
    const s = crisis.snapshot();
    market.week({ tensions: Object.fromEntries(s.tracks.map((t) => [t.id, t.tension])), breaching: s.tracks.filter((t) => t.state === 'breach').map((t) => t.id) });
  });
}
