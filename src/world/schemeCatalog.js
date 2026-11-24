// The full scheme list (GDD: World canvas > Schemes, Alternate schemes; Crises > Breach and containment).
// Data only. 37 schemes: 11 escalate, 5 calm, 7 influence/intel, 6 Classic containment ops,
// 4 alternate escalate and 4 alternate containment ops.
//
// Fields
//   group       escalate | calm | influence | containment
//   dept        specialProjects | communications | corporate | sales
//   target      'one' (any open track) | 'chosen' | 'region' | 'all' | a track id | ['bloom', ...] (any of these)
//   momentum    momentum added (+) or removed (-) on the target; containment ops add points instead
//   perWeek / weeks   ongoing momentum (Think Tank Grant)
//   cost        cash in $ (GDD money scale); rp = research points instead of cash
//   heat        heat added (negative lowers it); multiplied by the target track's band when it runs
//   payback     cash returned when it completes
//   unlockAt    campaign minutes ("1:58" = 118)
//   requires    track id that must be in the roster (track-specific schemes)
//   effect      the GDD's one-line effect, for the UI

import { hm } from './tracks.js';

const M = 1_000_000;
const S = (o) => Object.freeze(o);

export const SCHEME_GROUPS = Object.freeze(['escalate', 'calm', 'influence', 'containment']);

