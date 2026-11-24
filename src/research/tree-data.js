// The research tree as pure data (GDD: Research, unlocks and fan-outs). Add, remove or rebalance
// projects here; no code changes needed. `node --test tests/research.test.js` validates it.
//
// node: { id, branch, tier 1-5, name, rp, cash, requires: [ids], blurb, effects: [effect...] }
//   Tier 1 costs cash only and lands at once ("Chapter 1 runs on cash"); higher tiers cost RP and cash.
//   Cash follows the GDD costs x 0.1 (the bunker catalog's PRICE_SCALE) until the economy is rescaled.
// effect types (applied by ResearchTree.effects()):
//   { type: 'object', id }        a bunker object (src/shelter/bunker-catalog.js OBJECTS) in the build palette
//   { type: 'structure', id }     a bunker structure ('spine')
//   { type: 'stratum', id }       digging into that stratum (clay, bedrock, deep, abyss)
//   { type: 'scheme', id }        a scheme on the world map (src/schemes/schemes.js SCHEMES)
//   { type: 'amenity', id }       a room for client packages and orders (src/clients/rooms.js)
//   { type: 'crew', amount }      extra build crews
//   { type: 'scheme_heat', mult } schemes generate this much heat (0.75 = 25% less)
//
// Node ids are stable: saves, the pacing bots and tests refer to them.

export const BRANCHES = Object.freeze({
  structure: 'Structure',
  life: 'Life systems',
  luxury: 'Luxury',
  special: 'Special Projects',
  corporate: 'Corporate',
});

// GDD row 1, the starter kit: buildable without research. Any object no node unlocks is also free
// (ordinary furniture and decor), so new catalog items never get stuck behind research by accident.
export const STARTER = Object.freeze({
  objects: ['door', 'airlock', 'bunk', 'bed', 'crank_scrubber', 'o2_rack', 'tank', 'shelf', 'fridge', 'diesel', 'fuel',
    'stove', 'toilet', 'shower', 'camera', 'plant', 'lamp'],
  structures: ['wall'],
  strata: ['topsoil'],
});

const n = (id, branch, tier, name, rp, cash, requires, blurb, effects) => ({ id, branch, tier, name, rp, cash, requires, blurb, effects });

