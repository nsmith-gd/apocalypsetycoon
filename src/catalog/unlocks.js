// The 48-row unlock schedule (GDD: Research, unlocks and fan-outs > The unlock schedule) as data.
// 39 research nodes in five branches plus 9 free story, board and tier unlocks.
//
// row: { n, at (minutes of play at mixed speed), name, gate: { kinds, branch?, tier?, text }, rp, cash (GDD $),
//        research (true = a research node; false = free from the story, the board or a tier-up),
//        rooms (src/catalog/rooms.js ids), alternateRooms ({ trackId: [room ids] }, alternate worlds only),
//        products, strata, opensTrack, features (schemes, departments, client classes... as text),
//        fanOut, nodes (ids in src/research/tree-data.js that implement this row today) }
//
// In alternate worlds, rows 11, 21, 26 and 31 also open the alternate track and its first two counter rooms;
// the third counter room follows about ten minutes later as a Life node of the same tier (ALTERNATE_FOLLOW_UPS).

import { hm } from '../world/tracks.js';

const G = (text, kinds, branch = null, tier = null) => ({ text, kinds, branch, tier });
const U = (n, at, name, gate, rp, cash, more = {}) => ({
  n, at: hm(at), name, gate, rp, cash, research: !(rp == null && cash == null),
  rooms: [], alternateRooms: {}, products: [], strata: [], opensTrack: null, features: [], nodes: [], fanOut: '', ...more,
});
const M = 1_000_000;

