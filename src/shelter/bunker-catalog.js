// Bunker catalog: strata, structures, furniture and machines, and the room types they make.
// GDD: Shelter canvas (Grid spec, Strata, Room catalog, Life systems, Build rules).
//
// RimWorld-style: the player digs tiles, builds walls and doors, lays conduits and places objects.
// Rooms are NOT placed as blocks: any space enclosed by walls/doors/rock becomes a room, and its type
// comes from what is inside it (a Bunk Room is an enclosed space with bunks in it, a Pantry is one
// with pantry shelves...). GDD room names, sizes and system numbers are used throughout.
//
// Money: the GDD prices in $M; the game's economy is still in $K, so every price here is the GDD price
// x PRICE_SCALE (see the gap review). One constant to change when the economy is rescaled.

export const PRICE_SCALE = 0.1;
export const TILE_M = 1; // 1 tile = 1 m x 1 m (GDD grid spec)
export const ROOM_DEPTH_M = 4; // the cutaway is 4 m deep: one tile of room holds 4 m3 of air
export const WATER_TABLE_M = 12; // clay: water table at 12 m needs sump pumps

// GDD strata: dig cost per tile ($), crew speed (tiles per day), base blast rating.
export const STRATA = Object.freeze([
  { id: 'topsoil', name: 'Topsoil', from: 0, to: 10, digCost: 10_000, speed: 6, blast: 1, color: '#6b4a32' },
  { id: 'clay', name: 'Clay', from: 10, to: 25, digCost: 25_000, speed: 4, blast: 2, color: '#8a5a36' },
  { id: 'bedrock', name: 'Bedrock', from: 25, to: 60, digCost: 80_000, speed: 2, blast: 3, color: '#5e5a60' },
  { id: 'deep', name: 'Deep Rock', from: 60, to: 120, digCost: 200_000, speed: 1, blast: 4, color: '#3e3a44' },
  { id: 'abyss', name: 'The Abyss', from: 120, to: 1e9, digCost: 500_000, speed: 0.5, blast: 5, color: '#24202a' },
]);
export const stratumAt = (depthM) => STRATA.find((s) => depthM >= s.from && depthM < s.to) ?? STRATA.at(-1);

// Structures built tile by tile.
export const STRUCTURES = Object.freeze({
  wall: { name: 'Concrete wall / slab', cost: 4_000, days: 0.25 },
  spine: { name: 'Utility Spine', cost: 15_000, days: 0.5, passable: true, carries: ['air', 'water', 'power'] },
});
export const CONDUITS = Object.freeze({
  air: { name: 'Air duct', cost: 1_000, days: 0.05, color: '#6ab4ff' },
  water: { name: 'Water pipe', cost: 1_000, days: 0.05, color: '#3ad0c0' },
  power: { name: 'Power cable', cost: 800, days: 0.05, color: '#ffd23a' },
});

