// Dialogue outcomes: what a conversation with a guest at an event is worth (#55, director note D2).
//
// The dialogue engine (#54) walks a tree; each choice the player picks can carry an `effects` object
// (vocabulary below). When the tree reaches an ending node, the engine hands over the ending id and
// the effects of every choice taken. This module turns that into:
//   - a LEAD (or none), whose quality scales with the guest's trust and how well the player played to
//     their fears and traits, handed to the lead pipeline (src/leads, LeadInventory.fromDialogue);
//   - SIDE EFFECTS: heat, reputation, client leverage that follows the lead into the sale, and SLIPS:
//     moments where the player let slip that they stoke the crises, which tip off a journalist.
// Pillar 4, "nothing is free": every aggressive ending carries a risk.
//
// CHOICE EFFECTS (all optional, per choice)
//   trust: n          guest trust change (-30..+30)
//   fear: 'trackId'   the line plays to this fear. Matches a guest fear: +8 trust and counts as a hit;
//                     the wrong fear: -4 trust and counts as a miss.
//   trait: 'traitId'  the line plays to this trait (vain, paranoid, family, skeptic...). Same rule, +6 / -3.
//   aggressive: true  pressure, threats, insider hints. Counted; raises leverage and slip odds.
//   slip: true        the line hints you know (or cause) what is coming. Rolled at the end.
//   promise: 'want'   you promised a luxury (gold taps, cryo pods). Each promise: +4 leverage for the client.
//   learn: 'traitId'  the player found out a trait; it is stored on the lead.
//
// ENDINGS  (ENDINGS below has the numbers)
//   sold_fear     won by selling their fear                    lead
//   sold_dream    won by selling the luxury                    lead, promises become leverage
//   hard_close    won by pressure                              lead, +leverage, chance the guest complains
//   insider_tip   won by hinting you know what is coming       hot lead, +heat, big slip risk
//   polite_exit   no sale, no harm                             nothing
//   rebuffed      the guest says no                            small reputation loss if you were pushy
//   backfire      the guest sees through you                   no lead, reputation and heat, slips land
//
// THE WORLD (#57)  context.world = worldState({ crisis, schemes }) (src/dialogue/world-state.js)
//   A guest whose fear is boiling over starts with more trust and gives a better lead; if the player's
//   schemes fed that fear just before, suspicion costs trust and makes every slip likelier.
//
//   const result = resolveOutcome({ ending, guest, effects, context: { journalistPresent, world }, rng });
//   const { lead } = applyOutcome(result, { leads, pushback, press, guest, venueId });

import { crisisPitch } from './world-state.js';

export const OUTCOME_RULES = Object.freeze({
  startTrust: 30, // a stranger at a party
  fearHit: 8, fearMiss: -4,
  traitHit: 6, traitMiss: -3,
  promiseLeverage: 4,
  aggressionLeverage: 3, // per aggressive choice, on top of the ending's own
  slip: {
    base: 0.3, // chance each slip lands
    journalistPresent: 0.25, // a reporter in the room
    perTrust: -0.003, // guests who trust you keep quiet: -0.3 percentage points per trust point
    aggressive: 0.05, // per aggressive choice
    min: 0.05, max: 0.95,
    story: { present: 25, rumour: 10 }, // story progress: a reporter heard it / it gets back to Gil as gossip
    heat: 6,
  },
});