export const UNLOCK_SCHEDULE = Object.freeze([
  U(1, '0:00', 'Starter kit', G('Start', ['start']), null, null, { rooms: ['airlock', 'bunk_room', 'pantry', 'water_tank', 'diesel_generator', 'hand_crank_scrubber', 'galley_kitchen'], strata: ['topsoil'], products: ['solo_pod'], fanOut: 'The first Solo Pod contract' }),
  U(2, '0:06', 'Blast Door Mk I', G('Structure 1', ['research'], 'structure', 1), 0, 0.5 * M, { rooms: ['blast_door_1'], nodes: ['s1_blast'], fanOut: 'Contracts start asking for blast 2' }),
  U(3, '0:10', 'Master Suite, Lounge', G('Luxury 1', ['research'], 'luxury', 1), 0, 0.5 * M, { rooms: ['master_suite', 'lounge'], nodes: ['x1_suite'], fanOut: 'More power, a second generator, noise in the layout' }),
  U(4, '0:15', 'Utility Spine', G('Structure 1', ['research'], 'structure', 1), 0, 1 * M, { rooms: ['utility_spine'], nodes: ['s1_spine'], fanOut: 'Multi-floor shelters; every floor must touch it' }),
  U(5, '0:20', 'Clay digging, Sump Pump', G('Structure 1', ['research'], 'structure', 1), 0, 1.5 * M, { rooms: ['sump_pump'], strata: ['clay'], nodes: ['s1_clay'], fanOut: 'Seepage below 12 m, pumps, more power' }),
  U(6, '0:25', 'Special Projects, Leak; Atomic Standoff opens', G('Board', ['board']), null, null, { opensTrack: 'atomic', features: ['Special Projects department', 'Leak scheme'], fanOut: 'Atomic demand for depth and blast doors' }),
  U(7, '0:32', 'Window Wall, Laundry', G('Luxury 1', ['research'], 'luxury', 1), 0, 1 * M, { rooms: ['window_wall', 'laundry'], fanOut: 'Comfort demand and more power' }),
  U(8, '0:38', 'Med Bay', G('Life 1', ['research'], 'life', 1), 0, 1 * M, { rooms: ['med_bay'], nodes: ['l1_med'], fanOut: 'A medic to hire and house' }),
  U(9, '0:45', 'Blueprints', G('Corporate 1', ['research'], 'corporate', 1), 0, 2 * M, { features: ['Blueprints'], fanOut: 'Saved floors stamped into new shelters' }),
  U(10, '0:50', 'Family Vault, a third crew', G('Corporate 1', ['research'], 'corporate', 1), 0, 2 * M, { products: ['family_vault'], features: ['A third crew'], nodes: ['c_crew2'], fanOut: 'Bigger plots, more floors, spine capacity' }),
  U(11, '0:55', 'Boutique tier: R&D, Communications; The Bloom opens; Decon Shower, HEPA Scrubber Bay', G('Tier and story', ['tier', 'story']), null, null, { rooms: ['decon_shower', 'hepa_scrubber_bay'], alternateRooms: { greygoo: ['ceramic_lining', 'emp_room'] }, opensTrack: 'bloom', features: ['Boutique tier', 'R&D department', 'Communications department'], nodes: ['a_scrubber'], fanOut: 'Spore retrofits for every shelter sold' }),
  U(12, '1:00', 'Heat, Iris Kemp’s first story, Distraction', G('Story', ['story']), null, null, { features: ['Heat', 'Iris Kemp’s first story', 'Distraction scheme'], fanOut: 'Heat management and Communications upgrades' }),
  U(13, '1:05', 'Resilience Grants: the crisis dividend', G('Board', ['board']), null, null, { features: ['Resilience Grants'], fanOut: 'A reason to heat a second track' }),
  U(14, '1:10', 'Disruptor clients; Wine Cellar, Home Cinema, Biohacking Lab, Broadcast Studio, Gym', G('Story and Luxury 2', ['story', 'research'], 'luxury', 2), 50, 2 * M, { rooms: ['wine_cellar', 'home_cinema', 'biohacking_lab', 'broadcast_studio', 'gym'], features: ['C2 Disruptor clients'], nodes: ['a_cellar'], fanOut: 'Status tier, cellar depth, bigger plots' }),
  U(15, '1:15', 'Everything Is Fine, Doom Influencer Network, Think Tank Grant', G('Special Projects 2', ['research'], 'special', 2), 40, 1 * M, { features: ['Everything Is Fine scheme', 'Doom Influencer Network scheme', 'Think Tank Grant scheme'], nodes: ['s_thinktank'], fanOut: 'Holding a track at Boil becomes possible' }),
  U(16, '1:22', 'Condo Silo, Guest Quarters', G('Corporate 2', ['research'], 'corporate', 2), 60, 3 * M, { rooms: ['guest_quarters'], products: ['condo_silo'], fanOut: 'Shared systems, feuds, condo gossip' }),
  U(17, '1:30', 'Second site; Panic Room, Chef’s Kitchen, Library; Shelter Subsidy Lobby', G('Tier and Luxury 2', ['tier', 'research'], 'luxury', 2), 50, 2 * M, { rooms: ['panic_room', 'chefs_kitchen', 'library_game_room'], features: ['Second site', 'Shelter Subsidy Lobby scheme'], fanOut: 'Regional exposure and a second client pool' }),
  U(18, '1:38', 'Battery Bank, Solar Mast', G('Life 2', ['research'], 'life', 2), 40, 1 * M, { rooms: ['battery_bank', 'solar_mast'], nodes: ['l2_power'], fanOut: 'Surface visibility, which matters later' }),
  U(19, '1:45', 'Hydroponics Bay', G('Life 2', ['research'], 'life', 2), 60, 2 * M, { rooms: ['hydroponics_bay'], nodes: ['a_hydro'], fanOut: 'Water, grow-light power, bigger tanks' }),
  U(20, '1:50', 'Firm tier; Brink Analysts (Intel I)', G('Tier and Special Projects 3', ['tier', 'research'], 'special', 3), 120, null, { features: ['Firm tier', 'Brink Analysts (Intel I)'], fanOut: 'Brink riding becomes readable' }),
  U(21, '1:58', 'Superstorm Season opens; Flood Seals, Storm Shutters; Weather Mod Contract', G('Story and Life 3', ['story', 'research'], 'life', 3), 120, 4 * M, { rooms: ['flood_seals'], alternateRooms: { longshade: ['thermal_cladding', 'boiler_room'] }, opensTrack: 'superstorm', features: ['Weather Mod Contract scheme'], fanOut: 'Coastal retrofits, power independence' }),
  U(22, '2:05', 'Bedrock digging, Blast Door Mk II', G('Structure 3', ['research'], 'structure', 3), 180, 6 * M, { rooms: ['blast_door_2'], strata: ['bedrock'], nodes: ['s3_bedrock'], fanOut: 'Geothermal within reach' }),
  U(23, '2:10', 'Containment ops; Arms Broker, Peace Summit Sponsorship', G('Special Projects 3', ['research'], 'special', 3), 150, 5 * M, { features: ['Containment ops', 'Arms Broker scheme', 'Peace Summit Sponsorship scheme'], fanOut: 'A first breach becomes survivable' }),
  U(24, '2:15', 'Dynasty clients; Art Vault, Heir Nursery, Museum of Me, Trophy Garage, Helipad; Lab Leak', G('Story and Luxury 3', ['story', 'research'], 'luxury', 3), 200, 8 * M, { rooms: ['art_vault', 'heir_nursery', 'museum_of_me', 'trophy_garage', 'helipad'], features: ['C3 Dynasty clients', 'Lab Leak scheme'], nodes: ['x3_art'], fanOut: 'Climate power, surface visibility, bigger families' }),
  U(25, '2:25', 'Legal, NDAs; Therapy Pod, Cigar Lounge, Personal Mausoleum; Philanthropy Gala', G('Corporate 3', ['research'], 'corporate', 3), 150, 5 * M, { rooms: ['therapy_pod', 'cigar_lounge', 'personal_mausoleum'], features: ['Legal department', 'NDAs', 'Philanthropy Gala scheme'], fanOut: 'Leverage management' }),
  U(26, '2:35', 'The Optimizer opens; Faraday Room; Feature Creep, Debunk', G('Story and Life 3', ['story', 'research'], 'life', 3), 160, 5 * M, { rooms: ['faraday_room'], alternateRooms: { kessler: ['debris_cap', 'radio_room'] }, opensTrack: 'optimizer', features: ['Feature Creep scheme', 'Debunk scheme'], fanOut: 'Every Disruptor’s smart bunker needs a retrofit' }),
  U(27, '2:45', 'Geothermal Plant, a second spine', G('Life 3', ['research'], 'life', 3), 220, 8 * M, { rooms: ['geothermal_plant'], features: ['A second spine'], nodes: ['l3_geo'], fanOut: 'Engineers to house, heat exchangers' }),
  U(28, '2:55', 'Halcyon Vaults arrives; Poach Clients', G('Story', ['story']), null, null, { features: ['Rival: Halcyon Vaults', 'Poach Clients scheme'], fanOut: 'Competition for Dynasty leads' }),
  U(29, '3:05', 'Deep Water Recycler, Infinity Pool, Spa and Sauna', G('Life 3 and Luxury 3', ['research'], 'life', 3), 200, 8 * M, { rooms: ['deep_water_recycler', 'infinity_pool', 'spa_sauna'], nodes: ['a_water'], fanOut: 'Water budgets that fight at Midnight' }),
  U(30, '3:12', 'Kompromat, Sabotage', G('Special Projects 3', ['research'], 'special', 3), 180, 6 * M, { features: ['Kompromat scheme', 'Sabotage scheme (board vote)'], fanOut: 'Leverage counters; Sabotage needs a board vote' }),
  U(31, '3:20', 'Conglomerate tier; The Hush opens; Aquaponics, Protein Vats, Seed Vault, Atrium Garden; Pesticide Partnership', G('Tier, story and Life 4', ['tier', 'story', 'research'], 'life', 4), 280, 14 * M, { rooms: ['aquaponics_bay', 'protein_vats', 'seed_vault', 'atrium_garden'], alternateRooms: { cloudstrike: ['condenser', 'water_vault'] }, opensTrack: 'hush', features: ['Conglomerate tier', 'Pesticide Partnership scheme'], nodes: ['l4_vats'], fanOut: 'Food-independence retrofits everywhere' }),
  U(32, '3:30', 'Security; The Pitchforks opens; Security Post, Decoy Entrance, Armory; Gentrify', G('Story and Corporate 4', ['story', 'research'], 'corporate', 4), 250, 12 * M, { rooms: ['security_post', 'decoy_entrance', 'armory'], opensTrack: 'pitchforks', features: ['Security department', 'Gentrify scheme'], nodes: ['c_security'], fanOut: 'Sieges, guards; surface footprint becomes a liability' }),
  U(33, '3:40', 'Deep Rock digging, Aquifer Well, Blast Door Mk III', G('Structure 4', ['research'], 'structure', 4), 320, 18 * M, { rooms: ['aquifer_well', 'blast_door_3'], strata: ['deep'], nodes: ['s4_deep'], fanOut: 'Reactor siting, unlimited water' }),
  U(34, '3:50', 'Mogul clients; Throne Room, Mansion Replica Floor, Private Forest Dome, Pet Clone Lab', G('Story and Luxury 4', ['story', 'research'], 'luxury', 4), 300, 16 * M, { rooms: ['throne_room', 'mansion_replica_floor', 'private_forest_dome', 'pet_clone_lab'], features: ['C4 Mogul clients'], fanOut: 'Enormous power and water draws' }),
  U(35, '4:00', 'Micro-reactor', G('Life 4', ['research'], 'life', 4), 350, 20 * M, { rooms: ['micro_reactor'], nodes: ['l4_reactor'], fanOut: 'Shielding, specialists, regulator heat' }),
  U(36, '4:10', 'Intel II: the domino map; Firebreak', G('Special Projects 4', ['research'], 'special', 4), 300, null, { features: ['Intel II: the domino map', 'Firebreak scheme'], fanOut: 'Planning dominoes instead of guessing' }),
  U(37, '4:20', 'Compound', G('Corporate 4', ['research'], 'corporate', 4), 280, 15 * M, { products: ['compound'], fanOut: 'Tunnels between sites, spread risk' }),
  U(38, '4:30', 'Mr. Gray reveals The Table; Table leads; Legacy Broadcast Array; Deep Throat (Intel III)', G('Story and Special Projects 4', ['story', 'research'], 'special', 4), 350, null, { rooms: ['legacy_broadcast_array'], features: ['Mr. Gray reveals The Table', 'C5 Table leads', 'Deep Throat (Intel III)'], fanOut: 'The Ark becomes the goal' }),
  U(39, '4:38', 'Cryo Pod Bay', G('Luxury 4', ['research'], 'luxury', 4), 300, 20 * M, { rooms: ['cryo_pod_bay'], nodes: ['a_cryo'], fanOut: 'Reactor-grade power in Dynasty and Mogul shelters' }),
  U(40, '4:45', 'Bunkr goes public; Hostile Takeover', G('Story', ['story']), null, null, { features: ['Rival: Bunkr goes public', 'Hostile Takeover'], fanOut: 'A rival’s sites and secrets for sale' }),
  U(41, '4:50', 'The Last Resort tier; Project Lights Out; Abyss digging', G('Tier and Structure 5', ['tier', 'research'], 'structure', 5), 350, 40 * M, { strata: ['abyss'], features: ['The Last Resort tier', 'Project Lights Out'], nodes: ['s5_abyss'], fanOut: 'Ark-depth excavation' }),
  U(42, '5:00', 'The Ark; Governance Hall, Schoolhouse', G('Corporate 5', ['research'], 'corporate', 5), 400, 60 * M, { products: ['ark'], features: ['Ark modules: Governance Hall, Schoolhouse'], fanOut: 'A consortium build for hundreds of occupants' }),
  U(43, '5:10', 'Genetic Library', G('Luxury 5', ['research'], 'luxury', 5), 250, 40 * M, { rooms: ['genetic_library'], fanOut: 'The Table’s final vanity' }),
  U(44, '5:20', 'Readiness Audit: simulate Midnight for any shelter', G('Life 5', ['research'], 'life', 5), 300, 40 * M, { features: ['Readiness Audit'], fanOut: 'Find weak shelters before Midnight does' }),
  U(45, '5:30', 'The Final Product: an engineered breach option per track', G('Special Projects 5 and a board vote', ['research', 'board'], 'special', 5), 400, 80 * M, { features: ['The Final Product (board vote)'], fanOut: 'Choose which apocalypse to sell' }),
  U(46, '5:40', 'Seal Order logistics: convoys and helicopter lift', G('Corporate 5', ['research'], 'corporate', 5), 200, 30 * M, { features: ['Seal Order logistics'], fanOut: 'Getting clients inside on time' }),
  U(47, '5:45', 'The Last Resort path (hidden)', G('Story: Iris Kemp trust 3+, Ruth Abernathy loyalty 70+', ['story']), null, null, { features: ['The Last Resort path'], fanOut: 'The whistleblower ending' }),
  U(48, '5:50', 'The Overtime offer', G('Board', ['board']), null, null, { features: ['Overtime'], fanOut: 'Endless quarters past quarter 12' }),
].map((r) => Object.freeze(r)));

