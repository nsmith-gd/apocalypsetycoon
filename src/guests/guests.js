// Guest roster (#53, director note D2): archetypes, wealth, fears and traits for the people the CEO
// meets at events. Data lives in data/guests.json; this module validates it and rolls guests.
//
//   const roster = await loadGuestRoster();              // or parseGuestRoster(json)
//   const g = rollGuest(roster, rng, { wealthClass: 'C2', region: 'tech', world: ['atomic', ...], tension })
//   generateGuestList(roster, { seed, count: 5, classes: { C1: 2, C2: 1 }, region, world, tension, themes })
//
// A guest: { id, name, archetype, title, wealthClass, wealthTier, budget, region, dominantFear, fears[],
//            traits[], hiddenTraits[] }  (fears are threat track ids running in this campaign's world)
//
// Rules
// - Archetypes are drawn by how well they fit the wanted wealth class (and region, if any).
// - A fear on a track this world doesn't run moves to the track in the same slot (Grey Goo <-> The Bloom).
// - Fear weights grow with that track's current tension (+1x at 100) and with venue themes (+1x);
//   traits with fearBoost (Germaphobe: The Bloom x2) multiply too. The heaviest fear is the dominant one.
// - 2-3 traits per guest from the archetype's weights; hidden traits are kept apart for dialogue to reveal.
// - Same seed, same inputs: same guests.

import { mulberry32 } from '../pushback/pushback.js';
import { TRACK_BY_ID, CLASSIC_ROSTER, GDD_REGIONS } from '../world/tracks.js';

export const WEALTH_CLASSES = Object.freeze({
  C1: { tier: 'The Comfortably Nervous', budget: [3e6, 12e6] },
  C2: { tier: 'The Disruptors', budget: [10e6, 40e6] },
  C3: { tier: 'The Dynasties', budget: [30e6, 120e6] },
  C4: { tier: 'The Moguls', budget: [80e6, 400e6] },
  C5: { tier: 'The Table', budget: [500e6, 1500e6] },
});

const FIRST = ['Augustin', 'Bettina', 'Cornelius', 'Delphine', 'Ezra', 'Fenella', 'Gideon', 'Honoria', 'Ignatius', 'Juniper',
  'Kip', 'Lavinia', 'Magnus', 'Nadia', 'Orson', 'Priya', 'Quentin', 'Rosalind', 'Sterling', 'Tamsin', 'Ulrich', 'Vivienne',
  'Wendell', 'Ximena', 'Yusuf', 'Zelda', 'Barnaby', 'Celestine', 'Dashiell', 'Esme', 'Florian', 'Gwendolyn'];
const LAST = ['Ashcombe', 'Blackwood', 'Carrington', 'Dunmore', 'Ellsworth', 'Fairfax', 'Grimsby', 'Hargreave', 'Ingram',
  'Jessup', 'Kensington', 'Lockhart', 'Montague', 'Northcott', 'Oakes', 'Pennington', 'Quill', 'Rothwell', 'Sinclair',
  'Thorne', 'Underhill', 'Vance', 'Whitlock', 'Yardley', 'Abernathy-Lux', 'Bellweather', 'Cavendish', 'Drummond'];

const REGION_IDS = GDD_REGIONS.map((r) => r.id);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const weights = (o) => isObj(o) && Object.keys(o).length > 0 && Object.values(o).every((w) => typeof w === 'number' && w > 0);

