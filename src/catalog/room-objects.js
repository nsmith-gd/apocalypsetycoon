// Catalog room objects (#140): the bunker objects that make every GDD room buildable.
//
// The grid builds rooms from objects (an enclosed space is the room its objects define; src/catalog/identify.js).
// 30 rooms' defining objects and the fixtures / surface builds with no object yet ("planned" in rooms.js) are
// generated here from the room's GDD data, so all 73 catalog entries can be built:
//   size      the room's GDD footprint, less a walking tile: the object is the room's centrepiece
//             (double-height rooms get a double-height object, so they need a double-height space)
//   cost      the room's GDD cost (it IS the room's price), x PRICE_SCALE
//   stats     the room's provides / draws: power, water, meals, prestige, comfort, seal, blast, security,
//             noise, storage, staff, visibility
//   cat       by needs tier, so the tier trim and colours follow (survive machines, comfort, status, delusion)
//   gating    `unlockAt` (the room's unlock time) and `track` (alternate rooms: only in worlds running the track)
// Objects that already existed keep their hand-tuned numbers; they only gain the room's unlock time and track.

import { GDD_ROOMS } from './rooms.js';

// Player-facing names for the generated objects.
export const PLANNED_NAMES = Object.freeze({
  faraday_cage: 'Faraday cage', fish_tank: 'Fish tank', seed_locker: 'Seed locker', washer: 'Washer-dryer stack',
  therapy_couch: 'Therapy couch', atrium_tree: 'Atrium tree', biohack_pod: 'Biohacking pod', broadcast_desk: 'Broadcast desk',
  panic_console: 'Panic room console', crib: 'Heir crib', car_lift: 'Car lift and display', humidor: 'Walk-in humidor',
  sauna_stove: 'Sauna stove', pool_basin: 'Infinity pool basin', self_statue: 'Statue of yourself', sarcophagus: 'Gold sarcophagus',
  throne: 'Throne', mansion_facade: 'Mansion facade', dome_tree: 'Dome canopy tree', clone_tank: 'Clone tank',
  broadcast_array: 'Broadcast array', gene_bank: 'Gene bank', emp_coil: 'EMP coil', boiler: 'Boiler', radio_set: 'Long-wave radio set',
  condenser_unit: 'Atmospheric condenser', vault_tank: 'Vault tank', kiln: 'Ceramic kiln', fuel_bladder: 'Fuel bladder',
  convoy_ramp: 'Convoy ramp',
  // fixtures and surface builds with no object before
  flood_seal_kit: 'Flood seals and storm shutters', ceramic_liner: 'Ceramic lining', thermal_clad: 'Thermal cladding',
  debris_cap: 'Debris cap', helipad_deck: 'Helipad', embassy_office: 'Cloud embassy',
});

// Fixture / surface catalog entries and the object that stands for them.
export const ENTRY_OBJECTS = Object.freeze({
  flood_seals: 'flood_seal_kit', ceramic_lining: 'ceramic_liner', thermal_cladding: 'thermal_clad', debris_cap: 'debris_cap',
  helipad: 'helipad_deck', cloud_embassy: 'embassy_office',
});

// Needs tier -> object category (the grid's colours and power-shedding priority follow the category).
const CAT_BY_TIER = { survive: 'security', comfort: 'comfort', status: 'status', delusion: 'delusion' };
const MACHINE_CAT = { power: 'power', waterPerDay: 'water', mealsPerDay: 'food', air: 'air', security: 'security' };

/** The defining object of a room: the first `all` entry, else the first `anyOf`. */
export const definingObject = (room) => (room.requires ? Object.keys(room.requires.all ?? {})[0] ?? room.requires.anyOf?.[0] : null) ?? ENTRY_OBJECTS[room.id] ?? null;

function sizeFor(room) {
  const { w, h, fixture, surface, doubleHeight } = room.size;
  if (fixture) return { w: 2, h: 1 }; // a kit fitted to a room's wall
  const rw = w ?? 2, rh = h ?? 3;
  if (surface) return { w: Math.max(1, rw), h: Math.max(1, Math.min(rh, 4)) };
  return {
    w: Math.max(1, Math.min(rw - 1, rw >= 8 ? Math.ceil(rw / 2) : rw >= 6 ? 3 : 2)),
    h: doubleHeight ? Math.max(4, rh - 1) : Math.max(1, Math.min(rh, 3) - (rw <= 2 ? 0 : 1)),
  };
}

function statsFor(room) {
  const s = room.stats ?? {};
  const o = {};
  if (s.power) o.power = s.power;
  if (s.waterPerDay) o.water = s.waterPerDay;
  if (s.mealsPerDay) o.food = s.mealsPerDay;
  if (s.air) o.air = s.air * 30; // people -> m3/h (30 per person)
  for (const k of ['prestige', 'seal', 'blast', 'security', 'noise', 'staff', 'visibility']) if (s[k]) o[k] = s[k];
  if (s.comfort) o.beauty = s.comfort * 2;
  if (s.morale) o.morale = s.morale;
  if (s.waterStored) o.waterStock = s.waterStored;
  if (s.fuelStored) o.fuelStock = s.fuelStored;
  if (s.floodSeal) o.floodSeal = s.floodSeal;
  if (s.heatLoss) o.heatLoss = s.heatLoss;
  if (s.sleeps) o.beds = s.sleeps;
  if (room.tier === 'status' || room.tier === 'delusion') o.luxury = true;
  const net = [];
  if ((o.power ?? 0) < 0 || (o.power ?? 0) > 0) net.push('power');
  if (o.water) net.push('water');
  if (net.length) o.net = net;
  return o;
}

/**
 * Generated object definitions (before PRICE_SCALE), for every catalog room whose defining object doesn't
 * exist yet. `existing` = ids already in the bunker catalog.
 */
export function catalogObjects(existing) {
  const out = [];
  const seen = new Set(existing);
  for (const room of GDD_ROOMS) {
    // every object the room's definition names (and the entry object of a fixture / surface build)
    const ids = [...Object.keys(room.requires?.all ?? {}), ...(room.requires?.anyOf ?? []), ENTRY_OBJECTS[room.id]].filter(Boolean);
    for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const st = statsFor(room);
    const cat = Object.entries(MACHINE_CAT).find(([k]) => room.stats?.[k] > 0)?.[1] ?? CAT_BY_TIER[room.tier];
    out.push({
      id, name: PLANNED_NAMES[id] ?? room.name, cat, ...sizeFor(room), cost: room.cost,
      ...st,
      ...(room.size.fixture ? { layer: 'wall', fixture: true } : {}),
      ...(room.size.surface ? { surface: true } : {}),
      ...(room.size.minDepth ? { minDepth: room.size.minDepth } : {}),
      room: room.id, tier: room.tier, unlockAt: room.unlockAt, ...(room.track ? { track: room.track } : {}),
      generated: true,
    });
    }
  }
  return out;
}

/** Unlock time and track for every object that defines (or stands for) a catalog room. */
export function roomGates() {
  const out = {};
  for (const room of GDD_ROOMS) {
    const ids = new Set([definingObject(room), ...(room.objects ?? [])].filter(Boolean));
    for (const id of ids) {
      const g = out[id];
      // an object shared by several rooms unlocks with the earliest of them
      if (!g || room.unlockAt < g.unlockAt) out[id] = { room: room.id, unlockAt: room.unlockAt, track: room.track ?? null };
    }
  }
  return out;
}
