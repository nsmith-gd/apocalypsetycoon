// Client orders and the wants-versus-needs split (pillar 3: "Build what they want, grade
// what they need").
//
// A client places an ORDER: a shelter for N occupants, with a short list of luxury WANTS
// (gold taps, cryo pods...). The client pays a small base fee plus a premium for every want
// you fit, and a bonus for fitting them all. Air, water and food pay NOTHING extra: clients
// assume the plumbing just works. Every shelter has a fixed number of room slots, so every
// slot spent on survival is a slot not spent on what they pay for.
//
// When you deliver, the sale is priced on the wants, and the shelter's AIR / WATER / FOOD
// ratings are worked out with Midnight's own rules and stored on the shelter record, so the
// Midnight grade can be shown at the sale and computed at the end of Q12.
//
//   const book = new ClientBook({ ledger, pushback, rng });
//   const order = book.generateOrder({ quarter, region, crisis, isUnlocked });
//   book.price(order, rooms)               -> { total, lines, wantsMet, ... } (preview)
//   book.forecast(order, rooms)            -> { ratios, grades, survivors, ... } (Midnight preview)
//   const shelter = book.deliver(order.id, rooms, { quarter, priceMultiplier });
//   computeMidnight({ shelters: book.sheltersForMidnight(), ... })

import { gradeShelter } from '../midnight/midnight.js';
import { ROOM_CATALOG } from './rooms.js';

// Data-driven client archetypes. `wants` = luxury room ids with what each fitted copy pays.
// `wantCount` = how many wants an order picks from that list. Survival never pays, except
// a little for the Prepper, who is the only client who reads the spec sheet.
export const CLIENT_TYPES = Object.freeze({
  tech_founder: {
    wealthClass: 'C2', style: 'tech_minimal', // preferred style (design layer)
    label: 'Tech founder', occupants: [3, 5], slots: 7, baseFee: 60_000,
    wants: { cryo_pod: 140_000, ai_butler: 220_000, gold_taps: 30_000 }, wantCount: [1, 2],
    names: ['Kai Brandt', 'Sasha Okonkwo-Reyes', 'Elon-Marie Voss', 'Dev Patel-Hart'],
    blurb: 'Wants to wake up in the future with a butler that knows his name.',
  },
  oil_heir: {
    wealthClass: 'C3', style: 'gilded', // preferred style (design layer)
    label: 'Oil heir', occupants: [8, 12], slots: 9, baseFee: 80_000,
    wants: { gold_taps: 70_000, wine_cellar: 120_000, cryo_pod: 90_000 }, wantCount: [2, 3],
    names: ['Chad Remington IV', 'Lady Graves', 'Count Velasquez', 'The Halvorsen Twins'],
    blurb: 'The whole family, the staff and the 1961 Pétrus. Gold everything.',
  },
  celebrity: {
    wealthClass: 'C4', style: 'kitsch', // preferred style (design layer)
    label: 'Celebrity', occupants: [4, 6], slots: 7, baseFee: 50_000,
    wants: { gold_taps: 90_000, cryo_pod: 110_000, wine_cellar: 60_000 }, wantCount: [1, 2],
    names: ['DJ Bunkr', 'Mrs. Abernathy-Lux', 'Rex Starling', 'Paloma'],
    blurb: 'Needs it to look incredible on the last livestream.',
  },
  politician: {
    wealthClass: 'C3', style: 'gilded', // preferred style (design layer)
    label: 'Politician', occupants: [6, 10], slots: 8, baseFee: 70_000,
    wants: { wine_cellar: 100_000, gold_taps: 50_000 }, wantCount: [1, 2],
    names: ['Senator Pike', 'Minister Hollis', 'Governor Banks', 'Mayor Duquesne'],
    blurb: 'Discreet. Off the books. A panic room for the panic.',
  },
  prepper: {
    wealthClass: 'C1', style: 'brutalist', // preferred style (design layer)
    label: 'Billionaire prepper', occupants: [6, 8], slots: 8, baseFee: 90_000,
    wants: { mil_scrubber: 60_000, water_recycler: 50_000, hydroponics: 40_000, gold_taps: 40_000 }, wantCount: [2, 3],
    names: ['The Kessler Trust', 'Ms. Tanaka-Ruiz', 'Bishop Oduya', 'Mr. Vance'],
    blurb: 'Has read every forum. Still wants one gold tap.',
  },
});

