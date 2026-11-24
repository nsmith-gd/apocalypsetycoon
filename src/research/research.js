// Research tree funded by crises (pillar 1: crises fund your research).
//
// Research points (RP) come from two crisis-driven sources:
//   1. CRISIS GRANTS: a steady trickle every tick, set by the world's crisis level. It climbs as
//      the world gets worse, peaks just below the tipping point, and falls off once the world
//      tips (your labs and suppliers get caught in the chaos too).
//   2. CRISIS PROFITS: the part of every sale that exists only because the world is scared
//      (the crisis premium on the price) is ploughed into the labs: fundFromIncome($).
// RP is spent on projects from the data-driven tree in tree-data.js. A project fills from banked
// RP; buy() finishes one at once when the bank covers it. Finished projects apply their effects:
// amenities, schemes, crews, grid rows, shelter slots, scheme heat and luxury prices.
//
// Usage:
//   const tree = new ResearchTree();
//   tree.start('a_cryo');  /  tree.buy('a_cryo')
//   tree.tick(dtSeconds, crisisLevel /* 0..100 */);
//   tree.fundFromIncome(crisisPremiumDollars, 'Shelter sale');
//   tree.onUnlock((node) => ...);            // node.effects, node.unlocks = { type, id, label }
//   tree.isUnlocked('cryo_pod');             // amenity / scheme id
//   tree.effects()                           // { amenities, schemes, crews, gridRows, shelterSlots, schemeHeatMult, luxuryPriceMult }

import { BRANCHES, TREE_NODES, effectLabel } from './tree-data.js';

export { BRANCHES, effectLabel };
export const TIPPING_POINT = 90;

export const FUNDING = Object.freeze({
  grantBase: 0.15, // RP/s in a calm world
  grantPeak: 1.0, // RP/s just below the tipping point
  dollarsPerRP: 500, // crisis profits: $500 of crisis premium buys 1 RP
});

/** Crisis-grant RP per second at a crisis level (0..100). */
export function researchRate(crisis, f = FUNDING) {
  const c = Math.max(0, Math.min(100, crisis));
  const edge = TIPPING_POINT - 2;
  if (c <= edge) return f.grantBase + (f.grantPeak - f.grantBase) * (c / edge) ** 2;
  if (c < TIPPING_POINT) return f.grantPeak;
  // past the tipping point: chaos disrupts the labs, down to 40% of peak at 100
  return f.grantPeak * (1 - 0.6 * ((c - TIPPING_POINT) / (100 - TIPPING_POINT)));
}

export function researchZone(crisis) {
  if (crisis >= TIPPING_POINT) return { name: 'tipping', label: 'LABS DISRUPTED' };
  if (crisis >= 70) return { name: 'edge', label: 'CRISIS GRANTS POURING IN' };
  if (crisis >= 40) return { name: 'uneasy', label: 'FUNDING RISING' };
  return { name: 'calm', label: 'CALM WORLD, THIN FUNDING' };
}

/** Normalise data nodes: adds the legacy `unlocks` summary (first effect) for older callers. */
export function buildNodes(data = TREE_NODES) {
  return data.map((n) => {
    const first = n.effects[0];
    const id = first.id ?? `${n.id}_${first.type}`;
    return Object.freeze({ ...n, unlocks: { type: first.type, id, label: n.effects.map(effectLabel).join(' · ') } });
  });
}

export const RESEARCH_NODES = Object.freeze(buildNodes());

export class ResearchTree {
  constructor({ nodes = RESEARCH_NODES, baseCrews = 1, funding = FUNDING } = {}) {
    this.nodes = nodes;
    this.byId = new Map(nodes.map((n) => [n.id, n]));
    this.baseCrews = baseCrews;
    this.funding = funding;
    this.pool = 0; // banked RP not yet spent
    this.totalEarned = 0;
    this.sources = { grants: 0, income: 0 }; // RP earned, by source
    this.incomeLog = []; // recent crisis-profit deposits { label, dollars, rp }
    this.progress = new Map(); // nodeId -> RP spent
    this.done = new Set();
    this.active = null;
    this.rate = researchRate(0, funding);
    this.listeners = { unlock: new Set(), change: new Set(), fund: new Set() };
  }

  status(id) {
    if (this.done.has(id)) return 'done';
    if (this.active === id) return 'active';
    const node = this.byId.get(id);
    return node.requires.every((r) => this.done.has(r)) ? 'available' : 'locked';
  }

  remaining(id) {
    return this.byId.get(id).cost - (this.progress.get(id) ?? 0);
  }

  canAfford(id) {
    const s = this.status(id);
    return (s === 'available' || s === 'active') && this.pool >= this.remaining(id) - 1e-9;
  }

  /** Point the labs at a project; banked RP is spent into it straight away. */
  start(id) {
    const s = this.status(id);
    if (s !== 'available' && s !== 'active') return false;
    this.active = id;
    this.spendPool();
    this.emit('change');
    return true;
  }

