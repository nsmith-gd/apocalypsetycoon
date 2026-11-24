// Difficulty settings (#92; GDD: Pushback systems > Difficulty).
//
// | Setting          | Tipping-point range | Brink drift / week | Heat decay / week | Quota growth / quarter |
// | Investor         | 86-94               | +1.0               | 2                 | 20%                    |
// | Founder (default)| 82-94               | +1.5               | 1                 | 30%                    |
// | Hostile Takeover | 78-92               | +2.0               | 0.5               | 35%                    |
//
// `difficultySettings(id)` turns a row into the config each system takes:
//   crisis   -> CrisisSystem({ config })   tipBase / tipOffset (the hidden roll's range) and brinkDrift
//   pushback -> Pushback({ config })       heat decays weekly (weekTick) instead of once a quarter
//   board    -> Board({ config })          quotaGrowth

export const DIFFICULTIES = Object.freeze({
  investor: { id: 'investor', label: 'Investor', tipRange: [86, 94], brinkDrift: 1.0, heatDecayPerWeek: 2, quotaGrowth: 0.2, for: 'Players here for the satire' },
  founder: { id: 'founder', label: 'Founder', tipRange: [82, 94], brinkDrift: 1.5, heatDecayPerWeek: 1, quotaGrowth: 0.3, for: 'The intended balance' },
  hostile: { id: 'hostile', label: 'Hostile Takeover', tipRange: [78, 92], brinkDrift: 2.0, heatDecayPerWeek: 0.5, quotaGrowth: 0.35, for: 'Brink riders' },
});
export const DIFFICULTY_ORDER = Object.freeze(['investor', 'founder', 'hostile']);
export const DEFAULT_DIFFICULTY = 'founder';
const TIP_BASE = 90;

export function difficultySettings(id = DEFAULT_DIFFICULTY) {
  const d = DIFFICULTIES[id] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
  const [lo, hi] = d.tipRange;
  return {
    ...d,
    crisis: { tipBase: TIP_BASE, tipOffset: [lo - TIP_BASE, hi - TIP_BASE], brinkDrift: d.brinkDrift },
    pushback: { heat: { decayPerWeek: d.heatDecayPerWeek, decayPerQuarter: 0 } },
    board: { quotaGrowth: d.quotaGrowth },
  };
}