export const ORDER_CONFIG = Object.freeze({
  allWantsBonus: 0.25, // +25% on the want premiums when every want is fitted
  orderLifetimeQuarters: 2, // an open order expires after this many quarters
  // Which client types show up, by world crisis: calm worlds draw cautious preppers,
  // worlds at the edge draw everybody with money and a camera.
  typeWeights(crisis) {
    const c = Math.max(0, Math.min(100, crisis)) / 100;
    return { prepper: 3 - 2 * c, politician: 1 + c, tech_founder: 1 + 2 * c, oil_heir: 0.5 + 2.5 * c, celebrity: 3 * c };
  },
});

// Deterministic PRNG so tests and the pacing harness can replay orders.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const between = (rng, [lo, hi]) => lo + Math.floor(rng() * (hi - lo + 1));

function weightedPick(rng, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of entries) if ((r -= w) <= 0) return k;
  return entries[entries.length - 1][0];
}

/** Count of each room id in a list. */
export function countRooms(rooms) {
  const m = {};
  for (const id of rooms) m[id] = (m[id] ?? 0) + 1;
  return m;
}

export class ClientBook {
  constructor({ ledger = null, pushback = null, rng = mulberry32(1), types = CLIENT_TYPES, cfg = ORDER_CONFIG } = {}) {
    this.ledger = ledger;
    this.pushback = pushback;
    this.rng = rng;
    this.types = types;
    this.cfg = cfg;
    this.orders = []; // open orders
    this.shelters = []; // delivered (sold) shelters, Midnight-ready
    this.nextId = 1;
    this.listeners = new Set();
  }

  /** Make a new order. `isUnlocked(roomId)` limits wants to rooms the player can build. */
  generateOrder({ quarter = 1, region = '', crisis = 0, isUnlocked = () => true, type } = {}) {
    const typeId = type ?? weightedPick(this.rng, this.cfg.typeWeights(crisis));
    const t = this.types[typeId];
    const buildable = (id) => !ROOM_CATALOG[id]?.research || isUnlocked(id);
    let pool = Object.keys(t.wants).filter(buildable);
    if (!pool.length) pool = ['gold_taps'].filter((id) => t.wants[id]);
    const n = Math.min(pool.length, between(this.rng, t.wantCount));
    const wants = [];
    const remaining = [...pool];
    for (let i = 0; i < n; i++) {
      const id = remaining.splice(Math.floor(this.rng() * remaining.length), 1)[0];
      // big orders sometimes want two of the cheap stuff
      const qty = t.wants[id] <= 70_000 && this.rng() < 0.35 ? 2 : 1;
      wants.push({ room: id, qty, pays: t.wants[id] });
    }
    const order = {
      id: `o${this.nextId++}`,
      client: pick(this.rng, t.names),
      type: typeId,
      typeLabel: t.label,
      wealthClass: t.wealthClass ?? 'C1',
      style: t.style ?? null,
      blurb: t.blurb,
      region,
      occupants: between(this.rng, t.occupants),
      slots: t.slots,
      baseFee: t.baseFee,
      wants,
      placedQuarter: quarter,
      expiresQuarter: quarter + this.cfg.orderLifetimeQuarters,
    };
    this.orders.push(order);
    this.emit();
    return order;
  }

  getOrder(id) {
    return this.orders.find((o) => o.id === id) ?? null;
  }

