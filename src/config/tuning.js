// THE tuning table (#77; GDD: Economy and tuning > Tuning constants). Every number a system tunes from
// lives here, so one edit changes the game everywhere.
//
// TUNING holds every row of the GDD constants table (GDD_CONSTANTS maps each row to its key). The
// per-system defaults below (DEMAND, BREACH, PUSHBACK_DEFAULTS, LIFE, DOOM_CLOCK, MOMENTUM, PRESS_REPUTATION)
// used to be scattered through the systems; they now live here too. Their GDD-backed fields are live
// getters into TUNING (change TUNING.fear.decayPerWeek and demand changes); the rest are this game's
// own stand-ins, marked (stand-in), until the GDD gives a number.
//
// Systems import from here and keep their old export names, so nothing else had to change.

export const TUNING = {
  momentum: { carry: 0.75, release: 0.25 },
  fear: { perTension: 2, perBreachWeek: 10, decayPerWeek: 0.15 },
  tippingPoint: { base: 90, offset: [-8, 4] },
  tipBandShown: [10, 5, 3, 1],
  scarPerContainedBreach: 3,
  containmentWindowWeeks: [6, 4, 3],
  breachSpillover: { strong: 6, medium: 3, weak: 1.5 }, // momentum per week
  collapseShove: { strong: 15, medium: 8, weak: 4 }, // tension
  doomClock: { startMinutes: 15, tensionDivisor: 40 },
  heatDecay: { perWeek: 1, perCommunicationsLevel: 1, notorietyFloorByTier: [0, 5, 10, 20, 30] },
  // GDD Pushback systems > Heat: the five heat levels and their effects (#148).
  heatBands: [
    { id: 'unnoticed', name: 'Unnoticed', from: 0 },
    { id: 'whispers', name: 'Whispers', from: 30, schemeCost: 0.10, story: true },
    { id: 'investigation', name: 'Investigation', from: 55, auditsPerQuarter: 1, auditWeeks: 1, sabotageLocked: true, leverageGrowth: 1.5 },
    { id: 'hearings', name: 'Hearings', from: 75, hearingsPerQuarter: 1, hearing: { reputation: -10, boardConfidence: -10 }, newLeads: -0.25 },
    { id: 'exposed', name: 'Exposed', from: 95, indictmentWeeks: 4 },
  ],
  whistleblowerChance: 0.25, // per quarter when eligible
  condoGossip: 0.1, // per week toward the highest resident
  retainer: 0.04, // of build price per quarter
  changeOrderMarkup: 0.15,
  brinkCosts: { heatPerWeekPerTrack: 1, volatility: 3, volatilityLastResort: 6 },
  repeatCalming: { penalty: 0.25, windowWeeks: 8 },
  fragility: { perFloorMinute: 1, tippingFloor: 72 },
  shelterInPlaceTest: { pass: { reputation: 2 }, fail: { reputation: -5, leverage: 15 } },
  leads: { perWeekWithSite: 0.5, fearDivisor: 50, waitWeeks: 4 },
  reputation: { min: 0, max: 100, start: 40 },
  siegeStrength: { tensionDivisor: 20, perVisibleFeature: 1 },
  loyalty: { raise: 5, brokenPromise: -10 },
};

