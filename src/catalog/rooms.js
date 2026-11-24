// GDD room catalog as data: all 73 rooms and fixtures (Shelter canvas > Room catalog), by tier.
// Survive 29, Comfort 10, Status 13, Delusion 9, alternate-track 12 (only in worlds running that track).
//
// The shelter grid builds rooms RimWorld-style from objects (src/shelter/bunker-catalog.js), so this is the
// design-level list: what each room is, when it unlocks, what it provides and draws, and what it costs.
// It links to the live tables instead of replacing them:
//   kind      'room' (an enclosed space; what is inside decides which room it is), 'fixture' (a door, lining or
//             seal fitted to a room), 'structure' (the spine) or 'surface' (built above ground, not enclosed)
//   requires  for rooms: the objects that make an enclosed space THIS room (see src/catalog/identify.js).
//             { all: { objectId: minCount }, anyOf: [objectIds] } — every `all` entry, plus at least one of `anyOf`.
//             Ids not in the bunker catalog yet are planned objects: the room exists in the data but can't be
//             built until its object is added.
//   objects   bunker objects (OBJECTS ids) that make or stand for this room or fixture in the grid
//   amenity   the client-package room id in src/clients/rooms.js, when there is one
//   row       the unlock schedule row (src/catalog/unlocks.js) that unlocks it
//
// Size: w x h tiles; `fixture` = a door/lining/fixture with no room of its own; `surface` = built at the
// surface; `minDepth` = metres; `fullHeight` = spans every floor (the spine).
// Money: `cost` is the GDD price in dollars. The GDD gives a price range per tier plus three exact prices
// (Micro-reactor $25M, Infinity Pool $6M, Mansion Replica Floor $20M); every other room's cost is placed in
// its tier's range by unlock time (`costSource: 'tier-range'`). Multiply by PRICE_SCALE for today's $K economy.
// stats: the numbers in "Provides"/"Draws" in machine form (power kW: + supplies, - draws; water L/day,
// meals/day, storage, sleeps, air = people, prestige, comfort, morale, seal, blast, security).

import { hm } from '../world/tracks.js';

export const TIERS = Object.freeze(['survive', 'comfort', 'status', 'delusion']);

// GDD Economy and tuning > Build and running costs.
export const TIER_COST = Object.freeze({
  survive: { lo: 200_000, hi: 1_500_000 },
  comfort: { lo: 300_000, hi: 1_000_000 },
  status: { lo: 800_000, hi: 4_000_000 },
  delusion: { lo: 2_000_000, hi: 12_000_000 },
});
export const EXACT_COST = Object.freeze({ micro_reactor: 25_000_000, infinity_pool: 6_000_000, mansion_replica_floor: 20_000_000 });

const R = (id, name, tier, size, at, provides, draws, stats = {}, link = {}) => ({ id, name, tier, size, unlockAt: hm(at), provides, draws, stats, ...link });
const S = (w, h, extra = {}) => ({ w, h, ...extra });

