// Client traits (#163; GDD Clients and needs ladder > Client traits). Data first, then small pure rules.
//
// Every client has 1-3 traits. Some are hidden until the consultation (the quote on the world map). Each trait has
// an effect on the contract or the shelter, and a pushback hook (heat, leverage, reputation, payment, morale).
//
//   const traits = rollTraits(rng)                   -> [{ id, hidden }]   (1-3, never two that cancel out)
//   contractDemands(traits)                          -> rooms the contract demands, with who asked
//   checkDemands(roomTypes, traits)                  -> { demands, met, missing }
//   tunedSealed(sealed, traits)                      -> the shelter's Days Sealed for THIS client (food, mouths, power)
//   salePriceFor(price, traits, { missing })         -> haggling and missing demands
//   onSaleHooks(traits)                              -> { leverage, heat, reputation, payWeeksLate, ... } at handover
//   quarterHooks(client, { nda, rng })               -> { heat, defaulted } every quarter while they hold a shelter
//   fearWeight(traits, track), referralMultiplier(traits), sharedSiloMorale(clients)

export const TRAITS = Object.freeze({
  paranoid: { name: 'Paranoid', effect: 'Inspects the Survive tier and demands more Days Sealed', hook: 'Signs off slowly', daysMult: 1.25, inspectsSurvive: true, payWeeksLate: 2 },
  engineer: { name: 'Engineer', effect: 'Inspects everything and tells peers about flaws', hook: 'Raises standards across their class', inspectsAll: true, flawReputation: -2 },
  germaphobe: { name: 'Germaphobe', effect: 'Needs Decon and a Med Bay; fears The Bloom twice as much', hook: 'Change orders mid-build', demands: ['decon_shower', 'med_bay'], fears: { bloom: 2 }, changeOrder: 0.15 },
  gourmand: { name: 'Gourmand', effect: 'Wants a Chef’s Kitchen and Wine Cellar; eats 1.5× the food', hook: 'Morale crash when luxuries run out under seal', demands: ['chefs_kitchen', 'wine_cellar'], foodMult: 1.5, sealedMoraleCrash: -1 },
  pet_parent: { name: 'Pet Parent', effect: 'Pet decor, later a Pet Clone Lab', hook: 'Animals count as extra mouths', demands: ['pet_clone_lab'], extraMouths: 2 },
  influencer: { name: 'Influencer', effect: 'Wants a Broadcast Studio; doubles referral leads', hook: 'Leaks: heat +3 a quarter unless under NDA', demands: ['broadcast_studio'], referralMult: 2, heatPerQuarter: 3 },
  collector: { name: 'Collector', effect: 'Wants an Art Vault and a Museum of Me', hook: 'Climate power around the clock', demands: ['art_vault', 'museum_of_me'], extraPowerKw: 3 },
  dynast: { name: 'Dynast', effect: 'Wants an Heir Nursery; +2 occupants per generation', hook: 'Long Days Sealed requirements', demands: ['heir_nursery'], extraOccupants: 2, daysMult: 1.2 },
  health_optimizer: { name: 'Health Optimizer', effect: 'Biohacking Lab, then Cryo Pods', hook: 'Always wants the newest unlock', demands: ['biohacking_lab', 'cryo_pod_bay'], wantsNewest: true },
  control_freak: { name: 'Control Freak', effect: 'Demands override codes to every system', hook: 'Leverage +10 at handover; a security risk', hidden: true, leverageAtHandover: 10, securityRisk: 1 },
  penny_pincher: { name: 'Penny-Pincher', effect: 'Haggles 15% off', hook: 'Pays late', priceMult: 0.85, payWeeksLate: 4 },
  secretly_broke: { name: 'Secretly Broke', effect: 'May default on retainers', hook: 'You hold leverage over them, for once', hidden: true, retainerDefault: 0.25, leverageOverThem: true },
  knows_too_much: { name: 'Knows Too Much', effect: 'Starts with 30 leverage over you', hook: 'Blackmail arrives early', hidden: true, startLeverage: 30 },
  feuding: { name: 'Feuding', effect: 'Hates one named client; morale −20 if they share a silo', hook: 'Condo drama, sabotage under seal', hidden: true, feudMorale: -20 },
  doomer_romantic: { name: 'Doomer Romantic', effect: 'Wants a Window Wall that shows a last sunset', hook: 'Small budget, big story beats', demands: ['window_wall'], priceMult: 0.8, storyBeats: true },
  philanthropist: { name: 'Philanthropist', effect: 'Funds a public shelter wing', hook: 'Reputation +5, heat −3', reputation: 5, heat: -3 },
});
export const TRAIT_IDS = Object.freeze(Object.keys(TRAITS));