/** Every row of the GDD "Tuning constants" table, in order, with where its value lives in TUNING. */
export const GDD_CONSTANTS = Object.freeze([
  { row: 'Momentum carried into the next week', key: 'momentum', gdd: '75%, with a quarter released as tension each week', section: 'Pushback systems' },
  { row: 'Fear', key: 'fear', gdd: '+2 per point of tension gained, +10 per breach week, −15% per week', section: 'Core loop' },
  { row: 'Tipping point', key: 'tippingPoint', gdd: '90 plus an offset from −8 to +4', section: 'Crises and tipping points' },
  { row: 'Tipping-point band shown', key: 'tipBandShown', gdd: '±10, then ±5, ±3, ±1 with intel', section: 'Crises and tipping points' },
  { row: 'Scar per contained breach', key: 'scarPerContainedBreach', gdd: 'Tipping point −3', section: 'Crises and tipping points' },
  { row: 'Containment window', key: 'containmentWindowWeeks', gdd: '6, then 4, then 3 weeks', section: 'Crises and tipping points' },
  { row: 'Breach spillover, strong / medium / weak', key: 'breachSpillover', gdd: '+6 / +3 / +1.5 momentum per week', section: 'Crises and tipping points' },
  { row: 'Collapse shove, strong / medium / weak', key: 'collapseShove', gdd: '+15 / +8 / +4 tension', section: 'Crises and tipping points' },
  { row: 'Doom Clock', key: 'doomClock', gdd: '15 minutes, tension sum divided by 40', section: 'Crises and tipping points' },
  { row: 'Heat decay', key: 'heatDecay', gdd: '1 per week plus 1 per Communications level, floored at Notoriety (0 to 30 by company tier)', section: 'Pushback systems' },
  { row: 'Whistleblower chance', key: 'whistleblowerChance', gdd: '25% per quarter when eligible', section: 'Company and board' },
  { row: 'Condo gossip', key: 'condoGossip', gdd: '10% per week toward the highest resident', section: 'Pushback systems' },
  { row: 'Retainer', key: 'retainer', gdd: '4% of build price per quarter', section: 'Clients and needs ladder' },
  { row: 'Change-order markup', key: 'changeOrderMarkup', gdd: '15%', section: 'Clients and needs ladder' },
  { row: 'Brink costs', key: 'brinkCosts', gdd: '+1 heat per week per Brink track; volatility up to ±3, rising to ±6 at The Last Resort', section: 'Core loop' },
  { row: 'Repeat calming', key: 'repeatCalming', gdd: '−25% effect per use on the same track within 8 weeks', section: 'Core loop' },
  { row: 'Fragility', key: 'fragility', gdd: 'Every tipping point −1 per floor minute; never below 72', section: 'Crises and tipping points' },
  { row: 'Shelter-in-place test', key: 'shelterInPlaceTest', gdd: 'Pass: reputation +2. Fail: reputation −5, client leverage +15', section: 'Crises and tipping points' },
  { row: 'Leads', key: 'leads', gdd: '0.5 a week where you own a site, plus Fear × exposure ÷ 50; unworked leads wait 4 weeks', section: 'World canvas' },
  { row: 'Reputation', key: 'reputation', gdd: '0–100, starting at 40', section: 'Pushback systems' },
  { row: 'Siege strength', key: 'siegeStrength', gdd: 'Pitchforks tension ÷ 20, +1 per visible surface feature', section: 'Pushback systems' },
  { row: 'Loyalty drivers', key: 'loyalty', gdd: 'Set per head; raises +5, broken promises −10', section: 'Company and board' },
]);

const T = TUNING;

// ---------------- Money (#91): the GDD $M scale ----------------
// Every price in the game is in GDD dollars. The GDD-backed rows (Economy and tuning > The quota, Contract pricing,
// Build and running costs; Shelter canvas > Product lines, Strata) are set here; systems read them from MONEY.
// Systems whose stand-in prices were tuned in the old $K economy convert through the `fromStandIn` factors below,
// each one the ratio that puts that system's numbers on the GDD scale (checked against a GDD price it names).
export const MONEY = Object.freeze({
  startingCash: 5_000_000, // (stand-in) the GDD names no opening treasury: enough for a first Solo Pod and a quarter of crews
  crewPerWeek: 100_000, // GDD: $0.1M per crew per week
  staffPerWeek: 50_000, // GDD: $0.05M per person per week
  quotaQ1: 6_000_000, // GDD: Q = 6 x 1.3^(n-1) $M
  quotaGrowth: 0.3,
  departmentLevelsM: [2, 4, 8, 16], // GDD: levels 2 / 3 / 4 / 5
  siteCost: { low: 2_000_000, medium: 5_000_000, high: 12_000_000, veryHigh: 25_000_000 },
  contractMargin: 0.4, // GDD: base = dig + room cost, plus a 40% margin
  classMultiplier: { C1: 1, C2: 1.1, C3: 1.2, C4: 1.35, C5: 1.5 },
  soloPodPrice: [3_000_000, 5_000_000], // GDD Product lines: what a Solo Pod typically sells for (a check, not a rule)
  fromStandIn: Object.freeze({
    bunker: 10, // the tile grid's old PRICE_SCALE was 0.1 (GDD x 0.1)
    research: 10, // the research tree's cash followed the bunker catalog (GDD x 0.1)
    rooms: 40, // the client-package room list: $12K-$200K -> $0.48M-$8M, inside the GDD tier ranges
    schemes: 33, // the six map schemes: Fund doom podcast $15K -> $0.5M (the GDD's Leak)
    pushback: 25, // investigation, raid, fines and relief: Lay low $40K -> $1M (Everything Is Fine)
    clients: 40, // client fees and wants follow the room list
    venues: 10, // social venues follow the bunker economy ($15K fair -> $150K)
  }),
});

// ---------------- Demand (src/demand/demand.js) ----------------
export const DEMAND = {
  get fearPerTension() { return T.fear.perTension; },
  get fearBreachWeek() { return T.fear.perBreachWeek; },
  get fearDecay() { return T.fear.decayPerWeek; },
  get baseLeadsWithSite() { return T.leads.perWeekWithSite; },
  get fearDivisor() { return T.leads.fearDivisor; },
  get rivalAfterWeeks() { return T.leads.waitWeeks; },
  reputationForUpgrade: 40, // (stand-in) GDD says "every 20 points above 40" moves a lead up a class
  showroomPrestigeForUpgrade: 1, // (stand-in) site prestige needed (a Showroom gives 1+)
  maxPanicPremium: 0.5, // (stand-in) a track at 100 tension adds up to +50% in a high-exposure region
};