// ---------------- validation ----------------
export function validateRoster(json) {
  const errors = [];
  if (!isObj(json)) return ['roster must be an object'];
  const approaches = json.approaches;
  if (!Array.isArray(approaches) || !approaches.length) errors.push('approaches: must list conversation approaches');
  const traitIds = new Set();
  (json.traits ?? []).forEach((t, i) => {
    const at = `trait ${t?.id ?? `#${i}`}`;
    if (!t?.id) errors.push(`${at}: missing id`);
    if (traitIds.has(t.id)) errors.push(`${at}: duplicate id`);
    traitIds.add(t.id);
    if (!t.name) errors.push(`${at}: missing name`);
    if (!['personality', 'client', 'both'].includes(t.kind)) errors.push(`${at}: kind must be personality, client or both`);
    for (const k of ['likes', 'dislikes']) {
      if (!Array.isArray(t[k])) errors.push(`${at}: ${k} must be a list`);
      else for (const a of t[k]) if (!approaches?.includes(a)) errors.push(`${at}: unknown approach "${a}" in ${k}`);
    }
    for (const tr of Object.keys(t.fearBoost ?? {})) if (!TRACK_BY_ID[tr]) errors.push(`${at}: fearBoost on unknown track "${tr}"`);
  });
  if (!Array.isArray(json.traits) || !json.traits.length) errors.push('traits: must be a non-empty list');
  const ids = new Set();
  if (!Array.isArray(json.archetypes) || !json.archetypes.length) errors.push('archetypes: must be a non-empty list');
  (json.archetypes ?? []).forEach((a, i) => {
    const at = `archetype ${a?.id ?? `#${i}`}`;
    if (!a?.id) errors.push(`${at}: missing id`);
    if (ids.has(a.id)) errors.push(`${at}: duplicate id`);
    ids.add(a.id);
    if (!a.title) errors.push(`${at}: missing title`);
    if (!weights(a.classes)) errors.push(`${at}: classes must be positive weights`);
    else for (const c of Object.keys(a.classes)) if (!WEALTH_CLASSES[c]) errors.push(`${at}: unknown wealth class "${c}"`);
    if (a.regions != null) {
      if (!weights(a.regions)) errors.push(`${at}: regions must be positive weights`);
      else for (const r of Object.keys(a.regions)) if (!REGION_IDS.includes(r)) errors.push(`${at}: unknown region "${r}"`);
    }
    if (!weights(a.fears)) errors.push(`${at}: fears must be positive weights`);
    else for (const f of Object.keys(a.fears)) if (!TRACK_BY_ID[f]) errors.push(`${at}: unknown threat track "${f}"`);
    if (!weights(a.traits)) errors.push(`${at}: traits must be positive weights`);
    else for (const t of Object.keys(a.traits)) if (!traitIds.has(t)) errors.push(`${at}: unknown trait "${t}"`);
    const [lo, hi] = a.traitCount ?? [];
    if (!(Number.isInteger(lo) && Number.isInteger(hi) && lo >= 1 && lo <= hi)) errors.push(`${at}: traitCount must be [min, max]`);
    else if (weights(a.traits) && hi > Object.keys(a.traits).length) errors.push(`${at}: traitCount max exceeds its trait list`);
    if (!a.blurb) errors.push(`${at}: missing blurb`);
  });
  return errors;
}

function deepFreeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
}

export function parseGuestRoster(json) {
  const errors = validateRoster(json);
  if (errors.length) throw new Error(`guest roster invalid:\n  ${errors.join('\n  ')}`);
  const data = deepFreeze(structuredClone(json));
  return Object.freeze({
    approaches: data.approaches,
    traits: data.traits,
    archetypes: data.archetypes,
    traitById: Object.freeze(Object.fromEntries(data.traits.map((t) => [t.id, t]))),
    archetypeById: Object.freeze(Object.fromEntries(data.archetypes.map((a) => [a.id, a]))),
  });
}

export const GUEST_DATA_URL = new URL('../../data/guests.json', import.meta.url);

export async function loadGuestRoster(url = GUEST_DATA_URL) {
  let json;
  if (typeof process !== 'undefined' && process.versions?.node && url.protocol === 'file:') {
    const { readFile } = await import('node:fs/promises');
    json = JSON.parse(await readFile(url, 'utf8'));
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`guest roster: ${res.status} loading ${url}`);
    json = await res.json();
  }
  return parseGuestRoster(json);
}

// ---------------- generation ----------------
function pickWeighted(rng, entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of entries) { r -= w; if (r < 0) return k; }
  return entries[entries.length - 1][0];
}

/** Map a track to the one this world runs in the same slot. */
export function trackInWorld(trackId, world = CLASSIC_ROSTER) {
  if (world.includes(trackId)) return trackId;
  const slot = TRACK_BY_ID[trackId]?.slot;
  return world.find((id) => TRACK_BY_ID[id].slot === slot) ?? null;
}

/** Archetypes that can appear as a wealth class, weighted by class fit (x2 if they favour the region). */
export function archetypesFor(roster, { wealthClass = null, region = null } = {}) {
  return roster.archetypes
    .filter((a) => !wealthClass || a.classes[wealthClass])
    .map((a) => [a.id, (wealthClass ? a.classes[wealthClass] : 1) * (region && a.regions?.[region] ? 2 : 1)]);
}

