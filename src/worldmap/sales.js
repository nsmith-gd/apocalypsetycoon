// World map sales (pillar 2: "the world map is what you sell").
// GDD: World canvas > Regions, Demand, Selling a shelter.
//
// Built on top of #27's demand model, not beside it:
//   - DEMAND in a region = its open leads in the LeadMarket (buyers waiting) plus leads/week.
//   - CRISIS in a region = the worst crisis track it is exposed to: tension x exposure weight
//     (high 1 / medium 0.5 / low 0.25), 0-100. Higher crisis -> more Fear -> more leads.
//   - SELLING a finished shelter works the region's best waiting lead (it leaves the inbox, so
//     local demand falls), pays out through the one ledger as a 'sales' entry, hands the client
//     to Pushback (leverage), and stores a Midnight-ready shelter record.
//
// Price = spec value (room costs x markup) x client wealth class x (the region's panic premium + any edge bonus).
//
//   const sales = new MapSales({ market, ledger, pushback, getTensions, getBreachMultiplier });
//   sales.addFinished({ name, rooms: ['bunk', 'gold_taps', ...], occupants });
//   sales.regionView('eur')            -> crisis, buyers waiting, leads/week, premium, quotes
//   sales.quote('eur', shelterId)      -> { price, lead, ... } or { error }
//   sales.sell('eur', shelterId)       -> sold shelter record (throws if no buyer / no stock)

import { REGIONS, EXPOSURE, WEALTH } from '../demand/demand.js';
import { ROOM_CATALOG } from '../clients/rooms.js';
import { CLIENT_TYPES } from '../clients/clients.js';
import { gradeShelter } from '../midnight/midnight.js';

export const SALES = Object.freeze({
  specMarkup: 2, // a finished shelter sells for twice what its rooms cost to build...
  specBaseFee: 150_000, // ...plus the dig, shell and handover
  // ...times what the buyer's wealth class will pay (provisional until the GDD tables are in the repo)
  wealthMultiplier: { comfortable: 0.8, rich: 1, ultra: 1.35, apex: 1.8 },
});

const r2 = (n) => Math.round(n * 100) / 100;

/** Crisis level of a region, 0-100: its worst track after exposure weighting. */
export function regionCrisis(region, tensions = {}) {
  let worst = 0;
  let track = null;
  for (const [t, level] of Object.entries(region.exposure)) {
    const v = (tensions[t] ?? 0) * EXPOSURE[level];
    if (v > worst) { worst = v; track = t; }
  }
  return { level: Math.round(worst), track };
}

/** What a finished shelter is worth before the buyer and the region's panic. */
export function specValue(shelter, cfg = SALES) {
  const rooms = shelter.rooms ?? [];
  const build = rooms.reduce((s, id) => s + (ROOM_CATALOG[id]?.cost ?? 0), 0);
  return Math.round((cfg.specBaseFee + build * cfg.specMarkup) / 1000) * 1000;
}

/** Final sale price for a shelter to a lead of this wealth class at this premium. */
export function salePrice(shelter, wealth, premium, cfg = SALES) {
  const w = cfg.wealthMultiplier[wealth] ?? 1;
  return Math.round((specValue(shelter, cfg) * w * premium) / 1000) * 1000;
}

export class MapSales {
  constructor({
    market, ledger = null, pushback = null, regions = REGIONS, config = {},
    getTensions = () => market.lastTension ?? {}, getBreachMultiplier = () => 1, getQuarter = () => 1,
    getEdgeBonus = () => 0,
  } = {}) {
    this.market = market;
    this.ledger = ledger;
    this.pushback = pushback;
    this.regions = regions;
    this.cfg = { ...SALES, ...config, wealthMultiplier: { ...SALES.wealthMultiplier, ...(config.wealthMultiplier ?? {}) } };
    this.getTensions = getTensions;
    this.getBreachMultiplier = getBreachMultiplier;
    this.getQuarter = getQuarter;
    this.getEdgeBonus = getEdgeBonus; // (regionId) -> extra price multiplier at the edge (#4 schemes)
    this.stock = []; // finished shelters waiting for a buyer
    this.sold = []; // Midnight-ready records
    this._ids = 0;
    this._listeners = new Set();
  }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit(evt) { for (const fn of this._listeners) fn(evt, this); }

  /** A shelter has finished construction (handover) and can be sold on the map. */
  addFinished({ name, rooms = [], occupants = 6, sealed = null } = {}) {
    const s = { id: `spec${++this._ids}`, name: name ?? `Spec shelter #${this._ids}`, rooms: [...rooms], occupants, ...(sealed ? { sealed } : {}) }; // sealed: a tile-built bunker's simulated Days Sealed and ratings
    s.value = specValue(s, this.cfg);
    this.stock.push(s);
    this._emit({ type: 'stock', shelter: s });
    return s;
  }

