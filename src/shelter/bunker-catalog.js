// Bunker catalog: strata, structures, furniture and machines, and the room types they make.
// GDD: Shelter canvas (Grid spec, Strata, Room catalog, Life systems, Build rules).
//
// RimWorld-style: the player digs tiles, builds walls and doors, lays conduits and places objects.
// Rooms are NOT placed as blocks: any space enclosed by walls/doors/rock becomes a room, and its type
// comes from what is inside it (a Bunk Room is an enclosed space with bunks in it, a Pantry is one
// with pantry shelves...). GDD room names, sizes and system numbers are used throughout.
//
// Money: GDD dollars (#91 moved the whole economy to the GDD $M scale). PRICE_SCALE stays as the one knob.

export const PRICE_SCALE = 1;
export const TILE_M = 1; // 1 tile = 1 m x 1 m (GDD grid spec)
export const ROOM_DEPTH_M = 4; // the cutaway is 4 m deep: one tile of room holds 4 m3 of air
export const WATER_TABLE_M = 12; // clay: water table at 12 m needs sump pumps

// GDD strata: dig cost per tile ($), crew speed (tiles per day), base blast rating.
export const STRATA = Object.freeze([
  { id: 'topsoil', name: 'Topsoil', from: 0, to: 10, gddDigCost: 10_000, speed: 6, blast: 1, color: '#6b4a32' },
  { id: 'clay', name: 'Clay', from: 10, to: 25, gddDigCost: 25_000, speed: 4, blast: 2, color: '#8a5a36' },
  { id: 'bedrock', name: 'Bedrock', from: 25, to: 60, gddDigCost: 80_000, speed: 2, blast: 3, color: '#5e5a60' },
  { id: 'deep', name: 'Deep Rock', from: 60, to: 120, gddDigCost: 200_000, speed: 1, blast: 4, color: '#3e3a44' },
  { id: 'abyss', name: 'The Abyss', from: 120, to: 1e9, gddDigCost: 500_000, speed: 0.5, blast: 5, color: '#24202a' },
].map((s) => ({ ...s, digCost: Math.round(s.gddDigCost * PRICE_SCALE) })));
export const stratumAt = (depthM) => STRATA.find((s) => depthM >= s.from && depthM < s.to) ?? STRATA.at(-1);