export const ENDINGS = Object.freeze({
  sold_fear: {
    label: 'Sold the fear', win: true, aggressive: false,
    lead: { base: 25, trust: 0.4, fear: 30, trait: 10 },
    blurb: 'You told them exactly what they were afraid of, and how deep the concrete goes.',
  },
  sold_dream: {
    label: 'Sold the dream', win: true, aggressive: false,
    lead: { base: 20, trust: 0.4, fear: 10, trait: 30 },
    blurb: 'Gold taps, a cinema, a wine cellar. They stopped asking about the air.',
  },
  hard_close: {
    label: 'Hard close', win: true, aggressive: true,
    lead: { base: 40, trust: 0.2, fear: 15, trait: 5 },
    leverage: 8, // they remember being pushed
    complain: { chance: 0.3, presentBonus: 0.2, reputation: -4 },
    blurb: 'You didn\'t let them leave the terrace without a deposit.',
  },
  insider_tip: {
    label: 'Insider tip', win: true, aggressive: true,
    lead: { base: 55, trust: 0.25, fear: 20, trait: 0 },
    heat: 3,
    forceSlip: true, // the pitch is itself a slip
    blurb: '"Between us? I\'d be underground by spring." They believed you. So might a reporter.',
  },
  polite_exit: {
    label: 'Polite exit', win: false, aggressive: false,
    blurb: 'A card, a handshake, nothing more.',
  },
  rebuffed: {
    label: 'Rebuffed', win: false, aggressive: false,
    pushyReputation: -2, // only if the player was aggressive on the way
    blurb: 'They had heard enough.',
  },
  backfire: {
    label: 'Backfire', win: false, aggressive: true,
    reputation: -6, heat: 5,
    forceSlip: true,
    blurb: 'They saw what you are. Now they are telling the room.',
  },
});

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** Fold the effects of every choice taken into a score for this guest. */
export function scoreConversation(guest = {}, effects = [], rules = OUTCOME_RULES) {
  const fears = new Set(guest.fears ?? []);
  const traits = new Set(guest.traits ?? []);
  let trust = guest.trust ?? rules.startTrust;
  let fearHits = 0, fearMisses = 0, traitHits = 0, traitMisses = 0, aggression = 0, slips = 0;
  const promises = [];
  const learned = [];
  for (const e of effects) {
    if (!e) continue;
    if (e.trust) trust += e.trust;
    if (e.fear) { if (fears.has(e.fear)) { fearHits++; trust += rules.fearHit; } else { fearMisses++; trust += rules.fearMiss; } }
    if (e.trait) { if (traits.has(e.trait)) { traitHits++; trust += rules.traitHit; } else { traitMisses++; trust += rules.traitMiss; } }
    if (e.aggressive) aggression++;
    if (e.slip) slips++;
    if (e.promise) promises.push(e.promise);
    if (e.learn && !learned.includes(e.learn)) learned.push(e.learn);
  }
  const ratio = (hit, miss) => (hit + miss ? hit / (hit + miss) : 0);
  return {
    trust: clamp(Math.round(trust)),
    // how well you played to them: share of fear/trait plays that landed, discounted if you only tried once
    fearPlay: Math.round(ratio(fearHits, fearMisses) * Math.min(1, (fearHits + fearMisses) / 2) * 100) / 100,
    traitPlay: Math.round(ratio(traitHits, traitMisses) * Math.min(1, (traitHits + traitMisses) / 2) * 100) / 100,
    fearHits, fearMisses, traitHits, traitMisses, aggression, slips, promises, learned,
  };
}

/** Chance that one slip reaches the press. */
export function slipChance(score, { journalistPresent = false } = {}, rules = OUTCOME_RULES) {
  const S = rules.slip;
  return clamp(S.base + (journalistPresent ? S.journalistPresent : 0) + S.perTrust * score.trust + S.aggressive * score.aggression, S.min, S.max);
}

/**
 * Decide what a finished conversation is worth. Pure: no side effects applied yet.
 * `effects` = the effects of every choice taken (or pass a precomputed `score`).
 * `context.journalistPresent` = a reporter was at the event (attend.js visit.press).
 */