// Pairs that contradict each other: a client never rolls both.
const CLASH = [['penny_pincher', 'philanthropist'], ['secretly_broke', 'philanthropist'], ['doomer_romantic', 'collector'], ['penny_pincher', 'doomer_romantic']];
const clashes = (a, b) => CLASH.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** 1-3 traits: [{ id, hidden }]. `rng` returns 0..1. Hidden traits show only after the consultation. */
export function rollTraits(rng = Math.random, { count = null } = {}) {
  const n = count ?? (rng() < 0.45 ? 1 : rng() < 0.75 ? 2 : 3);
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 50) {
    const id = TRAIT_IDS[Math.floor(rng() * TRAIT_IDS.length)];
    if (out.some((t) => t.id === id || clashes(t.id, id))) continue;
    out.push({ id, hidden: !!TRAITS[id].hidden });
  }
  return out;
}
const ids = (traits = []) => traits.map((t) => (typeof t === 'string' ? t : t.id)).filter((id) => TRAITS[id]);
const has = (traits, id) => ids(traits).includes(id);
const all = (traits) => ids(traits).map((id) => TRAITS[id]);

/** What the player can see: hidden traits stay '???' until the consultation reveals them. */
export function visibleTraits(traits = [], { consulted = false } = {}) {
  return traits.map((t) => (t.hidden && !consulted ? { id: null, name: '???' } : { id: t.id, name: TRAITS[t.id].name, effect: TRAITS[t.id].effect, hook: TRAITS[t.id].hook }));
}
/** The consultation: every trait is known from now on. */
export const consult = (traits = []) => traits.map((t) => ({ ...t, hidden: false }));

/** Rooms the contract demands, one entry per room, with the trait that asked for it. */
export function contractDemands(traits = []) {
  const out = [];
  for (const id of ids(traits)) for (const room of TRAITS[id].demands ?? []) if (!out.some((d) => d.room === room)) out.push({ room, by: id });
  return out;
}
/** Which demanded rooms the shelter has. roomTypes = catalog room ids of its rooms (bunker room identities). */
export function checkDemands(roomTypes = [], traits = []) {
  const demands = contractDemands(traits);
  const haveSet = new Set(roomTypes);
  const met = demands.filter((d) => haveSet.has(d.room));
  const missing = demands.filter((d) => !haveSet.has(d.room));
  return { demands, met, missing };
}

/** How much a client fears a track: Germaphobes fear The Bloom twice as much. */
export const fearWeight = (traits, track) => all(traits).reduce((m, t) => m * (t.fears?.[track] ?? 1), 1);
/** Influencers double the referral leads a happy client brings. */
export const referralMultiplier = (traits) => all(traits).reduce((m, t) => m * (t.referralMult ?? 1), 1);
/** Daily food use multiplier (Gourmand 1.5x). */
export const foodMultiplier = (traits) => all(traits).reduce((m, t) => m * (t.foodMult ?? 1), 1);
/** The Days Sealed this client asks for, over the shelter's base requirement (Paranoid x1.25, Dynast x1.2). */
export const daysRequirement = (baseDays, traits) => Math.round(all(traits).reduce((d, t) => d * (t.daysMult ?? 1), baseDays));
/** Extra people and animals inside: Dynast +2 occupants, Pet Parent +2 mouths. */
export const extraMouths = (traits) => all(traits).reduce((s, t) => s + (t.extraOccupants ?? 0) + (t.extraMouths ?? 0), 0);

