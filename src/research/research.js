// Research tree funded by crises (pillar 1: crises fund your research).
//
// Research points (RP) accrue every tick at a rate set by the world's crisis level.
// The curve mirrors the profit-at-the-edge idea: RP climbs steeply as the world gets
// worse, peaks just below the tipping point, and falls off once the world tips
// (your labs and suppliers get caught in the chaos too).
//
// Usage:
//   const tree = new ResearchTree();
//   tree.start('a_cryo');
//   tree.tick(dtSeconds, crisisLevel /* 0..100 */);
//   tree.onUnlock((node) => ...);           // node.unlocks = { type, id, label }
//   tree.isUnlocked('cryo_pod');            // by unlock id (amenity / scheme id)
//   tree.crewCount                           // base crews + researched crews

export const TIPPING_POINT = 90;

/** RP per second at a crisis level (0..100). */
export function researchRate(crisis) {
  const c = Math.max(0, Math.min(100, crisis));
  const base = 0.5;
  const peak = 4.5; // reached just below the tipping point
  const edge = TIPPING_POINT - 2;
  if (c <= edge) return base + (peak - base) * (c / edge) ** 2;
  if (c < TIPPING_POINT) return peak;
  // past the tipping point: chaos disrupts the labs, down to 40% of peak at 100
  return peak * (1 - 0.6 * ((c - TIPPING_POINT) / (100 - TIPPING_POINT)));
}

export function researchZone(crisis) {
  if (crisis >= TIPPING_POINT) return { name: 'tipping', label: 'LABS DISRUPTED' };
  if (crisis >= 70) return { name: 'edge', label: 'CRISIS GRANTS POURING IN' };
  if (crisis >= 40) return { name: 'uneasy', label: 'FUNDING RISING' };
  return { name: 'calm', label: 'CALM WORLD, THIN FUNDING' };
}

export const BRANCHES = Object.freeze({
  amenities: 'Amenities',
  schemes: 'Schemes',
  crews: 'Build crews',
});

// Costs assume ~27 real minutes per quarter: tier 1 takes ~1-3 min at an uneasy world,
// the top of each branch needs several quarters near the edge.
export const RESEARCH_NODES = Object.freeze([
  // Amenities (what clients want, and what Midnight grades)
  { id: 'a_hydro', branch: 'amenities', name: 'Hydroponic garden', cost: 150, requires: [], unlocks: { type: 'amenity', id: 'hydroponics', label: 'Hydroponic garden' }, blurb: 'Fresh food for decades. Grades well at Midnight.' },
  { id: 'a_water', branch: 'amenities', name: 'Deep-well recycler', cost: 220, requires: [], unlocks: { type: 'amenity', id: 'water_recycler', label: 'Deep-well recycler' }, blurb: 'Clean water without the surface.' },
  { id: 'a_cryo', branch: 'amenities', name: 'Cryo pod suite', cost: 350, requires: ['a_hydro'], unlocks: { type: 'amenity', id: 'cryo_pod', label: 'Cryo pod suite' }, blurb: 'Sleep through the worst of it. Clients adore it.' },
  { id: 'a_scrubber', branch: 'amenities', name: 'Military air scrubber', cost: 480, requires: ['a_water'], unlocks: { type: 'amenity', id: 'mil_scrubber', label: 'Military air scrubber' }, blurb: 'Filters fallout, spores and bad press.' },
  { id: 'a_cellar', branch: 'amenities', name: 'Wine cellar & panic room', cost: 400, requires: ['a_cryo'], unlocks: { type: 'amenity', id: 'wine_cellar', label: 'Wine cellar & panic room' }, blurb: 'Pure prestige. Midnight does not care.' },
  { id: 'a_butler', branch: 'amenities', name: 'AI butler core', cost: 1100, requires: ['a_cellar', 'a_scrubber'], unlocks: { type: 'amenity', id: 'ai_butler', label: 'AI butler core' }, blurb: 'Runs the bunker. Mostly obeys.' },

  // Schemes (new ways to stoke crises)
  { id: 's_thinktank', branch: 'schemes', name: 'Astroturf think tank', cost: 180, requires: [], unlocks: { type: 'scheme', id: 'astroturf', label: 'Astroturf think tank' }, blurb: 'Experts agree: things look bad.' },
  { id: 's_deepfake', branch: 'schemes', name: 'Deepfake broadcast', cost: 450, requires: ['s_thinktank'], unlocks: { type: 'scheme', id: 'deepfake', label: 'Deepfake broadcast' }, blurb: 'A president says the quiet part loud.' },
  { id: 's_shortage', branch: 'schemes', name: 'Engineered shortage', cost: 750, requires: ['s_deepfake'], unlocks: { type: 'scheme', id: 'shortage', label: 'Engineered shortage' }, blurb: 'Empty shelves sell full bunkers.' },
  { id: 's_blackout', branch: 'schemes', name: 'Grid blackout', cost: 1300, requires: ['s_shortage'], unlocks: { type: 'scheme', id: 'blackout', label: 'Grid blackout' }, blurb: 'Lights out. Phones ring.' },

  // Build crews
  { id: 'c_crew2', branch: 'crews', name: 'Second shovel crew', cost: 200, requires: [], unlocks: { type: 'crew', id: 'crew_2', label: '+1 build crew' }, blurb: 'Two holes at once.' },
  { id: 'c_borer', branch: 'crews', name: 'Tunnel boring machine', cost: 600, requires: ['c_crew2'], unlocks: { type: 'crew', id: 'crew_3', label: '+1 build crew' }, blurb: 'A crew that never sleeps.' },
  { id: 'c_crew4', branch: 'crews', name: 'Black-site contractors', cost: 1000, requires: ['c_borer'], unlocks: { type: 'crew', id: 'crew_4', label: '+1 build crew' }, blurb: 'No questions, no paperwork.' },
]);

