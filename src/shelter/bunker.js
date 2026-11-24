// BunkerSite: a RimWorld-style, tile-by-tile bunker. Pure rules, no DOM.
// GDD: Shelter canvas (Grid spec, Strata, Life systems, Build rules, Construction flow).
//
// THE GRID  1 m tiles, `width` wide (16 Solo Pod ... 64 Ark), `depth` metres deep, plus `sky` rows above
//           ground (y < 0) for surface objects. y = depth in metres.
// ORDERS    dig(x, y) | build('wall'|'spine', x, y) | conduit('air'|'water'|'power', x, y) | place(id, x, y)
//           | remove(x, y). Every order is paid up front and queued; cancelling an unfinished job refunds it.
//           Rect helpers: digRect, buildRect, conduitLine.
// CREWS     work the queue in order. A job is workable only when the crew can reach it from the surface
//           through dug, open tiles (so you dig down from the surface or the spine), and building on a
//           tile waits for its dig. Dig time = 1 / stratum crew speed (tiles per day).
// ROOMS     any space enclosed by walls, doors, the spine or raw rock is a room. Its type comes from what is
//           inside (bunks -> Bunk Room, shelves -> Pantry ...). Impressiveness = beauty + space - noise -
//           raw-rock walls - cramping. Raw rock below the 12 m water table seeps unless a sump pump runs.
// NETWORKS  air ducts, water pipes and power cables laid per tile (the spine carries all three). Machines
//           work only when their footprint touches the conduits they need; power networks shed load by
//           priority when short.
// SEALED    occupants = beds. Days Sealed = min over air (CO2 buffer), water, food, power (fuel, battery).
//           Ratings: seal, blast (stratum + best blast door above the bedrooms), security (0-5), morale (0-100).
// FLOW      survey (1 week) -> dig -> shell -> fit-out -> pressure test (30 days) -> walkthrough -> handover.

import { ResidentSim } from './residents.js';
import { STRATA, stratumAt, STRUCTURES, CONDUITS, OBJECTS, ROOM_TYPES, NEEDS, ROOM_DEPTH_M, WATER_TABLE_M, fitDays, LAYERS, layerOf, FINISHES, variantsFor } from './bunker-catalog.js';

export const BUNKER = Object.freeze({
  width: 24, // Family Vault plot
  depth: 40,
  sky: 5,
  daySeconds: 120 / 7, // GDD: a week is 120 s at 1x
  surveyDays: 7,
  pressureTestDays: 30,
  noiseRadius: 6,
  priority: { air: 0, water: 1, food: 2, power: 3, medical: 4, security: 5, kitchen: 6, bath: 6, comfort: 8, decor: 9, status: 10, sleep: 7 },
});

