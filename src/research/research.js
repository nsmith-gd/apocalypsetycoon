// Research tree funded by crises (pillar 1: crises fund your research). GDD: Research, unlocks and
// fan-outs; Core loop > The crisis dividend.
//
// FUNDING  Research points (RP) are crisis income:
//   1. CRISIS GRANTS (the crisis dividend): every in-game week each crisis track pays RP by its band:
//      Simmer 2, Boil 6, Brink 15 (src/world/momentum.js BANDS). Breached or collapsed tracks pay nothing.
//      fundWeek(tracks). Two tracks at Brink pay 30 RP a week.
//   2. CRISIS PROFITS: the panic-premium part of every shelter sale is ploughed into the labs:
//      fundFromIncome(dollars).
//   (tick(dt, crisis) is the older continuous trickle, kept for demos and the pacing simulator.)
// SPENDING Projects come from the data in tree-data.js. Starting one pays its cash at once (ledger
//   "R&D: name"); its RP then flows in from the bank until it is paid ("there is no separate timer").
//   Tier 1 costs cash only and lands immediately. One project at a time.
// EFFECTS  Finished projects unlock bunker objects, structures and strata (the shelter grid), schemes
//   (the world map), client-package rooms, crews and scheme heat. Everything else is the starter kit.
//
//   const tree = new ResearchTree({ ledger });
//   tree.start('a_hydro') / tree.buy('a_hydro') / tree.blocker('a_hydro')
//   tree.fundWeek(Object.values(crisis.tracks));   tree.fundFromIncome(premiumDollars, 'sale');
//   tree.canBuild('hepa')  tree.canDig('clay')  tree.isUnlocked('astroturf' | 'cryo_pod')  tree.crewCount

import { BRANCHES, TREE_NODES, STARTER, effectLabel } from './tree-data.js';
import { bandOf } from '../world/momentum.js';

export { BRANCHES, STARTER, effectLabel };
export const TIPPING_POINT = 90;

export const FUNDING = Object.freeze({
  grantBase: 0.15, // tick(): RP/s in a calm world (demos and the pacing simulator)
  grantPeak: 1.0, // tick(): RP/s just below the tipping point
  dollarsPerRP: 50_000, // crisis profits: $50K of panic premium buys 1 RP (#91: GDD scale)
  noGrantStates: ['breach', 'locked', 'collapsed'], // "the track's grants stop"
});

/** Continuous RP per second at a crisis level (0..100), for tick(). */
export function researchRate(crisis, f = FUNDING) {
  const c = Math.max(0, Math.min(100, crisis));
  const edge = TIPPING_POINT - 2;
  if (c <= edge) return f.grantBase + (f.grantPeak - f.grantBase) * (c / edge) ** 2;
  if (c < TIPPING_POINT) return f.grantPeak;
  return f.grantPeak * (1 - 0.6 * ((c - TIPPING_POINT) / (100 - TIPPING_POINT)));
}

export function researchZone(crisis) {
  if (crisis >= TIPPING_POINT) return { name: 'tipping', label: 'LABS DISRUPTED' };
  if (crisis >= 70) return { name: 'edge', label: 'CRISIS GRANTS POURING IN' };
  if (crisis >= 40) return { name: 'uneasy', label: 'FUNDING RISING' };
  return { name: 'calm', label: 'CALM WORLD, THIN FUNDING' };
}

/** Weekly crisis grants for a set of tracks ({ id, name?, tension, state? }), itemised. */
export function weeklyGrants(tracks, f = FUNDING) {
  const lines = [];
  for (const t of tracks ?? []) {
    if (t.open === false || f.noGrantStates.includes(t.state)) continue; // not in play yet, or breached
    const band = bandOf(t.tension ?? 0);
    if (band.grantRP > 0) lines.push({ track: t.id, name: t.name ?? t.id, band: band.name, rp: band.grantRP });
  }
  return { total: lines.reduce((s, l) => s + l.rp, 0), lines };
}

/** Problems with the tree data (empty list when fine). */
export function validateTree(nodes = TREE_NODES) {
  const bad = [];
  const ids = new Set();
  for (const nd of nodes) {
    if (ids.has(nd.id)) bad.push(`duplicate id ${nd.id}`);
    ids.add(nd.id);
    if (!BRANCHES[nd.branch]) bad.push(`${nd.id}: unknown branch ${nd.branch}`);
    if (!(nd.tier >= 1 && nd.tier <= 5)) bad.push(`${nd.id}: tier`);
    if (nd.tier === 1 && nd.rp !== 0) bad.push(`${nd.id}: tier 1 costs cash only`);
    if (nd.tier > 1 && !(nd.rp > 0)) bad.push(`${nd.id}: needs an RP cost`);
    if (!nd.effects?.length) bad.push(`${nd.id}: no effects`);
  }
  for (const nd of nodes) for (const r of nd.requires) if (!ids.has(r)) bad.push(`${nd.id}: requires unknown ${r}`);
  return bad;
}