// Objects: furniture, machines, doors and decor. w x h in tiles (side view: h is height).
// Systems per GDD units: air m3/h, water L/day, food meals/day, power kW (+ supply, - draw).
// beauty feeds room impressiveness; prestige is what clients pay for; noise radiates 6 tiles.
// net: the conduits the object must touch to work. door: part of a room boundary but passable.
const O = (id, name, cat, w, h, cost, extra = {}) => [id, { id, name, cat, w, h, cost, ...extra }];
export const OBJECTS = Object.freeze(Object.fromEntries([
  // doors (1 x 3 fixtures)
  O('door', 'Door', 'door', 1, 3, 2_000, { door: true }),
  O('airlock', 'Airlock door', 'door', 1, 3, 40_000, { door: true, seal: 1 }),
  O('blast_1', 'Blast Door Mk I', 'door', 1, 3, 60_000, { door: true, blast: 1 }),
  O('blast_2', 'Blast Door Mk II', 'door', 1, 3, 200_000, { door: true, blast: 2 }),
  O('blast_3', 'Blast Door Mk III', 'door', 1, 3, 600_000, { door: true, blast: 3 }),
  // sleeping
  O('bunk', 'Bunk bed', 'sleep', 2, 2, 15_000, { beds: 2, beauty: 0 }),
  O('bed', 'Double bed', 'sleep', 3, 1, 30_000, { beds: 2, beauty: 2 }),
  O('king_bed', 'Four-poster king bed', 'sleep', 3, 2, 120_000, { beds: 2, beauty: 5, prestige: 3, luxury: true }),
  // air
  O('crank_scrubber', 'Hand-crank scrubber', 'air', 1, 2, 20_000, { air: 120, morale: -1, net: ['air'] }), // air for 4
  O('hepa', 'HEPA scrubber unit', 'air', 2, 2, 150_000, { air: 360, power: -4, seal: 1, net: ['air', 'power'] }), // air for 12
  O('o2_rack', 'Oxygen candle rack', 'air', 1, 2, 30_000, { airStock: 2_000 }), // m3 of breathable reserve
  // water
  O('tank', 'Water tank', 'water', 2, 3, 40_000, { waterStock: 10_000, net: ['water'] }),
  O('recycler', 'Deep water recycler', 'water', 2, 2, 250_000, { recycle: 0.9, power: -5, net: ['water', 'power'] }),
  O('aquifer', 'Aquifer well head', 'water', 2, 3, 400_000, { waterUnlimited: true, power: -4, minDepth: 80, net: ['water', 'power'] }),
  O('sump', 'Sump pump', 'water', 2, 2, 60_000, { sump: true, power: -2, noise: 1, net: ['power'] }),
  // food
  O('shelf', 'Pantry shelving', 'food', 1, 3, 15_000, { foodStock: 2_000 }),
  O('fridge', 'Cold store', 'food', 1, 2, 25_000, { foodStock: 1_500, power: -1, net: ['power'] }),
  O('hydro', 'Hydroponic rack', 'food', 2, 2, 60_000, { food: 10, power: -2, water: -130, net: ['power', 'water'] }),
  O('grow_light', 'Grow light', 'food', 1, 1, 8_000, { growLight: true, power: -1, net: ['power'] }),
  O('vat', 'Protein vat', 'food', 2, 3, 300_000, { food: 50, power: -5, net: ['power'] }),
  // power
  O('diesel', 'Diesel generator', 'power', 2, 2, 120_000, { power: 12, fuelUse: 40, noise: 3, net: ['power', 'air'] }),
  O('fuel', 'Fuel tank', 'power', 1, 2, 20_000, { fuelStock: 2_000 }),
  O('battery', 'Battery bank', 'power', 1, 2, 80_000, { battery: 70, net: ['power'] }),
  O('solar', 'Solar mast', 'power', 2, 4, 150_000, { power: 8, solar: true, surface: true, visibility: 2, net: ['power'] }),
  O('geothermal', 'Geothermal plant', 'power', 6, 3, 2_500_000, { power: 80, minDepth: 50, net: ['power'] }),
  O('reactor', 'Micro-reactor', 'power', 6, 3, 25_000_000, { power: 500, minDepth: 60, noise: 4, net: ['power'] }),
  // kitchen / bath / medical
  O('stove', 'Galley stove', 'kitchen', 2, 1, 20_000, { beauty: 0, power: -2, net: ['power'] }),
  O('chef_range', "Chef's range", 'kitchen', 3, 1, 250_000, { beauty: 4, prestige: 4, power: -6, luxury: true, net: ['power'] }),
  O('toilet', 'Toilet', 'bath', 1, 1, 5_000, { water: -20, net: ['water'] }),
  O('shower', 'Shower', 'bath', 1, 3, 10_000, { water: -40, beauty: 1, net: ['water'] }),
  O('decon', 'Decon shower', 'bath', 1, 3, 120_000, { seal: 2, water: -50, power: -1, net: ['water', 'power'] }),
  O('gold_taps', 'Gold-tap vanity', 'bath', 1, 1, 40_000, { beauty: 3, prestige: 2, water: -30, luxury: true, net: ['water'] }),
  O('med_bed', 'Med bay bed', 'medical', 2, 1, 120_000, { beauty: 1, power: -3, comfortAll: 1, net: ['power'] }),
  // security
  O('gun_locker', 'Armory locker', 'security', 1, 2, 80_000, { security: 1 }),
  O('guard_post', 'Security post', 'security', 2, 2, 150_000, { security: 2, surface: true, visibility: 1 }),
  O('decoy', 'Decoy entrance', 'security', 2, 3, 100_000, { security: 1, surface: true, visibility: -2 }),
  O('camera', 'Camera', 'security', 1, 1, 10_000, { security: 0.5, power: -0.2, net: ['power'] }),
  // comfort / decor
  O('sofa', 'Sofa', 'comfort', 3, 1, 15_000, { beauty: 2 }),
  O('tv', 'Wall screen', 'comfort', 2, 1, 20_000, { beauty: 1, power: -0.5, net: ['power'] }),
  O('bookshelf', 'Bookshelf', 'comfort', 1, 3, 10_000, { beauty: 2 }),
  O('led_sky', 'LED sky panel', 'comfort', 2, 1, 80_000, { beauty: 4, power: -3, light: true, net: ['power'] }),
  O('gym_rig', 'Gym rig', 'comfort', 2, 2, 30_000, { beauty: 1, noise: 1 }),
  O('plant', 'Potted plant', 'decor', 1, 1, 3_000, { beauty: 1 }),
  O('painting', 'Oil painting', 'decor', 1, 1, 60_000, { beauty: 3, prestige: 2, luxury: true }),
  O('statue', 'Marble statue', 'decor', 1, 2, 150_000, { beauty: 5, prestige: 4, luxury: true }),
  O('lamp', 'Floor lamp', 'decor', 1, 2, 4_000, { beauty: 1, power: -0.1, net: ['power'] }),
  // status
  O('wine_rack', 'Wine rack', 'status', 1, 3, 100_000, { prestige: 4, beauty: 2, cellar: true, luxury: true }),
  O('cinema_seats', 'Cinema recliners', 'status', 3, 1, 200_000, { prestige: 4, beauty: 3, luxury: true }),
  O('cinema_screen', 'Cinema screen', 'status', 3, 2, 300_000, { prestige: 5, power: -4, luxury: true, net: ['power'] }),
  O('cryo_pod', 'Cryo pod', 'status', 1, 3, 2_000_000, { prestige: 8, power: -13, luxury: true, beds: 1, net: ['power'] }),
].map(([id, o]) => [id, { ...o, cost: Math.round(o.cost * PRICE_SCALE) }])));