// Structures built tile by tile.
export const STRUCTURES = Object.freeze({
  wall: { name: 'Concrete wall / slab', cost: 4_000 * PRICE_SCALE, days: 0.25 },
  spine: { name: 'Utility Spine', cost: 15_000 * PRICE_SCALE, days: 0.5, passable: true, carries: ['air', 'water', 'power'] },
});
export const CONDUITS = Object.freeze({
  air: { name: 'Air duct', cost: 1_000 * PRICE_SCALE, days: 0.05, color: '#6ab4ff' },
  water: { name: 'Water pipe', cost: 1_000 * PRICE_SCALE, days: 0.05, color: '#3ad0c0' },
  power: { name: 'Power cable', cost: 800 * PRICE_SCALE, days: 0.05, color: '#ffd23a' },
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
  O('tv', 'Wall screen', 'comfort', 2, 1, 20_000, { beauty: 1, power: -0.5, layer: 'wall', net: ['power'] }),
  O('bookshelf', 'Bookshelf', 'comfort', 1, 3, 10_000, { beauty: 2 }),
  O('led_sky', 'LED sky panel', 'comfort', 2, 1, 80_000, { beauty: 4, power: -3, light: true, layer: 'wall', net: ['power'] }),
  O('gym_rig', 'Gym rig', 'comfort', 2, 2, 30_000, { beauty: 1, noise: 1 }),
  O('plant', 'Potted plant', 'decor', 1, 1, 3_000, { beauty: 1 }),
  O('painting', 'Oil painting', 'decor', 2, 1, 60_000, { beauty: 3, prestige: 2, luxury: true, layer: 'wall' }),
  O('statue', 'Marble statue', 'decor', 1, 2, 150_000, { beauty: 5, prestige: 4, luxury: true }),
  O('lamp', 'Floor lamp', 'decor', 1, 2, 4_000, { beauty: 1, power: -0.1, net: ['power'] }),
  // status
  O('wine_rack', 'Wine rack', 'status', 1, 3, 100_000, { prestige: 4, beauty: 2, cellar: true, luxury: true }),
  O('cinema_seats', 'Cinema recliners', 'status', 3, 1, 200_000, { prestige: 4, beauty: 3, luxury: true }),
  O('cinema_screen', 'Cinema screen', 'status', 3, 2, 300_000, { prestige: 5, power: -4, luxury: true, net: ['power'] }),
  O('cryo_pod', 'Cryo pod', 'status', 1, 3, 2_000_000, { prestige: 8, power: -13, luxury: true, beds: 1, net: ['power'] }),
  // interior (#84): furniture, bath, kitchen, play
  O('armchair', 'Armchair', 'comfort', 2, 1, 12_000, { beauty: 2 }),
  O('coffee_table', 'Coffee table', 'decor', 2, 1, 6_000, { beauty: 1 }),
  O('dining_table', 'Dining table', 'kitchen', 3, 1, 15_000, { beauty: 2 }),
  O('dining_chair', 'Dining chair', 'kitchen', 1, 1, 3_000, { beauty: 0 }),
  O('desk', 'Writing desk', 'comfort', 2, 1, 10_000, { beauty: 1 }),
  O('wardrobe', 'Wardrobe', 'sleep', 2, 3, 15_000, { beauty: 1 }),
  O('nightstand', 'Nightstand', 'decor', 1, 1, 4_000, { beauty: 1 }),
  O('bathtub', 'Clawfoot bathtub', 'bath', 3, 1, 60_000, { beauty: 3, prestige: 1, water: -60, luxury: true, net: ['water'] }),
  O('sink', 'Basin', 'bath', 1, 1, 4_000, { water: -10, net: ['water'] }),
  O('vanity', 'Vanity mirror', 'bath', 1, 2, 20_000, { beauty: 2, prestige: 1 }),
  O('espresso', 'Espresso machine', 'kitchen', 1, 1, 15_000, { beauty: 1, power: -1, net: ['power'] }),
  O('bar_counter', 'Cocktail bar', 'status', 3, 2, 120_000, { beauty: 3, prestige: 3, luxury: true }),
  O('piano', 'Grand piano', 'status', 3, 2, 300_000, { beauty: 5, prestige: 5, luxury: true }),
  O('pool_table', 'Pool table', 'comfort', 3, 1, 60_000, { beauty: 2, prestige: 1 }),
  O('arcade', 'Arcade cabinet', 'comfort', 1, 2, 25_000, { beauty: 1, power: -1, net: ['power'] }),
  O('aquarium', 'Aquarium', 'decor', 2, 2, 80_000, { beauty: 5, prestige: 2, power: -1, luxury: true, net: ['power'] }),
  O('fireplace', 'LED fireplace', 'comfort', 2, 2, 50_000, { beauty: 4, prestige: 1, power: -2, net: ['power'] }),
  O('plant_tall', 'Fiddle-leaf fig', 'decor', 1, 2, 5_000, { beauty: 2 }),
  // rugs (under furniture)
  O('rug', 'Wool rug', 'decor', 3, 1, 8_000, { beauty: 2, layer: 'rug' }),
  O('rug_persian', 'Persian rug', 'decor', 4, 1, 60_000, { beauty: 4, prestige: 2, luxury: true, layer: 'rug' }),
  // on the back wall (above furniture)
  O('mirror', 'Gilt mirror', 'decor', 1, 2, 30_000, { beauty: 3, prestige: 1, layer: 'wall' }),
  O('sconce', 'Wall sconce', 'decor', 1, 1, 6_000, { beauty: 1, power: -0.1, layer: 'wall', net: ['power'] }),
  O('wall_shelf', 'Floating shelf', 'decor', 2, 1, 5_000, { beauty: 1, layer: 'wall' }),
  O('neon_sign', 'Neon sign', 'status', 2, 1, 20_000, { beauty: 2, prestige: 2, power: -0.5, layer: 'wall', net: ['power'] }),
  O('faux_window', 'Faux window and curtains', 'comfort', 2, 2, 40_000, { beauty: 4, power: -1, light: true, layer: 'wall', net: ['power'] }),
  O('trophy', 'Mounted trophy', 'status', 1, 1, 40_000, { beauty: 2, prestige: 3, luxury: true, layer: 'wall' }),
  // hanging from the ceiling
  O('chandelier', 'Crystal chandelier', 'status', 2, 1, 150_000, { beauty: 5, prestige: 4, power: -1, luxury: true, layer: 'ceiling', net: ['power'] }),
  O('pendant', 'Pendant lamp', 'decor', 1, 1, 5_000, { beauty: 1, power: -0.1, layer: 'ceiling', net: ['power'] }),
].map(([id, o]) => [id, { ...o, cost: Math.round(o.cost * PRICE_SCALE) }])));

