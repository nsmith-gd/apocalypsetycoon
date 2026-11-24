// The research tree as pure data. Add, remove or rebalance projects here; no code changes needed.
//
// node: { id, branch, name, cost (RP), requires: [ids], blurb, effects: [effect...] }
// effect types (applied by ResearchTree.effects()):
//   { type: 'amenity', id }          new room contents in the build palette and client orders
//   { type: 'scheme', id }           a new crisis-stoking scheme
//   { type: 'crew', amount }         extra build crews
//   { type: 'grid_rows', amount }    dig deeper: extra rows in your shelter grid
//   { type: 'shelter_slots', amount } extra room slots in every client shelter
//   { type: 'scheme_heat', mult }    schemes generate this much heat (0.75 = 25% less)
//   { type: 'luxury_price', mult }   luxury want premiums pay this much more (1.1 = +10%)
//
// Node ids are stable: saves, the pacing bots and tests refer to them.

export const BRANCHES = Object.freeze({
  amenities: 'Amenities',
  rooms: 'Rooms & digs',
  schemes: 'Schemes',
  crews: 'Build crews',
});

export const TREE_NODES = Object.freeze([
  // Amenities: what clients want, and what Midnight grades
  { id: 'a_hydro', branch: 'amenities', name: 'Hydroponic garden', cost: 150, requires: [], blurb: 'Fresh food for decades. Grades well at Midnight.', effects: [{ type: 'amenity', id: 'hydroponics' }] },
  { id: 'a_water', branch: 'amenities', name: 'Deep-well recycler', cost: 220, requires: [], blurb: 'Clean water without the surface.', effects: [{ type: 'amenity', id: 'water_recycler' }] },
  { id: 'a_cryo', branch: 'amenities', name: 'Cryo pod suite', cost: 350, requires: ['a_hydro'], blurb: 'Sleep through the worst of it. Clients adore it.', effects: [{ type: 'amenity', id: 'cryo_pod' }] },
  { id: 'a_scrubber', branch: 'amenities', name: 'Military air scrubber', cost: 480, requires: ['a_water'], blurb: 'Filters fallout, spores and bad press.', effects: [{ type: 'amenity', id: 'mil_scrubber' }] },
  { id: 'a_cellar', branch: 'amenities', name: 'Wine cellar & panic room', cost: 400, requires: ['a_cryo'], blurb: 'Pure prestige. Midnight does not care.', effects: [{ type: 'amenity', id: 'wine_cellar' }] },
  { id: 'a_butler', branch: 'amenities', name: 'AI butler core', cost: 1100, requires: ['a_cellar', 'a_scrubber'], blurb: 'Runs the bunker. Mostly obeys.', effects: [{ type: 'amenity', id: 'ai_butler' }] },
  { id: 'a_brochure', branch: 'amenities', name: 'Glossy brochures', cost: 600, requires: ['a_cryo'], blurb: 'Render the bunker at golden hour. Luxury wants pay 15% more.', effects: [{ type: 'luxury_price', mult: 1.15 }] },

  // Rooms & digs: more space in your own grid and in every shelter you sell
  { id: 'r_deepdig', branch: 'rooms', name: 'Deep excavation', cost: 250, requires: [], blurb: 'Another level down. Quieter, too.', effects: [{ type: 'grid_rows', amount: 1 }] },
  { id: 'r_modular', branch: 'rooms', name: 'Modular fit-outs', cost: 450, requires: ['r_deepdig'], blurb: 'Prefab rooms squeeze one more into every client shelter.', effects: [{ type: 'shelter_slots', amount: 1 }] },
  { id: 'r_sublevel', branch: 'rooms', name: 'Sub-basement levels', cost: 950, requires: ['r_modular'], blurb: 'Two more levels and room for everyone’s staff.', effects: [{ type: 'grid_rows', amount: 2 }, { type: 'shelter_slots', amount: 1 }] },

  // Schemes: new ways to stoke crises, and ways to get away with it
  { id: 's_thinktank', branch: 'schemes', name: 'Astroturf think tank', cost: 180, requires: [], blurb: 'Experts agree: things look bad.', effects: [{ type: 'scheme', id: 'astroturf' }] },
  { id: 's_deepfake', branch: 'schemes', name: 'Deepfake broadcast', cost: 450, requires: ['s_thinktank'], blurb: 'A president says the quiet part loud.', effects: [{ type: 'scheme', id: 'deepfake' }] },
  { id: 's_spin', branch: 'schemes', name: 'Spin doctors on retainer', cost: 550, requires: ['s_thinktank'], blurb: 'Every scheme draws 25% less heat.', effects: [{ type: 'scheme_heat', mult: 0.75 }] },
  { id: 's_shortage', branch: 'schemes', name: 'Engineered shortage', cost: 750, requires: ['s_deepfake'], blurb: 'Empty shelves sell full bunkers.', effects: [{ type: 'scheme', id: 'shortage' }] },
  { id: 's_blackout', branch: 'schemes', name: 'Grid blackout', cost: 1300, requires: ['s_shortage'], blurb: 'Lights out. Phones ring.', effects: [{ type: 'scheme', id: 'blackout' }] },

  // Build crews
  { id: 'c_crew2', branch: 'crews', name: 'Second shovel crew', cost: 200, requires: [], blurb: 'Two holes at once.', effects: [{ type: 'crew', amount: 1 }] },
  { id: 'c_borer', branch: 'crews', name: 'Tunnel boring machine', cost: 600, requires: ['c_crew2'], blurb: 'A crew that never sleeps.', effects: [{ type: 'crew', amount: 1 }] },
  { id: 'c_crew4', branch: 'crews', name: 'Black-site contractors', cost: 1000, requires: ['c_borer'], blurb: 'No questions, no paperwork.', effects: [{ type: 'crew', amount: 1 }] },
]);

// Display names for unlock ids (amenities and schemes), used in effect labels.
export const UNLOCK_NAMES = Object.freeze({
  hydroponics: 'Hydroponic garden', water_recycler: 'Deep-well recycler', cryo_pod: 'Cryo pod suite',
  mil_scrubber: 'Military air scrubber', wine_cellar: 'Wine cellar & panic room', ai_butler: 'AI butler core',
  astroturf: 'Astroturf think tank', deepfake: 'Deepfake broadcast', shortage: 'Engineered shortage', blackout: 'Grid blackout',
});

export function effectLabel(e) {
  switch (e.type) {
    case 'amenity': return `${UNLOCK_NAMES[e.id] ?? e.id} added to the build palette`;
    case 'scheme': return `${UNLOCK_NAMES[e.id] ?? e.id} added to your schemes`;
    case 'crew': return `+${e.amount} build crew`;
    case 'grid_rows': return `+${e.amount} level${e.amount > 1 ? 's' : ''} in your shelter grid`;
    case 'shelter_slots': return `+${e.amount} room slot in every client shelter`;
    case 'scheme_heat': return `Schemes draw ${Math.round((1 - e.mult) * 100)}% less heat`;
    case 'luxury_price': return `Luxury wants pay ${Math.round((e.mult - 1) * 100)}% more`;
    default: return e.type;
  }
}
