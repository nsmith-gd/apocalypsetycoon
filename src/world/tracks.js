// Threat track roster (GDD: World canvas > Threat tracks, Alternate tracks; Crises > The domino map).
// Data only, plus roster selection. No DOM.
//
// Ten tracks share six slots. Slot 1 (Atomic Standoff) and slot 6 (The Pitchforks) never change;
// slots 2-5 each have a Classic track and an alternate apocalypse. The first campaign is always
// Classic; after that the player picks Classic, Random or Custom (selectRoster).
//
// Times are campaign play time in minutes ("0:55" = 55). Regions use the GDD's fictional regions.

export const GDD_REGIONS = Object.freeze([
  { id: 'heartland', name: 'The Heartland', start: true },
  { id: 'coastal', name: 'Coastal Megacities' },
  { id: 'tech', name: 'Tech Corridor' },
  { id: 'capitals', name: 'Old Capitals' },
  { id: 'north', name: 'Northern Reaches' },
  { id: 'equator', name: 'Equatorial Belt' },
  { id: 'islands', name: 'Island Havens' },
  { id: 'frontier', name: 'The Frontier' },
]);

/** "1:58" -> 118 */
export const hm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

// exposure: { regionId: 'high' | 'medium' }; every other region is 'low'.
export const TRACKS = Object.freeze([
  // ---- Classic six ----
  { id: 'atomic', slot: 1, classic: true, name: 'Atomic Standoff', color: '#ff5a4f',
    premise: 'Two great powers rattle sabres over a fictional border',
    sells: 'Depth, blast doors, sealed air', containmentOp: 'summit', opensAt: hm('0:25'),
    exposure: { capitals: 'high', north: 'medium' } },
  { id: 'bloom', slot: 2, classic: true, name: 'The Bloom', color: '#c070ff',
    premise: 'A glittering fungal spore that makes people very sleepy, then very mouldy',
    sells: 'Decon showers, HEPA bays, seals', containmentOp: 'fungicide', opensAt: hm('0:55'),
    exposure: { coastal: 'medium', equator: 'high' } },
  { id: 'superstorm', slot: 3, classic: true, name: 'Superstorm Season', color: '#4a8ad8',
    premise: 'Weather that has stopped respecting forecasts',
    sells: 'Flood seals, power independence, depth', containmentOp: 'cloudseed', opensAt: hm('1:58'),
    exposure: { coastal: 'high', equator: 'high', islands: 'medium' } },
  { id: 'optimizer', slot: 4, classic: true, name: 'The Optimizer', color: '#7ed957',
    premise: 'A corporate AI that has concluded humanity is overhead',
    sells: 'Faraday rooms, analog backups, the end of smart homes', containmentOp: 'unplug', opensAt: hm('2:35'),
    exposure: { tech: 'high' } },
  { id: 'hush', slot: 5, classic: true, name: 'The Hush', color: '#f5c542',
    premise: 'Pollinators fall silent and crops fail',
    sells: 'Protein vats, aquaponics, seed vaults', containmentOp: 'robobee', opensAt: hm('3:20'),
    exposure: { heartland: 'high' } },
  { id: 'pitchforks', slot: 6, classic: true, name: 'The Pitchforks', color: '#ff9f1c',
    premise: 'The public notices the bunkers',
    sells: 'Security, decoys, concealment; it besieges your sites directly', containmentOp: 'circuses', opensAt: hm('3:30'),
    exposure: { heartland: 'medium', capitals: 'high' }, besieges: true },
  // ---- Alternates (slots 2-5) ----
  { id: 'greygoo', slot: 2, classic: false, replaces: 'bloom', name: 'The Grey Goo', color: '#a8a8b8',
    premise: 'Self-replicating nanobots from a luxury skincare line that eat everything except ceramic',
    sells: 'Ceramic linings, EMP pulse rooms, sealed ducts', containmentOp: 'firmware', opensAt: hm('0:55'),
    exposure: { tech: 'high', coastal: 'medium' },
    counterRooms: ['ceramic_lining', 'emp_room', 'kiln_workshop'] },
  { id: 'longshade', slot: 3, classic: false, replaces: 'superstorm', name: 'The Long Shade', color: '#6a5d8a',
    premise: 'A billionaire’s orbital sunshade, launched to fix the climate, jams in the “on” position',
    sells: 'Thermal cladding, boiler rooms, grow lights, depth', containmentOp: 'bridgeround', opensAt: hm('1:58'),
    exposure: { north: 'high', heartland: 'medium' },
    counterRooms: ['thermal_cladding', 'boiler_room', 'fuel_depot'] },
  { id: 'kessler', slot: 4, classic: false, replaces: 'optimizer', name: 'The Kessler Rain', color: '#d8c8a8',
    premise: 'Rival satellite constellations collide, and the debris keeps colliding',
    sells: 'Debris caps, radio rooms, wired everything', containmentOp: 'orbitalsweep', opensAt: hm('2:35'),
    exposure: { equator: 'high', capitals: 'medium' },
    counterRooms: ['debris_cap', 'radio_room', 'convoy_bay'] },
  { id: 'cloudstrike', slot: 5, classic: false, replaces: 'hush', name: 'The Cloud Strike', color: '#b8e0d0',
    premise: 'The clouds stop raining and issue a list of demands',
    sells: 'Atmospheric condensers, water vaults, recyclers, aquifer wells', containmentOp: 'bargaining', opensAt: hm('3:20'),
    exposure: { heartland: 'high', frontier: 'high' },
    counterRooms: ['condenser', 'water_vault', 'cloud_embassy'] },
]);