export const LAYERS = Object.freeze(['rug', 'floor', 'wall', 'ceiling']);
export const layerOf = (o) => o.layer ?? 'floor';

// ---------------------------------------------------------------------------------------------
// Interior finishing (#84): applied to a whole room (or one tile), like painting a room in The Sims.
// beauty is per tile, averaged over the room; cost is per tile.
// ---------------------------------------------------------------------------------------------
export const FINISHES = Object.freeze({
  wall: {
    concrete: { name: 'Bare concrete', a: '#3a3632', b: '#332f2b', beauty: 0, cost: 0, pattern: 'flat' },
    plaster: { name: 'White plaster', a: '#d8d0c0', b: '#ccc4b4', beauty: 1, cost: 300, pattern: 'flat' },
    brick: { name: 'Exposed brick', a: '#8a4a32', b: '#6e3a28', beauty: 1, cost: 500, pattern: 'brick' },
    walnut: { name: 'Walnut panelling', a: '#5a3a22', b: '#4a2e1a', beauty: 2, cost: 900, pattern: 'panel' },
    tech: { name: 'Tech-white panels', a: '#e8eef2', b: '#c8d4dc', beauty: 2, cost: 900, pattern: 'grid' },
    marble: { name: 'Calacatta marble', a: '#ece8e0', b: '#b8b0a4', beauty: 3, cost: 2_000, pattern: 'vein' },
    damask: { name: 'Gold damask', a: '#6a1e2a', b: '#c8a040', beauty: 3, cost: 2_000, pattern: 'damask' },
    velvet: { name: 'Emerald velvet', a: '#1e5a3e', b: '#164a32', beauty: 3, cost: 2_000, pattern: 'stripe' },
    neon: { name: 'Neon pink', a: '#c02a8a', b: '#ff5ac8', beauty: 2, cost: 1_200, pattern: 'stripe' },
    pastel: { name: 'Atomic pastel', a: '#8ad0c0', b: '#f0c8a0', beauty: 2, cost: 900, pattern: 'stripe' },
  },
  floor: {
    concrete: { name: 'Bare slab', a: '#6a6660', b: '#5a5650', beauty: 0, cost: 0 },
    oak: { name: 'Oak parquet', a: '#b07a40', b: '#8a5a2a', beauty: 2, cost: 700 },
    checker: { name: 'Marble checker', a: '#f0ece4', b: '#2a2a2a', beauty: 3, cost: 1_500 },
    carpet: { name: 'Red carpet', a: '#8a1e2a', b: '#6e1620', beauty: 2, cost: 600 },
    terrazzo: { name: 'Terrazzo', a: '#d8ccbc', b: '#8a7a6a', beauty: 2, cost: 900 },
    lacquer: { name: 'Black lacquer', a: '#1a1a1e', b: '#3a3a44', beauty: 2, cost: 1_000 },
  },
  light: {
    plain: { name: 'Work lights', tint: null, beauty: 0, cost: 0 },
    warm: { name: 'Warm glow', tint: 'rgba(255,170,80,.14)', beauty: 1, cost: 200 },
    cool: { name: 'Cool daylight', tint: 'rgba(160,200,255,.12)', beauty: 1, cost: 200 },
    sunset: { name: 'Sunset', tint: 'rgba(255,110,90,.16)', beauty: 1, cost: 300 },
    club: { name: 'Club neon', tint: 'rgba(200,70,255,.18)', beauty: 1, cost: 300 },
  },
});

