// Room catalog: what each room costs to build and whether clients see it as luxury
// or as plumbing. Survival numbers (air / water / food) live in Midnight's ROOM_STATS so
// there is exactly one source of truth for what Midnight grades.

import { ROOM_STATS } from '../midnight/midnight.js';

export const ROOM_CATALOG = Object.freeze({
  bunk: { name: 'Bunk room', cost: 20_000, kind: 'basic' },
  gold_taps: { name: 'Gold taps', cost: 40_000, kind: 'luxury' },
  air_vent: { name: 'Air vent', cost: 15_000, kind: 'survival' },
  water_tank: { name: 'Water tank', cost: 15_000, kind: 'survival' },
  pantry: { name: 'Pantry', cost: 12_000, kind: 'survival' },
  hydroponics: { name: 'Hydroponic garden', cost: 35_000, kind: 'survival', research: true },
  water_recycler: { name: 'Deep-well recycler', cost: 45_000, kind: 'survival', research: true },
  mil_scrubber: { name: 'Military air scrubber', cost: 70_000, kind: 'survival', research: true },
  cryo_pod: { name: 'Cryo pod suite', cost: 120_000, kind: 'luxury', research: true },
  wine_cellar: { name: 'Wine cellar & panic room', cost: 90_000, kind: 'luxury', research: true },
  ai_butler: { name: 'AI butler core', cost: 200_000, kind: 'luxury', research: true },
});

export function roomInfo(id) {
  const c = ROOM_CATALOG[id];
  const s = ROOM_STATS[id] ?? {};
  return c ? { id, ...c, air: s.air ?? 0, water: s.water ?? 0, food: s.food ?? 0, prestige: s.prestige ?? 0 } : null;
}

/** Rooms the player can build right now (base rooms + whatever research has unlocked). */
export function availableRooms(isUnlocked = () => false) {
  return Object.keys(ROOM_CATALOG).filter((id) => !ROOM_CATALOG[id].research || isUnlocked(id));
}