export class ResearchTree {
  constructor({ nodes = RESEARCH_NODES, baseCrews = 1 } = {}) {
    this.nodes = nodes;
    this.byId = new Map(nodes.map((n) => [n.id, n]));
    this.baseCrews = baseCrews;
    this.pool = 0; // banked RP not yet spent
    this.totalEarned = 0;
    this.progress = new Map(); // nodeId -> RP spent
    this.done = new Set();
    this.active = null;
    this.rate = researchRate(0);
    this.listeners = { unlock: new Set(), change: new Set() };
  }

  status(id) {
    if (this.done.has(id)) return 'done';
    if (this.active === id) return 'active';
    const node = this.byId.get(id);
    return node.requires.every((r) => this.done.has(r)) ? 'available' : 'locked';
  }

  start(id) {
    const s = this.status(id);
    if (s !== 'available' && s !== 'active') return false;
    this.active = id;
    this.spendPool();
    this.emit('change');
    return true;
  }

  tick(dt, crisis) {
    this.rate = researchRate(crisis);
    const gained = this.rate * dt;
    this.pool += gained;
    this.totalEarned += gained;
    this.spendPool();
    this.emit('change');
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
      this.emit('unlock', node);
    }
  }

  fraction(id) {
    const node = this.byId.get(id);
    return Math.min(1, (this.progress.get(id) ?? 0) / node.cost);
  }

  isUnlocked(unlockId) {
    for (const id of this.done) if (this.byId.get(id).unlocks.id === unlockId) return true;
    return false;
  }

  /** Every unlock id that research can provide, of a type ('amenity' | 'scheme' | 'crew'). */
  researchable(type) {
    return this.nodes.filter((n) => n.unlocks.type === type).map((n) => n.unlocks);
  }

  get crewCount() {
    return this.baseCrews + [...this.done].filter((id) => this.byId.get(id).unlocks.type === 'crew').length;
  }

  onUnlock(fn) { this.listeners.unlock.add(fn); return () => this.listeners.unlock.delete(fn); }
  onChange(fn) { this.listeners.change.add(fn); return () => this.listeners.change.delete(fn); }
  emit(kind, payload) { for (const fn of this.listeners[kind]) fn(payload, this); }

  toJSON() {
    return { pool: this.pool, totalEarned: this.totalEarned, progress: [...this.progress], done: [...this.done], active: this.active };
  }

  load(data) {
    this.pool = data.pool ?? 0;
    this.totalEarned = data.totalEarned ?? 0;
    this.progress = new Map(data.progress ?? []);
    this.done = new Set(data.done ?? []);
    this.active = data.active ?? null;
    this.emit('change');
  }
}