export const TREE_NODES = Object.freeze([
  // ---------- Structure: digging, strata, blast doors ----------
  n('s1_blast', 'structure', 1, 'Blast Door Mk I', 0, 50_000, [], 'Contracts start asking for blast 2.', [{ type: 'object', id: 'blast_1' }]),
  n('s1_spine', 'structure', 1, 'Utility Spine', 0, 100_000, [], 'Multi-floor shelters: every floor must touch it.', [{ type: 'structure', id: 'spine' }]),
  n('s1_clay', 'structure', 1, 'Clay digging', 0, 150_000, [], 'Below 10 m. Seepage below 12 m: bring pumps.', [{ type: 'stratum', id: 'clay' }, { type: 'object', id: 'sump' }]),
  n('s3_bedrock', 'structure', 3, 'Bedrock digging', 180, 600_000, ['s1_clay', 's1_blast'], 'Below 25 m, with Blast Door Mk II. Geothermal within reach.', [{ type: 'stratum', id: 'bedrock' }, { type: 'object', id: 'blast_2' }]),
  n('s4_deep', 'structure', 4, 'Deep Rock digging', 320, 1_800_000, ['s3_bedrock'], 'Below 60 m: an aquifer and Blast Door Mk III.', [{ type: 'stratum', id: 'deep' }, { type: 'object', id: 'aquifer' }, { type: 'object', id: 'blast_3' }]),
  n('s5_abyss', 'structure', 5, 'Abyss digging', 350, 4_000_000, ['s4_deep'], 'Ark-depth excavation.', [{ type: 'stratum', id: 'abyss' }]),

  // ---------- Life systems: air, water, food, power ----------
  n('l1_med', 'life', 1, 'Med Bay', 0, 100_000, [], 'A medic to hire and house.', [{ type: 'object', id: 'med_bed' }]),
  n('a_scrubber', 'life', 2, 'HEPA Scrubber Bay', 50, 150_000, [], 'Spore-proof air, and a decon shower at the door.', [{ type: 'object', id: 'hepa' }, { type: 'object', id: 'decon' }, { type: 'amenity', id: 'mil_scrubber' }]),
  n('l2_power', 'life', 2, 'Battery Bank, Solar Mast', 40, 100_000, [], 'Power that survives a fuel shortage. The mast shows from the surface.', [{ type: 'object', id: 'battery' }, { type: 'object', id: 'solar' }]),
  n('a_hydro', 'life', 2, 'Hydroponics Bay', 60, 200_000, [], 'Fresh food for decades. Grades well at Midnight.', [{ type: 'object', id: 'hydro' }, { type: 'object', id: 'grow_light' }, { type: 'amenity', id: 'hydroponics' }]),
  n('a_water', 'life', 3, 'Deep Water Recycler', 200, 800_000, ['a_scrubber'], 'Recycles 90% of the water. Water budgets that fight at Midnight.', [{ type: 'object', id: 'recycler' }, { type: 'amenity', id: 'water_recycler' }]),
  n('l3_geo', 'life', 3, 'Geothermal Plant', 220, 800_000, ['l2_power', 's3_bedrock'], 'Endless power from the rock itself.', [{ type: 'object', id: 'geothermal' }]),
  n('l4_vats', 'life', 4, 'Protein Vats', 280, 1_400_000, ['a_hydro'], 'Food independence. Nobody asks what is in it.', [{ type: 'object', id: 'vat' }]),
  n('l4_reactor', 'life', 4, 'Micro-reactor', 350, 2_000_000, ['l3_geo'], 'Shielding, specialists and regulator heat.', [{ type: 'object', id: 'reactor' }]),

  // ---------- Luxury: what clients pay for ----------
  n('x1_suite', 'luxury', 1, 'Master Suite, Lounge', 0, 50_000, [], 'More power, a second generator, noise in the layout.', [{ type: 'object', id: 'king_bed' }, { type: 'object', id: 'sofa' }, { type: 'object', id: 'tv' }, { type: 'object', id: 'bookshelf' }, { type: 'object', id: 'gold_taps' }, { type: 'object', id: 'bathtub' }, { type: 'object', id: 'vanity' }, { type: 'object', id: 'faux_window' }, { type: 'object', id: 'fireplace' }]),
  n('a_cellar', 'luxury', 2, "Wine Cellar, Home Cinema, Chef's Kitchen, Gym", 50, 200_000, ['x1_suite'], 'Status rooms. Midnight does not care.', [{ type: 'object', id: 'wine_rack' }, { type: 'object', id: 'cinema_seats' }, { type: 'object', id: 'cinema_screen' }, { type: 'object', id: 'gym_rig' }, { type: 'object', id: 'led_sky' }, { type: 'object', id: 'chef_range' }, { type: 'object', id: 'bar_counter' }, { type: 'object', id: 'pool_table' }, { type: 'object', id: 'arcade' }, { type: 'object', id: 'neon_sign' }, { type: 'amenity', id: 'wine_cellar' }]),
  n('x3_art', 'luxury', 3, 'Art Vault', 200, 800_000, ['a_cellar'], 'Oils and marble for the end of the world.', [{ type: 'object', id: 'painting' }, { type: 'object', id: 'statue' }, { type: 'object', id: 'piano' }, { type: 'object', id: 'aquarium' }, { type: 'object', id: 'rug_persian' }, { type: 'object', id: 'trophy' }, { type: 'object', id: 'chandelier' }, { type: 'object', id: 'mirror' }]),
  n('a_cryo', 'luxury', 4, 'Cryo Pod Bay', 300, 2_000_000, ['x3_art', 'l3_geo'], 'Sleep through the worst of it. Reactor-grade power.', [{ type: 'object', id: 'cryo_pod' }, { type: 'amenity', id: 'cryo_pod' }]),
  n('a_butler', 'luxury', 4, 'AI Butler Core', 250, 1_500_000, ['a_cellar'], 'Runs the bunker. Mostly obeys.', [{ type: 'amenity', id: 'ai_butler' }]),

  // ---------- Special Projects: schemes ----------
  n('s_thinktank', 'special', 2, 'Think Tank Grant', 40, 100_000, [], 'Experts agree: things look bad.', [{ type: 'scheme', id: 'astroturf' }]),
  n('s_deepfake', 'special', 2, 'Deepfake broadcast', 60, 150_000, ['s_thinktank'], 'A president says the quiet part loud.', [{ type: 'scheme', id: 'deepfake' }]),
  n('s_spin', 'special', 3, 'Spin doctors on retainer', 150, 500_000, ['s_thinktank'], 'Every scheme draws 25% less heat.', [{ type: 'scheme_heat', mult: 0.75 }]),
  n('s_shortage', 'special', 3, 'Engineered shortage', 180, 600_000, ['s_deepfake'], 'Empty shelves sell full bunkers.', [{ type: 'scheme', id: 'shortage' }]),
  n('s_blackout', 'special', 4, 'Grid blackout', 300, 1_500_000, ['s_shortage'], 'Lights out. Phones ring.', [{ type: 'scheme', id: 'blackout' }]),

  // ---------- Corporate: crews, security ----------
  n('c_crew2', 'corporate', 1, 'A second crew', 0, 100_000, [], 'Two holes at once.', [{ type: 'crew', amount: 1 }]),
  n('c_borer', 'corporate', 2, 'Tunnel boring machine', 60, 250_000, ['c_crew2'], 'A crew that never sleeps.', [{ type: 'crew', amount: 1 }]),
  n('c_crew4', 'corporate', 3, 'Black-site contractors', 180, 600_000, ['c_borer'], 'No questions, no paperwork.', [{ type: 'crew', amount: 1 }]),
  n('c_security', 'corporate', 4, 'Security Post, Decoy Entrance, Armory', 250, 1_200_000, ['c_crew4'], 'Sieges and guards: your surface footprint becomes a liability.', [{ type: 'object', id: 'guard_post' }, { type: 'object', id: 'decoy' }, { type: 'object', id: 'gun_locker' }]),
]);