  region(id) { return this.regions.find((r) => r.id === id) ?? null; }

  /** Open leads in a region, best buyer first (richest, then the one closest to walking). */
  buyers(regionId) {
    return this.market.leads
      .filter((l) => l.region === regionId)
      .sort((a, b) => WEALTH.indexOf(b.wealth) - WEALTH.indexOf(a.wealth) || a.week - b.week);
  }

  /** Everything the map needs for every region, in one pass. */
  overview() {
    const tensions = this.getTensions();
    const breachMultiplier = this.getBreachMultiplier();
    const rows = this.market.regionDemand({ tensions, breachMultiplier });
    return rows.map((d) => {
      const region = this.region(d.id);
      const crisis = regionCrisis(region, tensions);
      const edgeBonus = this.getEdgeBonus(d.id) || 0;
      return { ...d, crisis: crisis.level, crisisTrack: crisis.track, buyers: d.open, edgeBonus, premium: Math.round((d.panicPremium + edgeBonus) * 1000) / 1000 };
    });
  }

  /** Detail for one region, with a price quote for every shelter in stock. */
  regionView(regionId) {
    const row = this.overview().find((r) => r.id === regionId);
    if (!row) return null;
    const buyers = this.buyers(regionId);
    const best = buyers[0] ?? null;
    const quotes = this.stock.map((s) => ({
      shelter: s,
      price: best ? salePrice(s, best.wealth, row.premium, this.cfg) : null,
    }));
    return { ...row, buyerList: buyers, best, quotes };
  }

  quote(regionId, shelterId, { lead: pipelineLead = null } = {}) {
    const region = this.region(regionId);
    if (!region) return { error: 'Unknown region.' };
    const shelter = this.stock.find((s) => s.id === shelterId);
    if (!shelter) return { error: 'That shelter is not in stock.' };
    // Hook (#50): a lead from the player's pipeline (src/leads) can be the buyer instead of the
    // region's best waiting lead. Same price rule; it must be in this region.
    if (pipelineLead && pipelineLead.region !== regionId) return { error: `That lead is in another region.` };
    const lead = pipelineLead ?? this.buyers(regionId)[0];
    if (!lead) return { error: `No buyers in ${region.name}. Calm worlds don't buy bunkers.` };
    const premium = this.overview().find((r) => r.id === regionId).premium;
    return { region, shelter, lead, premium, price: salePrice(shelter, lead.wealth, premium, this.cfg) };
  }

  canSell(regionId, shelterId) { return !this.quote(regionId, shelterId).error; }

  /** Sell a finished shelter to the region's best waiting buyer. */
  sell(regionId, shelterId, { lead: pipelineLead = null } = {}) {
    const q = this.quote(regionId, shelterId, { lead: pipelineLead });
    if (q.error) throw new Error(q.error);
    const { region, shelter, lead, price, premium } = q;
    if (!pipelineLead) this.market.work(lead.id); // the buyer leaves the inbox: local demand falls
    this.stock = this.stock.filter((s) => s !== shelter);
    const type = CLIENT_TYPES[lead.type];
    const owner = lead.name ?? type?.names?.[lead.id % type.names.length] ?? 'A client';
    const graded = gradeShelter({ id: shelter.id, name: shelter.name, owner, occupants: shelter.occupants, rooms: shelter.rooms, sold: true });
    const record = {
      id: shelter.id,
      name: shelter.name,
      owner,
      clientType: lead.type,
      wealth: lead.wealth,
      region: region.id,
      occupants: shelter.occupants,
      rooms: [...shelter.rooms],
      sold: true,
      soldQuarter: this.getQuarter(),
      price,
      premium,
      ratings: { air: r2(graded.ratios.air), water: r2(graded.ratios.water), food: r2(graded.ratios.food) },
      grades: { ...graded.grades },
      prestige: graded.prestige,
    };
    this.sold.push(record);
    this.ledger?.record('sales', `${type?.label ?? 'Client'} shelter (${region.name}): ${owner}`, price);
    this.pushback?.onSale?.({ client: owner, price, region: region.id });
    this._emit({ type: 'sale', record, lead });
    return record;
  }

  /** Sold shelters exactly as computeMidnight expects them. */
  sheltersForMidnight() { return this.sold.map((s) => ({ ...s, rooms: [...s.rooms] })); }

  toJSON() { return { stock: this.stock, sold: this.sold, ids: this._ids }; }
  load(data) { this.stock = data.stock ?? []; this.sold = data.sold ?? []; this._ids = data.ids ?? 0; this._emit({ type: 'load' }); }
}
