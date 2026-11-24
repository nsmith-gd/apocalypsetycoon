// Residents: the billionaires who live in a bunker, Sims-style. Pure rules, no DOM.
//
// Every bed slot gets a resident with six needs (energy, hunger, bladder, hygiene, fun, social) that
// fall every in-game hour. When idle, a resident scores every object that offers something (USES in
// the catalog): how much it fixes each need, weighted by how urgent that need is, divided by the walk.
// They walk along floors (a tile with something solid under it) and climb the Utility Spine between
// floors; then they use the object with a pose (sleep, sit, shower, cook, play...). Beautiful things
// (paintings, aquariums, chandeliers...) get admired in passing. Two idle residents who meet chat.
// Mood = needs + how nice the room they're in is (beauty, finishes, noise) + recent pleasures.
//
//   const sim = new ResidentSim(site, { seed });
//   sim.tick(gameSeconds)          // after site.tick; keeps the roster in step with the beds
//   sim.residents                  // [{ name, x, y, needs, mood, action, thought, ... }]
//   sim.averageMood, sim.complaints

import { OBJECTS, USES, NEED_IDS, layerOf } from './bunker-catalog.js';

export const RESIDENTS = Object.freeze({
  // Residents live on their own, slower clock so you can watch them (a resident day is 2 minutes at 1x).
  // The calendar (a week = 120 s) still drives supplies and Days Sealed; this clock only drives needs.
  hourSeconds: 5,
  walkTilesPerSecond: 6,
  climbTilesPerSecond: 4,
  // need loss per in-game hour
  decay: { energy: 4, hunger: 5, bladder: 9, hygiene: 3, fun: 5, social: 3 },
  admireFunPerBeauty: 10, // fun per hour of admiring, per beauty point
  admireHours: 0.3,
  admireCooldownHours: 12,
  chatHours: 0.4,
  chatSocialPerHour: 90,
  urgentAt: 30,
});