/** Normalise data nodes: `cost` (= rp, for older callers) and the legacy `unlocks` summary. */
export function buildNodes(data = TREE_NODES) {
  return data.map((nd) => {
    const first = nd.effects[0];
    return Object.freeze({ ...nd, cost: nd.rp, unlocks: { type: first.type, id: first.id ?? `${nd.id}_${first.type}`, label: nd.effects.map((e) => effectLabel(e)).join(' · ') } });
  });
}

export const RESEARCH_NODES = Object.freeze(buildNodes());

export class ResearchTree {
  constructor({ nodes = RESEARCH_NODES, baseCrews = 1, funding = FUNDING, ledger = null, starter = STARTER } = {}) {
    this.nodes = nodes;
    this.byId = new Map(nodes.map((nd) => [nd.id, nd]));
    this.baseCrews = baseCrews;
    this.funding = funding;
    this.ledger = ledger;
    this.starter = starter;
    this.pool = 0; // banked RP not yet spent
    this.totalEarned = 0;
    this.sources = { grants: 0, income: 0 };
    this.incomeLog = []; // recent deposits { label, rp, dollars? }
    this.lastWeek = { total: 0, lines: [] }; // last weekly grant, for the panel
    this.progress = new Map(); // nodeId -> RP paid
    this.paid = new Set(); // nodes whose cash has been paid
    this.done = new Set();
    this.active = null;
    this.rate = researchRate(0, funding);
    this.listeners = { unlock: new Set(), change: new Set(), fund: new Set() };
  }

  status(id) {
    if (this.done.has(id)) return 'done';
    if (this.active === id) return 'active';
    return this.byId.get(id).requires.every((r) => this.done.has(r)) ? 'available' : 'locked';
  }

  remaining(id) { return this.byId.get(id).rp - (this.progress.get(id) ?? 0); }

  /** Why a project can't be started right now (null if it can). */
  blocker(id) {
    const nd = this.byId.get(id);
    if (!nd) return 'Unknown project';
    const s = this.status(id);
    if (s === 'done') return 'Already researched';
    if (s === 'locked') return `Needs ${nd.requires.filter((r) => !this.done.has(r)).map((r) => this.byId.get(r).name).join(' + ')}`;
    if (this.active && this.active !== id) return `The lab is busy with ${this.byId.get(this.active).name}`;
    if (!this.paid.has(id) && this.ledger && nd.cash > this.ledger.cash) return 'Not enough cash';
    return null;
  }

  canAfford(id) {
    const s = this.status(id);
    return (s === 'available' || s === 'active') && this.pool >= this.remaining(id) - 1e-9 && (this.paid.has(id) || !this.ledger || this.byId.get(id).cash <= this.ledger.cash);
  }

  /** Point the lab at a project: pays its cash, then banked RP flows in. Tier 1 lands at once. */
  start(id) {
    const s = this.status(id);
    if (s !== 'available' && s !== 'active') return false;
    if (this.active && this.active !== id) return false;
    const nd = this.byId.get(id);
    if (!this.paid.has(id)) {
      if (this.ledger && nd.cash > this.ledger.cash) return false;
      if (this.ledger && nd.cash) this.ledger.record('research', `R&D: ${nd.name}`, -nd.cash);
      this.paid.add(id);
    }
    this.active = id;
    this.spendPool();
    this.emit('change');
    return true;
  }

  /** Spend banked RP to finish a project now (only if the bank covers it). */
  buy(id) {
    if (!this.canAfford(id)) return false;
    if (this.active && this.active !== id) return false;
    return this.start(id) && this.done.has(id);
  }

  /** Drop the active project (its paid cash and RP stay with it). */
  pause() { this.active = null; this.emit('change'); }

  _deposit(rp, source, entry) {
    if (!(rp > 0)) return 0;
    this.pool += rp;
    this.totalEarned += rp;
    this.sources[source] += rp;
    if (entry) { this.incomeLog.unshift(entry); this.incomeLog.length = Math.min(this.incomeLog.length, 8); this.emit('fund', entry); }
    this.spendPool();
    this.emit('change');
    return rp;
  }

  /** The crisis dividend: one week of grants from every track's band. */
  fundWeek(tracks) {
    const g = weeklyGrants(tracks, this.funding);
    this.lastWeek = g;
    this._deposit(g.total, 'grants', g.total ? { label: 'Crisis grants', rp: g.total, lines: g.lines } : null);
    if (!g.total) this.emit('change');
    return g;
  }

  /** Crisis profits: dollars that exist only because of the panic go to the labs. */
  fundFromIncome(dollars, label = 'Crisis profits') {
    if (!(dollars > 0)) return 0;
    const rp = dollars / this.funding.dollarsPerRP;
    return this._deposit(rp, 'income', { label, dollars: Math.round(dollars), rp: Math.round(rp * 10) / 10 });
  }

