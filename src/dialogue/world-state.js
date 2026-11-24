// Crisis-aware dialogue (#57): what guests know about the world when you meet them.
//
// worldState({ crisis, schemes }) takes a snapshot of the live crisis tracks (CrisisSystem, #4/#69),
// recent headlines (the crisis log, plus the press coverage of the player's schemes) and the player's
// past schemes (SchemeBoard.log). Trees read it through conditions; outcomes read it through
// crisisPitch():
//   - a guest whose fear is boiling over is easier to sell: more starting trust, a better lead;
//   - but if the player's schemes fed that fear just before the party, the timing is too convenient:
//     suspicion costs trust and makes slips likelier. Skeptics and the paranoid notice sooner.
//
// CONDITION (on a tree choice `when`, or a node `alt[].when`; every key given must hold)
//   band: 'simmer'|'boil'|'brink'   the guest's fear is at least this hot (breach and collapse count as brink)
//   bandBelow: 'simmer'|...         the guest's fear is cooler than this
//   breach: true                    the guest's fear is in breach or has collapsed
//   anyBreach: true                 some open track is in breach right now
//   headline: true                  a headline about the guest's fear ran in the last HEADLINE_WEEKS
//   schemed: true                   the player schemed on the guest's fear in the last SCHEME_WEEKS
//   suspicious: true / false        the guest's suspicion is at least / below SUSPICIOUS
//   track: 'id'                     test band/breach/headline/schemed on this track instead of the guest's fear
// Text placeholders that read the world: {level} ("boiling over") and {headline} (latest about the fear).

import { TRACK_BY_ID } from '../world/tracks.js';
import { bandOf } from '../world/momentum.js';
import { SCHEMES } from '../schemes/schemes.js';

export const CRISIS_TALK = Object.freeze({
  headlineWeeks: 4,
  schemeWeeks: 6,
  suspicious: 0.5,
  // how hot the guest's fear is, 0..1.2, by band / state
  pressure: { calm: 0, simmer: 0.35, boil: 0.7, brink: 1, breach: 1.2, collapsed: 1 },
  trustPerPressure: 12, // starting trust at full pressure
  interestPerPressure: 15, // lead interest on a win at full pressure
  suspicion: {
    perScheme: 0.4, // a scheme this week on their fear; fades linearly over schemeWeeks
    hotMult: 1.4, // ...more when the fear is at boil or hotter (you visibly pushed it over)
    breachSoon: 0.25, // the fear breached within 2 weeks of one of your schemes
    traitMult: { skeptic: 1.5, paranoid: 1.3, discreet: 1.2 },
    trustCost: 25, // starting trust lost at suspicion 1
    slipChance: 0.3, // added to each slip's chance at suspicion 1
  },
});

const BAND_ORDER = ['calm', 'simmer', 'boil', 'brink'];
const LEVEL_WORDS = { calm: 'quiet', simmer: 'simmering', boil: 'boiling over', brink: 'on the brink', breach: 'in breach', collapsed: 'a catastrophe' };
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const nameOf = (id) => TRACK_BY_ID[id]?.name ?? id;
const SCHEME_BY_ID = Object.fromEntries(SCHEMES.map((s) => [s.id, s]));

/** A calm, empty world: what a conversation sees when there is no live data. */
export const QUIET_WORLD = Object.freeze({ week: 0, tracks: {}, headlines: [], schemes: [] });

/** Newspaper headline for a crisis log entry (null for entries that never reach the papers). */
export function headlineFor(entry, crisis = null) {
  const n = (id) => (crisis?.tracks?.[id]?.name ?? nameOf(id)).toUpperCase();
  switch (entry.type) {
    case 'open': return `${n(entry.track)}: EXPERTS SAY "WATCH THIS ONE"`;
    case 'breach': return `${n(entry.track)} BREACHES. OFFICIALS URGE CALM`;
    case 'collapse': return `${n(entry.track)}: IT HAS HAPPENED`;
    case 'contain': return null;
    case 'domino': return `${n(entry.to)} SPIKES AS ${n(entry.from)} SPREADS`;
    default: return null;
  }
}

/**
 * Snapshot the live world for dialogue. Every argument is optional.
 *   crisis   CrisisSystem: tracks (tension, state, open), week, log
 *   schemes  SchemeBoard: log of { week, scheme, region }, trackOf(scheme)
 */
export function worldState({ crisis = null, schemes = null } = {}) {
  if (!crisis) return QUIET_WORLD;
  const week = crisis.week ?? 0;
  const tracks = {};
  for (const t of Object.values(crisis.tracks ?? {})) {
    if (t.open === false) continue;
    tracks[t.id] = { id: t.id, name: t.name, tension: t.tension, state: t.state ?? 'calm', band: bandOf(t.tension).id };
  }
  const headlines = [];
  for (const e of crisis.log ?? []) {
    const text = headlineFor(e, crisis);
    if (text) headlines.push({ week: e.week, track: e.track ?? e.to, type: e.type, text });
  }
  const ran = [];
  for (const r of schemes?.log ?? []) {
    const s = SCHEME_BY_ID[r.scheme];
    const track = (s && schemes.trackOf?.(s)?.id) ?? s?.track ?? r.track;
    ran.push({ week: r.week, scheme: r.scheme, name: s?.name ?? r.scheme, track, region: r.region });
    // the press covers the result, not the cause
    if (s) headlines.push({ week: r.week, track, type: 'scheme', text: s.blurb.replace(/\.$/, '').toUpperCase() });
  }
  headlines.sort((a, b) => b.week - a.week);
  return { week, tracks, headlines, schemes: ran };
}

