// Midnight: the final apocalypse (pillar 3: "Clients pay for gold taps and cryo pods.
// Midnight grades air, water and food.").
//
// At the end of quarter 12 every shelter you sold, plus the ones you built and kept, is graded on
// AIR, WATER and FOOD supply against the people inside. Luxury (prestige) sold the shelter but is
// worth nothing at Midnight. How Midnight arrives depends on how well you kept the world in hand:
//
//   ENGINEERED        you pull the trigger on your own schedule: needs are normal.
//   FAILED TO CONTAIN runaway crises got there first: the surface is chaos and every shelter needs
//                     30% more of everything to make it through.
//
// Pure rules, no DOM. Feed it plain shelter records:
//   { id, name, owner, occupants, rooms: ['air_vent', 'gold_taps', ...], sold: true|false }
// and the world state (from Pushback: tension, heat, runaways).
//
//   const result = computeMidnight({ shelters, world: { tension, heat, runaways }, cash });
//   result.ending  -> { id, title, line }

/** What each room contributes at Midnight. Supplies are in "occupants kept alive". */
export const ROOM_STATS = Object.freeze({
  bunk: { air: 0, water: 0, food: 0, prestige: 0 },
  air_vent: { air: 4, water: 0, food: 0, prestige: 0 },
  water_tank: { air: 0, water: 4, food: 0, prestige: 0 },
  pantry: { air: 0, water: 0, food: 4, prestige: 0 },
  hydroponics: { air: 1, water: 0, food: 10, prestige: 1 },
  water_recycler: { air: 0, water: 10, food: 0, prestige: 0 },
  mil_scrubber: { air: 12, water: 0, food: 0, prestige: 0 },
  cryo_pod: { air: 0, water: 0, food: 3, prestige: 3 }, // sleepers barely eat; clients adore it
  gold_taps: { air: 0, water: -1, food: 0, prestige: 2 }, // they leak
  wine_cellar: { air: 0, water: 0, food: 0, prestige: 3 }, // Midnight does not care
  ai_butler: { air: 0, water: 0, food: 0, prestige: 4, efficiency: 0.15 }, // +15% to every supply
});

/** A shelter with this much prestige counts as a luxury build. */
export const LUXURY_PRESTIGE = 3;

export const STATS = Object.freeze(['air', 'water', 'food']);