  /** Older continuous trickle (demos, pacing simulator). */
  tick(dt, crisis) {
    this.rate = researchRate(crisis, this.funding);
    const gained = this.rate * dt;
    this.pool += gained;
    this.totalEarned += gained;
    this.sources.grants += gained;
    this.spendPool();
    this.emit('change');
  }

  spendPool() {
    if (!this.active) return;
    const nd = this.byId.get(this.active);
    const spent = this.progress.get(nd.id) ?? 0;
    const use = Math.min(this.pool, nd.rp - spent);
    this.pool -= use;
    this.progress.set(nd.id, spent + use);
    if (spent + use >= nd.rp - 1e-9) {
      this.done.add(nd.id);
      this.active = null;
      this._effects = null;
      this.emit('unlock', nd);
    }
  }

  fraction(id) {
    const nd = this.byId.get(id);
    return nd.rp ? Math.min(1, (this.progress.get(id) ?? 0) / nd.rp) : (this.done.has(id) ? 1 : 0);
  }

  /** Everything finished research grants, aggregated from the data, plus the starter kit. */
  effects() {
    if (this._effects) return this._effects;
    const fx = {
      objects: new Set(this.starter.objects), structures: new Set(this.starter.structures), strata: new Set(this.starter.strata),
      schemes: new Set(), amenities: new Set(), crews: this.baseCrews, schemeHeatMult: 1,
    };
    for (const id of this.done) {
      for (const e of this.byId.get(id).effects ?? []) {
        if (e.type === 'object') fx.objects.add(e.id);
        else if (e.type === 'structure') fx.structures.add(e.id);
        else if (e.type === 'stratum') fx.strata.add(e.id);
        else if (e.type === 'scheme') fx.schemes.add(e.id);
        else if (e.type === 'amenity') fx.amenities.add(e.id);
        else if (e.type === 'crew') fx.crews += e.amount;
        else if (e.type === 'scheme_heat') fx.schemeHeatMult *= e.mult;
      }
    }
    this._effects = fx;
    return fx;
  }

  /** Scheme or client-package room unlocked? (World map schemes, client orders.) */
  isUnlocked(unlockId) {
    const fx = this.effects();
    return fx.amenities.has(unlockId) || fx.schemes.has(unlockId);
  }

  /** Shelter grid hooks: may this object / structure be built, this stratum dug? */
  canBuild(objectId) { return this.effects().objects.has(objectId) || !this.gates('object', objectId); }
  canBuildStructure(id) { return this.effects().structures.has(id) || !this.gates('structure', id); }
  canDig(stratumId) { return this.effects().strata.has(stratumId) || !this.gates('stratum', stratumId); }
  /** The node that unlocks this (type, id), or null if no research gates it. */
  gates(type, id) { return this.nodes.find((nd) => nd.effects.some((e) => e.type === type && e.id === id)) ?? null; }

  /** Player-facing reason a locked thing can't be used yet. */
  lockedReason(type, id) {
    const nd = this.gates(type, id);
    return nd ? `Needs research: ${nd.name} (${BRANCHES[nd.branch]}, tier ${nd.tier})` : null;
  }

  /** Every unlock that research can provide, of an effect type. */
  researchable(type) {
    return this.nodes.flatMap((nd) => nd.effects.filter((e) => e.type === type).map((e) => ({ ...e, node: nd.id, label: effectLabel(e) })));
  }

  /** Apply research to a scheme list: locked research schemes are dropped, heat is scaled. */
  applyToSchemes(schemes) {
    const fx = this.effects();
    return schemes
      .filter((s) => !s.research || fx.schemes.has(s.id))
      .map((s) => (fx.schemeHeatMult === 1 ? s : { ...s, heat: Math.round(s.heat * fx.schemeHeatMult) }));
  }

  get crewCount() { return this.effects().crews; }
  get schemeHeatMult() { return this.effects().schemeHeatMult; }

  onUnlock(fn) { this.listeners.unlock.add(fn); return () => this.listeners.unlock.delete(fn); }
  onChange(fn) { this.listeners.change.add(fn); return () => this.listeners.change.delete(fn); }
  onFund(fn) { this.listeners.fund.add(fn); return () => this.listeners.fund.delete(fn); }
  emit(kind, payload) { for (const fn of this.listeners[kind]) fn(payload, this); }

  toJSON() {
    return { pool: this.pool, totalEarned: this.totalEarned, sources: this.sources, progress: [...this.progress], paid: [...this.paid], done: [...this.done], active: this.active };
  }

  load(data) {
    this.pool = data.pool ?? 0;
    this.totalEarned = data.totalEarned ?? 0;
    this.sources = { grants: 0, income: 0, ...(data.sources ?? {}) };
    this.progress = new Map(data.progress ?? []);
    this.paid = new Set(data.paid ?? []);
    this.done = new Set((data.done ?? []).filter((id) => this.byId.has(id)));
    this.active = this.byId.has(data.active) ? data.active : null;
    this._effects = null;
    this.emit('change');
  }
}
