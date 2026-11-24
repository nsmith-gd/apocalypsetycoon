// The Midnight finale when quarter 12 runs out (#17): which apocalypse arrives, and the world it
// arrives in, so the grade is based on the shelters AND the state of the world.
//
// GDD (Midnight and endings): shelters are judged against the arriving apocalypse's required Days
// Sealed and critical ratings. When the player has not engineered one (#29 / #70 own the engineered
// road and the full Seal Order sequence), the apocalypse is the one the world was already heading for:
//   1. a track that has COLLAPSED (the world already ended there),
//   2. else a track in BREACH or still recovering from one,
//   3. else a track at the BRINK,
//   4. else the hottest open track.
// Ties go to the higher tension. Control (engineered vs failed to contain) counts real breaches and
// collapses from the crisis system as well as Pushback's runaways.
//
//   const args = finaleArgs({ crisis, pushback, shelters, cash });
//   const result = computeMidnight({ ...args, ...(cause ? { forceType: 'failed', cause } : {}) });

import { APOCALYPSES, TRACK_APOCALYPSE } from './engineered.js';

// Alternate track ids (src/world/tracks.js) -> keys of the GDD apocalypse table (engineered.js).
export const ALT_APOCALYPSE = Object.freeze({ greygoo: 'goo', longshade: 'long_shade', kessler: 'kessler', cloudstrike: 'cloud' });

const RANK = { collapsed: 4, breach: 3, locked: 3, brink: 2, calm: 1 };

/** The apocalypse the world is heading for, from the crisis tracks ({ id, name, open, tension, state }). */
export function arrivingApocalypse(tracks = []) {
  const live = tracks.filter((t) => t.open !== false);
  const pool = live.length ? live : tracks;
  if (!pool.length) return null;
  const pick = [...pool].sort((a, b) => (RANK[b.state] ?? 1) - (RANK[a.state] ?? 1) || (b.tension ?? 0) - (a.tension ?? 0))[0];
  const id = APOCALYPSES[pick.id] ? pick.id : TRACK_APOCALYPSE[pick.id] ?? ALT_APOCALYPSE[pick.id];
  if (!APOCALYPSES[id]) return null;
  const reason = pick.state === 'collapsed' ? 'it had already collapsed'
    : pick.state === 'breach' || pick.state === 'locked' ? 'it had already breached'
      : pick.state === 'brink' ? 'it was at the Brink' : 'it was the hottest crisis';
  return { id, track: pick.id, tension: Math.round(pick.tension ?? 0), state: pick.state ?? 'calm', reason, ...APOCALYPSES[id] };
}

/** The world at Midnight, for the control score and the grade. */
export function worldAtMidnight({ tracks = [], pushback = null } = {}) {
  const open = tracks.filter((t) => t.open !== false);
  const breaches = tracks.reduce((s, t) => s + (t.breaches ?? 0), 0);
  const collapses = tracks.filter((t) => t.state === 'collapsed').length;
  const hottest = open.reduce((m, t) => Math.max(m, t.tension ?? 0), 0);
  return {
    tension: Math.round(Math.max(pushback?.tension ?? 0, hottest)),
    heat: Math.round(pushback?.heat ?? 0),
    runaways: Math.max(pushback?.runaways ?? 0, breaches),
    collapses,
  };
}

/** Everything computeMidnight needs for a quarter-12 (or Doom Clock) Midnight. */
export function finaleArgs({ crisis = null, pushback = null, shelters = [], cash = 0 } = {}) {
  const tracks = Object.values(crisis?.tracks ?? {});
  return { shelters, cash, world: worldAtMidnight({ tracks, pushback }), apocalypse: arrivingApocalypse(tracks) };
}