// Fit-out time per object: 1 crew-day per 2 tiles of footprint (doors 0.5 day).
export const fitDays = (o) => (o.door ? 0.5 : Math.max(0.5, (o.w * o.h) / 2));

// Room types, recognised from contents (first match wins, in this order). minTiles from GDD room sizes.
export const ROOM_TYPES = Object.freeze([
  { id: 'master_suite', name: 'Master Suite', tier: 'comfort', has: (c) => c.king_bed >= 1, minW: 6 },
  { id: 'bunk_room', name: 'Bunk Room', tier: 'survive', has: (c) => c.bunk >= 1, minW: 4 },
  { id: 'guest_quarters', name: 'Guest Quarters', tier: 'comfort', has: (c) => c.bed >= 1, minW: 4 },
  { id: 'cryo_bay', name: 'Cryo Pod Bay', tier: 'delusion', has: (c) => c.cryo_pod >= 1, minW: 6 },
  { id: 'cinema', name: 'Home Cinema', tier: 'status', has: (c) => c.cinema_screen >= 1, minW: 6 },
  { id: 'wine_cellar', name: 'Wine Cellar', tier: 'status', has: (c) => c.wine_rack >= 1, minW: 4 },
  { id: 'chefs_kitchen', name: "Chef's Kitchen", tier: 'status', has: (c) => c.chef_range >= 1, minW: 6 },
  { id: 'galley', name: 'Galley Kitchen', tier: 'comfort', has: (c) => c.stove >= 1, minW: 4 },
  { id: 'med_bay', name: 'Med Bay', tier: 'survive', has: (c) => c.med_bed >= 1, minW: 4 },
  { id: 'reactor_room', name: 'Reactor Hall', tier: 'survive', has: (c) => c.reactor >= 1 || c.geothermal >= 1, minW: 6 },
  { id: 'generator_room', name: 'Generator Room', tier: 'survive', has: (c) => c.diesel >= 1, minW: 3 },
  { id: 'scrubber_bay', name: 'Scrubber Bay', tier: 'survive', has: (c) => c.hepa >= 1 || c.crank_scrubber >= 1, minW: 2 },
  { id: 'hydroponics', name: 'Hydroponics Bay', tier: 'survive', has: (c) => c.hydro >= 1 || c.vat >= 1, minW: 6 },
  { id: 'water_room', name: 'Water Tank', tier: 'survive', has: (c) => c.tank >= 1 || c.recycler >= 1 || c.aquifer >= 1, minW: 3 },
  { id: 'pantry', name: 'Pantry', tier: 'survive', has: (c) => c.shelf >= 1 || c.fridge >= 1, minW: 3 },
  { id: 'armory', name: 'Armory', tier: 'survive', has: (c) => c.gun_locker >= 1, minW: 3 },
  { id: 'bathroom', name: 'Bathroom', tier: 'comfort', has: (c) => c.toilet >= 1 || c.shower >= 1 || c.decon >= 1, minW: 2 },
  { id: 'gym', name: 'Gym', tier: 'comfort', has: (c) => c.gym_rig >= 1, minW: 4 },
  { id: 'lounge', name: 'Lounge', tier: 'comfort', has: (c) => c.sofa >= 1 || c.tv >= 1 || c.bookshelf >= 1, minW: 6 },
  { id: 'battery_room', name: 'Battery Room', tier: 'survive', has: (c) => c.battery >= 1 || c.fuel >= 1, minW: 2 },
  { id: 'storage', name: 'Storeroom', tier: 'survive', has: () => true, minW: 1 },
]);

// Needs-tier colours (GDD: Art > Tier colour language).
export const TIER_COLORS = Object.freeze({ survive: '#f5c542', comfort: '#a0703a', status: '#3aa070', delusion: '#b07aff' });

// GDD life-system needs per occupant.
export const NEEDS = Object.freeze({ air: 30, water: 50, food: 3, power: 1.5, moraleMin: 30 });