const RAW = [
  // ---------- Survive (hazard-yellow trim) ----------
  R('airlock', 'Airlock', 'survive', S(3, 3), '0:00', 'Entry, seal +1', '—', { seal: 1 }, { objects: ['airlock'] }),
  R('bunk_room', 'Bunk Room', 'survive', S(4, 3), '0:00', 'Sleeps 4', '—', { sleeps: 4 }, { objects: ['bunk'], amenity: 'bunk' }),
  R('pantry', 'Pantry', 'survive', S(3, 3), '0:00', 'Stores 6,000 meals', '—', { mealsStored: 6000 }, { objects: ['shelf', 'fridge'], amenity: 'pantry' }),
  R('water_tank', 'Water Tank', 'survive', S(3, 3), '0:00', 'Stores 20,000 L', '—', { waterStored: 20000 }, { objects: ['tank'], amenity: 'water_tank' }),
  R('diesel_generator', 'Diesel Generator', 'survive', S(3, 3), '0:00', '12 kW', '40 L fuel per day, noise 3', { power: 12, fuelPerDay: 40, noise: 3 }, { objects: ['diesel', 'fuel'] }),
  R('hand_crank_scrubber', 'Hand-crank Scrubber', 'survive', S(2, 3), '0:00', 'Air for 4', 'Crank labour, morale −1', { air: 4, morale: -1 }, { objects: ['crank_scrubber'], amenity: 'air_vent' }),
  R('blast_door_1', 'Blast Door Mk I', 'survive', S(1, 3, { fixture: true }), '0:06', 'Blast +1', '—', { blast: 1 }, { objects: ['blast_1'] }),
  R('blast_door_2', 'Blast Door Mk II', 'survive', S(1, 3, { fixture: true }), '2:05', 'Blast +2', '—', { blast: 2 }, { objects: ['blast_2'] }),
  R('blast_door_3', 'Blast Door Mk III', 'survive', S(1, 3, { fixture: true }), '3:40', 'Blast +3', '—', { blast: 3 }, { objects: ['blast_3'] }),
  R('utility_spine', 'Utility Spine', 'survive', S(2, null, { fullHeight: true }), '0:15', 'Elevator and utility trunk; connects floors', '1 kW per floor', { powerPerFloor: -1 }, { structure: 'spine' }),
  R('sump_pump', 'Sump Pump', 'survive', S(2, 2), '0:20', 'Clears seepage below 12 m', '2 kW, noise 1', { power: -2, noise: 1 }, { objects: ['sump'] }),
  R('med_bay', 'Med Bay', 'survive', S(4, 3), '0:38', 'Treats 2 at a time', '3 kW, a medic', { treats: 2, power: -3, staff: 1 }, { objects: ['med_bed'] }),
  R('decon_shower', 'Decon Shower', 'survive', S(2, 3), '0:55', 'Seal +2 against spores', '1 kW, 50 L per use', { seal: 2, power: -1 }, { objects: ['decon'] }),
  R('hepa_scrubber_bay', 'HEPA Scrubber Bay', 'survive', S(3, 3), '0:55', 'Air for 12, filtered', '4 kW', { air: 12, power: -4 }, { objects: ['hepa'], amenity: 'mil_scrubber' }),
  R('battery_bank', 'Battery Bank', 'survive', S(3, 3), '1:38', 'Stores 200 kWh', '—', { powerStored: 200 }, { objects: ['battery'] }),
  R('solar_mast', 'Solar Mast', 'survive', S(2, 4, { surface: true }), '1:38', '8 kW by day', 'Raises surface visibility', { power: 8, visibility: 1 }, { objects: ['solar'] }),
  R('hydroponics_bay', 'Hydroponics Bay', 'survive', S(6, 3), '1:45', '30 meals per day', '6 kW, 400 L per day', { mealsPerDay: 30, power: -6, waterPerDay: -400 }, { objects: ['hydro', 'grow_light'], amenity: 'hydroponics' }),
  R('flood_seals', 'Flood Seals and Storm Shutters', 'survive', S(null, null, { fixture: true }), '1:58', 'Flood seal +2', '—', { floodSeal: 2 }),
  R('faraday_room', 'Faraday Room', 'survive', S(4, 3), '2:35', 'Shields analog backups from The Optimizer', '—', { shields: 'optimizer' }),
  R('geothermal_plant', 'Geothermal Plant', 'survive', S(6, 4, { minDepth: 50 }), '2:45', '80 kW', '2 engineers', { power: 80, staff: 2 }, { objects: ['geothermal'] }),
  R('deep_water_recycler', 'Deep Water Recycler', 'survive', S(4, 3), '3:05', 'Recycles 90% of water', '5 kW', { recycle: 0.9, power: -5 }, { objects: ['recycler'], amenity: 'water_recycler' }),
  R('aquaponics_bay', 'Aquaponics Bay', 'survive', S(6, 4), '3:20', '60 meals per day with protein', '8 kW, 300 L per day', { mealsPerDay: 60, power: -8, waterPerDay: -300 }),
  R('protein_vats', 'Protein Vats', 'survive', S(4, 3), '3:20', '100 meals per day, needs no pollinators', '10 kW', { mealsPerDay: 100, power: -10 }, { objects: ['vat'] }),
  R('seed_vault', 'Seed Vault', 'survive', S(3, 3), '3:20', 'Crops can restart after The Hush', '1 kW', { power: -1 }),
  R('security_post', 'Security Post', 'survive', S(3, 3, { surface: true }), '3:30', 'Security +2', '2 guards', { security: 2, staff: 2 }, { objects: ['guard_post'] }),
  R('decoy_entrance', 'Decoy Entrance', 'survive', S(3, 3, { surface: true }), '3:30', 'Diverts sieges', '—', {}, { objects: ['decoy'] }),
  R('armory', 'Armory', 'survive', S(3, 3), '3:30', 'Security +1, arms guards', 'Heat +1 per site', { security: 1, heatPerSite: 1 }, { objects: ['gun_locker'] }),
  R('aquifer_well', 'Aquifer Well', 'survive', S(2, 6, { minDepth: 80 }), '3:40', 'Unlimited water', '4 kW', { waterUnlimited: true, power: -4 }, { objects: ['aquifer'] }),
  R('micro_reactor', 'Micro-reactor', 'survive', S(6, 6, { minDepth: 60 }), '4:00', '500 kW', 'Shielding, 2 specialists, regulator heat', { power: 500, staff: 2 }, { objects: ['reactor'] }),

  // ---------- Comfort (warm walnut trim) ----------
  R('galley_kitchen', 'Galley Kitchen', 'comfort', S(4, 3), '0:00', 'Morale +1 for all', '2 kW', { morale: 1, power: -2 }, { objects: ['stove'] }),
  R('master_suite', 'Master Suite', 'comfort', S(6, 3), '0:10', 'Comfort +3 for the owner', '2 kW', { comfort: 3, power: -2 }, { objects: ['king_bed'], amenity: 'gold_taps' }),
  R('lounge', 'Lounge', 'comfort', S(6, 3), '0:10', 'Comfort +2 shared', '1 kW', { comfort: 2, power: -1 }, { objects: ['sofa', 'tv'] }),
  R('window_wall', 'Window Wall (LED sky)', 'comfort', S(4, 3), '0:32', 'Comfort +2, fakes daylight', '3 kW', { comfort: 2, power: -3 }, { objects: ['led_sky', 'faux_window'] }),
  R('laundry', 'Laundry', 'comfort', S(2, 3), '0:32', 'Comfort +1', '2 kW, 100 L per day', { comfort: 1, power: -2, waterPerDay: -100 }),
  R('gym', 'Gym', 'comfort', S(4, 3), '1:10', 'Comfort +2, health', '1 kW', { comfort: 2, power: -1 }, { objects: ['gym_rig'] }),
  R('guest_quarters', 'Guest Quarters', 'comfort', S(4, 3), '1:22', 'Sleeps 2, comfort +1', '1 kW', { sleeps: 2, comfort: 1, power: -1 }, { objects: ['bed'] }),
  R('library_game_room', 'Library and Game Room', 'comfort', S(4, 3), '1:30', 'Morale +2 under seal', '—', { morale: 2 }, { objects: ['bookshelf', 'pool_table'] }),
  R('therapy_pod', 'Therapy Pod', 'comfort', S(2, 3), '2:25', 'Prevents morale collapse', '1 kW, a counsellor', { power: -1, staff: 1 }),
  R('atrium_garden', 'Atrium Garden', 'comfort', S(6, 7, { doubleHeight: true }), '3:20', 'Comfort +3, 10 meals per day', '12 kW, 300 L per day', { comfort: 3, mealsPerDay: 10, power: -12, waterPerDay: -300 }),

  // ---------- Status (gold and emerald trim) ----------
  R('wine_cellar', 'Wine Cellar', 'status', S(4, 3), '1:10', 'Prestige 8 (+50% at 10 m or deeper)', '—', { prestige: 8, deepBonus: { depth: 10, mult: 1.5 } }, { objects: ['wine_rack'], amenity: 'wine_cellar' }),
  R('home_cinema', 'Home Cinema', 'status', S(6, 3), '1:10', 'Prestige 10', '4 kW', { prestige: 10, power: -4 }, { objects: ['cinema_screen', 'cinema_seats'] }),
  R('biohacking_lab', 'Biohacking Lab', 'status', S(4, 3), '1:10', 'Prestige 9', '5 kW', { prestige: 9, power: -5 }),
  R('broadcast_studio', 'Broadcast Studio', 'status', S(4, 3), '1:10', 'Prestige 7', '3 kW, leaks the bunker’s location if misused', { prestige: 7, power: -3 }),
  R('panic_room', 'Panic Room', 'status', S(3, 3, { touches: 'master_suite' }), '1:30', 'Prestige 6', '—', { prestige: 6 }),
  R('chefs_kitchen', 'Chef’s Kitchen', 'status', S(6, 3), '1:30', 'Prestige 10', '6 kW, a chef', { prestige: 10, power: -6, staff: 1 }, { objects: ['chef_range'] }),
  R('art_vault', 'Art Vault', 'status', S(6, 3), '2:15', 'Prestige 14', '3 kW climate control or prestige decays 2% per week', { prestige: 14, power: -3 }, { objects: ['painting', 'statue'] }),
  R('heir_nursery', 'Heir Nursery', 'status', S(4, 3), '2:15', 'Prestige 8', '1 kW', { prestige: 8, power: -1 }),
  R('trophy_garage', 'Trophy Garage', 'status', S(8, 3, { surfaceLift: true }), '2:15', 'Prestige 12', 'Raises surface visibility', { prestige: 12, visibility: 1 }),
  R('helipad', 'Helipad', 'status', S(6, 1, { surface: true }), '2:15', 'Prestige 10; enables evacuation', 'Raises surface visibility', { prestige: 10, visibility: 1 }),
  R('cigar_lounge', 'Cigar Lounge', 'status', S(4, 3), '2:25', 'Prestige 7', 'Air +10 m³ per hour', { prestige: 7, airDraw: 10 }),
  R('spa_sauna', 'Spa and Sauna', 'status', S(6, 3), '3:05', 'Prestige 12', '8 kW, 500 L per day', { prestige: 12, power: -8, waterPerDay: -500 }),
  R('infinity_pool', 'Infinity Pool', 'status', S(8, 4), '3:05', 'Prestige 18', 'Holds 30,000 L, 400 L per day, needs the recycler', { prestige: 18, waterHeld: 30000, waterPerDay: -400, needs: 'deep_water_recycler' }),

  // ---------- Delusion (iridescent violet trim) ----------
  R('museum_of_me', 'Museum of Me', 'delusion', S(8, 4), '2:15', 'Prestige 16', '4 kW', { prestige: 16, power: -4 }),
  R('personal_mausoleum', 'Personal Mausoleum', 'delusion', S(6, 3), '2:25', 'Prestige 9', 'Nothing, and does nothing', { prestige: 9 }),
  R('throne_room', 'Throne Room', 'delusion', S(8, 4), '3:50', 'Prestige 20', '5 kW', { prestige: 20, power: -5 }),
  R('mansion_replica_floor', 'Mansion Replica Floor', 'delusion', S(16, 7, { doubleHeight: true }), '3:50', 'Prestige 30', '25 kW, 800 L per day', { prestige: 30, power: -25, waterPerDay: -800 }),
  R('private_forest_dome', 'Private Forest Dome', 'delusion', S(12, 7, { doubleHeight: true }), '3:50', 'Prestige 26', '30 kW lights, 600 L per day', { prestige: 26, power: -30, waterPerDay: -600 }),
  R('pet_clone_lab', 'Pet Clone Lab', 'delusion', S(4, 3), '3:50', 'Prestige 14', '8 kW', { prestige: 14, power: -8 }),
  R('legacy_broadcast_array', 'Legacy Broadcast Array', 'delusion', S(3, 4, { surfaceAntenna: true }), '4:30', 'Prestige 15', '6 kW; its signal raises siege risk', { prestige: 15, power: -6 }),
  R('cryo_pod_bay', 'Cryo Pod Bay', 'delusion', S(6, 3), '4:38', 'Prestige 24', '40 kW, reactor-grade power', { prestige: 24, power: -40 }, { objects: ['cryo_pod'], amenity: 'cryo_pod' }),
  R('genetic_library', 'Genetic Library', 'delusion', S(4, 3), '5:10', 'Prestige 18', '6 kW', { prestige: 18, power: -6 }),

  // ---------- Alternate-track rooms (Survive, hazard-yellow trim): only in worlds running the track ----------
  R('ceramic_lining', 'Ceramic Lining', 'survive', S(null, null, { fixture: true }), '0:55', 'Seal +2 against nanobots', '—', { seal: 2 }, { track: 'greygoo' }),
  R('emp_room', 'EMP Pulse Room', 'survive', S(3, 3), '0:55', 'Clears goo from ducts and conduits', '6 kW; resets every smart device on the floor', { power: -6 }, { track: 'greygoo' }),
  R('thermal_cladding', 'Thermal Cladding', 'survive', S(null, null, { fixture: true }), '1:58', 'Heat loss −40%', '—', { heatLoss: -0.4 }, { track: 'longshade' }),
  R('boiler_room', 'Boiler Room', 'survive', S(4, 3), '1:58', '15 kW of heat', '30 L fuel per day, noise 2', { heat: 15, fuelPerDay: 30, noise: 2 }, { track: 'longshade' }),
  R('debris_cap', 'Debris Cap', 'survive', S(null, null, { fixture: true, surface: true }), '2:35', 'Blast +1 against falling debris; hides the surface footprint', '—', { blast: 1 }, { track: 'kessler' }),
  R('radio_room', 'Radio Room', 'survive', S(3, 3), '2:35', 'Long-wave contact with your other sites; morale +2 under seal', '2 kW, an operator', { morale: 2, power: -2, staff: 1 }, { track: 'kessler' }),
  R('condenser', 'Atmospheric Condenser', 'survive', S(3, 3), '3:20', '2,000 L of water per day from the air', '8 kW, noise 1', { waterPerDay: 2000, power: -8, noise: 1 }, { track: 'cloudstrike' }),
  R('water_vault', 'Water Vault', 'survive', S(6, 3), '3:20', 'Stores 120,000 L', '—', { waterStored: 120000 }, { track: 'cloudstrike' }),
  R('kiln_workshop', 'Kiln Workshop', 'survive', S(4, 3), '1:05', 'Fires ceramic linings on site, so lining retrofits cost 40% less', '12 kW, noise 2', { power: -12, noise: 2 }, { track: 'greygoo', third: true }),
  R('fuel_depot', 'Fuel Depot', 'survive', S(3, 3), '2:08', 'Stores 10,000 L of fuel for boilers and generators', 'Fire risk: never beside a bedroom', { fuelStored: 10000 }, { track: 'longshade', third: true }),
  R('convoy_bay', 'Convoy Bay', 'survive', S(8, 3, { surfaceRamp: true }), '2:45', 'Ground evacuation without satellites; Seal Order pickups need no helicopter', 'The ramp raises surface visibility', { visibility: 1 }, { track: 'kessler', third: true }),
  R('cloud_embassy', 'Cloud Embassy', 'survive', S(4, 3, { surface: true }), '3:30', '+10 containment points to every Collective Bargaining; reputation +1 a quarter', 'A diplomat; raises surface visibility', { reputationPerQuarter: 1, staff: 1, visibility: 1 }, { track: 'cloudstrike', third: true }),
];