// ---------------- Breach and containment (src/crisis/breach.js) ----------------
export const BREACH = {
  get tipBase() { return T.tippingPoint.base; },
  get tipOffset() { return T.tippingPoint.offset; },
  get tipMin() { return T.fragility.tippingFloor; },
  get scar() { return T.scarPerContainedBreach; },
  get windowWeeks() { return T.containmentWindowWeeks; },
  get shove() { return T.collapseShove; },
  shelterTest: {
    get pass() { return T.shelterInPlaceTest.pass; },
    get fail() { return T.shelterInPlaceTest.fail; },
    badlyBelow: 0.5, // (stand-in)
    constructionDelayDays: 7, // (stand-in)
  },
  perBreachWeek: { heat: 2, boardConfidence: -2, panicMultiplier: 2 }, // (stand-in)
  controlledBurnHeat: 10, // heat for deliberately tipping a track (#93; stand-in: the GDD only says "heat")
  recovery: { tension: 60, lockWeeks: 3 }, // (stand-in)
  collapseTension: 100,
  brinkMargin: 10, // (stand-in)
  // The five containment sources (GDD: Crises and tipping points > Breach and containment).
  sources: {
    // +40 when the op completes, 2 weeks after launch; $10M x the breach count; one per track at a time.
    op: { label: 'Containment op', points: 40, weeks: 2, costPerBreach: 10_000_000, uses: Infinity },
    // +15 every breach week while it runs, 40 RP a week; needs R&D level 2; pauses normal research.
    research: { label: 'Crash research program', points: 15, perWeek: true, rpPerWeek: 40, requiresRD: 2, uses: 1, blocksResearch: true },
    // Half the calming scheme's momentum (Everything Is Fine: momentum 8 -> +4), at the scheme's own cost and heat.
    calming: { label: 'Calming scheme', momentumShare: 0.5, scheme: 'everythingfine', uses: 3 },
    // +25 once per breach; needs reputation 50 or more; heat -5.
    government: { label: 'Government partnership', points: 25, uses: 1, minReputation: 50, heat: -5 },
    // +20 once per executive per campaign (Ruth, June or Theo; Theo's dirty fix also costs heat +10).
    heroics: { label: 'Executive heroics', points: 20, perExecutive: true, uses: Infinity, boardConfidence: -5 },
  },
};

// ---------------- Doom Clock (src/doomclock/doomclock.js) ----------------
export const DOOM_CLOCK = {
  get startMinutes() { return T.doomClock.startMinutes; },
  get tensionDivisor() { return T.doomClock.tensionDivisor; },
  floorDrops: { brink: 0.25, chapter: 0.5, breachContained: 1, collapse: 4 },
  get fragilityPerMinute() { return T.fragility.perFloorMinute; },
  get tippingFloor() { return T.fragility.tippingFloor; },
  collapsesForCountdown: 2,
  countdownWeeks: 4,
  brinkMargin: 10, // auto-detect: a track is at its Brink within 10 of its (fragile) tipping point
};

// ---------------- Momentum (src/world/momentum.js) ----------------
export const MOMENTUM = {
  get release() { return T.momentum.release; },
  get calmRepeatPenalty() { return T.repeatCalming.penalty; },
  get calmRepeatWindow() { return T.repeatCalming.windowWeeks; },
  defaultWeeks: 2, // (stand-in)
};

// ---------------- Press reputation (src/pushback/press.js) ----------------
export const PRESS_REPUTATION = {
  get start() { return T.reputation.start; },
  get min() { return T.reputation.min; },
  get max() { return T.reputation.max; },
};

