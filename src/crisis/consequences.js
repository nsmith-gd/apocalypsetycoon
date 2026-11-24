// Crisis consequences (#67; GDD: Crises and tipping points > Recovery, Breach and containment, Collapse and the domino).
// Listens to a CrisisSystem's events; does not change breach.js.
//
//   CONTAINED  the board reacts, member by member: Priya Sandoval -10, Cornelius Vane -5, Bryce Kettering +5.
//   BREACH WEEK heat +2 and board confidence -2 per track in breach: breach.js already applies these every week
//              (BREACH.perBreachWeek -> pushback heat and crisis.boardConfidence, which the campaign hands to the
//              board as crisis fallout each quarter). This module mirrors the numbers in CONSEQUENCES.breachWeek and
//              counts the weeks, but does not apply them a second time.
//   COLLAPSE   the track's hot regions fill with ruin events. For every sold site in a region exposed to the track:
//              - a damage check (seeded): high exposure 60%, medium 30%; a hit sets site.damaged and a damage record;
//              - retainers stop: site.retainerStopped, retainer income 0 from then on (retainerFor(site));
//              - in high-exposure regions the client demands evacuation (queued in `evacuations`, 'evacuation' event).
//
//   const cons = new CrisisConsequences({ crisis, board, sites: () => mapSales.sold, seed });
//   cons.on('ruin' | 'evacuation' | 'reaction', fn);  cons.drainNotes() -> lines for the quarter report

import { seededRng } from '../campaign/rng.js';
import { REGIONS as SALES_REGIONS } from '../demand/demand.js';
import { TUNING } from '../config/tuning.js';

const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v); return Object.freeze(o); };

export const CONSEQUENCES = deepFreeze({
  // GDD Recovery: "The board reacts: Priya Sandoval -10, Cornelius Vane -5, Bryce Kettering +5 (he loves a thrill)."
  containedReactions: { sandoval: -10, vane: -5, kettering: 5 },
  // GDD Breach and containment, step 4 (applied by breach.js; listed here so both stay in one place to check).
  breachWeek: { heat: 2, boardConfidence: -2 },
  ruin: {
    damageChance: { high: 0.6, medium: 0.3 }, // provisional: the GDD says "damage checks" without odds
    retainerStopsAt: ['high', 'medium'], // every hot region
    evacuationAt: ['high'], // clients in the worst-hit regions demand to be got out
  },
});

/** How exposed a (map) region is to a track: 'high' | 'medium' | 'low'. */
export function exposureLevel(regionId, trackId, regions = SALES_REGIONS) {
  return regions.find((r) => r.id === regionId)?.exposure?.[trackId] ?? 'low';
}

/** Quarterly retainer for a sold site (GDD: 4% of the build price), 0 once a collapse has stopped it. */
export function retainerFor(site) {
  return site?.retainerStopped ? 0 : Math.round((site?.price ?? 0) * (TUNING.retainer ?? 0.04));
}

export class CrisisConsequences {
  constructor({ crisis, board = null, sites = () => [], seed = 1, regions = SALES_REGIONS, config = CONSEQUENCES } = {}) {
    if (!crisis) throw new Error('CrisisConsequences needs a CrisisSystem');
    this.crisis = crisis;
    this.board = board;
    this.getSites = sites;
    this.regions = regions;
    this.cfg = config;
    this.rng = seededRng(seed);
    this.breachWeeks = 0; // breach weeks seen (all tracks)
    this.evacuations = []; // { site, owner, region, track, week, status: 'open' }
    this.ruins = []; // { track, week, sites: [{ site, damaged, retainerStopped, evacuation }] }
    this.notes = [];
    this._listeners = new Map();
    this._offs = [
      crisis.on('contained', (e) => this.onContained(e.track)),
      crisis.on('collapse', (e) => this.onCollapse(e.track)),
      crisis.on('week', () => { this.breachWeeks += crisis.activeBreaches.length; }),
    ];
  }

  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
    return () => this._listeners.get(type).delete(fn);
  }
  _emit(type, payload) { for (const fn of this._listeners.get(type) ?? []) fn(payload, this); }
  destroy() { this._offs.forEach((off) => off?.()); }

  trackName(id) { return this.crisis.tracks[id]?.name ?? id; }

  onContained(trackId) {
    const applied = {};
    for (const [member, amount] of Object.entries(this.cfg.containedReactions)) {
      applied[member] = this.board?.react ? this.board.react(member, amount, `${this.trackName(trackId)} breach contained`) : amount;
    }
    this.notes.push(`${this.trackName(trackId)} contained. The board reacts: Priya ${fmt(applied.sandoval)}, Cornelius ${fmt(applied.vane)}, Bryce ${fmt(applied.kettering)}.`);
    this._emit('reaction', { track: trackId, applied });
    return applied;
  }

  onCollapse(trackId) {
    const R = this.cfg.ruin;
    const week = this.crisis.week;
    const hit = [];
    for (const site of this.getSites()) {
      if (!site?.sold) continue;
      const level = exposureLevel(site.region, trackId, this.regions);
      if (!R.damageChance[level] && !R.retainerStopsAt.includes(level)) continue;
      const entry = { site: site.id, name: site.name, owner: site.owner, region: site.region, level, damaged: false, retainerStopped: false, evacuation: false };
      if (R.damageChance[level] && this.rng() < R.damageChance[level]) {
        site.damaged = true;
        (site.damage ??= []).push({ track: trackId, week });
        entry.damaged = true;
      }
      if (R.retainerStopsAt.includes(level) && !site.retainerStopped) {
        site.retainerStopped = true;
        site.retainer = 0;
        entry.retainerStopped = true;
      }
      if (R.evacuationAt.includes(level)) {
        const demand = { site: site.id, name: site.name, owner: site.owner, region: site.region, track: trackId, week, status: 'open' };
        this.evacuations.push(demand);
        entry.evacuation = true;
        this._emit('evacuation', demand);
      }
      hit.push(entry);
    }
    const ruin = { track: trackId, week, sites: hit };
    this.ruins.push(ruin);
    const dmg = hit.filter((h) => h.damaged).length;
    const evac = hit.filter((h) => h.evacuation).length;
    const stopped = hit.filter((h) => h.retainerStopped).length;
    this.notes.push(hit.length
      ? `${this.trackName(trackId)} collapsed: ${dmg} site${dmg === 1 ? '' : 's'} damaged, ${stopped} retainer${stopped === 1 ? '' : 's'} stopped, ${evac} client${evac === 1 ? '' : 's'} demanding evacuation.`
      : `${this.trackName(trackId)} collapsed. None of your sites are in its hot regions.`);
    this._emit('ruin', ruin);
    return ruin;
  }

  /** Lines collected since the last call (for the quarter report). */
  drainNotes() { const n = this.notes; this.notes = []; return n; }

  toJSON() { return { rng: this.rng.state, breachWeeks: this.breachWeeks, evacuations: this.evacuations, ruins: this.ruins, notes: this.notes }; }
  load(d = {}) {
    if (d.rng != null) this.rng.state = d.rng;
    for (const k of ['breachWeeks', 'evacuations', 'ruins', 'notes']) if (d[k] != null) this[k] = d[k];
  }
}

const fmt = (n) => `${n > 0 ? '+' : ''}${n}`;