/**
 * The shelter's Days Sealed for this client. `sealed` = the bunker's record ({ daysSealed, days, flows } from the
 * tile bunker). Food: everyone eats food x the trait multiplier, and extra mouths eat too. Power: climate control
 * draws around the clock. Without flows (older records) it scales the food days directly.
 */
export function tunedSealed(sealed, traits = [], { occupants = null } = {}) {
  if (!sealed) return sealed;
  const fm = foodMultiplier(traits), mouths = extraMouths(traits), kw = all(traits).reduce((s, t) => s + (t.extraPowerKw ?? 0), 0);
  if (fm === 1 && !mouths && !kw) return sealed;
  const days = { ...(sealed.days ?? {}) };
  const f = sealed.flows?.food;
  const people = occupants ?? sealed.occupants ?? 0;
  if (f) {
    const perHead = people > 0 ? f.need / people : 1;
    const need = (people + mouths) * perHead * fm;
    days.food = need <= f.production ? Infinity : f.stock / (need - f.production);
  } else if (days.food != null) {
    days.food = days.food / (fm * (people > 0 ? (people + mouths) / people : 1));
  } else days.food = sealed.daysSealed / fm;
  const p = sealed.flows?.power;
  if (kw && Number.isFinite(days.power)) days.power = days.power * ((p?.demand ?? 10) / ((p?.demand ?? 10) + kw)); // the same reserves, a bigger draw
  const vals = Object.values(days).filter((v) => typeof v === 'number');
  const daysSealed = vals.length ? Math.min(sealed.daysSealed, ...vals) : sealed.daysSealed;
  return { ...sealed, days, daysSealed: Math.round(daysSealed * 10) / 10, traitAdjusted: { foodMult: fm, extraMouths: mouths, extraPowerKw: kw, before: sealed.daysSealed } };
}

/** The sale price after haggling (Penny-Pincher -15%, Doomer Romantic's small budget) and missing demands (-10% each). */
export function salePriceFor(price, traits = [], { missing = 0 } = {}) {
  const mult = all(traits).reduce((m, t) => m * (t.priceMult ?? 1), 1) * Math.max(0.5, 1 - 0.1 * missing);
  return Math.round((price * mult) / 1000) * 1000;
}

/** Pushback at handover. */
export function onSaleHooks(traits = [], { grades = null } = {}) {
  const T = all(traits);
  const flaw = grades && Object.values(grades).some((g) => g === 'F' || g === 'D');
  return {
    leverage: T.reduce((s, t) => s + (t.startLeverage ?? 0) + (t.leverageAtHandover ?? 0), 0),
    heat: T.reduce((s, t) => s + (t.heat ?? 0), 0),
    reputation: T.reduce((s, t) => s + (t.reputation ?? 0), 0) + (flaw && has(traits, 'engineer') ? TRAITS.engineer.flawReputation : 0),
    payWeeksLate: Math.max(0, ...T.map((t) => t.payWeeksLate ?? 0)),
    securityRisk: T.reduce((s, t) => s + (t.securityRisk ?? 0), 0),
    leverageOverThem: T.some((t) => t.leverageOverThem),
    changeOrder: T.reduce((s, t) => s + (t.changeOrder ?? 0), 0), // the share of the price added by mid-build change orders
  };
}

/** Pushback every quarter: Influencer leaks (+3 heat unless under NDA); Secretly Broke may default on the retainer. */
export function quarterHooks(client = {}, { rng = Math.random } = {}) {
  const t = client.traits ?? [];
  const heat = has(t, 'influencer') && !client.nda ? TRAITS.influencer.heatPerQuarter : 0;
  const defaulted = has(t, 'secretly_broke') && rng() < TRAITS.secretly_broke.retainerDefault;
  return { heat, defaulted };
}

/** Morale under seal for clients sharing one silo: -20 for every feuding client whose enemy is in there too. */
export function sharedSiloMorale(clients = []) {
  const names = new Set(clients.map((c) => c.name ?? c.owner));
  let morale = 0;
  for (const c of clients) if (has(c.traits ?? [], 'feuding') && c.feudsWith && names.has(c.feudsWith)) morale += TRAITS.feuding.feudMorale;
  return morale;
}