export const TRACK_BY_ID = Object.freeze(Object.fromEntries(TRACKS.map((t) => [t.id, t])));
export const SLOTS = Object.freeze([1, 2, 3, 4, 5, 6]);
export const SWAPPABLE_SLOTS = Object.freeze([2, 3, 4, 5]);
export const tracksInSlot = (slot) => TRACKS.filter((t) => t.slot === slot);
export const EXPOSURE_WEIGHT = Object.freeze({ high: 1, medium: 0.5, low: 0.25 });

export function exposureOf(trackId, regionId) {
  return TRACK_BY_ID[trackId]?.exposure[regionId] ?? 'low';
}
export function hotRegions(trackId) {
  const t = TRACK_BY_ID[trackId];
  return Object.entries(t.exposure).map(([region, level]) => ({ region, level }));
}

// Counter rooms that exist only in alternate worlds (GDD: Shelter canvas > Alternate-track rooms).
// The first two unlock when their track opens, the third about ten minutes later.
export const COUNTER_ROOMS = Object.freeze({
  ceramic_lining: { name: 'Ceramic Lining', size: 'fixture', track: 'greygoo', unlockAt: hm('0:55'), provides: 'Seal +2 against nanobots', draws: '' },
  emp_room: { name: 'EMP Pulse Room', size: '3x3', track: 'greygoo', unlockAt: hm('0:55'), provides: 'Clears goo from ducts and conduits', draws: '6 kW; resets every smart device on the floor' },
  kiln_workshop: { name: 'Kiln Workshop', size: '4x3', track: 'greygoo', unlockAt: hm('1:05'), provides: 'Fires ceramic linings on site: lining retrofits cost 40% less', draws: '12 kW, noise 2' },
  thermal_cladding: { name: 'Thermal Cladding', size: 'fixture', track: 'longshade', unlockAt: hm('1:58'), provides: 'Heat loss −40%', draws: '' },
  boiler_room: { name: 'Boiler Room', size: '4x3', track: 'longshade', unlockAt: hm('1:58'), provides: '15 kW of heat', draws: '30 L fuel per day, noise 2' },
  fuel_depot: { name: 'Fuel Depot', size: '3x3', track: 'longshade', unlockAt: hm('2:08'), provides: 'Stores 10,000 L of fuel for boilers and generators', draws: 'Fire risk: never beside a bedroom' },
  debris_cap: { name: 'Debris Cap', size: 'surface fixture', track: 'kessler', unlockAt: hm('2:35'), provides: 'Blast +1 against falling debris; hides the surface footprint', draws: '' },
  radio_room: { name: 'Radio Room', size: '3x3', track: 'kessler', unlockAt: hm('2:35'), provides: 'Long-wave contact with your other sites; morale +2 under seal', draws: '2 kW, an operator' },
  convoy_bay: { name: 'Convoy Bay', size: '8x3 + ramp', track: 'kessler', unlockAt: hm('2:45'), provides: 'Ground evacuation without satellites; Seal Order pickups need no helicopter', draws: 'The ramp raises surface visibility' },
  condenser: { name: 'Atmospheric Condenser', size: '3x3', track: 'cloudstrike', unlockAt: hm('3:20'), provides: '2,000 L of water per day from the air', draws: '8 kW, noise 1' },
  water_vault: { name: 'Water Vault', size: '6x3', track: 'cloudstrike', unlockAt: hm('3:20'), provides: 'Stores 120,000 L', draws: '' },
  cloud_embassy: { name: 'Cloud Embassy', size: '4x3 surface', track: 'cloudstrike', unlockAt: hm('3:30'), provides: '+10 containment points to every Collective Bargaining; reputation +1 a quarter', draws: 'A diplomat; raises surface visibility' },
});