// What makes an enclosed space each room. A room has one identity at a time (src/catalog/identify.js).
// Planned objects (not in the bunker catalog yet) are marked with a trailing comment.
const RECIPES = {
  bunk_room: { all: { bunk: 1 } },
  pantry: { anyOf: ['shelf', 'fridge'] },
  water_tank: { all: { tank: 1 } },
  diesel_generator: { all: { diesel: 1 } },
  hand_crank_scrubber: { all: { crank_scrubber: 1 } },
  sump_pump: { all: { sump: 1 } },
  med_bay: { all: { med_bed: 1 } },
  decon_shower: { all: { decon: 1 } },
  hepa_scrubber_bay: { all: { hepa: 1 } },
  battery_bank: { all: { battery: 1 } },
  hydroponics_bay: { all: { hydro: 1 } },
  faraday_room: { all: { faraday_cage: 1 } }, // planned
  geothermal_plant: { all: { geothermal: 1 } },
  deep_water_recycler: { all: { recycler: 1 } },
  aquaponics_bay: { all: { hydro: 1, fish_tank: 1 } }, // fish_tank planned
  protein_vats: { all: { vat: 1 } },
  seed_vault: { all: { seed_locker: 1 } }, // planned
  armory: { all: { gun_locker: 1 } },
  aquifer_well: { all: { aquifer: 1 } },
  micro_reactor: { all: { reactor: 1 } },
  galley_kitchen: { all: { stove: 1 } },
  master_suite: { all: { king_bed: 1 } },
  lounge: { anyOf: ['sofa', 'tv', 'bookshelf'] },
  window_wall: { all: { led_sky: 1 } },
  laundry: { all: { washer: 1 } }, // planned
  gym: { all: { gym_rig: 1 } },
  guest_quarters: { all: { bed: 1 } },
  library_game_room: { all: { bookshelf: 1 }, anyOf: ['pool_table', 'arcade'] },
  therapy_pod: { all: { therapy_couch: 1 } }, // planned
  atrium_garden: { all: { atrium_tree: 1 } }, // planned
  wine_cellar: { all: { wine_rack: 1 } },
  home_cinema: { all: { cinema_screen: 1 } },
  biohacking_lab: { all: { biohack_pod: 1 } }, // planned
  broadcast_studio: { all: { broadcast_desk: 1 } }, // planned
  panic_room: { all: { panic_console: 1 } }, // planned
  chefs_kitchen: { all: { chef_range: 1 } },
  art_vault: { all: { painting: 2 } },
  heir_nursery: { all: { crib: 1 } }, // planned
  trophy_garage: { all: { car_lift: 1 } }, // planned
  cigar_lounge: { all: { humidor: 1 } }, // planned
  spa_sauna: { all: { sauna_stove: 1 } }, // planned
  infinity_pool: { all: { pool_basin: 1 } }, // planned
  museum_of_me: { all: { self_statue: 1 } }, // planned
  personal_mausoleum: { all: { sarcophagus: 1 } }, // planned
  throne_room: { all: { throne: 1 } }, // planned
  mansion_replica_floor: { all: { mansion_facade: 1 } }, // planned
  private_forest_dome: { all: { dome_tree: 1 } }, // planned
  pet_clone_lab: { all: { clone_tank: 1 } }, // planned
  legacy_broadcast_array: { all: { broadcast_array: 1 } }, // planned
  cryo_pod_bay: { all: { cryo_pod: 1 } },
  genetic_library: { all: { gene_bank: 1 } }, // planned
  emp_room: { all: { emp_coil: 1 } }, // planned
  boiler_room: { all: { boiler: 1 } }, // planned
  radio_room: { all: { radio_set: 1 } }, // planned
  condenser: { all: { condenser_unit: 1 } }, // planned
  water_vault: { all: { vault_tank: 1 } }, // planned
  kiln_workshop: { all: { kiln: 1 } }, // planned
  fuel_depot: { all: { fuel_bladder: 1 } }, // planned
  convoy_bay: { all: { convoy_ramp: 1 } }, // planned
};
// Everything in the catalog that is not an enclosed room.
const KINDS = {
  airlock: 'fixture', blast_door_1: 'fixture', blast_door_2: 'fixture', blast_door_3: 'fixture', flood_seals: 'fixture',
  ceramic_lining: 'fixture', thermal_cladding: 'fixture', debris_cap: 'fixture',
  utility_spine: 'structure',
  solar_mast: 'surface', security_post: 'surface', decoy_entrance: 'surface', helipad: 'surface', cloud_embassy: 'surface',
};