// Display names for unlock ids (amenities, schemes, strata) used in effect labels.
export const UNLOCK_NAMES = Object.freeze({
  hydroponics: 'Hydroponic garden', water_recycler: 'Deep-well recycler', cryo_pod: 'Cryo pod suite',
  mil_scrubber: 'Military air scrubber', wine_cellar: 'Wine cellar & panic room', ai_butler: 'AI butler core',
  astroturf: 'Astroturf think tank', deepfake: 'Deepfake broadcast', shortage: 'Engineered shortage', blackout: 'Grid blackout',
  clay: 'Clay', bedrock: 'Bedrock', deep: 'Deep Rock', abyss: 'The Abyss', spine: 'Utility Spine',
});

export function effectLabel(e, objectNames = {}) {
  switch (e.type) {
    case 'object': return `build ${objectNames[e.id] ?? e.id.replace(/_/g, ' ')}`;
    case 'structure': return `build ${UNLOCK_NAMES[e.id] ?? e.id}`;
    case 'stratum': return `dig into ${UNLOCK_NAMES[e.id] ?? e.id}`;
    case 'amenity': return `${UNLOCK_NAMES[e.id] ?? e.id} in client packages`;
    case 'scheme': return `${UNLOCK_NAMES[e.id] ?? e.id} scheme`;
    case 'crew': return `+${e.amount} build crew`;
    case 'scheme_heat': return `schemes draw ${Math.round((1 - e.mult) * 100)}% less heat`;
    default: return e.type;
  }
}
