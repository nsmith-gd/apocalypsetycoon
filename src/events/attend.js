// Attend-event flow (director note D2): pick a venue that runs this quarter, pay its cash and agenda
// days, walk in and get a guest list drawn from the venue's pool, then leave and go back to the
// screen you came from. Dialogue with guests (and turning them into leads) is a later ticket; this
// module hands it the guest list. Pure game state, no DOM: presentation belongs to a UI task.
//
//   const circuit = new EventCircuit({ catalog, ledger, seed, clock, addHeat, addReputation });
//   circuit.options(quarter)            -> every venue this quarter, with canAttend / reason
//   const visit = circuit.attend(id, { quarter, from: 'world' })   // pays, holds the clock
//   visit.guests                        -> [{ id, name, wealthClass, region, fears, venueId }]
//   circuit.meet(guestId)               -> marks a guest as met (dialogue calls this)
//   circuit.leave()                     -> { visit, returnTo: 'world' }, releases the clock
//
// Rules
// - Agenda: the CEO has AGENDA.daysPerQuarter days a quarter for events; unused days do not carry over.
// - Each venue can be attended once per quarter, and only one visit can be open at a time.
// - Guest classes follow the GDD arrival times: a class that has not arrived by the quarter is not in
//   the room. A venue whose whole crowd has not arrived yet cannot be attended.
// - Each venue has a fixed pool of `guestPool.size` people (stable for the campaign seed). A guest list
//   samples `guestList.min..max` of them without repeats, skipping people you have already met there.
// - Exposure applies on arrival: heat and reputation change, and a journalist is present with chance `press`.

import { mulberry32 } from '../pushback/pushback.js';
import { GDD_REGIONS, TRACKS, CLASSIC_ROSTER, resolveTracks } from '../world/tracks.js';
import { PACING } from '../debug/pacing.js';

export const AGENDA = Object.freeze({ daysPerQuarter: 6 });

// GDD Clients > Wealth classes, "Arrives at" (minutes of play). A class is in the room in quarter q
// if it arrives before that quarter ends.
export const CLASS_ARRIVES_AT = Object.freeze({ C1: 0, C2: 70, C3: 135, C4: 230, C5: 270 });
export const classArrivedBy = (cls, quarter, quarterMinutes = PACING.quarterMinutes) =>
  CLASS_ARRIVES_AT[cls] < Math.min(quarter, 12) * quarterMinutes;

const FIRST = ['Augustin', 'Bettina', 'Cornelius', 'Delphine', 'Ezra', 'Fenella', 'Gideon', 'Honoria', 'Ignatius', 'Juniper',
  'Kip', 'Lavinia', 'Magnus', 'Nadia', 'Orson', 'Priya', 'Quentin', 'Rosalind', 'Sterling', 'Tamsin', 'Ulrich', 'Vivienne',
  'Wendell', 'Ximena', 'Yusuf', 'Zelda'];
const LAST = ['Ashcombe', 'Blackwood', 'Carrington', 'Dunmore', 'Ellsworth', 'Fairfax', 'Grimsby', 'Hargreave', 'Ingram',
  'Jessup', 'Kensington', 'Lockhart', 'Montague', 'Northcott', 'Oakes', 'Pennington', 'Quill', 'Rothwell', 'Sinclair',
  'Thorne', 'Underhill', 'Vance', 'Whitlock', 'Yardley'];

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function pickWeighted(rng, weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of entries) { r -= w; if (r < 0) return k; }
  return entries[entries.length - 1][0];
}

/** Tracks that are hot (high or medium) in a region. */
const hotTracksIn = (regionId, roster) => TRACKS.filter((t) => t.exposure[regionId] && roster.includes(t.id)).map((t) => t.id);

export class EventCircuit {
  constructor({ catalog, ledger = null, seed = 1, clock = null, addHeat = null, addReputation = null,
    daysPerQuarter = AGENDA.daysPerQuarter, quarterMinutes = PACING.quarterMinutes, roster = CLASSIC_ROSTER } = {}) {
    if (!catalog) throw new Error('EventCircuit needs a venue catalog');
    this.catalog = catalog;
    this.getRoster = typeof roster === 'function' ? roster : () => roster; // #75: guest fears follow slots
    this.ledger = ledger;
    this.seed = seed;
    this.clock = clock;
    this.addHeat = addHeat;
    this.addReputation = addReputation;
    this.daysPerQuarter = daysPerQuarter;
    this.quarterMinutes = quarterMinutes;
    this.daysUsed = {};        // quarter -> agenda days spent
    this.attended = {};        // quarter -> [venueId]
    this.met = {};             // venueId -> [guestId]
    this.current = null;       // open visit
    this.history = [];         // closed visits (summaries)
    this.visits = 0;
    this.listeners = new Set();
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, data) { for (const fn of this.listeners) fn(type, data); }

  daysLeft(quarter) { return this.daysPerQuarter - (this.daysUsed[quarter] ?? 0); }

  /** Wealth classes of a venue's crowd that are in the game by `quarter`. */
  presentClasses(venue, quarter) {
    return Object.fromEntries(Object.entries(venue.guestPool.classes).filter(([c]) => classArrivedBy(c, quarter, this.quarterMinutes)));
  }