// Colour variants: every piece can be recoloured. Most share a family; luxe variants add beauty.
export const VARIANTS = Object.freeze({
  upholstery: [{ id: 'cream', name: 'Cream linen', a: '#e8dcc4', b: '#6a4a2a' }, { id: 'burgundy', name: 'Burgundy velvet', a: '#7a1e2e', b: '#3a2418', beauty: 1 }, { id: 'emerald', name: 'Emerald velvet', a: '#1e6a48', b: '#3a2418', beauty: 1 }, { id: 'leather', name: 'Black leather', a: '#2a2626', b: '#8a8a8a' }, { id: 'leopard', name: 'Leopard print', a: '#d8a040', b: '#3a2a1a', beauty: 1 }, { id: 'navy', name: 'Navy and gold', a: '#1e2e5a', b: '#c8a040', beauty: 1 }],
  wood: [{ id: 'walnut', name: 'Walnut', a: '#6a4428', b: '#4a2e1a' }, { id: 'oak', name: 'Oak', a: '#b88a4a', b: '#8a6230' }, { id: 'ebony', name: 'Ebony and brass', a: '#2a2220', b: '#c8a040', beauty: 1 }, { id: 'white', name: 'White lacquer', a: '#ece8e0', b: '#b8b0a4' }],
  metal: [{ id: 'steel', name: 'Brushed steel', a: '#a8acb0', b: '#6a6e72' }, { id: 'gold', name: 'Gold', a: '#d8b040', b: '#8a6a20', beauty: 1 }, { id: 'copper', name: 'Copper', a: '#c87a4a', b: '#7a4428' }, { id: 'black', name: 'Matte black', a: '#2a2a2e', b: '#5a5a62' }],
  bedding: [{ id: 'blue', name: 'Cornflower', a: '#5a7ab0', b: '#f2e6c9' }, { id: 'white', name: 'Hotel white', a: '#ece8e0', b: '#c8c0b0', beauty: 1 }, { id: 'silk', name: 'Champagne silk', a: '#e0c890', b: '#f2e6c9', beauty: 1 }, { id: 'red', name: 'Bordeaux', a: '#8a2030', b: '#f2e6c9' }],
  plant: [{ id: 'green', name: 'Leafy green', a: '#3a8a3a', b: '#7a5030' }, { id: 'olive', name: 'Olive', a: '#6a8a4a', b: '#d8d0c0' }, { id: 'bloom', name: 'In bloom', a: '#3a8a3a', b: '#e05a8a', beauty: 1 }],
});
const FAMILY = { sleep: 'bedding', comfort: 'upholstery', decor: 'wood', kitchen: 'wood', bath: 'metal', status: 'wood', medical: 'metal', security: 'metal', air: 'metal', water: 'metal', food: 'metal', power: 'metal', door: 'wood' };
const FAMILY_BY_KIND = { plant: 'plant', plant_tall: 'plant', armchair: 'upholstery', sofa: 'upholstery', cinema_seats: 'upholstery', rug: 'upholstery', rug_persian: 'upholstery', dining_chair: 'wood', wardrobe: 'wood', bookshelf: 'wood', gold_taps: 'metal', chandelier: 'metal', mirror: 'metal', sconce: 'metal', pendant: 'metal' };
export const variantsFor = (kind) => VARIANTS[FAMILY_BY_KIND[kind] ?? FAMILY[OBJECTS[kind]?.cat] ?? 'wood'];

