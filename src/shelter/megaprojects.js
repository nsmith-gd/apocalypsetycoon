// Megaprojects (#143, L1 greybox): the Compound (4:20) and the Ark (5:00).
// GDD: Shelter canvas > Product lines.
//
// COMPOUND  three linked bunkers (sites A, B, C, each a normal BunkerSite plot) joined by tunnels. Tunnels are
//           dug at a chosen depth; below the water table they can FLOOD each week, and while a linked site is
//           besieged they can be BREACHED. A flooded or breached tunnel cuts its link until it is pumped out or
//           resealed. Linked sites pool their supplies: the Compound's Days Sealed is the worst of its linked
//           groups, each group lasting as long as its pooled stores (spreading the risk across sites).
// ARK       a 64-wide consortium build down to the Abyss (120 m) for 200-500 people, commissioned by The Table.
//           Start it from a Table (C5) lead once the Ark is unlocked. It is done when it reaches the Abyss, has a
//           Governance Hall and a Schoolhouse (greybox definitions in tuning), and sleeps 200.
//
//   const board = new MegaprojectBoard({ ledger, isUnlocked: (id) => bool, seed });
//   board.startCompound(); board.compound.digTunnel('AB', 8); board.compound.week();
//   board.startArk(lead) -> { ok, ark } | { ok: false, reason };  board.ark.checklist()
//   board.tick(gameSeconds)  (crews work every site);  board.week()  (tunnels flood, sieges);  toJSON / load

import { BunkerSite } from './bunker.js';
import { PRICE_SCALE } from './bunker-catalog.js';
import { MEGAPROJECTS } from '../config/tuning.js';

const money = (gdd) => Math.round(gdd * PRICE_SCALE);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- Compound
export class Compound {
  constructor({ ledger = null, seed = 1, cfg = MEGAPROJECTS.compound, crews = () => 1, siteOpts = {} } = {}) {
    this.cfg = cfg;
    this.ledger = ledger;
    this.rand = rng(seed);
    this.week_ = 0;
    this.ids = ['A', 'B', 'C'].slice(0, cfg.sites);
    this.sites = Object.fromEntries(this.ids.map((id) => [id, new BunkerSite({ ledger, crews, cfg: { width: cfg.siteWidth, depth: cfg.siteDepth }, name: `Compound site ${id}`, ...siteOpts })]));
    this.tunnels = cfg.tunnels.map(([a, b]) => ({ id: `${a}${b}`, a, b, depth: null, state: 'planned', events: [] }));
    this.besieged = new Set(); // site ids under siege this week (set by the Pitchforks / sieges system)
    this.log = [];
  }

  tunnel(id) { return this.tunnels.find((t) => t.id === id); }

  /** Cost of digging a tunnel at a depth (deeper tunnels cost more: the stratum's own dig cost scales it). */
  tunnelCost(depth) {
    const deep = 1 + Math.max(0, depth - 10) / 20;
    return money(this.cfg.tunnelCostPerMetre * this.cfg.tunnelLength * deep);
  }

  /** Dig (or re-dig) a tunnel at `depth` metres. Shallow is cheaper and dry; below the water table it can flood. */
  digTunnel(id, depth = 8) {
    const t = this.tunnel(id);
    if (!t) return { ok: false, reason: 'No such tunnel' };
    if (t.state === 'open') return { ok: false, reason: 'Already open' };
    const cost = this.tunnelCost(depth);
    this.ledger?.record('builds', `Compound tunnel ${t.a}-${t.b} at ${depth} m`, -cost);
    t.depth = depth;
    t.state = 'open';
    this._note(`Tunnel ${t.a}-${t.b} dug at ${depth} m${depth > this.cfg.waterTable ? ' (below the water table: it can flood)' : ''}.`);
    return { ok: true, cost };
  }

  /** Pump out a flooded tunnel or reseal a breached one. */
  repairTunnel(id) {
    const t = this.tunnel(id);
    if (!t || (t.state !== 'flooded' && t.state !== 'breached')) return { ok: false, reason: 'Nothing to repair' };
    const cost = money(this.cfg.pumpOutCost);
    this.ledger?.record('builds', `Compound tunnel ${t.a}-${t.b} ${t.state === 'flooded' ? 'pumped out' : 'resealed'}`, -cost);
    this._note(`Tunnel ${t.a}-${t.b} ${t.state === 'flooded' ? 'pumped out' : 'resealed'}.`);
    t.state = 'open';
    return { ok: true, cost };
  }

