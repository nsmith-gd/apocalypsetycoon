// Headless WORLD harness (#75): runs the real crisis system (src/crisis/breach.js) over a roster for a
// whole 12-quarter campaign, so a roster swap (The Grey Goo in slot 2, ...) can be checked end to end:
// tracks open on their GDD schedule, a scripted player stokes the hottest open track toward the edge,
// contains breaches when it can, and every domino along a (slot-keyed) link is recorded.
//
//   simulateWorld({ roster, seed }) -> { weeks, completed, opened, breaches, collapses, dominoes, apocalypse, log }

import { CrisisSystem } from '../crisis/breach.js';
import { TRACK_BY_ID, rosterLinks, CLASSIC_ROSTER, heroFears, HERO_CLIENTS, rivalFavourites, trackInSlot } from '../world/tracks.js';
import { arrivingApocalypse } from '../midnight/finale.js';
import { PACING } from './pacing.js';

// `tipSlot`: from week `tipFrom` the player shoves that slot's track over the edge and lets it collapse, so its
// slot-keyed links are exercised (default slot 2 in the last three quarters).
export function simulateWorld({ roster = CLASSIC_ROSTER, seed = 1, weeks = 12 * 13, tipSlot = 2, tipFrom = 9 * 13 } = {}) {
  const crisis = new CrisisSystem({
    seed,
    tracks: roster.map((id) => ({ id, name: TRACK_BY_ID[id].name, open: false })),
    links: rosterLinks(roster).map((l) => [l.from, l.to, l.strength]),
  });
  const minutesPerWeek = PACING.quarterMinutes / 13;
  const out = { roster: [...roster], weeks: 0, completed: false, opened: [], breaches: [], collapses: [], dominoes: [], log: [] };
  crisis.on('breach', (e) => out.breaches.push({ week: crisis.week, track: e.track }));
  crisis.on('collapse', (e) => out.collapses.push({ week: crisis.week, track: e.track }));
  crisis.on('domino', (e) => out.dominoes.push({ week: crisis.week, from: e.from, to: e.to, strength: e.strength }));
  let rng = seed * 2654435761 % 4294967296;
  const rand = () => ((rng = (rng * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let w = 0; w < weeks; w++) {
    const minutes = w * minutesPerWeek;
    for (const id of roster) if (!crisis.tracks[id].open && TRACK_BY_ID[id].opensAt <= minutes) { crisis.openTrack(id, { tension: 20 }); out.opened.push({ week: w, track: id }); }
    // Scripted player: stoke the hottest calm open track toward the edge (stop ~8 below its visible tip).
    const open = Object.values(crisis.tracks).filter((t) => t.open && t.state !== 'collapsed' && t.state !== 'breach' && t.state !== 'locked');
    if (open.length) {
      const t = open.sort((a, b) => b.tension - a.tension)[Math.floor(rand() * Math.min(2, open.length))];
      const tip = crisis.visibleTip?.(t.id)?.range?.[0] ?? 80;
      if (t.tension < tip - 8) crisis.addTension(t.id, 4 + Math.floor(rand() * 6), 'scheme');
    }
    const doomed = tipSlot ? trackInSlot(roster, tipSlot) : null;
    if (doomed && w >= tipFrom && crisis.tracks[doomed].open && !['breach', 'locked', 'collapsed'].includes(crisis.tracks[doomed].state)) crisis.addTension(doomed, 15, 'reckless scheme');
    // Contain breaches (except the one being let go): spend every available source.
    for (const t of crisis.activeBreaches.filter((x) => x.id !== doomed)) for (const key of ['op', 'calming', 'government', 'research', 'heroics']) if (t.state === 'breach') crisis.contribute(t.id, key);
    crisis.advanceWeek();
    out.weeks = w + 1;
  }
  out.completed = out.weeks === weeks;
  out.apocalypse = arrivingApocalypse(Object.values(crisis.tracks))?.name ?? null;
  out.finalTension = Object.fromEntries(Object.values(crisis.tracks).map((t) => [t.id, Math.round(t.tension)]));
  out.heroFears = Object.fromEntries(HERO_CLIENTS.slice(0, 6).map((h) => [h.name, heroFears(h, roster).map((id) => TRACK_BY_ID[id].name)]));
  out.rivals = { halcyon: rivalFavourites('halcyon', roster), bunkr: rivalFavourites('bunkr', roster) };
  return out;
}