const NET_TYPES = ['air', 'water', 'power'];
const BIT = { air: 1, water: 2, power: 4 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class BunkerSite {
  // research (#16): canBuild(objectId), canBuildStructure(id), canDig(stratumId), lockedReason(type, id).
  // All default to open, so demos and tests without a research tree are unaffected.
  constructor({ ledger = null, crews = () => 1, costMultiplier = () => 1, cfg = {}, surveyed = false, name = 'Last Resort HQ', research = null } = {}) {
    this.research = research;
    this.cfg = { ...BUNKER, ...cfg };
    this.W = this.cfg.width;
    this.H = this.cfg.depth;
    this.S = this.cfg.sky;
    this.ledger = ledger;
    this.crews = crews;
    this.costMultiplier = costMultiplier;
    this.name = name;
    this.listeners = new Set();
    this.handedOver = 0;
    this.reset(surveyed);
  }

  reset(surveyed = false) {
    const n = this.W * (this.H + this.S);
    this.dug = new Uint8Array(n); // 1 = excavated
    this.structure = new Array(n).fill(null); // 'wall' | 'spine'
    this.conduits = new Uint8Array(n); // bitmask air/water/power
    // object ids per layer (0 = none): rugs under, furniture, back-wall decor, ceiling fixtures
    this.layers = Object.fromEntries(LAYERS.map((l) => [l, new Int32Array(n).fill(0)]));
    this.occupant = this.layers.floor; // the furniture layer (what blocks walls and other furniture)
    // interior finishes per tile (null = bare): back wall, floor, room lighting
    this.finish = { wall: new Array(n).fill(null), floor: new Array(n).fill(null), light: new Array(n).fill(null) };
    this.objects = new Map(); // id -> { id, kind, x, y, built }
    this.jobs = [];
    this._id = 1;
    this.surveyed = surveyed;
    this.surveyLeft = surveyed ? 0 : this.cfg.surveyDays;
    this.pressureTest = null; // { daysLeft, result }
    this.people = new ResidentSim(this, { seed: 7 + (this.handedOver ?? 0) }); // the billionaires who live here
    this.day = 0;
    this._version = 0;
    this._cache = null;
  }

  // ---------- geometry ----------
  inside(x, y) { return x >= 0 && x < this.W && y >= -this.S && y < this.H; }
  idx(x, y) { return (y + this.S) * this.W + x; }
  isSky(x, y) { return y < 0; }
  stratum(y) { return stratumAt(Math.max(0, y)); }
  isDug(x, y) { return y < 0 || this.dug[this.idx(x, y)] === 1; }
  isSolid(x, y) { return !this.inside(x, y) ? true : y >= 0 && (!this.isDug(x, y) || this.structure[this.idx(x, y)] === 'wall'); }
  objectAt(x, y, layer = 'floor') { const id = this.inside(x, y) ? this.layers[layer][this.idx(x, y)] : 0; return id ? this.objects.get(id) : null; }
  /** Everything on a tile, top layer first. */
  objectsAt(x, y) { return ['ceiling', 'wall', 'floor', 'rug'].map((l) => this.objectAt(x, y, l)).filter(Boolean); }
  /** Open for walking and for air: dug (or sky), not a wall. Spine, doors and furniture are passable. */
  passable(x, y) {
    if (!this.inside(x, y)) return false;
    if (y < 0) return true;
    const i = this.idx(x, y);
    return this.dug[i] === 1 && this.structure[i] !== 'wall';
  }

  // ---------- money ----------
  _charge(label, amount, category = 'builds') {
    const cost = Math.round(amount * this.costMultiplier());
    if (cost) this.ledger?.record(category, label, -cost);
    return cost;
  }
  _refund(label, amount, category = 'builds') { if (amount) this.ledger?.record(category, `Refund: ${label}`, amount); }

  // ---------- orders ----------
  _queue(job) {
    const j = { id: this._id++, progress: 0, ...job };
    this.jobs.push(j);
    this._changed();
    return j;
  }
  _plannedDig(x, y) { return this.jobs.some((j) => j.type === 'dig' && j.x === x && j.y === y); }
  _willBeDug(x, y) { return this.isDug(x, y) || this._plannedDig(x, y); }

  digCost(x, y) { return y < 0 ? 0 : this.stratum(y).digCost; }

  /** Order a tile dug. */
  dig(x, y) {
    if (!this.inside(x, y) || y < 0) return { ok: false, reason: 'Nothing to dig there' };
    if (this._willBeDug(x, y)) return { ok: false, reason: 'Already dug or ordered' };
    const s = this.stratum(y);
    if (this.research && !this.research.canDig(s.id)) return { ok: false, reason: this.research.lockedReason?.('stratum', s.id) ?? `Research ${s.name} digging first` };
    const paid = this._charge(`Dig ${s.name} at ${y} m`, s.digCost);
    return { ok: true, job: this._queue({ type: 'dig', x, y, days: 1 / s.speed, paid, label: `Dig (${s.name})` }) };
  }

  digRect(x0, y0, x1, y1) {
    let n = 0;
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (this.dig(x, y).ok) n++;
    return n;
  }

  /** Order a wall/slab or a spine tile. The tile must be dug (or ordered dug) and free. */
  build(kind, x, y) {
    const def = STRUCTURES[kind];
    if (!def || !this.inside(x, y) || y < 0) return { ok: false, reason: 'Cannot build there' };
    if (this.research && !this.research.canBuildStructure(kind)) return { ok: false, reason: this.research.lockedReason?.('structure', kind) ?? `Research ${def.name} first` };
    if (!this._willBeDug(x, y)) return { ok: false, reason: 'Dig the tile first' };
    if (this.structure[this.idx(x, y)] || this.jobs.some((j) => j.type === 'build' && j.x === x && j.y === y)) return { ok: false, reason: 'Already built' };
    if (LAYERS.some((l) => this.layers[l][this.idx(x, y)]) || this._plannedObjectAt(x, y)) return { ok: false, reason: 'Something is in the way' };
    const paid = this._charge(def.name, def.cost);
    return { ok: true, job: this._queue({ type: 'build', kind, x, y, days: def.days, paid, label: def.name }) };
  }

  buildRect(kind, x0, y0, x1, y1, { outline = false } = {}) {
    let n = 0;
    const [ax, bx, ay, by] = [Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1)];
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
      if (outline && x !== ax && x !== bx && y !== ay && y !== by) continue;
      if (this.build(kind, x, y).ok) n++;
    }
    return n;
  }

  /** Lay a conduit on a dug tile (inside walls too) or the surface. */
  conduit(net, x, y) {
    const def = CONDUITS[net];
    if (!def || !this.inside(x, y)) return { ok: false, reason: 'Cannot lay that there' };
    if (y >= 0 && !this._willBeDug(x, y)) return { ok: false, reason: 'Dig the tile first' };
    const i = this.idx(x, y);
    if (this.conduits[i] & BIT[net] || this.jobs.some((j) => j.type === 'conduit' && j.net === net && j.x === x && j.y === y)) return { ok: false, reason: 'Already laid' };
    const paid = this._charge(def.name, def.cost);
    return { ok: true, job: this._queue({ type: 'conduit', net, x, y, days: def.days, paid, label: def.name }) };
  }

  conduitLine(net, x0, y0, x1, y1) {
    // L-shaped run: horizontal first, then vertical
    let n = 0;
    const sx = Math.sign(x1 - x0) || 1;
    for (let x = x0; x !== x1 + sx; x += sx) if (this.conduit(net, x, y0).ok) n++;
    const sy = Math.sign(y1 - y0) || 1;
    for (let y = y0 + sy; y !== y1 + sy; y += sy) if (this.conduit(net, x1, y).ok) n++;
    return n;
  }

  _plannedObjectAt(x, y, layer = null) {
    return this.jobs.some((j) => j.type === 'object' && (!layer || layerOf(OBJECTS[j.kind]) === layer) && x >= j.x && x < j.x + OBJECTS[j.kind].w && y <= j.y && y > j.y - OBJECTS[j.kind].h);
  }

  /**
   * Can object `kind` sit with its bottom-left tile at (x, y)? (y is the bottom row; it occupies rows
   * y-h+1 .. y.) Checks bounds, surface/depth rules, support underneath and overlaps.
   */
  canPlace(kind, x, y) {
    const o = OBJECTS[kind];
    if (!o) return { ok: false, reason: 'Unknown object' };
    if (this.research && !this.research.canBuild(kind)) return { ok: false, reason: this.research.lockedReason?.('object', kind) ?? `Research ${o.name} first` };
    const top = y - o.h + 1;
    if (!this.inside(x, top) || !this.inside(x + o.w - 1, y)) return { ok: false, reason: 'Off the plot' };
    if (o.surface) { if (y !== -1) return { ok: false, reason: `${o.name} goes on the surface` }; }
    else if (top < 0) return { ok: false, reason: `${o.name} goes underground` };
    if (o.minDepth && y < o.minDepth) return { ok: false, reason: `${o.name} needs ${o.minDepth} m or deeper` };
    const layer = layerOf(o);
    const wallAt = (xx, yy) => this.structure[this.idx(xx, yy)] === 'wall' || this.jobs.some((j) => j.type === 'build' && j.kind === 'wall' && j.x === xx && j.y === yy);
    for (let yy = top; yy <= y; yy++) for (let xx = x; xx < x + o.w; xx++) {
      if (yy >= 0 && !this._willBeDug(xx, yy)) return { ok: false, reason: 'Dig out the space first' };
      const i = this.idx(xx, yy);
      if (wallAt(xx, yy)) return { ok: false, reason: 'A wall is in the way' };
      if (layer !== 'floor' && this.structure[i] === 'spine') return { ok: false, reason: 'Not on the spine' };
      if (this.layers[layer][i] || this._plannedObjectAt(xx, yy, layer)) return { ok: false, reason: 'Something is already there' };
    }
    if (layer === 'wall') return { ok: true }; // hangs on the back wall: no floor needed, sits over furniture
    if (layer === 'ceiling') {
      for (let xx = x; xx < x + o.w; xx++) {
        const above = top - 1;
        if (!(above < -this.S || (above >= 0 && (!this._willBeDug(xx, above) || wallAt(xx, above))))) return { ok: false, reason: 'It hangs from a ceiling' };
      }
      return { ok: true };
    }
    for (let xx = x; xx < x + o.w; xx++) {
      const below = y + 1;
      const solid = !this.inside(xx, below) || (below >= 0 && (!this._willBeDug(xx, below) || this.structure[this.idx(xx, below)] === 'wall' || this.jobs.some((j) => j.type === 'build' && j.kind === 'wall' && j.x === xx && j.y === below)));
      if (!solid) return { ok: false, reason: 'It needs a floor to stand on' };
    }
    return { ok: true };
  }

  place(kind, x, y, { variant = null, flip = false } = {}) {
    const c = this.canPlace(kind, x, y);
    if (!c.ok) return c;
    const o = OBJECTS[kind];
    const paid = this._charge(o.name, o.cost);
    const v = variant ?? variantsFor(kind)[0].id;
    return { ok: true, job: this._queue({ type: 'object', kind, x, y, variant: v, flip: !!flip, days: layerOf(o) === 'floor' ? fitDays(o) : 0.25, paid, label: `Fit ${o.name}` }) };
  }

  /** Recolour an installed object (or a queued one) to one of its variants. Free, instant. */
  recolor(objOrJob, variantId = null) {
    const list = variantsFor(objOrJob.kind);
    const i = list.findIndex((v) => v.id === objOrJob.variant);
    objOrJob.variant = variantId ?? list[(i + 1) % list.length].id;
    this._changed({ type: 'recolor' });
    return objOrJob.variant;
  }
  flip(objOrJob) { objOrJob.flip = !objOrJob.flip; this._changed({ type: 'flip' }); return objOrJob.flip; }

  /**
   * Finish a room like The Sims: `kind` wall | floor | light, applied to every tile of the room that
   * (x, y) is in (or just that tile with { single: true }). Charged per tile, applied at once.
   */
  paint(kind, finishId, x, y, { single = false } = {}) {
    const def = FINISHES[kind]?.[finishId];
    if (!def || !this.inside(x, y) || y < 0) return { ok: false, reason: 'Nothing to finish there' };
    let tiles;
    if (single) tiles = this.passable(x, y) && this.structure[this.idx(x, y)] !== 'spine' ? [[x, y]] : [];
    else {
      const { rooms, roomOf } = this.rooms();
      const r = rooms[roomOf[this.idx(x, y)]];
      tiles = r && !r.touchesSky ? r.tiles : [];
    }
    if (!tiles.length) return { ok: false, reason: 'Click inside a room' };
    const todo = tiles.filter(([tx, ty]) => this.finish[kind][this.idx(tx, ty)] !== finishId);
    const cost = this._charge(`${def.name} (${todo.length} m²)`, def.cost * todo.length);
    for (const [tx, ty] of todo) this.finish[kind][this.idx(tx, ty)] = finishId === 'concrete' || finishId === 'plain' ? null : finishId;
    this._changed({ type: 'paint' });
    return { ok: true, tiles: todo.length, cost };
  }

  /** Cancel a queued job on a tile (full refund) or deconstruct what's there (50% back on objects). */
  remove(x, y) {
    const j = [...this.jobs].reverse().find((k) => (k.type === 'object' ? x >= k.x && x < k.x + OBJECTS[k.kind].w && y <= k.y && y > k.y - OBJECTS[k.kind].h : k.x === x && k.y === y));
    if (j) {
      this.jobs = this.jobs.filter((k) => k !== j);
      this._refund(j.label, j.paid);
      this._changed();
      return { ok: true, cancelled: j };
    }
    const obj = this.objectAt(x, y, 'floor') ?? this.objectAt(x, y, 'wall') ?? this.objectAt(x, y, 'ceiling') ?? this.objectAt(x, y, 'rug');
    if (obj) {
      const o = OBJECTS[obj.kind];
      for (const [xx, yy] of this.footprint(obj)) this.layers[layerOf(o)][this.idx(xx, yy)] = 0;
      this.objects.delete(obj.id);
      this._refund(`${o.name} salvage`, Math.round(o.cost * 0.5));
      this._changed();
      return { ok: true, removed: obj.kind };
    }
    if (!this.inside(x, y)) return { ok: false };
    const i = this.idx(x, y);
    if (this.conduits[i]) { this.conduits[i] = 0; this._changed(); return { ok: true, removed: 'conduit' }; }
    if (this.structure[i]) { const s = this.structure[i]; this.structure[i] = null; this._changed(); return { ok: true, removed: s }; }
    return { ok: false, reason: 'Nothing to remove' };
  }

  footprint(obj) {
    const o = OBJECTS[obj.kind];
    const out = [];
    for (let yy = obj.y - o.h + 1; yy <= obj.y; yy++) for (let xx = obj.x; xx < obj.x + o.w; xx++) out.push([xx, yy]);
    return out;
  }

  // ---------- crews ----------
  /** Tiles reachable from the surface through open tiles. */
  reachable() {
    const seen = new Uint8Array(this.dug.length);
    const q = [];
    for (let x = 0; x < this.W; x++) { const i = this.idx(x, -1); seen[i] = 1; q.push([x, -1]); }
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.passable(nx, ny)) continue;
        const i = this.idx(nx, ny);
        if (seen[i]) continue;
        seen[i] = 1;
        q.push([nx, ny]);
      }
    }
    return seen;
  }

  _workable(j, reach) {
    const near = (x, y) => (this.inside(x, y) && reach[this.idx(x, y)]) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.inside(x + dx, y + dy) && reach[this.idx(x + dx, y + dy)]);
    if (j.type === 'dig') return near(j.x, j.y);
    if (j.type === 'build' || j.type === 'conduit') return (j.y < 0 || this.isDug(j.x, j.y)) && near(j.x, j.y);
    if (j.type === 'object') {
      const o = OBJECTS[j.kind];
      for (let yy = j.y - o.h + 1; yy <= j.y; yy++) for (let xx = j.x; xx < j.x + o.w; xx++) if (yy >= 0 && !this.isDug(xx, yy)) return false;
      for (let xx = j.x; xx < j.x + o.w; xx++) for (let yy = j.y - o.h + 1; yy <= j.y; yy++) if (near(xx, yy)) return true;
      return false;
    }
    return false;
  }

  _complete(j) {
    const i = this.idx(j.x, j.y);
    if (j.type === 'dig') this.dug[i] = 1;
    else if (j.type === 'build') this.structure[i] = j.kind;
    else if (j.type === 'conduit') this.conduits[i] |= BIT[j.net];
    else if (j.type === 'object') {
      const obj = { id: this._id++, kind: j.kind, x: j.x, y: j.y, built: true, variant: j.variant ?? variantsFor(j.kind)[0].id, flip: !!j.flip };
      this.objects.set(obj.id, obj);
      for (const [xx, yy] of this.footprint(obj)) this.layers[layerOf(OBJECTS[j.kind])][this.idx(xx, yy)] = obj.id;
    }
    this.jobs = this.jobs.filter((k) => k !== j);
    this._changed({ type: 'built', job: j });
  }

  /** Advance game time (seconds). Survey first, then crews work the queue; runs the pressure test. */
  tick(seconds) {
    this.people.tick(seconds);
    let days = seconds / this.cfg.daySeconds;
    this.day += days;
    if (this.pressureTest && this.pressureTest.daysLeft > 0) {
      this.pressureTest.daysLeft -= days;
      if (this.pressureTest.daysLeft <= 0) { this.pressureTest.result = this.simulate(); this._changed({ type: 'pressureTest' }); }
    }
    if (this.stallDays > 0) { // a breach sent the crew home (shelter-in-place)
      const use = Math.min(days, this.stallDays);
      this.stallDays -= use;
      days -= use;
      if (days <= 1e-9) return;
    }
    if (!this.surveyed) {
      const use = Math.min(days, this.surveyLeft);
      this.surveyLeft -= use;
      days -= use;
      if (this.surveyLeft <= 1e-9) { this.surveyed = true; this._changed({ type: 'surveyed' }); }
      if (!this.surveyed) return;
    }
    const crews = Math.max(1, this.crews());
    this.crewAt = [];
    const taken = new Set();
    for (let c = 0; c < crews; c++) {
      let budget = days;
      let guard = 0;
      while (budget > 1e-9 && guard++ < 500) {
        const reach = this.reachable();
        const j = this.jobs.find((k) => !taken.has(k) && this._workable(k, reach));
        if (!j) break;
        this.crewAt[c] = { x: j.x, y: j.y, type: j.type, job: j };
        const use = Math.min(budget, j.days - j.progress);
        j.progress += use;
        budget -= use;
        if (j.progress >= j.days - 1e-9) this._complete(j);
        else taken.add(j); // another crew picks a different job
      }
    }
  }

  /** Construction stops for `days` (a breach's shelter-in-place sends the crews home). */
  delay(days = 7) {
    this.stallDays = (this.stallDays ?? 0) + days;
    this._changed({ type: 'delay', days });
  }

  /** Finish everything instantly (debug / tests). */
  finishAll() {
    this.surveyed = true;
    for (let guard = 0; guard < 10_000 && this.jobs.length; guard++) {
      const reach = this.reachable();
      const j = this.jobs.find((k) => this._workable(k, reach));
      if (!j) break;
      this._complete(j);
    }
  }

  // ---------- networks and rooms ----------
  _changed(e = { type: 'change' }) {
    this._version++;
    this._cache = null;
    for (const fn of this.listeners) fn(e, this);
  }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /** Network components per type: { air: [{ tiles:Set, objects:[] }], ... } */
  networks() {
    const out = {};
    for (const net of NET_TYPES) {
      const carries = (i) => (this.conduits[i] & BIT[net]) || this.structure[i] === 'spine';
      const seen = new Uint8Array(this.dug.length);
      const comps = [];
      for (let y = -this.S; y < this.H; y++) for (let x = 0; x < this.W; x++) {
        const i = this.idx(x, y);
        if (seen[i] || !carries(i)) continue;
        const tiles = new Set();
        const q = [[x, y]];
        seen[i] = 1;
        while (q.length) {
          const [cx, cy] = q.pop();
          tiles.add(this.idx(cx, cy));
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (!this.inside(nx, ny)) continue;
            const ni = this.idx(nx, ny);
            if (seen[ni] || !carries(ni)) continue;
            seen[ni] = 1;
            q.push([nx, ny]);
          }
        }
        comps.push({ net, tiles, objects: [], hasSpine: [...tiles].some((t) => this.structure[t] === 'spine') });
      }
      out[net] = comps;
    }
    return out;
  }

  /** The network component an object is wired into for `net`, or null. */
  _netOf(nets, obj, net) {
    const fp = this.footprint(obj).map(([x, y]) => this.idx(x, y));
    return nets[net].find((c) => fp.some((t) => c.tiles.has(t))) ?? null;
  }

  rooms() {
    const roomOf = new Int32Array(this.dug.length).fill(-1);
    const rooms = [];
    const interior = (x, y) => y >= 0 && this.inside(x, y) && this.dug[this.idx(x, y)] === 1 && !this.structure[this.idx(x, y)] && !(this.objectAt(x, y) && OBJECTS[this.objectAt(x, y).kind].door);
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      if (!interior(x, y) || roomOf[this.idx(x, y)] >= 0) continue;
      const room = { id: rooms.length, tiles: [], rough: 0, touchesSky: false, minX: x, maxX: x, minY: y, maxY: y };
      const q = [[x, y]];
      roomOf[this.idx(x, y)] = room.id;
      while (q.length) {
        const [cx, cy] = q.pop();
        room.tiles.push([cx, cy]);
        room.minX = Math.min(room.minX, cx); room.maxX = Math.max(room.maxX, cx);
        room.minY = Math.min(room.minY, cy); room.maxY = Math.max(room.maxY, cy);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (ny < 0) { room.touchesSky = true; continue; }
          if (!this.inside(nx, ny)) continue;
          if (interior(nx, ny)) {
            const ni = this.idx(nx, ny);
            if (roomOf[ni] < 0) { roomOf[ni] = room.id; q.push([nx, ny]); }
          } else if (!this.isDug(nx, ny)) room.rough++;
        }
      }
      rooms.push(room);
    }
    // contents: objects with any footprint tile in the room (doors excluded)
    for (const obj of this.objects.values()) {
      const o = OBJECTS[obj.kind];
      if (o.door) continue;
      const ids = new Set(this.footprint(obj).map(([x, y]) => (y >= 0 ? roomOf[this.idx(x, y)] : -1)).filter((r) => r >= 0));
      for (const r of ids) (rooms[r].objects ??= []).push(obj);
    }
    for (const r of rooms) {
      r.objects ??= [];
      const counts = {};
      for (const o of r.objects) counts[o.kind] = (counts[o.kind] ?? 0) + 1;
      r.counts = counts;
      r.width = r.maxX - r.minX + 1;
      r.height = r.maxY - r.minY + 1;
      r.size = r.tiles.length;
      r.type = r.touchesSky ? { id: 'open_pit', name: 'Open pit', tier: 'survive' } : (ROOM_TYPES.find((t) => t.has(counts)) ?? ROOM_TYPES.at(-1));
      r.beds = r.objects.reduce((s, o) => s + (OBJECTS[o.kind].beds ?? 0), 0);
      r.cramped = r.width < (r.type.minW ?? 1);
      r.seeps = r.rough > 0 && r.maxY >= WATER_TABLE_M;
    }
    return { rooms, roomOf };
  }

  // ---------- simulation ----------
  /** Everything the panel shows: rooms, networks, life systems, Days Sealed, ratings. Cached. */
  simulate() {
    if (this._cache) return this._cache;
    const nets = this.networks();
    const { rooms, roomOf } = this.rooms();
    const objs = [...this.objects.values()];
    const occupants = objs.reduce((s, o) => s + (OBJECTS[o.kind].beds ?? 0), 0);
    const notes = [];

    // Which objects are wired up (every net they need touches their footprint)?
    const wired = new Map();
    for (const obj of objs) {
      const o = OBJECTS[obj.kind];
      const need = o.net ?? [];
      const comps = {};
      let ok = true;
      for (const n of need) { comps[n] = this._netOf(nets, obj, n); if (!comps[n]) ok = false; }
      wired.set(obj.id, { ok, comps });
    }

    // Power: per network, supply vs demand, shed by priority. Occupant load goes on the spine's network
    // (or the biggest one).
    const powerNets = nets.power;
    const mainPower = powerNets.find((c) => c.hasSpine) ?? [...powerNets].sort((a, b) => b.tiles.size - a.tiles.size)[0] ?? null;
    const fuelStock = objs.reduce((s, o) => s + (OBJECTS[o.kind].fuelStock ?? 0), 0);
    const online = new Set();
    const powerReport = [];
    for (const comp of powerNets) {
      const members = objs.filter((o) => wired.get(o.id).comps.power === comp);
      let continuous = 0, diesel = 0, battery = 0;
      for (const m of members) {
        const o = OBJECTS[m.kind];
        if (!wired.get(m.id).ok && !(o.power > 0)) continue;
        if (o.power > 0) {
          if (o.fuelUse) { if (fuelStock > 0 && wired.get(m.id).ok) diesel += o.power; }
          else if (o.solar) continuous += o.power * 0.5; // averaged over day and night
          else continuous += o.power;
        }
        if (o.battery) battery += o.battery;
      }
      const consumers = members.filter((m) => (OBJECTS[m.kind].power ?? 0) < 0).sort((a, b) => (BUNKER.priority[OBJECTS[a.kind].cat] ?? 9) - (BUNKER.priority[OBJECTS[b.kind].cat] ?? 9));
      const base = comp === mainPower ? occupants * NEEDS.power + rooms.length * 0 : 0;
      const spineFloors = comp.hasSpine ? Math.ceil(this._spineDepth() / 4) : 0;
      let demand = base + spineFloors;
      const supply = continuous + diesel;
      const powered = [];
      let shed = 0;
      for (const m of consumers) {
        const draw = -OBJECTS[m.kind].power;
        if (!wired.get(m.id).ok) continue;
        if (demand + draw <= supply + (battery > 0 ? 1e9 : 0)) { demand += draw; powered.push(m); } else shed++;
      }
      for (const m of powered) online.add(m.id);
      powerReport.push({ comp, continuous, diesel, battery, demand, supply, shed, main: comp === mainPower });
    }
    for (const obj of objs) {
      const o = OBJECTS[obj.kind];
      if (!((o.power ?? 0) < 0) && wired.get(obj.id).ok) online.add(obj.id); // unpowered things work when plumbed
    }
    const isOn = (obj) => online.has(obj.id);

    // Air: scrubbers on an air network that reaches a bedroom.
    const bedRooms = rooms.filter((r) => r.beds > 0);
    const bedTiles = new Set(bedRooms.flatMap((r) => r.tiles.map(([x, y]) => this.idx(x, y))));
    const airReachesBeds = (comp) => comp && [...comp.tiles].some((t) => bedTiles.has(t) || [1, -1, this.W, -this.W].some((d) => bedTiles.has(t + d)));
    let airSupply = 0;
    for (const obj of objs) {
      const o = OBJECTS[obj.kind];
      if (o.air && isOn(obj) && airReachesBeds(wired.get(obj.id).comps.air)) airSupply += o.air;
    }
    const sealedVolume = rooms.filter((r) => !r.touchesSky).reduce((s, r) => s + r.size * ROOM_DEPTH_M, 0) + objs.reduce((s, o) => s + (OBJECTS[o.kind].airStock ?? 0), 0);
    const airNeed = occupants * NEEDS.air;

    // Water
    let waterStock = 0, waterUse = occupants * NEEDS.water, recycle = 0, unlimited = false;
    for (const obj of objs) {
      const o = OBJECTS[obj.kind];
      if (o.waterStock && wired.get(obj.id).ok) waterStock += o.waterStock;
      if (o.water < 0 && isOn(obj)) waterUse += -o.water;
      if (o.recycle && isOn(obj)) recycle = Math.max(recycle, o.recycle);
      if (o.waterUnlimited && isOn(obj)) unlimited = true;
    }
    const waterNet = waterUse * (1 - recycle);

    // Food
    let foodStock = 0, foodProd = 0;
    for (const obj of objs) {
      const o = OBJECTS[obj.kind];
      if (o.foodStock) foodStock += o.foodStock * (o.power < 0 && !isOn(obj) ? 0.5 : 1); // an unpowered cold store spoils half
      if (o.food && isOn(obj)) {
        // a grow light touching the rack adds 20%
        const lit = objs.some((l) => OBJECTS[l.kind].growLight && isOn(l) && this._touching(l, obj));
        foodProd += o.food * (lit ? 1.2 : 1);
      }
    }
    const foodNeed = occupants * NEEDS.food;

    // Power days
    const main = powerReport.find((p) => p.main);
    // Power lasts while continuous supply (reactor, geothermal, solar) covers demand; otherwise diesel
    // fills the gap while fuel lasts and batteries cover what's left.
    const daysPower = (() => {
      if (!occupants) return Infinity;
      if (!main) return 0;
      const gap = main.demand - main.continuous;
      if (gap <= 0) return Infinity;
      const dieselKW = Math.min(main.diesel, gap);
      const gensRunning = Math.ceil(dieselKW / 12);
      const fuelDays = gensRunning ? fuelStock / (40 * gensRunning) : 0;
      const rest = gap - dieselKW;
      if (rest <= 0) return fuelDays + main.battery / (gap * 24);
      const batteryDays = main.battery / (rest * 24);
      return gensRunning ? Math.min(batteryDays, fuelDays) : batteryDays;
    })();

    const days = {
      air: !occupants || airSupply >= airNeed ? Infinity : sealedVolume / ((airNeed - airSupply) * 24),
      water: !occupants || unlimited || waterNet <= 0 ? Infinity : waterStock / waterNet,
      food: !occupants || foodProd >= foodNeed ? Infinity : foodStock / (foodNeed - foodProd),
      power: daysPower,
    };
    for (const k of Object.keys(days)) if (days[k] !== Infinity) days[k] = Math.floor(days[k] * 10) / 10;
    const daysSealed = Math.min(days.air, days.water, days.food, days.power);
    const limiting = Object.keys(days).reduce((a, k) => (days[k] < days[a] ? k : a), 'air');

    // Noise: each online noisy object costs every bedroom/status room within 6 tiles 1 per noise point.
    for (const r of rooms) { r.noise = 0; r.beauty = 0; r.prestige = 0; }
    for (const obj of objs) {
      const o = OBJECTS[obj.kind];
      if (!o.noise || !isOn(obj)) continue;
      const cx = obj.x + o.w / 2, cy = obj.y - o.h / 2;
      for (const r of rooms) {
        if (!(r.beds > 0 || r.type.tier === 'status')) continue;
        if (r.objects.includes(obj)) continue;
        const near = r.tiles.some(([x, y]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= this.cfg.noiseRadius);
        if (near) r.noise += o.noise;
      }
    }
    // Room impressiveness and prestige
    let prestige = 0;
    for (const r of rooms) {
      for (const obj of r.objects) {
        const o = OBJECTS[obj.kind];
        r.beauty += (o.beauty ?? 0) + (variantsFor(obj.kind).find((v) => v.id === obj.variant)?.beauty ?? 0);
        let p = o.prestige ?? 0;
        if (o.cellar && r.minY >= 10) p *= 1.5; // GDD: wine cellar +50% at 10 m or deeper
        r.prestige += p;
      }
      // finishes: the room's average wall + floor + light beauty per tile, x3 (a fully marbled room is +9)
      let fin = 0;
      for (const [x, y] of r.tiles) { const i = this.idx(x, y); for (const k of ['wall', 'floor', 'light']) fin += FINISHES[k][this.finish[k][i]]?.beauty ?? 0; }
      r.finishBeauty = Math.round((fin / Math.max(1, r.tiles.length)) * 3);
      r.beauty += r.finishBeauty;
      r.prestige = Math.max(0, r.prestige - (r.type.tier === 'status' ? r.noise : 0));
      r.impressiveness = Math.round(r.beauty + Math.min(10, r.size / 4) - (r.beds ? r.noise : 0) - (r.rough ? 3 : 0) - (r.cramped ? 5 : 0) - (r.seeps ? 4 : 0));
      prestige += r.prestige;
    }

    // Ratings
    const sump = objs.some((o) => OBJECTS[o.kind].sump && isOn(o));
    const seeping = rooms.filter((r) => r.seeps && !sump);
    const fullyWalled = bedRooms.length > 0 && bedRooms.every((r) => r.rough === 0 && !r.touchesSky);
    const airlocks = objs.filter((o) => OBJECTS[o.kind].seal && OBJECTS[o.kind].door).length;
    const sealParts = { walled: fullyWalled ? 1 : 0, airlocks: Math.min(2, airlocks), decon: objs.some((o) => o.kind === 'decon' && isOn(o)) ? 2 : 0, hepa: objs.some((o) => o.kind === 'hepa' && isOn(o)) ? 1 : 0, seepage: seeping.length ? -1 : 0 };
    const seal = clamp(Object.values(sealParts).reduce((a, b) => a + b, 0), 0, 5);
    const blastRoom = bedRooms.length ? bedRooms.reduce((a, r) => (r.minY < a.minY ? r : a)) : rooms[0];
    const bestDoor = blastRoom ? objs.filter((o) => OBJECTS[o.kind].blast && o.y < blastRoom.minY + 3).reduce((m, o) => Math.max(m, OBJECTS[o.kind].blast), 0) : 0;
    const blast = blastRoom ? clamp(this.stratum(blastRoom.minY).blast + bestDoor, 0, 5) : 0;
    const visibility = objs.reduce((s, o) => s + (OBJECTS[o.kind].visibility ?? 0), 0);
    const security = clamp(Math.floor(objs.reduce((s, o) => s + (isOn(o) || !(OBJECTS[o.kind].power < 0) ? OBJECTS[o.kind].security ?? 0 : 0), 0) - Math.max(0, visibility) / 2), 0, 5);
    const bedImpress = bedRooms.length ? bedRooms.reduce((s, r) => s + r.impressiveness, 0) / bedRooms.length : 0;
    const shared = rooms.filter((r) => !r.beds && ['comfort', 'status'].includes(r.type.tier)).reduce((s, r) => s + Math.max(0, r.impressiveness), 0);
    const moraleMods = objs.reduce((s, o) => s + (isOn(o) ? (OBJECTS[o.kind].morale ?? 0) * 5 + (OBJECTS[o.kind].comfortAll ?? 0) * 5 : 0), 0);
    const morale = occupants ? clamp(Math.round(40 + bedImpress * 2 + Math.min(20, shared) + moraleMods - seeping.length * 5), 0, 100) : 0;

    for (const r of seeping) notes.push(`${r.type.name} at ${r.minY} m has raw rock below the water table: it seeps. Wall it in or run a sump pump.`);
    for (const r of rooms) if (r.cramped && r.objects.length) notes.push(`${r.type.name} is cramped (${r.width} wide, needs ${r.type.minW}).`);
    for (const r of rooms) if (r.noise && r.beds) notes.push(`${r.type.name} hears machinery: -${r.noise} comfort.`);
    for (const obj of objs) if (!wired.get(obj.id).ok && OBJECTS[obj.kind].net) notes.push(`${OBJECTS[obj.kind].name} at ${obj.y} m isn't connected (${OBJECTS[obj.kind].net.filter((n) => !wired.get(obj.id).comps[n]).join(', ')}).`);
    for (const p of powerReport) if (p.shed) notes.push(`Power network short: ${p.shed} device${p.shed > 1 ? 's' : ''} shut down (${Math.round(p.supply)} kW for ${Math.round(p.demand)} kW).`);

    this._cache = {
      occupants, rooms, roomOf, nets, online, wired,
      flows: {
        air: { supply: airSupply, need: airNeed, buffer: sealedVolume, unit: 'm³/h' },
        water: { stock: waterStock, use: waterUse, net: Math.round(waterNet), recycle, unlimited, unit: 'L/day' },
        food: { stock: foodStock, production: Math.round(foodProd), need: foodNeed, unit: 'meals/day' },
        power: main ? { supply: Math.round(main.continuous + main.diesel), continuous: main.continuous, diesel: main.diesel, demand: Math.round(main.demand), battery: main.battery, fuel: fuelStock, unit: 'kW' } : { supply: 0, demand: occupants * NEEDS.power, battery: 0, fuel: fuelStock, unit: 'kW' },
      },
      days, daysSealed, limiting,
      ratings: { seal, blast, security, morale },
      sealParts, prestige: Math.round(prestige), visibility, notes,
    };
    return this._cache;
  }

  _touching(a, b) {
    const fa = this.footprint(a);
    const fb = new Set(this.footprint(b).map(([x, y]) => `${x},${y}`));
    return fa.some(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fb.has(`${x + dx},${y + dy}`)));
  }
  _spineDepth() {
    let d = 0;
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if (this.structure[this.idx(x, y)] === 'spine') d = Math.max(d, y + 1);
    return d;
  }

  // ---------- construction phases ----------
  phase() {
    if (!this.surveyed) return { id: 'survey', name: 'Survey', detail: `${Math.ceil(this.surveyLeft)} days left` };
    if (this.jobs.some((j) => j.type === 'dig')) return { id: 'dig', name: 'Dig', detail: `${this.jobs.filter((j) => j.type === 'dig').length} tiles to dig` };
    if (this.jobs.some((j) => j.type === 'build' || j.type === 'conduit')) return { id: 'shell', name: 'Shell', detail: `${this.jobs.filter((j) => j.type !== 'object').length} walls, spine and conduits` };
    if (this.jobs.some((j) => j.type === 'object')) return { id: 'fitout', name: 'Fit-out', detail: `${this.jobs.length} items to install` };
    if (this.pressureTest && this.pressureTest.daysLeft > 0) return { id: 'pressure', name: 'Pressure test', detail: `${Math.ceil(this.pressureTest.daysLeft)} of 30 days` };
    if (this.pressureTest?.result) return { id: 'walkthrough', name: 'Walkthrough', detail: this.pressureTest.result.daysSealed >= 30 ? 'Ready for handover' : 'Failed the pressure test' };
    return { id: 'ready', name: 'Ready to test', detail: 'Run the 30-day pressure test' };
  }

  startPressureTest() {
    if (this.jobs.length || !this.surveyed) return { ok: false, reason: 'Finish construction first' };
    this.pressureTest = { daysLeft: this.cfg.pressureTestDays, result: null };
    this._changed({ type: 'pressureStart' });
    return { ok: true };
  }

  // ---------- adapter for the campaign (same surface as ShelterGrid) ----------
  get built() { return [...this.objects.values()]; }
  get queue() { return this.jobs; }
  get occupants() { return this.simulate().occupants; }

  /** Legacy room ids for the rest of the game (sales, client orders, old Midnight grading). */
  legacyRooms() {
    const map = { bunk: 'bunk', bed: 'bunk', king_bed: 'bunk', hepa: 'mil_scrubber', crank_scrubber: 'air_vent', tank: 'water_tank', recycler: 'water_recycler', aquifer: 'water_recycler', shelf: 'pantry', fridge: 'pantry', hydro: 'hydroponics', vat: 'hydroponics', gold_taps: 'gold_taps', cryo_pod: 'cryo_pod', wine_rack: 'wine_cellar' };
    return this.built.map((o) => map[o.kind]).filter(Boolean);
  }

  toShelter() {
    const s = this.simulate();
    // morale: the layout's rating blended with how the residents actually feel living here
    const mood = this.people.averageMood;
    const morale = mood == null ? s.ratings.morale : Math.round((s.ratings.morale + mood) / 2);
    return { id: 'hq', name: this.name, owner: 'your board', occupants: s.occupants, rooms: this.legacyRooms(), sold: false, sealed: { daysSealed: s.daysSealed, ratings: { ...s.ratings, morale: Math.round(morale / 20) }, prestige: s.prestige } };
  }

  handOver(name = 'Shelter') {
    if (this.jobs.length) return { ok: false, reason: 'The crew is still working' };
    if (!this.objects.size) return { ok: false, reason: 'Build something first' };
    const sh = this.toShelter();
    const shelter = { name, rooms: sh.rooms, occupants: sh.occupants, sealed: sh.sealed };
    this.handedOver += 1;
    this.reset(false);
    this._changed({ type: 'handover', shelter });
    return { ok: true, shelter };
  }

  toJSON() {
    return {
      v: 2, W: this.W, H: this.H, S: this.S,
      dug: Array.from(this.dug), structure: this.structure, conduit: Array.from(this.conduits),
      objects: [...this.objects.values()], jobs: this.jobs, id: this._id, finish: this.finish,
      surveyed: this.surveyed, surveyLeft: this.surveyLeft, pressureTest: this.pressureTest, day: this.day, handedOver: this.handedOver, stallDays: this.stallDays ?? 0,
    };
  }

  load(d) {
    if (!d || d.v !== 2 || d.W !== this.W || d.H !== this.H || d.S !== this.S) return; // old saves start a fresh site
    this.dug = Uint8Array.from(d.dug);
    this.structure = d.structure;
    this.conduits = Uint8Array.from(d.conduit);
    this.objects = new Map(d.objects.map((o) => [o.id, { ...o }]));
    this.layers = Object.fromEntries(LAYERS.map((l) => [l, new Int32Array(this.dug.length).fill(0)]));
    this.occupant = this.layers.floor;
    for (const o of this.objects.values()) for (const [x, y] of this.footprint(o)) this.layers[layerOf(OBJECTS[o.kind])][this.idx(x, y)] = o.id;
    if (d.finish) this.finish = { wall: [...d.finish.wall], floor: [...d.finish.floor], light: [...d.finish.light] };
    this.jobs = d.jobs.map((j) => ({ ...j }));
    this._id = d.id;
    this.surveyed = d.surveyed;
    this.surveyLeft = d.surveyLeft;
    this.pressureTest = d.pressureTest;
    this.stallDays = d.stallDays ?? 0;
    this.day = d.day;
    this.handedOver = d.handedOver ?? 0;
    this._changed({ type: 'load' });
  }
}

export { STRATA, OBJECTS, NET_TYPES };