  /** A week passes: tunnels below the water table may flood; tunnels to a besieged site may be breached. */
  week() {
    this.week_ += 1;
    const events = [];
    for (const t of this.tunnels) {
      if (t.state !== 'open') continue;
      if (t.depth > this.cfg.waterTable && this.rand() < this.cfg.floodChancePerWeek) {
        t.state = 'flooded';
        events.push({ type: 'flood', tunnel: t.id });
        this._note(`TUNNEL FLOODED: ${t.a}-${t.b}. The sites are cut off from each other until it is pumped out.`);
      } else if ((this.besieged.has(t.a) || this.besieged.has(t.b)) && this.rand() < this.cfg.breachChancePerWeekAtSiege) {
        t.state = 'breached';
        events.push({ type: 'breach', tunnel: t.id });
        this._note(`TUNNEL BREACHED: ${t.a}-${t.b}. The mob got in through the tunnel; it is sealed off.`);
      }
    }
    return events;
  }

  /** Groups of sites joined by open tunnels. */
  groups() {
    const parent = Object.fromEntries(this.ids.map((id) => [id, id]));
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (const t of this.tunnels) if (t.state === 'open') parent[find(t.a)] = find(t.b);
    const out = {};
    for (const id of this.ids) (out[find(id)] ??= []).push(id);
    return Object.values(out);
  }

  /**
   * The Compound as one shelter: each linked group pools its stores (days weighted by the people each site holds);
   * the Compound lasts as long as its weakest group. Sites with nobody in them add their stores to the group.
   */
  summary() {
    const per = Object.fromEntries(this.ids.map((id) => {
      const s = this.sites[id].simulate();
      return [id, { occupants: s.occupants, days: s.daysSealed === Infinity ? 9_999 : s.daysSealed }];
    }));
    const groups = this.groups().map((ids) => {
      const occ = ids.reduce((a, id) => a + per[id].occupants, 0);
      // pooled person-days over the group's people
      const personDays = ids.reduce((a, id) => a + per[id].days * Math.max(1, per[id].occupants), 0);
      const weight = ids.reduce((a, id) => a + Math.max(1, per[id].occupants), 0);
      const days = occ ? Math.round((personDays / weight) * 10) / 10 : 0;
      return { sites: ids, occupants: occ, days };
    });
    const peopled = groups.filter((g) => g.occupants > 0);
    return {
      sites: per,
      groups,
      occupants: groups.reduce((a, g) => a + g.occupants, 0),
      daysSealed: peopled.length ? Math.min(...peopled.map((g) => g.days)) : 0,
      linked: groups.length === 1,
      tunnels: this.tunnels.map((t) => ({ ...t })),
    };
  }

  tick(seconds) { for (const s of Object.values(this.sites)) s.tick(seconds); }

  _note(text) { this.log.push({ week: this.week_, text }); }

  toJSON() {
    return { v: 1, week: this.week_, tunnels: this.tunnels.map((t) => ({ ...t })), sites: Object.fromEntries(this.ids.map((id) => [id, this.sites[id].toJSON()])), log: this.log.slice(-40) };
  }
  load(d) {
    if (!d) return;
    this.week_ = d.week ?? 0;
    for (const t of d.tunnels ?? []) Object.assign(this.tunnel(t.id) ?? {}, t);
    for (const id of this.ids) if (d.sites?.[id]) this.sites[id].load(d.sites[id]);
    this.log = d.log ?? [];
  }
}

// ---------------------------------------------------------------- Ark
export class ArkProject {
  constructor({ ledger = null, consortium = [], cfg = MEGAPROJECTS.ark, crews = () => 1, siteOpts = {} } = {}) {
    this.cfg = cfg;
    this.ledger = ledger;
    this.consortium = consortium.map((c) => ({ ...c })); // the Table members paying for it
    this.site = new BunkerSite({ ledger, crews, cfg: { width: cfg.width, depth: cfg.depth }, name: 'The Ark', ...siteOpts });
    this.handedOver = false;
  }

  /** Which Ark module each room is (greybox): a room wide enough holding the module's pieces. */
  modules(sim = this.site.simulate()) {
    const found = {};
    for (const [id, m] of Object.entries(this.cfg.modules)) {
      const room = sim.rooms.find((r) => !r.touchesSky && r.width >= m.minW && Object.entries(m.needs).every(([o, n]) => (r.counts?.[o] ?? 0) >= n));
      found[id] = room ? { room: room.id, name: m.name } : null;
    }
    return found;
  }

  deepestDug() {
    const s = this.site;
    for (let y = s.H - 1; y >= 0; y--) for (let x = 0; x < s.W; x++) if (s.dug[s.idx(x, y)]) return y;
    return 0;
  }