// Domino links belong to SLOTS, so alternates inherit their slot's links. The GDD gives the map as a
// picture (6 tracks, 10 links; every track feeds The Pitchforks, which feeds Atomic Standoff straight
// back; Kessler debris blinds Atomic's early-warning satellites). The other links and all weights
// below are assumptions until the picture's data is in the repo.
export const SLOT_LINKS = Object.freeze([
  { from: 1, to: 6, strength: 'strong' },
  { from: 2, to: 6, strength: 'medium' },
  { from: 3, to: 6, strength: 'medium' },
  { from: 4, to: 6, strength: 'medium' },
  { from: 5, to: 6, strength: 'strong' },
  { from: 6, to: 1, strength: 'strong' },
  { from: 4, to: 1, strength: 'medium' },
  { from: 3, to: 5, strength: 'strong' },
  { from: 2, to: 5, strength: 'weak' },
  { from: 1, to: 3, strength: 'weak' },
]);
export const LINK_SPILLOVER = Object.freeze({ strong: 6, medium: 3, weak: 1.5 }); // momentum per breach week
export const LINK_SHOVE = Object.freeze({ strong: 15, medium: 8, weak: 4 }); // tension on collapse

/** Links between the tracks of a roster (by track id). */
export function rosterLinks(roster) {
  const bySlot = Object.fromEntries(roster.map((id) => [TRACK_BY_ID[id].slot, id]));
  return SLOT_LINKS.map((l) => ({ from: bySlot[l.from], to: bySlot[l.to], strength: l.strength }));
}

export const ROSTER_MODES = Object.freeze(['classic', 'random', 'custom']);
export const CLASSIC_ROSTER = Object.freeze(TRACKS.filter((t) => t.classic).map((t) => t.id));

/**
 * The six tracks this campaign runs, slot order.
 *   selectRoster({ mode: 'classic' })
 *   selectRoster({ mode: 'random', rng })                  each swappable slot: classic or its alternate, 50/50
 *   selectRoster({ mode: 'custom', picks: { 2: 'greygoo', 4: 'kessler' } })   unlisted slots stay Classic
 *   firstCampaign: true forces Classic (the GDD's first campaign rule).
 */
export function selectRoster({ mode = 'classic', picks = {}, rng = Math.random, firstCampaign = false } = {}) {
  if (firstCampaign || mode === 'classic') return [...CLASSIC_ROSTER];
  return SLOTS.map((slot) => {
    const options = tracksInSlot(slot);
    if (options.length === 1) return options[0].id;
    if (mode === 'random') return options[rng() < 0.5 ? 0 : 1].id;
    const pick = picks[slot];
    if (pick && options.some((t) => t.id === pick)) return pick;
    return options.find((t) => t.classic).id;
  });
}

/** Tracks of a roster that are open at a given campaign minute. */
export function openTracks(roster, minutes) {
  return roster.filter((id) => TRACK_BY_ID[id].opensAt <= minutes);
}

/** Tracks the roster leaves out: Overtime opens them one per quarter. */
export function unusedTracks(roster) {
  return TRACKS.filter((t) => !roster.includes(t.id)).map((t) => t.id);
}