const CLASSES = { bunk: 'C1', bed: 'C2', king_bed: 'C3', cryo_pod: 'C4' };
const FIRST = ['Augustin', 'Bettina', 'Cornelius', 'Delphine', 'Ezra', 'Fenella', 'Gideon', 'Honoria', 'Ignatius', 'Juniper', 'Lavinia', 'Magnus', 'Nadia', 'Orson', 'Priya', 'Rosalind', 'Sterling', 'Tamsin', 'Vivienne', 'Wendell'];
const LAST = ['Ashcombe', 'Blackwood', 'Carrington', 'Dunmore', 'Fairfax', 'Hargreave', 'Kensington', 'Lockhart', 'Montague', 'Pennington', 'Rothwell', 'Sinclair', 'Thorne', 'Vance', 'Whitlock'];
// GDD client traits that change how a resident lives (Clients > Client traits).
export const TRAITS = Object.freeze({
  Gourmand: { decay: { hunger: 1.5 }, loves: ['chef_range', 'dining_table', 'bar_counter'] },
  Germaphobe: { decay: { hygiene: 1.6 }, loves: ['shower', 'bathtub', 'decon'] },
  Collector: { loves: ['painting', 'statue', 'aquarium', 'trophy'] },
  Influencer: { decay: { social: 1.5 }, loves: ['neon_sign', 'bar_counter', 'mirror'] },
  'Health Optimizer': { loves: ['gym_rig', 'cryo_pod'] },
  'Doomer Romantic': { loves: ['faux_window', 'fireplace', 'piano'] },
});
const TRAIT_IDS = Object.keys(TRAITS);

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export class ResidentSim {
  constructor(site, { seed = 7, cfg = {} } = {}) {
    this.site = site;
    this.cfg = { ...RESIDENTS, ...cfg };
    this.seed = seed;
    this.rng = rngFrom(seed);
    this.residents = [];
    this.complaints = [];
    this.clock = 0; // game hours
  }

  // ---------- movement graph ----------
  isSpine(x, y) { return this.site.inside(x, y) && y >= 0 && this.site.structure[this.site.idx(x, y)] === 'spine'; }
  /** A tile a resident can stand in: open, with something solid under it (or the climbable spine). */
  walkable(x, y) {
    const s = this.site;
    if (!s.inside(x, y) || y < 0 || !s.passable(x, y)) return false;
    return this.isSpine(x, y) || s.isSolid(x, y + 1);
  }
  neighbours(x, y) {
    const out = [];
    for (const dx of [-1, 1]) if (this.walkable(x + dx, y)) out.push([x + dx, y]);
    for (const dy of [-1, 1]) if (this.isSpine(x, y) && this.isSpine(x, y + dy) && this.walkable(x, y + dy)) out.push([x, y + dy]);
    return out;
  }
  /** BFS from a tile: Map "x,y" -> { d, prev }. */
  distances(x, y) {
    const key = (a, b) => `${a},${b}`;
    const seen = new Map([[key(x, y), { d: 0, prev: null, x, y }]]);
    const q = [[x, y]];
    while (q.length) {
      const [cx, cy] = q.shift();
      const cur = seen.get(key(cx, cy));
      for (const [nx, ny] of this.neighbours(cx, cy)) {
        const k = key(nx, ny);
        if (seen.has(k)) continue;
        seen.set(k, { d: cur.d + 1, prev: key(cx, cy), x: nx, y: ny });
        q.push([nx, ny]);
      }
    }
    return seen;
  }
  pathTo(dist, tx, ty) {
    const out = [];
    let k = `${tx},${ty}`;
    while (k && dist.get(k)) { const n = dist.get(k); out.unshift([n.x, n.y]); k = n.prev; }
    return out.slice(1);
  }

  /** Standing spots for using an object: walkable tiles under/in front of its footprint. */
  spots(obj) {
    const o = OBJECTS[obj.kind];
    const layer = layerOf(o);
    const out = [];
    for (let x = obj.x; x < obj.x + o.w; x++) {
      if (layer === 'floor' || layer === 'rug') { if (this.walkable(x, obj.y)) out.push([x, obj.y]); continue; }
      for (let y = obj.y; y < Math.min(this.site.H, obj.y + 4); y++) if (this.walkable(x, y)) { out.push([x, y]); break; }
    }
    return out;
  }

  // ---------- roster ----------
  syncRoster() {
    const slots = [];
    for (const obj of this.site.objects.values()) {
      const use = USES[obj.kind];
      if (!use?.sleep) continue;
      for (let i = 0; i < (OBJECTS[obj.kind].beds ?? 1); i++) slots.push({ bedId: obj.id, slot: i, kind: obj.kind });
    }
    const keep = [];
    for (const s of slots) {
      let r = this.residents.find((x) => x.bedId === s.bedId && x.slot === s.slot);
      if (!r) r = this._spawn(s);
      if (r) keep.push(r);
    }
    this.residents = keep;
  }
  _spawn({ bedId, slot, kind }) {
    const bed = this.site.objects.get(bedId);
    const spot = this.spots(bed)[slot] ?? this.spots(bed)[0];
    if (!spot) return null;
    const n = bedId * 7 + slot * 13 + this.seed;
    const trait = TRAIT_IDS[n % TRAIT_IDS.length];
    return {
      id: `${bedId}.${slot}`, bedId, slot,
      name: `${FIRST[n % FIRST.length]} ${LAST[(n * 3 + slot) % LAST.length]}`,
      cls: CLASSES[kind] ?? 'C1', trait,
      x: spot[0], y: spot[1], tx: spot[0], ty: spot[1], path: [], facing: 1,
      needs: { energy: 60 + (n % 30), hunger: 50 + (n % 40), bladder: 60 + (n % 35), hygiene: 70, fun: 50 + (n % 30), social: 60 },
      mood: 60, action: null, thought: null, thoughts: [], admired: {}, buff: 0, stuck: 0,
    };
  }

  // ---------- decisions ----------
  _environment(r) {
    const sim = this.site.simulate();
    const rid = sim.roomOf[this.site.idx(Math.round(r.x), r.y)];
    const room = sim.rooms[rid];
    return room ? { room, score: clamp(50 + room.impressiveness * 3) } : { room: null, score: 40 };
  }

  _usersOf(objId) { return this.residents.filter((x) => x.action?.objId === objId).length; }

  /** Candidate actions with scores (exposed for tests and the inspector). */
  options(r) {
    const sim = this.site.simulate();
    const dist = this.distances(Math.round(r.x), r.y);
    const out = [];
    const loves = TRAITS[r.trait]?.loves ?? [];
    for (const obj of this.site.objects.values()) {
      const use = USES[obj.kind];
      if (!use) continue;
      const o = OBJECTS[obj.kind];
      if (o.net && !sim.online.has(obj.id)) continue; // unplugged or unpowered: it doesn't work
      const spots = this.spots(obj).filter(([x, y]) => dist.has(`${x},${y}`));
      if (!spots.length) continue;
      const users = this._usersOf(obj.id);
      if (use.admire) {
        const last = r.admired[obj.id] ?? -Infinity;
        if (this.clock - last < this.cfg.admireCooldownHours) continue;
        const gain = { fun: (o.beauty ?? 1) * this.cfg.admireFunPerBeauty * this.cfg.admireHours };
        out.push(this._score(r, obj, { needs: gain, hours: this.cfg.admireHours, pose: 'admire' }, spots, dist, loves, true));
        continue;
      }
      if (users >= (use.seats ?? 1)) continue;
      if (use.sleep && obj.id !== r.bedId && this.residents.some((x) => x.bedId === obj.id)) continue; // someone else's bed
      out.push(this._score(r, obj, use, spots, dist, loves, false));
    }
    return out.filter(Boolean).sort((a, b) => b.score - a.score);
  }

  _score(r, obj, use, spots, dist, loves, admire) {
    let value = 0;
    for (const [need, perHour] of Object.entries(use.needs ?? {})) {
      const gain = Math.min(100 - r.needs[need], Math.max(-r.needs[need], perHour * (use.hours ?? 1)));
      const urgency = ((100 - r.needs[need]) / 100) ** 2 + 0.05;
      value += gain * urgency;
    }
    if (use.sleep && r.needs.energy > 45) value *= 0.1; // nobody naps at full energy
    if (use.sleep && obj.id === r.bedId) value *= 1.5;
    if (loves.includes(obj.kind)) value *= 1.4;
    value += use.mood ?? 0;
    const [sx, sy] = spots.reduce((a, b) => (dist.get(`${b[0]},${b[1]}`).d < dist.get(`${a[0]},${a[1]}`).d ? b : a));
    const d = dist.get(`${sx},${sy}`).d;
    return { obj, use, spot: [sx, sy], d, admire, score: value / (1 + d / 12) };
  }

  _think(r, text, good) {
    r.thoughts.unshift({ text, good, at: this.clock });
    r.thoughts = r.thoughts.slice(0, 5);
    r.thought = { text, good, until: this.clock + 1.5 };
  }

  _decide(r) {
    const opts = this.options(r);
    const best = opts[0];
    const worst = NEED_IDS.reduce((a, k) => (r.needs[k] < r.needs[a] ? k : a), 'energy');
    if (r.needs[worst] < this.cfg.urgentAt && !opts.some((o) => (o.use.needs?.[worst] ?? 0) > 0)) {
      const want = { energy: 'a bed', hunger: 'food', bladder: 'a toilet', hygiene: 'a shower', fun: 'anything to do', social: 'company' }[worst];
      // is there one, just broken or out of reach? say so
      const sim = this.site.simulate();
      const broken = [...this.site.objects.values()].find((obj) => (USES[obj.kind]?.needs?.[worst] ?? 0) > 0);
      let why = `can't find ${want}`;
      if (broken && OBJECTS[broken.kind].net && !sim.online.has(broken.id)) why = `says the ${OBJECTS[broken.kind].name.toLowerCase()} doesn't work (check its ${OBJECTS[broken.kind].net.join(' and ')})`;
      else if (broken && this._usersOf(broken.id) >= (USES[broken.kind].seats ?? 1)) why = `is waiting for the ${OBJECTS[broken.kind].name.toLowerCase()} (add another?)`;
      else if (broken) why = `can't reach the ${OBJECTS[broken.kind].name.toLowerCase()}`;
      if (!r.thought || r.thought.until < this.clock) this._think(r, `${r.name.split(' ')[0]} ${why}!`, false);
      this._complain(`${r.name} ${why}.`);
    }
    if (best && best.score > 1) {
      r.path = this.pathTo(this.distances(Math.round(r.x), r.y), best.spot[0], best.spot[1]);
      r.action = { objId: best.obj.id, kind: best.obj.kind, use: best.use, admire: best.admire, hoursLeft: best.use.hours ?? 1, started: false, spot: best.spot };
      return;
    }
    // chat with an idle resident within 3 tiles
    const mate = this.residents.find((m) => m !== r && !m.action && m.y === r.y && Math.abs(m.x - r.x) <= 3);
    if (mate && r.needs.social < 85) {
      for (const p of [r, mate]) p.action = { chat: true, with: p === r ? mate.id : r.id, hoursLeft: this.cfg.chatHours, started: true, use: { pose: 'chat' } };
      r.facing = Math.sign(mate.x - r.x) || 1;
      mate.facing = -r.facing;
      return;
    }
    // wander a few tiles
    const dist = this.distances(Math.round(r.x), r.y);
    const near = [...dist.values()].filter((n) => n.d > 0 && n.d <= 5 && n.y === r.y);
    if (near.length) { const t = near[Math.floor(this.rng() * near.length)]; r.path = this.pathTo(dist, t.x, t.y); }
    r.action = { wander: true, hoursLeft: 0.3, started: false, use: { pose: 'stand' } };
  }

  _complain(text) {
    if (!this.complaints.includes(text)) this.complaints.unshift(text);
    this.complaints = this.complaints.slice(0, 6);
  }

  // ---------- time ----------
  tick(gameSeconds) {
    this.syncRoster();
    const hours = gameSeconds / this.cfg.hourSeconds;
    this.clock += hours;
    // drop stale complaints every few hours
    if (Math.floor(this.clock / 6) !== Math.floor((this.clock - hours) / 6)) this.complaints = [];
    for (const r of this.residents) this._step(r, gameSeconds, hours);
  }

  _step(r, seconds, hours) {
    const mult = TRAITS[r.trait]?.decay ?? {};
    // walking
    if (r.path.length) {
      let budget = seconds;
      while (budget > 0 && r.path.length) {
        const [nx, ny] = r.path[0];
        const vertical = ny !== r.y;
        const speed = vertical ? this.cfg.climbTilesPerSecond : this.cfg.walkTilesPerSecond;
        if (vertical) { r.y = ny; budget -= 1 / speed; r.path.shift(); r.x = nx; continue; }
        const dx = nx - r.x;
        r.facing = Math.sign(dx) || r.facing;
        const step = Math.min(Math.abs(dx), speed * budget);
        r.x += Math.sign(dx) * step;
        budget -= step / speed;
        if (Math.abs(nx - r.x) < 1e-6) { r.x = nx; r.path.shift(); }
      }
      r.walking = true;
    } else r.walking = false;
    // needs fall
    for (const k of NEED_IDS) r.needs[k] = clamp(r.needs[k] - this.cfg.decay[k] * (mult[k] ?? 1) * hours);
    // doing things
    const a = r.action;
    if (!a) { this._decide(r); return this._mood(r); }
    if (!r.path.length && !a.started) {
      const obj = a.objId ? this.site.objects.get(a.objId) : null;
      if (a.objId && !obj) { r.action = null; return this._mood(r); }
      a.started = true;
      if (obj && obj.x + OBJECTS[obj.kind].w / 2 !== r.x) r.facing = obj.x + OBJECTS[obj.kind].w / 2 > r.x ? 1 : -1;
      if (a.admire) {
        r.admired[a.objId] = this.clock;
        this._think(r, `${r.name.split(' ')[0]} admires the ${OBJECTS[a.kind].name.toLowerCase()}.`, true);
        r.buff = Math.min(25, r.buff + (OBJECTS[a.kind].beauty ?? 1) * 2);
      }
    }
    if (a.started) {
      const gains = a.admire ? { fun: (OBJECTS[a.kind].beauty ?? 1) * this.cfg.admireFunPerBeauty } : a.chat ? { social: this.cfg.chatSocialPerHour, fun: 10 } : a.use?.needs ?? {};
      for (const [k, v] of Object.entries(gains)) r.needs[k] = clamp(r.needs[k] + v * hours);
      // a shared seat with someone else on it is more fun
      if (a.objId && (a.use?.seats ?? 1) > 1 && this._usersOf(a.objId) > 1) r.needs.social = clamp(r.needs.social + 20 * hours);
      a.hoursLeft -= hours;
      const satisfied = a.use?.sleep ? r.needs.energy >= 99 : false;
      if (a.hoursLeft <= 0 || satisfied) {
        if (a.use?.sleep) {
          const env = this._environment(r);
          if (env.room?.noise) this._think(r, `${r.name.split(' ')[0]} was kept up by the machinery noise.`, false);
          else if (env.score >= 70) this._think(r, `${r.name.split(' ')[0]} slept beautifully.`, true);
        } else if (a.kind && (a.use?.mood ?? 0) >= 4) this._think(r, `${r.name.split(' ')[0]} loved the ${OBJECTS[a.kind].name.toLowerCase()}.`, true);
        r.action = null;
      }
    } else if (!r.path.length && !a.started && a.wander) r.action = null;
    else if (a.wander && !r.path.length) r.action = null;
    this._mood(r);
  }

  _mood(r) {
    const needs = NEED_IDS.reduce((s, k) => s + r.needs[k], 0) / NEED_IDS.length;
    const env = this._environment(r).score;
    r.buff = Math.max(0, r.buff - 0.5);
    r.mood = Math.round(clamp(0.6 * needs + 0.4 * env + r.buff - NEED_IDS.filter((k) => r.needs[k] < 15).length * 8));
  }

  get averageMood() {
    if (!this.residents.length) return null;
    return Math.round(this.residents.reduce((s, r) => s + r.mood, 0) / this.residents.length);
  }

  /** What a resident is doing, in words. */
  doing(r) {
    const a = r.action;
    if (!a) return 'Thinking';
    if (a.chat) return `Chatting with ${this.residents.find((x) => x.id === a.with)?.name.split(' ')[0] ?? 'someone'}`;
    if (a.wander) return 'Wandering';
    const verb = { sleep: 'Sleeping in', sit: 'Sitting at', shower: 'Showering in', bath: 'Bathing in', cook: 'Cooking at', stand: 'Using', watch: 'Watching', read: 'Reading at', play: 'Playing', exercise: 'Working out on', drink: 'Having a drink at', admire: 'Admiring' }[a.admire ? 'admire' : a.use.pose] ?? 'Using';
    return `${a.started ? '' : 'Heading to: '}${verb} the ${OBJECTS[a.kind].name.toLowerCase()}`;
  }
}
