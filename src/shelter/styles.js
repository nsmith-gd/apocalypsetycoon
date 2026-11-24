// Design layer: room styles and the style multiplier in Satisfaction.
// GDD: Shelter canvas > The design layer; Clients > Two scores, one shelter; Wealth classes.
//
//   Satisfaction = s x sum_k ( w_k x met_k )        (w in %, so the result is 0-100, capped at 100)
//     w_k   = the client's willingness-to-pay weight for needs tier k (by wealth class, GDD table)
//     met_k = share of tier k's needs the shelter meets (0..1)
//     s     = style multiplier: 1.25 match, 1.0 neutral, 0.8 clash (GDD), averaged over the rooms
//             the client actually looks at (Comfort, Status, Delusion; Survive only for Paranoid or
//             Engineer clients, or with an Inspector).
//
// Every placed room carries a `style`. Cell-grid rooms store it on the cell; tile-built bunker rooms
// take the majority style of their furniture (each object has `style`), which BunkerSite saves as-is.
//
// L0 greybox: all six styles are defined, but only Brutalist and Gilded are offered in the
// palette (PLACEHOLDER_STYLES) until the other four get art.

export const STYLES = Object.freeze({
  brutalist: { name: 'Brutalist', look: 'Raw concrete, stencils, sodium light', lovedBy: 'Paranoid and control-freak clients' },
  gilded: { name: 'Gilded', look: 'Marble, gold leaf, velvet', lovedBy: 'Dynasties and collectors' },
  biophilic: { name: 'Biophilic', look: 'Living walls, timber, water features', lovedBy: 'Pet parents and doomer romantics' },
  tech_minimal: { name: 'Tech-Minimal', look: 'White panels, hidden screens, LED strips', lovedBy: 'Disruptors' },
  retro_atomic: { name: 'Retro-Atomic', look: '1960s civil-defence pastels and chrome', lovedBy: 'Gourmands and nervous millionaires' },
  kitsch: { name: 'Maximalist Kitsch', look: 'Neon, leopard print, mirrored ceilings', lovedBy: 'Influencers and moguls' },
});

/** Styles the player can pick at L0 (the two with placeholder art). */
export const PLACEHOLDER_STYLES = Object.freeze(['brutalist', 'gilded']);

/** The style a fresh room gets until the player re-skins it. */
export const DEFAULT_STYLE = 'brutalist';

// Clashes (provisional: the GDD gives the multiplier but not the pairs). Opposite looks clash;
// anything else that isn't a match is neutral.
export const CLASHES = Object.freeze([
  ['brutalist', 'gilded'],
  ['biophilic', 'tech_minimal'],
  ['retro_atomic', 'kitsch'],
]);

export const STYLE_MULTIPLIER = Object.freeze({ match: 1.25, neutral: 1.0, clash: 0.8 });

/** Willingness-to-pay weights by wealth class (GDD: Survive / Comfort / Status / Delusion). */
export const WTP_WEIGHTS = Object.freeze({
  C1: { survive: 25, comfort: 40, status: 30, delusion: 5 },
  C2: { survive: 10, comfort: 25, status: 40, delusion: 25 },
  C3: { survive: 5, comfort: 20, status: 40, delusion: 35 },
  C4: { survive: 5, comfort: 10, status: 30, delusion: 55 },
  C5: { survive: 5, comfort: 10, status: 25, delusion: 60 },
});

export const TIERS = Object.freeze(['survive', 'comfort', 'status', 'delusion']);

/** Needs tier of each cell-grid room (ROOM_CATALOG ids). Bunker rooms carry their own `type.tier`. */
export const ROOM_TIERS = Object.freeze({
  bunk: 'survive', air_vent: 'survive', water_tank: 'survive', pantry: 'survive',
  hydroponics: 'survive', water_recycler: 'survive', mil_scrubber: 'survive',
  gold_taps: 'status', wine_cellar: 'status',
  cryo_pod: 'delusion', ai_butler: 'delusion',
});

// met_k placeholder until the per-tier needs lists land with the needs-ladder work: a tier is fully
// met with this many rooms of that tier (Survive needs are graded properly by Midnight elsewhere).
export const TIER_TARGETS = Object.freeze({ survive: 4, comfort: 2, status: 2, delusion: 1 });