export const SCHEME_CATALOG = Object.freeze([
  // ---------- Escalate ----------
  S({ id: 'leak', name: 'Leak', group: 'escalate', dept: 'specialProjects', target: 'one', momentum: 8, cost: 0.5 * M, heat: 3, unlockAt: hm('0:25'), effect: '+8 momentum on one track' }),
  S({ id: 'distraction', name: 'Distraction', group: 'escalate', dept: 'specialProjects', target: 'chosen', momentum: 6, cost: 1 * M, heat: 4, unlockAt: hm('1:00'), stallsStoryWeeks: 3, effect: '+6 momentum on a chosen track; stalls a journalist’s story 3 weeks' }),
  S({ id: 'influencers', name: 'Doom Influencer Network', group: 'escalate', dept: 'specialProjects', target: 'region', momentum: 12, cost: 1 * M, heat: 5, unlockAt: hm('1:15'), effect: '+12 momentum in one region’s hotspot' }),
  S({ id: 'thinktank', name: 'Think Tank Grant', group: 'escalate', dept: 'specialProjects', target: 'one', momentum: 0, perWeek: 2, weeks: 8, cost: 2 * M, heat: 2, unlockAt: hm('1:15'), effect: '+2 momentum per week for 8 weeks' }),
  S({ id: 'weathermod', name: 'Weather Mod Contract', group: 'escalate', dept: 'specialProjects', target: 'superstorm', requires: 'superstorm', momentum: 15, cost: 3 * M, heat: 6, unlockAt: hm('1:58'), effect: '+15 momentum on Superstorm Season' }),
  S({ id: 'armsbroker', name: 'Arms Broker', group: 'escalate', dept: 'specialProjects', target: 'atomic', requires: 'atomic', momentum: 15, cost: 1 * M, heat: 8, payback: 2 * M, unlockAt: hm('2:10'), effect: '+15 momentum on Atomic Standoff; pays $2M back' }),
  S({ id: 'lableak', name: 'Lab Leak', group: 'escalate', dept: 'specialProjects', target: 'bloom', requires: 'bloom', momentum: 20, cost: 4 * M, heat: 12, unlockAt: hm('2:15'), effect: '+20 momentum on The Bloom' }),
  S({ id: 'featurecreep', name: 'Feature Creep', group: 'escalate', dept: 'specialProjects', target: 'optimizer', requires: 'optimizer', momentum: 15, cost: 3 * M, heat: 5, unlockAt: hm('2:35'), effect: '+15 momentum on The Optimizer' }),
  S({ id: 'sabotage', name: 'Sabotage', group: 'escalate', dept: 'specialProjects', target: 'one', momentum: 25, cost: 6 * M, heat: 15, unlockAt: hm('3:12'), boardVote: true, effect: '+25 momentum on any track' }),
  S({ id: 'pesticide', name: 'Pesticide Partnership', group: 'escalate', dept: 'specialProjects', target: 'hush', requires: 'hush', momentum: 15, cost: 3 * M, heat: 7, unlockAt: hm('3:20'), effect: '+15 momentum on The Hush' }),
  S({ id: 'gentrify', name: 'Gentrify', group: 'escalate', dept: 'specialProjects', target: 'pitchforks', requires: 'pitchforks', momentum: 10, cost: 2 * M, heat: 6, payback: 3 * M, unlockAt: hm('3:30'), effect: '+10 momentum on The Pitchforks; pays $3M in land' }),
  // ---------- Calm ----------
  S({ id: 'everythingfine', name: 'Everything Is Fine', group: 'calm', dept: 'communications', target: 'one', momentum: -8, cost: 1 * M, heat: -2, unlockAt: hm('1:15'), effect: '−8 momentum on one track' }),
  S({ id: 'peacesummit', name: 'Peace Summit Sponsorship', group: 'calm', dept: 'communications', target: 'atomic', requires: 'atomic', momentum: -15, cost: 5 * M, heat: -3, unlockAt: hm('2:10'), effect: '−15 momentum on Atomic Standoff' }),
  S({ id: 'gala', name: 'Philanthropy Gala', group: 'calm', dept: 'communications', target: 'all', momentum: -5, cost: 8 * M, heat: -5, reputation: 5, unlockAt: hm('2:25'), effect: '−5 momentum on every track; reputation +5' }),
  // Debunk works on whichever slot-2 and slot-4 tracks are running.
  S({ id: 'debunk', name: 'Debunk', group: 'calm', dept: 'communications', target: ['bloom', 'optimizer', 'greygoo', 'kessler'], momentum: -10, cost: 2 * M, heat: -1, unlockAt: hm('2:35'), effect: '−10 momentum on the slot-2 or slot-4 track' }),
  S({ id: 'firebreak', name: 'Firebreak', group: 'calm', dept: 'specialProjects', target: 'one', momentum: 0, spilloverMult: 0.5, weeks: 6, cost: 6 * M, heat: 3, unlockAt: hm('4:10'), effect: 'Halves one track’s spillover for 6 weeks' }),
  // ---------- Influence and intel ----------
  S({ id: 'subsidylobby', name: 'Shelter Subsidy Lobby', group: 'influence', dept: 'corporate', target: 'region', momentum: 0, demandMult: 1.3, weeks: 8, cost: 3 * M, heat: 2, unlockAt: hm('1:30'), effect: '+30% demand in one region for 8 weeks, with no tension added' }),
  S({ id: 'intel1', name: 'Brink Analysts (Intel I)', group: 'influence', dept: 'specialProjects', target: null, momentum: 0, intelBand: 5, cost: 0, rp: 120, heat: 0, unlockAt: hm('1:50'), effect: 'Tipping-point band narrows from ±10 to ±5; rival schemes shown' }),
  S({ id: 'poach', name: 'Poach Clients', group: 'influence', dept: 'sales', target: null, momentum: 0, cost: 1 * M, heat: 2, unlockAt: hm('2:55'), effect: 'Steals one lead from a rival' }),
  S({ id: 'kompromat', name: 'Kompromat', group: 'influence', dept: 'specialProjects', target: null, momentum: 0, leverage: -30, storyMult: 0.75, cost: 2 * M, heat: 6, unlockAt: hm('3:12'), effect: '−30 leverage on one client, or a journalist’s story −25%' }),
  S({ id: 'intel2', name: 'Intel II', group: 'influence', dept: 'specialProjects', target: null, momentum: 0, intelBand: 3, cost: 0, rp: 300, heat: 0, unlockAt: hm('4:10'), effect: 'Band narrows to ±3; the domino map is revealed' }),
  S({ id: 'intel3', name: 'Deep Throat (Intel III)', group: 'influence', dept: 'specialProjects', target: null, momentum: 0, intelBand: 1, cost: 0, rp: 350, heat: 2, unlockAt: hm('4:30'), effect: 'Band narrows to ±1' }),
  S({ id: 'takeover', name: 'Hostile Takeover', group: 'influence', dept: 'corporate', target: null, momentum: 0, cost: 150 * M, heat: 10, unlockAt: hm('4:45'), effect: 'Buys a rival and all its sites' }),
  // ---------- Containment ops (one per track; only during that track's breach) ----------
  ...[
    ['summit', 'Back-channel Summit', 'atomic'],
    ['fungicide', 'Fungicide Airdrop', 'bloom'],
    ['cloudseed', 'Cloud-Seeding Armada', 'superstorm'],
    ['unplug', 'Pull the Plug', 'optimizer'],
    ['robobee', 'Robo-Bee Swarm', 'hush'],
    ['circuses', 'Bread and Circuses', 'pitchforks'],
    ['firmware', 'Firmware Recall', 'greygoo'],
    ['bridgeround', 'Bridge Round', 'longshade'],
    ['orbitalsweep', 'Orbital Sweep', 'kessler'],
    ['bargaining', 'Collective Bargaining', 'cloudstrike'],
  ].map(([id, name, track]) => S({ id, name, group: 'containment', dept: 'specialProjects', target: track, requires: track, momentum: 0,
    containment: 40, weeksToLand: 2, cost: 10 * M, costPerBreach: true, heat: 0, unlockAt: hm('2:10'), breachOnly: true,
    effect: '+40 containment points after 2 weeks; $10M × the track’s breach count' })),
  // ---------- Alternate escalate ----------
  S({ id: 'skincare', name: 'Skincare Beta Test', group: 'escalate', dept: 'specialProjects', target: 'greygoo', requires: 'greygoo', momentum: 15, cost: 3 * M, heat: 8, unlockAt: hm('1:15'), effect: '+15 momentum on The Grey Goo' }),
  S({ id: 'sunshade', name: 'Sunshade Series B', group: 'escalate', dept: 'specialProjects', target: 'longshade', requires: 'longshade', momentum: 15, cost: 3 * M, heat: 5, payback: 2 * M, unlockAt: hm('1:58'), effect: '+15 momentum on The Long Shade; your stake pays $2M back' }),
  S({ id: 'launchparty', name: 'Launch Party', group: 'escalate', dept: 'specialProjects', target: 'kessler', requires: 'kessler', momentum: 15, cost: 3 * M, heat: 5, unlockAt: hm('2:35'), effect: '+15 momentum on The Kessler Rain' }),
  S({ id: 'waterfutures', name: 'Water Futures Fund', group: 'escalate', dept: 'specialProjects', target: 'cloudstrike', requires: 'cloudstrike', momentum: 15, cost: 2 * M, heat: 7, payback: 3 * M, unlockAt: hm('3:20'), effect: '+15 momentum on The Cloud Strike; pays $3M back' }),
]);

