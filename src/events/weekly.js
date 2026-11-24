import { seededRng } from '../campaign/rng.js';
// Weekly event deck (L0 greybox). GDD: World canvas > The event deck, Sample cards.
//
// One headline card every in-game week, each with two (sometimes three) choices that nudge tension,
// heat, cash, reputation or research. L0 deck: the GDD's six sample cards plus four general cards
// (10 total). Drawn at random, never repeating any of the last 3, regardless of track or band.
// The full system draws from each open track's deck by band plus a general deck; that comes later.
//
//   const deck = new WeeklyDeck({ seed });
//   const card = deck.draw(week);                  // once per week
//   const result = applyChoice(card, 'lobby', hooks); // hooks below; returns the applied effects
//
// hooks: { addTension(trackId, n), addHeat(n), addCash(label, n), addReputation(n), addResearch(n), note(text) }
// Money is GDD dollars x CARD_PRICE_SCALE (0.02) so a card fits a $400K opening treasury: the GDD's $3M lobby
// costs $60K here. One constant to change when the economy is rescaled.

export const CARD_PRICE_SCALE = 1; // #91: cards are in GDD dollars like the rest of the economy
const M = (millions) => Math.round(millions * 1_000_000 * CARD_PRICE_SCALE);

// Effects: tension: { track, n } | heat | cash | reputation | research. `later` = a GDD outcome whose
// system isn't wired into the campaign yet; it is shown on the card and logged, not applied.
export const WEEKLY_CARDS = Object.freeze([
  {
    id: 'senator_bunker', title: 'Senator Promises a Bunker in Every Backyard', type: 'headline', track: 'atomic', band: 'Boil',
    blurb: 'A rising senator wants a fallout shelter under every lawn. The networks love it.',
    choices: [
      { id: 'lobby', label: 'Lobby for it', cost: M(3), effects: { heat: 2 }, later: 'Heartland demand +30% for 8 weeks' },
      { id: 'mock', label: 'Mock it on air', effects: {}, later: "Bryce Kettering's confidence -3" },
    ],
  },
  {
    id: 'sourdough_glow', title: 'Sourdough Starters Glowing Faintly', type: 'headline', track: 'bloom', band: 'Simmer',
    blurb: 'Home bakers report a soft green light from the jar. Probably fine.',
    choices: [
      { id: 'study', label: 'Fund a study', cost: M(1), effects: { research: 20, tension: { track: 'bloom', n: 2 } } },
      { id: 'ignore', label: 'Ignore it', effects: { tension: { track: 'bloom', n: 4 } } },
    ],
  },
  {
    id: 'smart_fridge', title: 'Smart Fridge Refuses to Open', type: 'opportunity', track: 'optimizer', band: 'Boil',
    blurb: 'A firmware update decided its owner had eaten enough. Millions of kitchens are locked.',
    choices: [
      { id: 'buy', label: 'Buy the fridge maker', cost: M(10), effects: { tension: { track: 'optimizer', n: 6 } }, later: 'a new revenue line' },
      { id: 'ad', label: 'Run the ad "Our doors have handles"', effects: {}, later: 'Disruptor demand +20%' },
    ],
  },
  {
    id: 'honeybee_funeral', title: 'Last Honeybee Granted State Funeral', type: 'headline', track: 'hush', band: 'Brink',
    blurb: 'Flags at half-mast. A very small coffin. Florists are not coping.',
    choices: [
      { id: 'sponsor', label: 'Sponsor the funeral', cost: M(4), effects: { tension: { track: 'hush', n: -6 }, reputation: 3 } },
      { id: 'futures', label: 'Sell honey futures', effects: { cash: M(5), tension: { track: 'hush', n: 5 }, heat: 4 } },
    ],
  },
  {
    id: 'iris_comment', title: 'Iris Kemp Requests Comment', type: 'threat', track: null, band: null,
    blurb: 'The Ledger Review is running something about your supply chain. She wants a quote by Friday.',
    choices: [
      { id: 'no_comment', label: 'No comment', effects: { heat: 2 }, later: 'her story +10%' },
      { id: 'off_record', label: 'Off the record', effects: {}, later: "story stalls, Marcus Dell's leverage +5" },
      { id: 'showroom', label: 'Invite her to the Showroom', effects: { heat: 1, reputation: 1 }, later: 'Iris trust +1, story stalls 4 weeks' },
    ],
  },
  {
    id: 'halcyon_ashcombes', title: 'Halcyon Signs the Ashcombes', type: 'wildcard', track: null, band: null,
    blurb: "Seraphine Ash closed on Lady Ashcombe's family vault over oysters. Three generations, gone.",
    choices: [
      { id: 'poach', label: 'Poach them back', cost: M(3), effects: {}, later: 'Lady Ashcombe returns; Halcyon schemes on slot 3' },
      { id: 'let_go', label: 'Let them go', effects: {}, later: 'lose the lead; Cornelius Vane confidence -5' },
    ],
  },
  // ---- four general cards (L0 filler, written to the GDD's card types) ----
  {
    id: 'prepper_expo', title: 'Doomsday Prepper Expo Sells Out', type: 'opportunity', track: null, band: null,
    blurb: 'Forty thousand people queued for freeze-dried lasagne. Some of them are very rich.',
    choices: [
      { id: 'booth', label: 'Take a booth', cost: M(0.5), effects: { reputation: 2, tension: { track: null, n: 2 } } },
      { id: 'skip', label: 'Skip it', effects: {} },
    ],
  },
  {
    id: 'audit', title: 'Regulators Audit Bunker Builders', type: 'threat', track: null, band: null,
    blurb: 'A new task force wants every builder’s invoices for the last two years.',
    choices: [
      { id: 'open_books', label: 'Open the books', cost: M(0.8), effects: { heat: -6 } },
      { id: 'stall', label: 'Shred and stall', effects: { heat: 6 } },
    ],
  },
  {
    id: 'markets_wobble', title: 'Markets Wobble on Rumour', type: 'wildcard', track: null, band: null,
    blurb: 'Nobody knows who started it. Tension jumps on its own.',
    choices: [
      { id: 'short', label: 'Short the panic', effects: { cash: M(1.5), heat: 3, tension: { track: null, n: 8 } } },
      { id: 'calm', label: 'Issue a calming statement', effects: { tension: { track: null, n: 4 } } },
    ],
  },
  {
    id: 'discount_demand', title: 'Client Demands a Loyalty Discount', type: 'client', track: null, band: null,
    blurb: 'A buyer says a rival quoted less, and they know where some bodies are buried.',
    choices: [
      { id: 'grant', label: 'Grant 10% back', cost: M(1), effects: { heat: -2 } },
      { id: 'refuse', label: 'Refuse politely', effects: { heat: 3, reputation: -1 } },
    ],
  },
]);