/** 'match' | 'clash' | 'neutral' for a room style against the client's preferred style(s). */
export function styleRelation(roomStyle, clientStyle) {
  const prefs = [].concat(clientStyle ?? []).filter(Boolean);
  if (!roomStyle || !prefs.length) return 'neutral';
  if (prefs.includes(roomStyle)) return 'match';
  // Twins who want two styles: a clash with either preference still clashes.
  if (prefs.some((p) => CLASHES.some(([a, b]) => (a === p && b === roomStyle) || (b === p && a === roomStyle)))) return 'clash';
  return 'neutral';
}

export function styleMultiplier(roomStyle, clientStyle) {
  return STYLE_MULTIPLIER[styleRelation(roomStyle, clientStyle)];
}

/** A room's style: its own field, else the majority style of its furniture (bunker rooms). */
export function roomStyle(room) {
  if (room?.style) return room.style;
  const counts = {};
  for (const o of room?.objects ?? []) if (o.style) counts[o.style] = (counts[o.style] ?? 0) + 1;
  let best = null;
  for (const [k, n] of Object.entries(counts)) if (!best || n > counts[best]) best = k;
  return best ?? null;
}

export function roomTier(room) {
  return room?.tier ?? room?.type?.tier ?? ROOM_TIERS[room?.id] ?? 'survive';
}

/** Does this client look at rooms of this tier? (GDD: Does the client look?) */
export function clientLooksAt(tier, client = {}) {
  if (tier !== 'survive') return true;
  const traits = client.traits ?? [];
  return traits.includes('Paranoid') || traits.includes('Engineer') || !!client.inspector;
}

/** met_k per tier from a room list (placeholder targets; pass `met` to satisfaction() to override). */
export function tierMet(rooms) {
  const n = { survive: 0, comfort: 0, status: 0, delusion: 0 };
  for (const r of rooms) n[roomTier(r)] = (n[roomTier(r)] ?? 0) + 1;
  return Object.fromEntries(TIERS.map((k) => [k, Math.min(1, n[k] / TIER_TARGETS[k])]));
}

/**
 * Satisfaction 0-100 for a client and a list of rooms.
 * client: { wealthClass: 'C1'..'C5', style: 'gilded' | ['tech_minimal','gilded'], traits: [...] }
 * rooms:  [{ id | tier | type.tier, style | objects[].style }]
 * Returns { score, base, s, met, weights, rooms: [{ room, style, relation, multiplier, seen }] }.
 */
export function satisfaction(client, rooms, { met = null } = {}) {
  const weights = WTP_WEIGHTS[client?.wealthClass] ?? WTP_WEIGHTS.C1;
  const m = met ?? tierMet(rooms);
  const base = TIERS.reduce((sum, k) => sum + weights[k] * (m[k] ?? 0), 0);
  const detail = rooms.map((r) => {
    const style = roomStyle(r);
    const relation = styleRelation(style, client?.style);
    return { room: r, style, relation, multiplier: STYLE_MULTIPLIER[relation], seen: clientLooksAt(roomTier(r), client) };
  });
  const seen = detail.filter((d) => d.seen);
  const s = seen.length ? seen.reduce((a, d) => a + d.multiplier, 0) / seen.length : 1;
  const raw = base * s;
  return { score: Math.round(Math.min(100, raw) * 10) / 10, raw: Math.round(raw * 10) / 10, base: Math.round(base * 10) / 10, s: Math.round(s * 1000) / 1000, met: m, weights, rooms: detail };
}

/** Prestige scaled by the client's taste: each room's prestige x its style multiplier. */
export function styledPrestige(client, rooms, prestigeOf = (r) => r.prestige ?? 0) {
  return Math.round(rooms.reduce((sum, r) => sum + prestigeOf(r) * styleMultiplier(roomStyle(r), client?.style), 0) * 10) / 10;
}

/** Re-skin a bunker room: sets the style on every object in it and refreshes the site. */
export function setRoomStyle(site, room, style) {
  if (!STYLES[style]) return false;
  for (const o of room.objects ?? []) {
    const live = site.objects?.get?.(o.id) ?? o;
    live.style = style;
    o.style = style;
  }
  site._changed?.({ type: 'style', room: room.id, style });
  return true;
}

/** Next placeholder style in the cycle (for a one-click toggle). */
export function nextStyle(style, list = PLACEHOLDER_STYLES) {
  const i = list.indexOf(style);
  return list[(i + 1) % list.length];
}