  /** What the consortium expects before handover. */
  checklist() {
    const sim = this.site.simulate();
    const mods = this.modules(sim);
    const items = [
      { id: 'width', label: `${this.cfg.width}-wide plot`, done: this.site.W >= this.cfg.width },
      { id: 'abyss', label: `Dug down to the Abyss (${this.cfg.abyssDepth} m)`, done: this.deepestDug() >= this.cfg.abyssDepth, detail: `${this.deepestDug()} m` },
      ...Object.entries(this.cfg.modules).map(([id, m]) => ({ id, label: `${m.name} (a room ${m.minW}+ wide with ${Object.entries(m.needs).map(([o, n]) => `${n} ${o.replace(/_/g, ' ')}`).join(', ')})`, done: !!mods[id] })),
      { id: 'occupants', label: `Sleeps ${this.cfg.occupants.min}`, done: sim.occupants >= this.cfg.occupants.min, detail: `${sim.occupants} beds` },
    ];
    return { items, done: items.every((i) => i.done), occupants: sim.occupants, daysSealed: sim.daysSealed };
  }

  /** Price paid by the consortium at handover (GDD $500M+, scaled to the game economy). */
  price() {
    const occ = this.site.simulate().occupants;
    const extra = Math.max(0, occ - this.cfg.occupants.min) / (this.cfg.occupants.max - this.cfg.occupants.min);
    return money(this.cfg.price.min * (1 + extra));
  }

  handOver() {
    const c = this.checklist();
    if (!c.done) return { ok: false, reason: `Not finished: ${c.items.filter((i) => !i.done).map((i) => i.label.split(' (')[0]).join(', ')}` };
    if (this.handedOver) return { ok: false, reason: 'Already handed over' };
    const price = this.price();
    this.ledger?.record('sales', `The Ark: consortium of ${this.consortium.map((m) => m.name).join(', ') || 'The Table'}`, price);
    this.handedOver = true;
    return { ok: true, price };
  }

  tick(seconds) { this.site.tick(seconds); }

  toJSON() { return { v: 1, consortium: this.consortium, site: this.site.toJSON(), handedOver: this.handedOver }; }
  load(d) { if (!d) return; this.consortium = d.consortium ?? []; this.site.load(d.site); this.handedOver = !!d.handedOver; }
}

// ---------------------------------------------------------------- the board of megaprojects
export class MegaprojectBoard {
  constructor({ ledger = null, isUnlocked = () => false, seed = 1, crews = () => 1, siteOpts = {} } = {}) {
    this.ledger = ledger;
    this.isUnlocked = isUnlocked;
    this.seed = seed;
    this.crews = crews;
    this.siteOpts = siteOpts;
    this.compound = null;
    this.ark = null;
    this.listeners = new Set();
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(e) { for (const fn of this.listeners) fn(e, this); }

  startCompound() {
    if (!this.isUnlocked('compound')) return { ok: false, reason: `The Compound unlocks at ${MEGAPROJECTS.compound.unlockAt}` };
    if (this.compound) return { ok: false, reason: 'A Compound is already under way' };
    this.compound = new Compound({ ledger: this.ledger, seed: this.seed, crews: this.crews, siteOpts: this.siteOpts });
    this._emit({ type: 'compound' });
    return { ok: true, compound: this.compound };
  }

  /** Is this lead one of The Table's (who commission the Ark)? */
  static isTableLead(lead) { return lead?.wealthClass === MEGAPROJECTS.ark.tableClass; }

  /** Begin the Ark from a Table lead. */
  startArk(lead) {
    if (!MegaprojectBoard.isTableLead(lead)) return { ok: false, reason: 'Only The Table commissions the Ark (a C5 lead)' };
    if (!this.isUnlocked('ark')) return { ok: false, reason: `The Ark unlocks at ${MEGAPROJECTS.ark.unlockAt}` };
    if (this.ark) {
      if (!this.ark.consortium.some((m) => m.leadId === lead.id)) this.ark.consortium.push({ leadId: lead.id, name: lead.guest?.name ?? 'A Table member' });
      this._emit({ type: 'ark-member', lead });
      return { ok: true, ark: this.ark, joined: true };
    }
    this.ark = new ArkProject({ ledger: this.ledger, crews: this.crews, siteOpts: this.siteOpts, consortium: [{ leadId: lead.id, name: lead.guest?.name ?? 'A Table member' }] });
    this._emit({ type: 'ark', lead });
    return { ok: true, ark: this.ark };
  }

  tick(seconds) { this.compound?.tick(seconds); this.ark?.tick(seconds); }
  week() { const ev = this.compound?.week() ?? []; if (ev.length) this._emit({ type: 'week', events: ev }); return ev; }

  toJSON() { return { v: 1, compound: this.compound?.toJSON() ?? null, ark: this.ark?.toJSON() ?? null }; }
  load(d) {
    if (!d) return;
    if (d.compound) { this.compound = new Compound({ ledger: this.ledger, seed: this.seed, crews: this.crews, siteOpts: this.siteOpts }); this.compound.load(d.compound); }
    if (d.ark) { this.ark = new ArkProject({ ledger: this.ledger, crews: this.crews, siteOpts: this.siteOpts }); this.ark.load(d.ark); }
  }
}