export const MIDNIGHT_CONFIG = Object.freeze({
  failedNeedMultiplier: 1.3,
  // Control: 100, minus 25 per runaway crisis, minus 3 per tension point above 90, minus heat / 5.
  runawayPenalty: 25,
  tensionLine: 90,
  tensionPenalty: 3,
  heatDivisor: 5,
  engineeredAt: 50, // control >= this means you engineered Midnight
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function grade(ratio) {
  if (ratio >= 1.25) return 'A';
  if (ratio >= 1) return 'B';
  if (ratio >= 0.75) return 'C';
  if (ratio >= 0.5) return 'D';
  return 'F';
}

/** Share of occupants who live: full supply keeps everyone; shortfalls bite hard. */
export function survivalFraction(minRatio) {
  if (minRatio >= 1) return 1;
  return clamp(minRatio, 0, 1) ** 2;
}

/** Sum the supplies of one shelter. */
export function shelterSupply(shelter, roomStats = ROOM_STATS) {
  const s = { air: 0, water: 0, food: 0, prestige: 0 };
  let eff = 0;
  for (const id of shelter.rooms ?? []) {
    const r = roomStats[id];
    if (!r) continue;
    for (const k of STATS) s[k] += r[k] ?? 0;
    s.prestige += r.prestige ?? 0;
    eff += r.efficiency ?? 0;
  }
  for (const k of STATS) s[k] = Math.max(0, s[k] * (1 + eff));
  return s;
}

/** How well the player kept the world in hand going into Midnight (0-100). */
export function controlScore({ tension = 0, heat = 0, runaways = 0 } = {}, cfg = MIDNIGHT_CONFIG) {
  return Math.round(
    clamp(
      100 - runaways * cfg.runawayPenalty - Math.max(0, tension - cfg.tensionLine) * cfg.tensionPenalty - heat / cfg.heatDivisor,
      0,
      100,
    ),
  );
}

export function gradeShelter(shelter, { needMultiplier = 1, roomStats = ROOM_STATS } = {}) {
  const occupants = Math.max(0, shelter.occupants ?? 0);
  const supply = shelterSupply(shelter, roomStats);
  const need = occupants * needMultiplier;
  const ratios = {};
  const grades = {};
  for (const k of STATS) {
    ratios[k] = need > 0 ? supply[k] / need : 1;
    grades[k] = grade(ratios[k]);
  }
  const minRatio = Math.min(...STATS.map((k) => ratios[k]));
  const weakest = STATS.reduce((a, k) => (ratios[k] < ratios[a] ? k : a), 'air');
  const survivors = Math.round(occupants * survivalFraction(minRatio));
  let outcome;
  if (survivors === occupants) outcome = 'survived';
  else if (survivors === 0) outcome = 'lost';
  else outcome = 'rationing';
  return {
    id: shelter.id,
    name: shelter.name,
    owner: shelter.owner,
    sold: !!shelter.sold,
    occupants,
    supply,
    ratios,
    grades,
    weakest,
    survivors,
    outcome,
    prestige: supply.prestige,
  };
}

const ENDINGS = {
  engineered: [
    { min: 0.85, id: 'architect', title: 'ARCHITECT OF THE END', line: 'You set the date, you sold the seats, and nearly everyone you sold to lived. The new world opens an account with you.' },
    { min: 0.5, id: 'managed', title: 'MANAGED DECLINE', line: 'The apocalypse went to plan. The shelters mostly did not. Survivors are already drafting the lawsuits.' },
    { min: 0, id: 'gilded', title: 'GILDED TOMBS', line: 'You engineered the end of the world flawlessly. Then your clients choked in rooms full of gold taps.' },
  ],
  failed: [
    { min: 0.85, id: 'ark', title: 'THE ARK HELD', line: 'The world slipped out of your hands, but the shelters were built for worse. Pure luck, dressed up as genius.' },
    { min: 0.5, id: 'ashes', title: 'ASHES AND RECEIPTS', line: 'Midnight came early and angry. Half your clients made it. The other half’s estates are still invoicing you.' },
    { min: 0, id: 'nobody', title: 'NOBODY LEFT TO BILL', line: 'You lost control of the end of the world, and the bunkers failed with it. Last Resort Holdings had no last resort.' },
  ],
};

/**
 * Grade every shelter and decide the ending.
 * @param shelters  sold and kept shelters (see header)
 * @param world     { tension, heat, runaways } at Midnight (Pushback has all three)
 * @param cash      final cash, shown in the breakdown
 */
export function computeMidnight({ shelters = [], world = {}, cash = 0, cfg = MIDNIGHT_CONFIG, roomStats = ROOM_STATS } = {}) {
  const control = controlScore(world, cfg);
  const type = control >= cfg.engineeredAt ? 'engineered' : 'failed';
  const needMultiplier = type === 'failed' ? cfg.failedNeedMultiplier : 1;
  const graded = shelters.map((s) => gradeShelter(s, { needMultiplier, roomStats }));

  const totals = { occupants: 0, survivors: 0, prestige: 0, supply: { air: 0, water: 0, food: 0 }, need: 0 };
  for (const g of graded) {
    totals.occupants += g.occupants;
    totals.survivors += g.survivors;
    totals.prestige += g.prestige;
    for (const k of STATS) totals.supply[k] += g.supply[k];
  }
  totals.need = totals.occupants * needMultiplier;
  const overall = {};
  for (const k of STATS) {
    const ratio = totals.need > 0 ? totals.supply[k] / totals.need : 0;
    // A stat's overall grade is the people-weighted average of each shelter's own supply ratio
    // (capped at 1.5), so one huge surplus bunker can't hide a dozen failing ones.
    const weighted = totals.occupants > 0
      ? graded.reduce((sum, g) => sum + Math.min(1.5, g.ratios[k]) * g.occupants, 0) / totals.occupants
      : 0;
    const passing = graded.filter((g) => g.ratios[k] >= 1).length;
    overall[k] = { ratio, weighted, passing, of: graded.length, grade: graded.length ? grade(weighted) : 'F' };
  }
  const survivalRate = totals.occupants > 0 ? totals.survivors / totals.occupants : 0;
  const ending = ENDINGS[type].find((e) => survivalRate >= e.min);
  const outcomes = {
    survived: graded.filter((g) => g.outcome === 'survived').length,
    rationing: graded.filter((g) => g.outcome === 'rationing').length,
    lost: graded.filter((g) => g.outcome === 'lost').length,
  };
  // The pillar-3 punchline: luxury that sold the shelters but did nothing at Midnight.
  const wasted = graded.filter((g) => g.outcome !== 'survived' && g.prestige >= LUXURY_PRESTIGE).length;
  return {
    type,
    control,
    needMultiplier,
    world: { tension: world.tension ?? 0, heat: world.heat ?? 0, runaways: world.runaways ?? 0 },
    shelters: graded,
    totals,
    overall,
    survivalRate,
    outcomes,
    wasted,
    cash,
    ending: { ...ending, type },
  };
}