// ---------------- Pushback (src/pushback/pushback.js) ----------------
// Quarter-based heat / tension / leverage / board model that predates the GDD's weekly rules.
// All stand-ins, tuned with the pacing harness (#12). Money x PB = the GDD $M scale (#91).
const PB = MONEY.fromStandIn.pushback;
export const PUSHBACK_DEFAULTS = {
  heat: {
    start: 5,
    decayPerQuarter: 8, // heat cools off on its own when you lay low
    decayPerWeek: 0, // the campaign uses weekly decay from the difficulty table instead (#92): weekTick()
    investigationAt: 55, // GDD Investigation band: crossing it mid-quarter opens an investigation (once per quarter)
    fineAt: Infinity, // (retired by #148: the GDD has no regulator fine; Hearings and Exposed are the high-heat costs)
    finePerPoint: 1_500 * PB, // fine = (heat - fineAt + 10) * finePerPoint
    raidAt: Infinity, // (retired by #148: at 95+ the GDD runs a 4-week indictment instead of a raid)
    raidFine: 150_000 * PB,
    raidHeatAfter: 55,
  },
  tension: {
    start: 20,
    decayPerQuarter: 3,
    momentumAt: 75, // above this, tension feeds itself every quarter
    momentumGain: 6,
    runawayAt: 100,
    runawayDamagePct: 0.15, // runaway costs 15% of cash (min floor below) in damages
    runawayDamageMin: 60_000 * PB,
    runawayDamageMax: 600_000 * PB, // cap: uncapped, a rich late game lost millions per runaway (pacing harness)
    runawayResetTo: 70,
  },
  leverage: {
    perSale: 10, // starting leverage of a new client
    heatFactor: 0.15, // leverage gained per quarter = heat * heatFactor
    demandAt: 30,
    blackmailAt: 55,
    maxEventsPerQuarter: 2,
  },
  board: {
    enabled: true, // the campaign turns this off and runs the GDD board (src/board/board.js) instead
    firstTarget: 50_000 * PB, // quarterly profit expected in Q1
    growth: 0.08, // each target is 8% above the previous one (pacing harness: 25% ousted every bot by Q7)
    ratchet: 0.25, // a beaten target also moves 25% of the way toward the profit that beat it
    strikesToOust: 3,
    missClawbackPct: 0.10, // executive clawback: 10% of cash (min floor)
    missClawbackMin: 25_000 * PB,
    missClawbackMax: 200_000 * PB, // cap: uncapped, one miss snowballed into three (pacing harness)
    freezeMultiplier: 1.25, // second strike: builds cost 25% more next quarter
    beatBonusPct: 0.05, // beating the target pays a bonus of 5% of profit
  },
  // Relief valves: paid ways to push back on the pushback. Each use in the same quarter costs
  // 50% more than the last ("nothing is free"), and each has a side effect.
  relief: {
    layLow: { cost: 40_000 * PB, heat: -15, label: 'Lay low', blurb: 'Lawyers, shredders, a quiet quarter. Heat -15.' },
    fundRelief: { cost: 50_000 * PB, tension: -14, heat: 3, label: 'Fund disaster relief', blurb: 'Calm the world a little. Tension -14, but the press asks where the money came from (heat +3).' },
    repeatMarkup: 0.5,
  },
};

// ---------------- Shelter life systems (src/shelter/life.js) ----------------
// Megaprojects (#143): Compound (4:20) and Ark (5:00). GDD: Shelter canvas > Product lines. Plot widths, site count,
// the Abyss depth and the Ark modules are GDD; the rest are this game's stand-ins until the GDD gives a number.
export const MEGAPROJECTS = {
  compound: {
    unlockAt: '4:20',
    sites: 3, // GDD: three linked bunkers
    siteWidth: 24, siteDepth: 40, // (stand-in) each site is a Family Vault-sized plot
    tunnels: [['A', 'B'], ['B', 'C']], // (stand-in) a chain; A-C can be added
    tunnelCostPerMetre: 30_000, // GDD dollars (stand-in)
    tunnelLength: 40, // metres between neighbouring sites (stand-in)
    waterTable: 12, // m: tunnels below it can flood (same water table as the bunker)
    floodChancePerWeek: 0.05, // per tunnel below the water table (stand-in)
    breachChancePerWeekAtSiege: 0.15, // per tunnel while The Pitchforks besiege a linked site (stand-in)
    pumpOutCost: 500_000, // GDD dollars (stand-in)
  },
  ark: {
    unlockAt: '5:00',
    width: 64, // GDD
    depth: 130, // m: down past 120 m, the Abyss
    abyssDepth: 120, // GDD: The Abyss is 120 m and below
    // GDD: Ark modules. Greybox definition (stand-in): a room of at least this width holding these pieces.
    modules: {
      governance_hall: { name: 'Governance Hall', minW: 8, needs: { dining_table: 1, dining_chair: 6 } },
      schoolhouse: { name: 'Schoolhouse', minW: 6, needs: { desk: 4, bookshelf: 1 } },
    },
    occupants: { min: 200, max: 500 }, // GDD
    price: { min: 500_000_000 }, // GDD: $500M+ from a consortium
    tableClass: 'C5', // The Table's leads
  },
};

export const LIFE = {
  noiseRadius: 6, // tiles
  noiseComfort: 1, // comfort lost per noisy room within range of quarters (once per pair)
  baseSeal: 1,
  baseSecurity: 1,
  visibilityPerSecurity: 2, // every 2 visibility costs 1 security
  moraleBase: 1,
  peoplePerComfort: 4, // morale = base + comfort per 4 occupants, minus crowding
  ratingMax: 5,
  missingPointPenalty: 0.25,
};