  /** Why a venue can't be attended right now, or null if it can. */
  blocker(venue, quarter) {
    if (!venue) return 'unknown event';
    if (this.current) return 'already at an event';
    if (!venue.quarters.includes(Math.min(quarter, 12))) return 'not running this quarter';
    if ((this.attended[quarter] ?? []).includes(venue.id)) return 'already attended this quarter';
    if (!Object.keys(this.presentClasses(venue, quarter)).length) return 'this crowd has not arrived yet';
    if (venue.cost.days > this.daysLeft(quarter)) return 'not enough agenda days';
    if (this.ledger && this.ledger.cash < venue.cost.cash) return 'not enough cash';
    if (!this.guestCandidates(venue, quarter).length) return 'you have met everyone here';
    return null;
  }

  /** Every venue running this quarter, with whether the player can go and why not. */
  options(quarter) {
    return this.catalog.inQuarter(quarter).map((venue) => {
      const reason = this.blocker(venue, quarter);
      return { venue, canAttend: !reason, reason };
    });
  }

  /** The venue's fixed crowd for this campaign: `size` people with stable ids, classes and fears. */
  pool(venue) {
    const rng = mulberry32(hashString(`${this.seed}:${venue.id}`));
    const regionName = GDD_REGIONS.find((r) => r.id === venue.region)?.name ?? venue.region;
    const roster = this.getRoster();
    const local = hotTracksIn(venue.region, roster);
    const themes = resolveTracks(roster, venue.themes); // venue themes name Classic tracks: read them by slot
    return Array.from({ length: venue.guestPool.size }, (_, i) => {
      const fearsFrom = themes.length ? themes : local;
      const fears = fearsFrom.length ? [fearsFrom[Math.floor(rng() * fearsFrom.length)]] : [];
      return {
        id: `${venue.id}#${i + 1}`,
        name: `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`,
        wealthClass: pickWeighted(rng, venue.guestPool.classes),
        region: venue.region,
        regionName,
        fears,
        venueId: venue.id,
      };
    });
  }

  guestCandidates(venue, quarter) {
    const met = new Set(this.met[venue.id] ?? []);
    const present = this.presentClasses(venue, quarter);
    return this.pool(venue).filter((g) => present[g.wealthClass] && !met.has(g.id));
  }

  /**
   * Pay for and enter a venue. `from` is the screen to return to on leave().
   * Throws with the blocker reason if the player can't go.
   */
  attend(venueId, { quarter, from = null } = {}) {
    if (!Number.isInteger(quarter) || quarter < 1) throw new Error('attend needs the current quarter');
    const venue = this.catalog.byId[venueId];
    const reason = this.blocker(venue, quarter);
    if (reason) throw new Error(`Can't attend ${venue?.name ?? venueId}: ${reason}`);

    this.visits += 1;
    const rng = mulberry32(hashString(`${this.seed}:${venue.id}:${quarter}:${this.visits}`));

    if (this.ledger && venue.cost.cash) this.ledger.record('other', `Event: ${venue.name}`, -venue.cost.cash);
    this.daysUsed[quarter] = (this.daysUsed[quarter] ?? 0) + venue.cost.days;
    (this.attended[quarter] ??= []).push(venue.id);

    // Guest list: sample without replacement from the people still to meet.
    const candidates = this.guestCandidates(venue, quarter);
    const want = venue.guestList.min + Math.floor(rng() * (venue.guestList.max - venue.guestList.min + 1));
    const guests = [];
    while (guests.length < want && candidates.length) guests.push(candidates.splice(Math.floor(rng() * candidates.length), 1)[0]);

    const press = rng() < venue.exposure.press;
    if (venue.exposure.heat && this.addHeat) this.addHeat(venue.exposure.heat, venue.name);
    if (venue.exposure.reputation && this.addReputation) this.addReputation(venue.exposure.reputation, venue.name);

    this.clock?.hold?.('event');
    this.current = {
      venueId: venue.id, venueName: venue.name, quarter, from, press,
      cost: { ...venue.cost }, exposure: { heat: venue.exposure.heat, reputation: venue.exposure.reputation },
      guests, met: [],
    };
    this.emit('attend', this.current);
    return this.current;
  }

  /** Mark a guest at the current event as met (they won't be on future lists for this venue). */
  meet(guestId) {
    const v = this.current;
    if (!v) throw new Error('not at an event');
    if (!v.guests.some((g) => g.id === guestId)) throw new Error(`${guestId} is not on this guest list`);
    if (v.met.includes(guestId)) return false;
    v.met.push(guestId);
    (this.met[v.venueId] ??= []).push(guestId);
    this.emit('meet', { visit: v, guestId });
    return true;
  }

  /** End the visit and go back where the player came from. */
  leave() {
    const visit = this.current;
    if (!visit) return { visit: null, returnTo: null };
    this.current = null;
    this.history.push({ venueId: visit.venueId, quarter: visit.quarter, guests: visit.guests.length, met: visit.met.length, press: visit.press });
    this.clock?.release?.('event');
    this.emit('leave', visit);
    return { visit, returnTo: visit.from };
  }

  toJSON() {
    // An open visit is closed on save: leaving mid-event keeps the costs but not the guest list.
    return { daysUsed: this.daysUsed, attended: this.attended, met: this.met, history: this.history, visits: this.visits };
  }

  load(d = {}) {
    if (this.current) this.leave();
    this.daysUsed = d.daysUsed ?? {};
    this.attended = d.attended ?? {};
    this.met = d.met ?? {};
    this.history = d.history ?? [];
    this.visits = d.visits ?? 0;
  }
}