  /** What the client would pay for these rooms. Survival rooms add nothing (unless wanted). */
  price(order, rooms, { priceMultiplier = 1 } = {}) {
    const have = countRooms(rooms);
    const lines = [{ label: `Base fee (${order.occupants} people)`, amount: order.baseFee }];
    let premium = 0;
    let wantsMet = 0;
    for (const w of order.wants) {
      const fitted = Math.min(w.qty, have[w.room] ?? 0);
      if (fitted >= w.qty) wantsMet++;
      const amount = fitted * w.pays;
      premium += amount;
      lines.push({ label: `${ROOM_CATALOG[w.room]?.name ?? w.room}${w.qty > 1 ? ` (${fitted}/${w.qty})` : fitted ? '' : ' (missing)'}`, amount, want: w.room, met: fitted >= w.qty });
    }
    const allMet = wantsMet === order.wants.length && order.wants.length > 0;
    const bonus = allMet ? Math.round(premium * this.cfg.allWantsBonus) : 0;
    if (allMet) lines.push({ label: 'Every want fitted bonus', amount: bonus });
    const survivalRooms = rooms.filter((id) => ROOM_CATALOG[id]?.kind === 'survival' && !order.wants.some((w) => w.room === id)).length;
    if (survivalRooms) lines.push({ label: `Air, water & food rooms (${survivalRooms})`, amount: 0, unpaid: true });
    const subtotal = order.baseFee + premium + bonus;
    const total = Math.round(subtotal * priceMultiplier);
    return { lines, premium, bonus, wantsMet, wantsTotal: order.wants.length, allMet, subtotal, priceMultiplier, total };
  }

  /** Midnight forecast for a fit-out, using Midnight's own grading. */
  forecast(order, rooms, opts = {}) {
    return gradeShelter({ id: order.id, name: '', owner: order.client, occupants: order.occupants, rooms, sold: true }, opts);
  }

  /** Can these rooms be delivered for this order? */
  validate(order, rooms) {
    if (!order) return 'No such order.';
    if (rooms.length === 0) return 'The shelter is empty.';
    if (rooms.length > order.slots) return `Only ${order.slots} room slots.`;
    if (rooms.some((id) => !ROOM_CATALOG[id])) return 'Unknown room.';
    return null;
  }

  /**
   * Sell the shelter: records the sale in the ledger (pricing on wants), hands the client to
   * Pushback (leverage), and stores the shelter with its survival ratings for Midnight.
   * Build costs are NOT charged here: the grid charges them as rooms are placed.
   */
  deliver(orderId, rooms, { quarter = 1, priceMultiplier = 1 } = {}) {
    const order = this.getOrder(orderId);
    const err = this.validate(order, rooms);
    if (err) throw new Error(err);
    const priced = this.price(order, rooms, { priceMultiplier });
    const graded = this.forecast(order, rooms);
    const shelter = {
      id: `s-${order.id}`,
      name: `${order.client}'s shelter`,
      owner: order.client,
      clientType: order.type,
      region: order.region,
      occupants: order.occupants,
      rooms: [...rooms],
      sold: true,
      soldQuarter: quarter,
      price: priced.total,
      wantsMet: priced.wantsMet,
      wantsTotal: priced.wantsTotal,
      // The survival stats Midnight grades, recorded at the sale.
      ratings: {
        air: round2(graded.ratios.air),
        water: round2(graded.ratios.water),
        food: round2(graded.ratios.food),
      },
      grades: { ...graded.grades },
      supply: { air: graded.supply.air, water: graded.supply.water, food: graded.supply.food },
      prestige: graded.prestige,
    };
    this.shelters.push(shelter);
    this.orders = this.orders.filter((o) => o !== order);
    this.ledger?.record('sales', `${order.typeLabel} shelter: ${order.client}`, priced.total);
    this.pushback?.onSale?.({ client: order.client, price: priced.total, region: order.region });
    this.emit({ type: 'sale', shelter, priced });
    return shelter;
  }

  /** Drop orders whose deadline has passed. Returns the expired ones. */
  expire(quarter) {
    const gone = this.orders.filter((o) => quarter > o.expiresQuarter);
    if (gone.length) {
      this.orders = this.orders.filter((o) => quarter <= o.expiresQuarter);
      this.emit({ type: 'expired', orders: gone });
    }
    return gone;
  }

  /** Shelter records exactly as computeMidnight expects them. */
  sheltersForMidnight() {
    return this.shelters.map((s) => ({ ...s, rooms: [...s.rooms] }));
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(evt) { for (const fn of this.listeners) fn(evt, this); }

  toJSON() {
    return { orders: this.orders, shelters: this.shelters, nextId: this.nextId };
  }

  load(data) {
    this.orders = data.orders ?? [];
    this.shelters = data.shelters ?? [];
    this.nextId = data.nextId ?? 1;
    this.emit();
  }
}

const round2 = (n) => Math.round(n * 100) / 100;
