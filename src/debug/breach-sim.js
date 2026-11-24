// Weekly crisis harness (#68): plays the real CrisisSystem over a roster, week by week, with a bot holding
// its crisis band through scheme-sized pushes, and reports when the first breach lands, naturally or
// through the first-breach wildcard. The quarter-level pacing sim (sim.js) has no per-track crisis, so
// this is the check for "first breach by 2:30".
//
//   simulateFirstBreach({ bot: 'cautious', seed: 1 }) -> { firstBreach: { minute, track, how }, weeks: [...] }

import { CrisisSystem } from '../crisis/breach.js';
import { FirstBreachNudge, FIRST_BREACH } from '../crisis/first-breach.js';
import { TRACK_BY_ID, CLASSIC_ROSTER } from '../world/tracks.js';
import { BOTS, SIM } from './sim.js';
import { PACING } from './pacing.js';
import { mulberry32 } from '../pushback/pushback.js';

export const WEEK_MINUTES = PACING.quarterMinutes / 13;
export const OPEN_TENSION = 20; // TRACK_OPEN_TENSION in the campaign

/**
 * One campaign's first ~3.5 hours of crisis, week by week.
 * The bot pushes its hottest open track up toward its band with the stand-in schemes (one or two a
 * week, tension values from SIM.schemes), and stops at the top of the band.
 */
export function simulateFirstBreach({ bot = 'cautious', seed = 1, roster = CLASSIC_ROSTER, untilMinutes = 210, nudge = true } = {}) {
  const profile = BOTS[bot];
  const [lo, hi] = profile.tension;
  const rng = mulberry32(seed * 104729);
  const crisis = new CrisisSystem({ seed, tracks: roster.map((id) => ({ id, name: TRACK_BY_ID[id].name, open: false })) });
  let minute = 0;
  const nudger = new FirstBreachNudge({ crisis, minutes: () => minute });
  const schemes = SIM.schemes.filter((s) => !s.research);
  let first = null;
  crisis.on('breach', ({ track }) => { if (!first) first = { minute: Math.round(minute), track, how: nudger.fired ? 'wildcard' : 'natural' }; });
  const weeks = [];
  for (let w = 1; minute < untilMinutes; w++) {
    minute = w * WEEK_MINUTES;
    for (const id of roster) if (TRACK_BY_ID[id].opensAt <= minute && !crisis.tracks[id].open) crisis.openTrack(id, { tension: OPEN_TENSION });
    // the bot: one or two schemes a week on the hottest open track, if it sits under the band
    const open = crisis.openTracks.filter((t) => t.state === 'calm' || t.state === 'brink').sort((a, b) => b.tension - a.tension);
    const target = open[0];
    if (target && target.tension < lo) {
      const n = rng() < 0.5 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const fits = schemes.filter((s) => target.tension + s.tension <= hi);
        if (!fits.length || target.tension >= lo) break;
        crisis.addTension(target.id, fits[Math.floor(rng() * fits.length)].tension, 'bot scheme');
      }
    }
    // a little weekly noise (weekly cards nudge tension by a few points)
    for (const t of crisis.openTracks) if (t.state === 'calm' || t.state === 'brink') crisis.addTension(t.id, Math.round((rng() - 0.6) * 6), 'weekly card');
    if (nudge) { const card = nudger.check(); if (card) nudger.apply(card); }
    crisis.paused = false; // the bot "resumes" after a breach pause; containment is not played here
    crisis.advanceWeek();
    weeks.push({ week: w, minute: Math.round(minute), tensions: Object.fromEntries(crisis.openTracks.map((t) => [t.id, t.tension])) });
  }
  return { bot, seed, firstBreach: first, wildcard: nudger.fired, deadline: FIRST_BREACH.atMinutes, weeks };
}

/** Every bot over several seeds: when the first breach happens. */
export function firstBreachHarness({ bots = ['cautious', 'edge', 'luxury'], seeds = [1, 2, 3, 4, 5], nudge = true } = {}) {
  const runs = [];
  for (const bot of bots) for (const seed of seeds) runs.push(simulateFirstBreach({ bot, seed, nudge }));
  const latest = Math.max(...runs.map((r) => r.firstBreach?.minute ?? Infinity));
  return {
    runs,
    checks: {
      everyRunBreachesByDeadline: runs.every((r) => r.firstBreach && r.firstBreach.minute <= FIRST_BREACH.atMinutes + WEEK_MINUTES),
      latestFirstBreach: latest,
      naturalShare: Math.round((runs.filter((r) => r.firstBreach?.how === 'natural').length / runs.length) * 100) / 100,
    },
  };
}