/**
 * Roll one guest. Options: archetypeId (force), wealthClass, region (where they are met), world (six track ids),
 * tension ({ trackId: 0-100 }), themes (track ids the venue is about), id, name.
 */
export function rollGuest(roster, rng, { archetypeId = null, wealthClass = null, region = null, world = CLASSIC_ROSTER, tension = {}, themes = [], id = null } = {}) {
  let pool = archetypesFor(roster, { wealthClass, region });
  if (!pool.length) pool = archetypesFor(roster, { region });
  const arch = roster.archetypeById[archetypeId ?? pickWeighted(rng, pool)];
  if (!arch) throw new Error(`unknown archetype ${archetypeId}`);
  const cls = wealthClass && arch.classes[wealthClass] ? wealthClass : pickWeighted(rng, Object.entries(arch.classes));
  const home = region ?? (arch.regions ? pickWeighted(rng, Object.entries(arch.regions)) : REGION_IDS[Math.floor(rng() * REGION_IDS.length)]);

  // Traits
  const [lo, hi] = arch.traitCount;
  const n = lo + Math.floor(rng() * (hi - lo + 1));
  const left = Object.entries(arch.traits);
  const traitIds = [];
  while (traitIds.length < n && left.length) {
    const t = pickWeighted(rng, left);
    traitIds.push(t);
    left.splice(left.findIndex(([k]) => k === t), 1);
  }

  // Fears: mapped into this world, weighted by tension, venue themes and trait boosts.
  const fearW = {};
  for (const [t, w] of Object.entries(arch.fears)) {
    const inWorld = trackInWorld(t, world);
    if (inWorld) fearW[inWorld] = (fearW[inWorld] ?? 0) + w;
  }
  for (const t of Object.keys(fearW)) {
    fearW[t] *= 1 + (tension[t] ?? 0) / 100;
    if (themes.includes(t)) fearW[t] *= 2;
    for (const tid of traitIds) fearW[t] *= roster.traitById[tid].fearBoost?.[t] ?? 1;
  }
  const fears = Object.entries(fearW).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const dominantFear = fears.length ? pickWeighted(rng, fears.map(([t, w]) => [t, w * w])) : null; // squared: the heaviest usually wins

  const [bLo, bHi] = WEALTH_CLASSES[cls].budget;
  const budget = Math.round((bLo + rng() * (bHi - bLo)) / 1e5) * 1e5;
  const name = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`;
  const visible = traitIds.filter((t) => !roster.traitById[t].hidden);
  const hidden = traitIds.filter((t) => roster.traitById[t].hidden);
  return {
    id: id ?? `${arch.id}:${Math.floor(rng() * 1e9).toString(36)}`,
    name,
    archetype: arch.id,
    title: arch.title,
    wealthClass: cls,
    wealthTier: WEALTH_CLASSES[cls].tier,
    budget,
    region: home,
    dominantFear,
    fears: [dominantFear, ...fears.map(([t]) => t).filter((t) => t !== dominantFear)].filter(Boolean),
    traits: visible,
    hiddenTraits: hidden,
  };
}

/**
 * A guest list for an event. classes: wealth-class weights ({ C1: 2, C2: 1 }); region: where the event is
 * (most guests are local); count; seed or rng. Archetypes don't repeat within a list while others fit.
 */
export function generateGuestList(roster, { seed = 1, rng = null, count = 4, classes = { C1: 1 }, region = null, world = CLASSIC_ROSTER, tension = {}, themes = [], idPrefix = 'guest' } = {}) {
  const r = rng ?? mulberry32(seed);
  const used = new Set();
  const list = [];
  for (let i = 0; i < count; i++) {
    const cls = pickWeighted(r, Object.entries(classes));
    const local = region && r() < 0.7 ? region : null;
    let pool = archetypesFor(roster, { wealthClass: cls, region }).filter(([id]) => !used.has(id));
    if (!pool.length) pool = archetypesFor(roster, { wealthClass: cls, region });
    if (!pool.length) continue;
    const archetypeId = pickWeighted(r, pool);
    used.add(archetypeId);
    list.push(rollGuest(roster, r, { archetypeId, wealthClass: cls, region: local, world, tension, themes, id: `${idPrefix}-${i + 1}` }));
  }
  return list;
}
