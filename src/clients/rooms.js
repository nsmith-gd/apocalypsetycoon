// Room catalog: what each room costs to build and whether clients see it as luxury
// or as plumbing. Survival numbers (air / water / food) live in Midnight's ROOM_STATS so
// there is exactly one source of truth for what Midnight grades.

import { ROOM_STATS } from '../midnight/midnight.js';
import { GDD_ROOMS } from '../catalog/rooms.js';

// #91: prices in GDD dollars. Rooms linked to the GDD catalog (src/catalog/rooms.js `amenity`) take its price;
// the rest are the old $K price x MONEY.fromStandIn.rooms (40), inside the GDD tier ranges.
const GDD_PRICE = Object.fromEntries(GDD_ROOMS.filter((r) => r.amenity).map((r) => [r.amenity, r.cost]));
const ROOMS_RAW = {
  bunk: { name: 'Bunk room', cost: 800_000, kind: 'basic' },
  gold_taps: { name: 'Gold taps', cost: 1_600_000, kind: 'luxury' },
  air_vent: { name: 'Air vent', cost: 600_000, kind: 'survival' },
  water_tank: { name: 'Water tank', cost: 600_000, kind: 'survival' },
  pantry: { name: 'Pantry', cost: 480_000, kind: 'survival' },
  hydroponics: { name: 'Hydroponic garden', cost: 1_400_000, kind: 'survival', research: true },
  water_recycler: { name: 'Deep-well recycler', cost: 1_800_000, kind: 'survival', research: true },
  mil_scrubber: { name: 'Military air scrubber', cost: 2_800_000, kind: 'survival', research: true },
  cryo_pod: { name: 'Cryo pod suite', cost: 4_800_000, kind: 'luxury', research: true },
  wine_cellar: { name: 'Wine cellar & panic room', cost: 3_600_000, kind: 'luxury', research: true },
  ai_butler: { name: 'AI butler core', cost: 8_000_000, kind: 'luxury', research: true },
};
export const ROOM_CATALOG = Object.freeze(Object.fromEntries(Object.entries(ROOMS_RAW).map(([id, r]) => [id, Object.freeze({ ...r, cost: GDD_PRICE[id] ?? r.cost })])));

export function roomInfo(id) {
  const c = ROOM_CATALOG[id];
  const s = ROOM_STATS[id] ?? {};
  return c ? { id, ...c, air: s.air ?? 0, water: s.water ?? 0, food: s.food ?? 0, prestige: s.prestige ?? 0 } : null;
}

/** Rooms the player can build right now (base rooms + whatever research has unlocked). */
export function availableRooms(isUnlocked = () => false) {
  return Object.keys(ROOM_CATALOG).filter((id) => !ROOM_CATALOG[id].research || isUnlocked(id));
}
