// Room identity (director review of #36): a room is an enclosed space with objects inside it. Specific
// object requirements make it reach the definition of a specific room, and a room has ONE identity at a time.
//
//   identifyRoom(counts, { width, roster }) -> { type, hint }
//     counts  { objectId: how many are inside the space }
//     type    the room it is: { id, name, tier, minW, requires, gdd } (a GDD room, or Washroom / Storeroom / Empty room)
//     hint    the closest room it is NOT yet, and what to add: { id, name, missing: [{ object, count }] } or null
//
// Choosing one identity when several definitions are met:
//   1. the most specific definition (more required objects): a bookshelf and a pool table make a Library, not a Lounge;
//   2. then the one with more of its defining objects inside: two generators and a battery make a Diesel Generator room;
//   3. then the higher needs tier (Delusion > Status > Comfort > Survive): a stove and a fridge make a Galley Kitchen,
//      a bunk and a four-poster a Master Suite;
//   4. then the one whose defining objects are worth more: a four-poster beats a double bed (Master Suite, not Guest
//      Quarters), a recycler beats a water tank;
//   5. then the later unlock.
// Objects that don't belong to the winning room just sit in it.
// Size is not part of the definition: a room narrower than the GDD size is still that room, but "cramped".

import { ENCLOSED_ROOMS } from './rooms.js';
import { OBJECTS } from '../shelter/bunker-catalog.js';

const TIER_RANK = { survive: 0, comfort: 1, status: 2, delusion: 3 };

// Identities outside the GDD catalog: plumbing rooms the grid needs, and the fallbacks.
export const EXTRA_ROOMS = Object.freeze([
  { id: 'washroom', name: 'Washroom', tier: 'comfort', minW: 2, requires: { anyOf: ['toilet', 'shower', 'sink', 'bathtub'] }, gdd: false },
]);
export const STOREROOM = Object.freeze({ id: 'storeroom', name: 'Storeroom', tier: 'survive', minW: 1, requires: null, gdd: false });
export const EMPTY_ROOM = Object.freeze({ id: 'empty', name: 'Empty room', tier: 'survive', minW: 1, requires: null, gdd: false });

const objectsOf = (req) => [...Object.keys(req?.all ?? {}), ...(req?.anyOf ?? [])];
/** A definition can be built once every object it names exists in the bunker catalog. */
export const buildable = (req) => objectsOf(req).length > 0 && Object.keys(req.all ?? {}).every((o) => OBJECTS[o]) && (!req.anyOf || req.anyOf.some((o) => OBJECTS[o]));
const value = (req, counts) => objectsOf(req).reduce((s, o) => s + (counts[o] ? (OBJECTS[o]?.cost ?? 0) : 0), 0);
const strength = (req, counts) => objectsOf(req).reduce((s, o) => s + (counts[o] ?? 0), 0);
const specificity = (req) => Object.values(req.all ?? {}).reduce((s, n) => s + n, 0) + (req.anyOf?.length ? 1 : 0);

/** Every identity a walled space can take, most specific first. */
export const ROOM_TYPES = Object.freeze([
  ...ENCLOSED_ROOMS.map((r) => ({ id: r.id, name: r.name, tier: r.tier, minW: r.size.w ?? 1, requires: r.requires, unlockAt: r.unlockAt, track: r.track ?? null, gdd: true })),
  ...EXTRA_ROOMS.map((r) => ({ ...r, unlockAt: 0, track: null })),
].sort((a, b) => specificity(b.requires) - specificity(a.requires) || TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.unlockAt - a.unlockAt)
  .map((t) => Object.freeze(t)));

/** Missing objects for one definition, given what is inside ([] = met). */
export function missingFor(req, counts) {
  const out = [];
  for (const [o, n] of Object.entries(req.all ?? {})) if ((counts[o] ?? 0) < n) out.push({ object: o, count: n - (counts[o] ?? 0) });
  if (req.anyOf?.length && !req.anyOf.some((o) => (counts[o] ?? 0) > 0)) out.push({ object: req.anyOf.find((o) => OBJECTS[o]) ?? req.anyOf[0], count: 1, orAny: req.anyOf });
  return out;
}

const inWorld = (t, roster) => !t.track || !roster || roster.includes(t.track);

export function identifyRoom(counts = {}, { roster = null } = {}) {
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const candidates = ROOM_TYPES.filter((t) => inWorld(t, roster) && buildable(t.requires));
  const met = candidates.filter((t) => missingFor(t.requires, counts).length === 0);
  // ROOM_TYPES is already ordered by specificity, tier and unlock; among equally specific matches the one with
  // more of its defining objects inside wins (two generators and a battery make a generator room).
  const best = met.filter((t) => specificity(t.requires) === specificity(met[0]?.requires ?? {}));
  best.sort((a, b) => strength(b.requires, counts) - strength(a.requires, counts) || TIER_RANK[b.tier] - TIER_RANK[a.tier] || value(b.requires, counts) - value(a.requires, counts)); // stable: unlock order on ties
  const type = total === 0 ? EMPTY_ROOM : best[0] ?? STOREROOM;
  // Hint: the closest buildable definition this room doesn't meet yet, among those it has started on.
  let hint = null;
  for (const t of candidates) {
    if (t.id === type.id) continue;
    const req = t.requires;
    const has = objectsOf(req).some((o) => (counts[o] ?? 0) > 0);
    const missing = missingFor(req, counts);
    if (!has || !missing.length) continue;
    const need = missing.reduce((s, m) => s + m.count, 0);
    if (!hint || need < hint.need) hint = { id: t.id, name: t.name, missing, need };
  }
  return { type, hint: hint && type.id !== 'empty' ? hint : null };
}