// What each object offers a resident (Sims-style "advertisements"). needs gained per in-game hour of
// use; hours = how long one use takes; seats = how many residents at once; pose drives the animation.
export const USES = Object.freeze({
  bunk: { needs: { energy: 14 }, hours: 7, seats: 2, pose: 'sleep', sleep: true },
  bed: { needs: { energy: 15 }, hours: 7, seats: 2, pose: 'sleep', sleep: true },
  king_bed: { needs: { energy: 18 }, hours: 7, seats: 2, pose: 'sleep', sleep: true, mood: 5 },
  cryo_pod: { needs: { energy: 20 }, hours: 6, seats: 1, pose: 'sleep', sleep: true, mood: 3 },
  toilet: { needs: { bladder: 300 }, hours: 0.3, seats: 1, pose: 'sit' },
  shower: { needs: { hygiene: 160 }, hours: 0.6, seats: 1, pose: 'shower' },
  bathtub: { needs: { hygiene: 90, fun: 20 }, hours: 1, seats: 1, pose: 'bath', mood: 4 },
  sink: { needs: { hygiene: 60 }, hours: 0.25, seats: 1, pose: 'stand' },
  decon: { needs: { hygiene: 160 }, hours: 0.5, seats: 1, pose: 'shower' },
  gold_taps: { needs: { hygiene: 80 }, hours: 0.3, seats: 1, pose: 'stand', mood: 3 },
  vanity: { needs: { hygiene: 30, fun: 10 }, hours: 0.4, seats: 1, pose: 'stand' },
  fridge: { needs: { hunger: 90 }, hours: 0.4, seats: 1, pose: 'stand' },
  shelf: { needs: { hunger: 60 }, hours: 0.5, seats: 1, pose: 'stand' },
  stove: { needs: { hunger: 100 }, hours: 0.8, seats: 1, pose: 'cook' },
  chef_range: { needs: { hunger: 110, fun: 20 }, hours: 0.8, seats: 1, pose: 'cook', mood: 4 },
  espresso: { needs: { hunger: 20, energy: 30, fun: 10 }, hours: 0.2, seats: 1, pose: 'stand' },
  dining_table: { needs: { hunger: 30, social: 40 }, hours: 0.8, seats: 3, pose: 'sit' },
  dining_chair: { needs: { social: 20 }, hours: 0.5, seats: 1, pose: 'sit' },
  sofa: { needs: { fun: 25, energy: 5, social: 15 }, hours: 1, seats: 3, pose: 'sit' },
  armchair: { needs: { fun: 25, energy: 5 }, hours: 1, seats: 1, pose: 'sit' },
  tv: { needs: { fun: 45 }, hours: 1, seats: 3, pose: 'watch' },
  cinema_seats: { needs: { fun: 70, social: 15 }, hours: 1.5, seats: 3, pose: 'sit', mood: 4 },
  bookshelf: { needs: { fun: 35 }, hours: 1, seats: 1, pose: 'read' },
  desk: { needs: { fun: 20 }, hours: 1, seats: 1, pose: 'sit' },
  piano: { needs: { fun: 60 }, hours: 1, seats: 1, pose: 'play', mood: 5 },
  pool_table: { needs: { fun: 55, social: 35 }, hours: 1, seats: 2, pose: 'play' },
  arcade: { needs: { fun: 60 }, hours: 0.8, seats: 1, pose: 'play' },
  gym_rig: { needs: { fun: 25, energy: -15, hygiene: -15 }, hours: 1, seats: 1, pose: 'exercise', mood: 2 },
  bar_counter: { needs: { social: 60, fun: 30 }, hours: 1, seats: 3, pose: 'drink', mood: 3 },
  med_bed: { needs: { energy: 10 }, hours: 1, seats: 1, pose: 'sleep' },
  wine_rack: { needs: { fun: 30 }, hours: 0.4, seats: 1, pose: 'admire' },
  // decor: residents stop to admire beautiful things (fun scaled by beauty)
  painting: { admire: true }, statue: { admire: true }, aquarium: { admire: true }, fireplace: { admire: true },
  chandelier: { admire: true }, neon_sign: { admire: true }, faux_window: { admire: true }, mirror: { admire: true },
  trophy: { admire: true }, plant_tall: { admire: true }, led_sky: { admire: true }, rug_persian: { admire: true },
});
export const NEED_IDS = Object.freeze(['energy', 'hunger', 'bladder', 'hygiene', 'fun', 'social']);


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