/** Band (or breach state) of a track in a world snapshot. */
export function levelOf(world, trackId) {
  const t = world?.tracks?.[trackId];
  if (!t) return 'calm';
  if (t.state === 'breach' || t.state === 'collapsed') return t.state;
  return t.band;
}
const bandRank = (level) => (level === 'breach' || level === 'collapsed' ? 3 : BAND_ORDER.indexOf(level));

export function recentHeadlines(world, trackId, weeks = CRISIS_TALK.headlineWeeks) {
  return (world?.headlines ?? []).filter((h) => h.track === trackId && world.week - h.week <= weeks);
}
export function recentSchemes(world, trackId, weeks = CRISIS_TALK.schemeWeeks) {
  return (world?.schemes ?? []).filter((s) => s.track === trackId && world.week - s.week < weeks);
}

/** How suspicious this guest is of your timing, 0..1. */
export function suspicionOf(guest, world, cfg = CRISIS_TALK) {
  const fear = guest?.fears?.[0];
  if (!fear || !world) return 0;
  const S = cfg.suspicion;
  const hot = bandRank(levelOf(world, fear)) >= 2;
  let s = 0;
  for (const r of recentSchemes(world, fear, cfg.schemeWeeks)) s += S.perScheme * (1 - (world.week - r.week) / cfg.schemeWeeks);
  if (hot) s *= S.hotMult;
  const breach = recentHeadlines(world, fear, 2).find((h) => h.type === 'breach' || h.type === 'collapse');
  if (breach && recentSchemes(world, fear, cfg.schemeWeeks).some((r) => Math.abs(r.week - breach.week) <= 2)) s += S.breachSoon;
  for (const t of guest.traits ?? []) s *= S.traitMult[t] ?? 1;
  return Math.round(clamp(s) * 100) / 100;
}

/**
 * What the state of the world does to a pitch to this guest.
 * -> { track, level, pressure, trustBonus, interestBonus, suspicion, trustPenalty, slipBonus, lines }
 */
export function crisisPitch(guest, world, cfg = CRISIS_TALK) {
  const track = guest?.fears?.[0] ?? null;
  const level = track ? levelOf(world, track) : 'calm';
  const pressure = cfg.pressure[level] ?? 0;
  const suspicion = suspicionOf(guest, world, cfg);
  const out = {
    track, level, pressure, suspicion,
    trustBonus: Math.round(cfg.trustPerPressure * pressure),
    interestBonus: Math.round(cfg.interestPerPressure * pressure),
    trustPenalty: Math.round(cfg.suspicion.trustCost * suspicion),
    slipBonus: Math.round(cfg.suspicion.slipChance * suspicion * 100) / 100,
    lines: [],
  };
  const who = guest?.name ?? 'The guest';
  if (pressure >= 0.7) out.lines.push(`${nameOf(track)} is ${LEVEL_WORDS[level]}: ${who} came ready to buy.`);
  if (suspicion >= cfg.suspicious) out.lines.push(`${who} noticed how well-timed your pitch was, right after ${nameOf(track)} got worse.`);
  else if (suspicion > 0) out.lines.push(`${who} half-remembers reading about a leak. The timing nags at them.`);
  return out;
}

/** Does a condition hold for this guest in this world? (No condition: always.) */
export function conditionHolds(when, guest, world, cfg = CRISIS_TALK) {
  if (!when) return true;
  const w = world ?? QUIET_WORLD;
  const track = when.track ?? guest?.fears?.[0];
  const level = levelOf(w, track);
  if (when.band && bandRank(level) < BAND_ORDER.indexOf(when.band)) return false;
  if (when.bandBelow && bandRank(level) >= BAND_ORDER.indexOf(when.bandBelow)) return false;
  if (when.breach && !(level === 'breach' || level === 'collapsed')) return false;
  if (when.anyBreach && !Object.values(w.tracks).some((t) => t.state === 'breach')) return false;
  if (when.headline && !recentHeadlines(w, track, cfg.headlineWeeks).length) return false;
  if (when.schemed && !recentSchemes(w, track, cfg.schemeWeeks).length) return false;
  if (when.suspicious != null && (suspicionOf(guest, w, cfg) >= cfg.suspicious) !== when.suspicious) return false;
  return true;
}

export const CONDITION_KEYS = Object.freeze(['band', 'bandBelow', 'breach', 'anyBreach', 'headline', 'schemed', 'suspicious', 'track']);
export const BANDS_FOR_CONDITIONS = BAND_ORDER;

/** Words for the placeholders. */
export function worldWords(guest, world) {
  const track = guest?.fears?.[0];
  const h = recentHeadlines(world ?? QUIET_WORLD, track, 99)[0];
  return { level: LEVEL_WORDS[levelOf(world, track)] ?? 'quiet', headline: h ? `"${h.text}"` : 'the usual doom on the news' };
}