  /** Spend banked RP to finish a project now. Returns false if the bank can't cover it. */
  buy(id) {
    if (!this.canAfford(id)) return false;
    const prev = this.active;
    this.active = id;
    this.spendPool();
    if (prev && prev !== id && !this.done.has(prev)) this.active = prev;
    this.emit('change');
    return true;
  }

  tick(dt, crisis) {
    this.rate = researchRate(crisis, this.funding);
    const gained = this.rate * dt;
    this.pool += gained;
    this.totalEarned += gained;
    this.sources.grants += gained;
    this.spendPool();
    this.emit('change');
  }

  /** Crisis profits: dollars that exist only because of the crisis go to the labs. */
  fundFromIncome(dollars, label = 'Crisis profits') {
    if (!(dollars > 0)) return 0;
    const rp = dollars / this.funding.dollarsPerRP;
    this.pool += rp;
    this.totalEarned += rp;
    this.sources.income += rp;
    const entry = { label, dollars: Math.round(dollars), rp: Math.round(rp) };
    this.incomeLog.unshift(entry);
    this.incomeLog.length = Math.min(this.incomeLog.length, 8);
    this.spendPool();
    this.emit('fund', entry);
    this.emit('change');
    return rp;
  }

  spendPool() {
    if (!this.active) return;
    const node = this.byId.get(this.active);
    const spent = this.progress.get(node.id) ?? 0;
    const use = Math.min(this.pool, node.cost - spent);
    this.pool -= use;
    this.progress.set(node.id, spent + use);
    if (spent + use >= node.cost - 1e-9) {
      this.done.add(node.id);
      this.active = null;
      this._effects = null;
      this.emit('unlock', node);
    }
  }

  fraction(id) {
    const node = this.byId.get(id);
    return Math.min(1, (this.progress.get(id) ?? 0) / node.cost);
  }

  /** Everything finished research grants, aggregated from the data. */
  effects() {
    if (this._effects) return this._effects;
    const fx = { amenities: new Set(), schemes: new Set(), crews: this.baseCrews, gridRows: 0, shelterSlots: 0, schemeHeatMult: 1, luxuryPriceMult: 1 };
    for (const id of this.done) {
      for (const e of this.byId.get(id).effects ?? []) {
        if (e.type === 'amenity') fx.amenities.add(e.id);
        else if (e.type === 'scheme') fx.schemes.add(e.id);
        else if (e.type === 'crew') fx.crews += e.amount;
        else if (e.type === 'grid_rows') fx.gridRows += e.amount;
        else if (e.type === 'shelter_slots') fx.shelterSlots += e.amount;
        else if (e.type === 'scheme_heat') fx.schemeHeatMult *= e.mult;
        else if (e.type === 'luxury_price') fx.luxuryPriceMult *= e.mult;
      }
    }
    this._effects = fx;
    return fx;
  }

  isUnlocked(unlockId) {
    const fx = this.effects();
    return fx.amenities.has(unlockId) || fx.schemes.has(unlockId);
  }

  /** Every unlock that research can provide, of an effect type ('amenity' | 'scheme' | ...). */
  researchable(type) {
    return this.nodes.flatMap((n) => n.effects.filter((e) => e.type === type).map((e) => ({ ...e, node: n.id, label: effectLabel(e) })));
  }

  /** Apply research to a scheme list: locked research schemes are dropped, heat is scaled. */
  applyToSchemes(schemes) {
    const fx = this.effects();
    return schemes
      .filter((s) => !s.research || fx.schemes.has(s.id))
      .map((s) => (fx.schemeHeatMult === 1 ? s : { ...s, heat: Math.round(s.heat * fx.schemeHeatMult) }));
  }

  get crewCount() {
    return this.effects().crews;
  }

  onUnlock(fn) { this.listeners.unlock.add(fn); return () => this.listeners.unlock.delete(fn); }
  onChange(fn) { this.listeners.change.add(fn); return () => this.listeners.change.delete(fn); }
  onFund(fn) { this.listeners.fund.add(fn); return () => this.listeners.fund.delete(fn); }
  emit(kind, payload) { for (const fn of this.listeners[kind]) fn(payload, this); }

  toJSON() {
    return { pool: this.pool, totalEarned: this.totalEarned, sources: this.sources, progress: [...this.progress], done: [...this.done], active: this.active };
  }

  load(data) {
    this.pool = data.pool ?? 0;
    this.totalEarned = data.totalEarned ?? 0;
    this.sources = { grants: 0, income: 0, ...(data.sources ?? {}) };
    this.progress = new Map(data.progress ?? []);
    this.done = new Set(data.done ?? []);
    this.active = data.active ?? null;
    this._effects = null;
    this.emit('change');
  }
}
