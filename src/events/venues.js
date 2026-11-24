// Event venue catalog: social events the CEO can attend to meet guests and find leads
// (director note D2: "Leads should come through going to events and doing dialogue trees with guests").
//
// The data lives in data/venues.json. This module validates it against VENUE_SCHEMA and gives
// lookups by quarter and region. Pure rules, no DOM.
//
// Not the weekly event deck (#35): the deck is headlines that HAPPEN to you once a week; venues are
// places you CHOOSE to go. See src/events/README.md for how the two relate.

import { GDD_REGIONS, TRACK_BY_ID } from '../world/tracks.js';

export const VENUE_KINDS = Object.freeze(['gala', 'expo', 'summit', 'funeral', 'auction', 'retreat', 'sport', 'dinner']);
export const WEALTH_CLASSES = Object.freeze(['C1', 'C2', 'C3', 'C4', 'C5']);
export const QUARTERS = 12;

/**
 * Field-by-field schema for one venue entry. `check(value, venue)` returns an error string or null.
 * Kept as data so the README and any editor tooling can list the fields.
 */
const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const regionIds = GDD_REGIONS.map((r) => r.id);

export const VENUE_SCHEMA = Object.freeze({
  id: { doc: 'unique kebab-case id', check: (v) => (typeof v === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) ? null : 'must be a kebab-case string') },
  name: { doc: 'display name', check: (v) => (typeof v === 'string' && v.trim() ? null : 'must be a non-empty string') },
  kind: { doc: `one of ${VENUE_KINDS.join(', ')}`, check: (v) => (VENUE_KINDS.includes(v) ? null : `must be one of ${VENUE_KINDS.join('|')}`) },
  region: { doc: 'GDD region id', check: (v) => (regionIds.includes(v) ? null : `must be one of ${regionIds.join('|')}`) },
  quarters: {
    doc: 'quarters 1-12 in which the event runs (ascending, no repeats)',
    check: (v) => {
      if (!Array.isArray(v) || !v.length) return 'must be a non-empty array';
      if (!v.every((q) => isInt(q) && q >= 1 && q <= QUARTERS)) return `entries must be integers 1-${QUARTERS}`;
      if (!v.every((q, i) => i === 0 || q > v[i - 1])) return 'must be ascending with no repeats';
      return null;
    },
  },
  cost: {
    doc: '{ cash: dollars >= 0, days: agenda days >= 1 }',
    check: (v) => {
      if (!isObj(v)) return 'must be an object';
      if (!isInt(v.cash) || v.cash < 0) return 'cash must be a whole number >= 0';
      if (!isInt(v.days) || v.days < 1) return 'days must be a whole number >= 1';
      return null;
    },
  },
  guestPool: {
    doc: '{ size: people in the room, classes: { C1..C5: relative weight } }',
    check: (v) => {
      if (!isObj(v)) return 'must be an object';
      if (!isInt(v.size) || v.size < 1) return 'size must be a whole number >= 1';
      if (!isObj(v.classes)) return 'classes must be an object';
      const keys = Object.keys(v.classes);
      if (!keys.length) return 'classes must name at least one wealth class';
      for (const k of keys) {
        if (!WEALTH_CLASSES.includes(k)) return `unknown wealth class ${k}`;
        if (!isNum(v.classes[k]) || v.classes[k] <= 0) return `weight for ${k} must be > 0`;
      }
      return null;
    },
  },
  guestList: {
    doc: '{ min, max }: guests you actually get to talk to per attendance (min <= max <= pool size)',
    check: (v, venue) => {
      if (!isObj(v)) return 'must be an object';
      if (!isInt(v.min) || !isInt(v.max) || v.min < 1 || v.max < v.min) return 'needs whole numbers 1 <= min <= max';
      if (isObj(venue.guestPool) && isInt(venue.guestPool.size) && v.max > venue.guestPool.size) return 'max cannot exceed guestPool.size';
      return null;
    },
  },
  exposure: {
    doc: '{ heat: change per attendance, reputation: change per attendance, press: 0-1 chance a journalist attends }',
    check: (v) => {
      if (!isObj(v)) return 'must be an object';
      if (!isInt(v.heat) || !isInt(v.reputation)) return 'heat and reputation must be whole numbers';
      if (!isNum(v.press) || v.press < 0 || v.press > 1) return 'press must be between 0 and 1';
      return null;
    },
  },
  themes: {
    doc: 'threat track ids whose Fear makes guests here more receptive (may be empty)',
    check: (v) => (Array.isArray(v) && v.every((t) => TRACK_BY_ID[t]) ? null : 'must be an array of threat track ids'),
  },
  blurb: { doc: 'one or two lines of flavour', check: (v) => (typeof v === 'string' && v.trim() ? null : 'must be a non-empty string') },
});

/** Errors for one venue entry (empty array = valid). */
export function validateVenue(venue) {
  if (!isObj(venue)) return ['entry must be an object'];
  const errors = [];
  for (const [field, rule] of Object.entries(VENUE_SCHEMA)) {
    if (!(field in venue)) { errors.push(`${field}: missing`); continue; }
    const err = rule.check(venue[field], venue);
    if (err) errors.push(`${field}: ${err}`);
  }
  for (const field of Object.keys(venue)) if (!VENUE_SCHEMA[field]) errors.push(`${field}: unknown field`);
  return errors;
}

/** Validates a parsed catalog file and returns a frozen catalog. Throws listing every problem. */
export function parseVenueCatalog(json) {
  const problems = [];
  if (!isObj(json) || !Array.isArray(json.venues)) throw new Error('venue catalog: expected { venues: [...] }');
  const seen = new Set();
  json.venues.forEach((v, i) => {
    const label = v?.id ?? `#${i}`;
    for (const e of validateVenue(v)) problems.push(`${label}: ${e}`);
    if (v?.id && seen.has(v.id)) problems.push(`${label}: duplicate id`);
    seen.add(v?.id);
  });
  if (problems.length) throw new Error(`venue catalog invalid:\n  ${problems.join('\n  ')}`);
  return makeCatalog(json.venues);
}

function deepFreeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
}

function makeCatalog(list) {
  const venues = deepFreeze(structuredClone(list));
  const byId = Object.freeze(Object.fromEntries(venues.map((v) => [v.id, v])));
  return Object.freeze({
    venues,
    byId,
    /** Venues running in quarter q (1-12). Overtime quarters (13+) reuse Q12's line-up. */
    inQuarter: (q) => venues.filter((v) => v.quarters.includes(Math.min(q, QUARTERS))),
    inRegion: (regionId) => venues.filter((v) => v.region === regionId),
    /** Quarters with no venue at all (should be empty). */
    uncoveredQuarters: () => Array.from({ length: QUARTERS }, (_, i) => i + 1).filter((q) => !venues.some((v) => v.quarters.includes(q))),
  });
}

export const VENUE_DATA_URL = new URL('../../data/venues.json', import.meta.url);

/** Loads and validates data/venues.json (fetch in the browser, fs in Node). */
export async function loadVenueCatalog(url = VENUE_DATA_URL) {
  let json;
  if (typeof process !== 'undefined' && process.versions?.node && url.protocol === 'file:') {
    const { readFile } = await import('node:fs/promises');
    json = JSON.parse(await readFile(url, 'utf8'));
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`venue catalog: ${res.status} loading ${url}`);
    json = await res.json();
  }
  return parseVenueCatalog(json);
}
