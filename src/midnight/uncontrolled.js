// The uncontrolled road to Midnight (#70; GDD: Midnight and endings > Two roads to Midnight).
//
// "Uncontrolled: the Doom Clock reaches zero, or the Final Countdown runs out after a second collapse.
//  What you control: only the last 4 weeks." There is no Last Call and no date you chose. The Midnight
// sequence still runs: the Seal Order scramble (2 weeks to get every client in), then every shelter is
// graded against the apocalypse that actually arrived, and the ending is OFF THE RAILS, one grade down.
//
//   const road = uncontrolledRoad({ reason: 'clock' | 'countdown', crisis, doom });
//   const clients = sealOrderClients({ sold, pushback, crisis, regions });
//   const run = resolveUncontrolled({ road, shelters, clients, world, cash, seed });
//   -> { road, seal (runSealOrder results), pickups, result (computeMidnight + road, ending name) }

import { requirementFor, runSealOrder } from './engineered.js';
import { computeMidnight } from './midnight.js';
import { EXPOSURE } from '../demand/demand.js';

export const UNCONTROLLED = Object.freeze({
  endingName: 'OFF THE RAILS', // GDD Endings: "The apocalypse you didn't plan, graded one step down"
  // Seal Order distance from the HQ region (0 = same region ... 3 = the other side of the world). Provisional.
  hq: 'nam',
  distance: { nam: 0, lat: 1, eur: 2, afr: 2, mea: 2, sas: 3, eas: 3, oce: 3 },
  siegeAt: 90, // a client's region has a high-exposure track at 90+: the streets are besieged
});

// Roster track ids whose apocalypse is keyed differently in the GDD apocalypse table.
const APOC_ID = { greygoo: 'goo', longshade: 'long_shade', cloudstrike: 'cloud' };
const apocId = (id) => APOC_ID[id] ?? id;

const CAUSES = {
  clock: 'The Doom Clock struck zero before you were ready.',
  countdown: 'Two collapses started a Final Countdown you could not stop.',
};

/**
 * Which apocalypse arrived. Countdown: the two tracks that collapsed (a combined apocalypse).
 * Clock: the hottest open track (or a collapsed one, if any). Track ids are the roster's.
 */
export function uncontrolledRoad({ reason = 'clock', crisis = null, doom = null } = {}) {
  const collapsed = [...new Set((doom?.collapses ?? []).map((c) => c.track))];
  let target;
  if (collapsed.length >= 2) target = collapsed.slice(-2);
  else if (collapsed.length === 1) target = collapsed[0];
  else {
    const open = crisis ? crisis.openTracks.map((t) => [t.id, t.tension]) : Object.entries(doom?.tensions ?? {});
    open.sort((a, b) => b[1] - a[1]);
    target = open[0]?.[0] ?? 'atomic';
  }
  const apocalypse = requirementFor(Array.isArray(target) ? target.map(apocId) : apocId(target));
  return { reason, cause: CAUSES[reason] ?? CAUSES.clock, target, apocalypse, endingName: UNCONTROLLED.endingName };
}

/** Every sold shelter's client, as the Seal Order needs them (distance, siege, leverage). */
export function sealOrderClients({ sold = [], pushback = null, crisis = null, regions = [], cfg = UNCONTROLLED } = {}) {
  return sold.filter((s) => s.sold).map((s) => {
    const region = regions.find((r) => r.id === s.region);
    const besieged = !!(crisis && region && crisis.openTracks.some((t) => t.tension >= cfg.siegeAt && EXPOSURE[region.exposure?.[t.id]] === 1));
    const client = pushback?.clients?.find((c) => c.name === s.owner);
    return { id: s.id, name: s.owner, region: s.region, distance: cfg.distance[s.region] ?? 2, siege: besieged, leverage: client?.leverage ?? 0 };
  });
}

/** Run the Seal Order and grade Midnight on the uncontrolled road. Pure apart from the seeded rolls. */
export function resolveUncontrolled({ road, shelters = [], clients = [], world = {}, cash = 0, seed = 1, helicopters = false } = {}) {
  const seal = runSealOrder(clients, { seed, helicopters });
  const pickups = Object.fromEntries(seal.map((r) => [r.id, r.outcome]));
  const result = computeMidnight({ shelters, world, cash, apocalypse: road.apocalypse, pickups, forceType: 'failed', cause: road.cause });
  result.road = 'uncontrolled';
  result.endingName = road.endingName;
  result.target = road.target;
  return { road, seal, pickups, result };
}