// Each alternate's third counter room: a Life node of the same tier about ten minutes after its track opens.
export const ALTERNATE_FOLLOW_UPS = Object.freeze([
  { track: 'greygoo', room: 'kiln_workshop', at: hm('1:05'), afterRow: 11 },
  { track: 'longshade', room: 'fuel_depot', at: hm('2:08'), afterRow: 21 },
  { track: 'kessler', room: 'convoy_bay', at: hm('2:45'), afterRow: 26 },
  { track: 'cloudstrike', room: 'cloud_embassy', at: hm('3:30'), afterRow: 31 },
]);

// Live research nodes (src/research/tree-data.js) with no row of their own: stand-ins from before the GDD
// tables were in the repo. Kept so saves and the pacing bots still work; candidates to fold into the rows above.
export const NODES_OUTSIDE_SCHEDULE = Object.freeze(['s_deepfake', 's_spin', 's_shortage', 's_blackout', 'c_borer', 'c_crew4', 'a_butler']);

export const UNLOCK_BY_N = Object.freeze(Object.fromEntries(UNLOCK_SCHEDULE.map((r) => [r.n, r])));

/** Target unlock time (minutes) for each live research node, from the schedule. */
export function nodeTargets() {
  const out = {};
  for (const r of UNLOCK_SCHEDULE) for (const id of r.nodes) out[id] = r.at;
  return out;
}

/** Row that unlocks a room or product (null for alternate third rooms, see ALTERNATE_FOLLOW_UPS). */
export function rowFor(id) {
  return UNLOCK_SCHEDULE.find((r) => r.rooms.includes(id) || r.products.includes(id) || Object.values(r.alternateRooms).some((l) => l.includes(id))) ?? null;
}

/** The next `count` unlocks after minute `m` (the GDD's "locked shelf" shows three). */
export function lockedShelf(m, count = 3) {
  return UNLOCK_SCHEDULE.filter((r) => r.at > m).slice(0, count);
}