export function resolveOutcome({ ending, guest = {}, effects = [], score = null, context = {}, rng = Math.random, rules = OUTCOME_RULES } = {}) {
  const E = ENDINGS[ending];
  if (!E) throw new Error(`Unknown dialogue ending "${ending}"`);
  const pitch = context.world ? crisisPitch(guest, context.world) : null;
  const startTrust = (guest.trust ?? rules.startTrust) + (pitch ? pitch.trustBonus - pitch.trustPenalty : 0);
  const s = score ?? scoreConversation({ ...guest, trust: startTrust }, effects, rules);
  const present = !!context.journalistPresent;
  const out = {
    ending, label: E.label, win: E.win, guest: { id: guest.id ?? null, name: guest.name ?? 'A guest' },
    score: s, crisis: pitch, lead: null, heat: 0, reputation: 0, leverage: 0, slips: [], complained: false, lines: [],
  };

  if (E.win) {
    const L = E.lead;
    const interest = clamp(Math.round(L.base + L.trust * s.trust + L.fear * s.fearPlay + L.trait * s.traitPlay + (pitch?.interestBonus ?? 0)), 1, 100);
    out.leverage = (E.leverage ?? 0) + rules.aggressionLeverage * s.aggression + rules.promiseLeverage * s.promises.length;
    out.lead = { interest, traits: [...s.learned], note: E.label, leverage: out.leverage, promises: [...s.promises] };
    out.lines.push(`${E.label}: ${out.guest.name} is ${interest >= 75 ? 'hot' : interest >= 40 ? 'warm' : 'lukewarm'} (interest ${interest}).`);
    if (out.leverage) out.lines.push(`They'll remember how you got them: +${out.leverage} leverage once they buy.`);
  } else {
    out.lines.push(`${E.label}: no lead from ${out.guest.name}.`);
  }

  if (E.heat) out.heat += E.heat;
  if (E.reputation) out.reputation += E.reputation;
  if (E.pushyReputation && s.aggression > 0) out.reputation += E.pushyReputation;
  if (E.complain) {
    const chance = E.complain.chance + (present ? E.complain.presentBonus : 0);
    if (rng() < chance) { out.complained = true; out.reputation += E.complain.reputation; out.lines.push(`${out.guest.name} complains to the room about the hard sell.`); }
  }

  if (pitch) out.lines.push(...pitch.lines);
  // Slips: each one rolls; forced endings add one that always rolls.
  const slipRolls = s.slips + (E.forceSlip ? 1 : 0);
  const chance = Math.min(rules.slip.max, slipChance(s, context, rules) + (pitch?.slipBonus ?? 0));
  for (let i = 0; i < slipRolls; i++) {
    if (rng() >= chance) continue;
    const S = rules.slip;
    const slip = present
      ? { journalist: context.journalistId ?? 'iris', progress: S.story.present, heard: 'reporter' }
      : { journalist: 'gil', progress: S.story.rumour, heard: 'gossip' };
    out.slips.push(slip);
    out.heat += S.heat;
  }
  if (out.slips.length) {
    out.lines.push(out.slips[0].heard === 'reporter'
      ? `A reporter heard you. They know you're feeding the panic you sell.`
      : `Word gets around: someone tells DoomWatch Live you're stoking the crisis.`);
  }
  out.slipChance = slipRolls ? chance : 0;
  if (out.heat) out.lines.push(`Heat +${out.heat}.`);
  if (out.reputation) out.lines.push(`Reputation ${out.reputation}.`);
  return out;
}

/**
 * Apply a resolved outcome to the game. Every hook is optional:
 *   leads (LeadInventory), pushback (heat), press (reputation, tip-offs), guest + venueId for the lead.
 * Returns { lead, tipOffs }.
 */
export function applyOutcome(result, { leads = null, pushback = null, press = null, addHeat = null, addReputation = null, guest = null, venueId = null, quarter } = {}) {
  let lead = null;
  if (result.lead && leads && guest) {
    lead = leads.fromDialogue({ guest, venueId, outcome: { interest: result.lead.interest, traits: result.lead.traits, note: result.lead.note }, ...(quarter ? { quarter } : {}) });
    if (lead) {
      lead.leverage = result.lead.leverage;
      lead.promises = [...result.lead.promises];
      lead.source.ending = result.ending;
    }
  }
  const heatFn = addHeat ?? (pushback ? (n, why) => pushback.addHeat(n, why) : null);
  const repFn = addReputation ?? (press ? (n, why) => press.addReputation(n, why) : null);
  const why = `Conversation with ${result.guest.name}`;
  if (result.heat && heatFn) heatFn(result.heat, why);
  if (result.reputation && repFn) repFn(result.reputation, why);
  const tipOffs = [];
  for (const s of result.slips) {
    const t = press?.tipOff?.(s.journalist, s.progress, `Bunker seller "knows what's coming", says ${result.guest.name}'s circle`);
    if (t) tipOffs.push(t);
  }
  return { lead, tipOffs };
}