const mulberry32 = seededRng; // saveable state (#80)

export class WeeklyDeck {
  constructor({ seed = 1, cards = WEEKLY_CARDS, noRepeat = 3 } = {}) {
    this.cards = cards;
    this.rng = mulberry32(seed);
    this.noRepeat = Math.min(noRepeat, cards.length - 1);
    this.recent = [];
    this.lastWeek = 0; // the last week a card was drawn for
    this.history = []; // { week, card, choice }
  }

  /** Draw this week's card. Returns null if a card was already drawn for this week (one per week). */
  draw(week) {
    if (week <= this.lastWeek) return null;
    this.lastWeek = week;
    const pool = this.cards.filter((c) => !this.recent.includes(c.id));
    const card = pool[Math.floor(this.rng() * pool.length)];
    this.recent = [card.id, ...this.recent].slice(0, this.noRepeat);
    this.history.push({ week, card: card.id, choice: null });
    return card;
  }

  /** Record the player's pick for a week's card. */
  chose(week, choiceId) {
    const h = [...this.history].reverse().find((x) => x.week === week);
    if (h) h.choice = choiceId;
  }

  toJSON() { return { recent: this.recent, lastWeek: this.lastWeek, history: this.history.slice(-60) }; }
  load(d) {
    if (!d) return;
    this.recent = d.recent ?? [];
    this.lastWeek = d.lastWeek ?? 0;
    this.history = d.history ?? [];
  }
}

/** Human-readable effect list for a choice ("-$300K", "heat +2", "Bloom +4", ...). */
export function describeChoice(choice, trackName = (id) => id) {
  const e = choice.effects ?? {};
  const out = [];
  const money = (n) => `${n < 0 ? '-' : '+'}$${Math.abs(n) >= 1e6 ? `${(Math.abs(n) / 1e6).toFixed(1)}M` : `${Math.round(Math.abs(n) / 1000)}K`}`;
  if (choice.cost) out.push(money(-choice.cost));
  if (e.cash) out.push(money(e.cash));
  if (e.tension) out.push(`${e.tension.track ? trackName(e.tension.track) : 'Tension'} ${e.tension.n > 0 ? '+' : ''}${e.tension.n}`);
  if (e.heat) out.push(`heat ${e.heat > 0 ? '+' : ''}${e.heat}`);
  if (e.reputation) out.push(`reputation ${e.reputation > 0 ? '+' : ''}${e.reputation}`);
  if (e.research) out.push(`+${e.research} RP`);
  return out;
}

/** Apply a choice through the hooks. Returns { applied: [...strings], later }. */
export function applyChoice(card, choiceId, hooks = {}, trackName = (id) => id) {
  const choice = card.choices.find((c) => c.id === choiceId) ?? card.choices[0];
  const e = choice.effects ?? {};
  const label = `${card.title}: ${choice.label}`;
  if (choice.cost) hooks.addCash?.(label, -choice.cost);
  if (e.cash) hooks.addCash?.(label, e.cash);
  if (e.tension) hooks.addTension?.(e.tension.track, e.tension.n, card.title);
  if (e.heat) hooks.addHeat?.(e.heat, card.title);
  if (e.reputation) hooks.addReputation?.(e.reputation);
  if (e.research) hooks.addResearch?.(e.research);
  if (choice.later) hooks.note?.(`${card.title}: ${choice.later} (coming with a later system)`);
  return { card, choice, applied: describeChoice(choice, trackName), later: choice.later ?? null };
}