/** Cost in the tier's GDD range by unlock time (earliest = bottom of the range), rounded to $0.1M. */
function placeCosts(rooms) {
  const out = [];
  for (const tier of TIERS) {
    const inTier = rooms.filter((r) => r.tier === tier && !EXACT_COST[r.id]);
    const ats = inTier.map((r) => r.unlockAt);
    const lo = Math.min(...ats), hi = Math.max(...ats);
    const { lo: cLo, hi: cHi } = TIER_COST[tier];
    for (const r of inTier) {
      const t = hi > lo ? (r.unlockAt - lo) / (hi - lo) : 0;
      out.push([r.id, Math.round((cLo + (cHi - cLo) * t) / 100_000) * 100_000]);
    }
  }
  const byId = Object.fromEntries(out);
  return rooms.map((r) => ({ ...r, cost: EXACT_COST[r.id] ?? byId[r.id], costSource: EXACT_COST[r.id] ? 'gdd' : 'tier-range' }));
}

function freeze(o) { for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); return Object.freeze(o); }

export const GDD_ROOMS = freeze(placeCosts(RAW).map((r) => ({
  alternate: !!r.track, objects: [], ...r, kind: KINDS[r.id] ?? 'room', requires: RECIPES[r.id] ?? null,
})));
/** Only the enclosed rooms (59): the identities a walled space can take. */
export const ENCLOSED_ROOMS = Object.freeze(GDD_ROOMS.filter((r) => r.kind === 'room'));
export const GDD_ROOM_BY_ID = Object.freeze(Object.fromEntries(GDD_ROOMS.map((r) => [r.id, r])));

/** Rooms that exist in a world: every non-alternate room, plus the counter rooms of the alternates in the roster. */
export function roomsForRoster(roster = []) {
  return GDD_ROOMS.filter((r) => !r.track || roster.includes(r.track));
}