export const SCHEME_BY_ID = Object.freeze(Object.fromEntries(SCHEME_CATALOG.map((s) => [s.id, s])));

/** Schemes this roster can ever use (track-specific ones need their track in the roster). */
export function schemesForRoster(roster) {
  return SCHEME_CATALOG.filter((s) => {
    if (s.requires) return roster.includes(s.requires);
    if (Array.isArray(s.target)) return s.target.some((t) => roster.includes(t));
    return true;
  });
}

/** Which tracks a scheme can be aimed at, given the roster and which tracks are open. */
export function schemeTargets(scheme, openTrackIds) {
  if (scheme.target == null || scheme.target === 'region') return [];
  if (scheme.target === 'one' || scheme.target === 'chosen' || scheme.target === 'all') return [...openTrackIds];
  const list = Array.isArray(scheme.target) ? scheme.target : [scheme.target];
  return list.filter((t) => openTrackIds.includes(t));
}

// Special Projects level unlocks (GDD unlock schedule rows 6, 15, 20, 36, 45). Each level adds a scheme slot.
export const SPECIAL_PROJECTS_LEVELS = Object.freeze([
  { level: 1, unlockAt: hm('0:25'), slots: 1, heatCut: 0 },
  { level: 2, unlockAt: hm('1:15'), slots: 2, heatCut: 0.08 },
  { level: 3, unlockAt: hm('1:50'), slots: 3, heatCut: 0.16 },
  { level: 4, unlockAt: hm('4:10'), slots: 4, heatCut: 0.24 },
  { level: 5, unlockAt: hm('5:30'), slots: 5, heatCut: 0.32 },
]);
export const schemeSlots = (level) => (level <= 0 ? 0 : SPECIAL_PROJECTS_LEVELS[Math.min(5, level) - 1].slots);
