// Shelter grid: the build canvas (pillar 2: "the shelter grid is what you build").
// Pure rules, no DOM.
//
// A cross-section of cols x rows 16px cells. Row 0 is the surface, column 0 is the ladder shaft
// (the Utility Spine in life.js terms). Every other cell is earth until a room is ordered there.
//
//   const grid = new ShelterGrid({ ledger, costMultiplier: () => pb.board.buildCostMultiplier, crews: () => tree.crewCount });
//   grid.quote(col, row, 'gold_taps')   -> { ok, cost, dig, room, reason }
//   grid.place(col, row, 'gold_taps')   -> books the cost in the ledger and queues the job for a crew
//   grid.remove(col, row)               -> cancels (full refund) or demolishes (50% salvage)
//   grid.tick(gameSeconds)              -> crews work through the queue; rooms count once built
//   grid.stats()                        -> the shelter stat sheet (air/water/food vs need, grades, prestige...)
//   grid.toShelter()                    -> { id, name, owner, occupants, rooms: [ids] } for computeMidnight
//
// Costs: room price (ROOM_CATALOG) + digging the cell (STRATA by depth, 5 m per row) the first
// time it is excavated, times the board's build-cost multiplier. Demolishing returns half the room
// price; the hole stays dug. Cancelling a job that hasn't finished refunds everything.
// Build time: dig seconds by stratum + fit-out seconds, in game seconds (a 27-minute quarter is
// 1620 s), so one shovel crew finishes roughly 8 to 12 rooms a quarter.

import { STYLES, DEFAULT_STYLE } from './styles.js';
import { ROOM_CATALOG, availableRooms } from '../clients/rooms.js';
import { gradeShelter, LUXURY_PRESTIGE } from '../midnight/midnight.js';
import { stratumAt, FLOOR_METERS } from './life.js';
import { MONEY } from '../config/tuning.js';

// Fit-out time per $100K of the old $K room prices; #91 moved prices to GDD dollars (x MONEY.fromStandIn.rooms).
const FIT_OUT_PER = 100_000 * MONEY.fromStandIn.rooms;

export const GRID = Object.freeze({
  cols: 10,
  rows: 6,
  shaftCol: 0,
  salvage: 0.5, // share of a room's price you get back when you demolish it
  baseOccupants: 2, // you and a plus-one; every bunk room adds bedsPerBunk
  bedsPerBunk: 4,
  digSeconds: { topsoil: 60, clay: 90, sandstone: 120, granite: 180, bedrock: 240 },
  fitOutSeconds: 60,
  fitOutPer100k: 30, // pricier rooms take longer to fit out
});

export const depthOfRow = (row) => row * FLOOR_METERS;

export class ShelterGrid {
  constructor({ ledger = null, costMultiplier = () => 1, crews = () => 1, isUnlocked = () => false, name = 'Last Resort HQ', cfg = GRID } = {}) {
    this.cfg = cfg;
    this.cols = cfg.cols;
    this.rows = cfg.rows;
    this.ledger = ledger;
    this.costMultiplier = costMultiplier;
    this.crews = crews;
    this.isUnlocked = isUnlocked;
    this.name = name;
    this.cells = new Map(); // "col,row" -> { col, row, id, built, progress, need, paid, digPaid }
    this.dug = new Set(); // cells already excavated
    this.listeners = new Set();
  }

  // ---------- queries ----------
  key(col, row) { return `${col},${row}`; }
  at(col, row) { return this.cells.get(this.key(col, row)) ?? null; }
  get rooms() { return [...this.cells.values()]; }
  get built() { return this.rooms.filter((r) => r.built); }
  get queue() { return this.rooms.filter((r) => !r.built).sort((a, b) => a.order - b.order); }
  palette() { return Object.keys(ROOM_CATALOG).map((id) => ({ id, ...ROOM_CATALOG[id], locked: !availableRooms(this.isUnlocked).includes(id) })); }

  isBuildable(col, row) {
    return col >= 0 && col < this.cols && row >= 1 && row < this.rows && col !== this.cfg.shaftCol;
  }

  stratum(row) { return stratumAt(depthOfRow(row)); }

  /** What placing `id` at (col,row) would cost, and whether it's allowed. */
  quote(col, row, id) {
    const def = ROOM_CATALOG[id];
    if (!def) return { ok: false, reason: 'Unknown room' };
    if (!this.isBuildable(col, row)) return { ok: false, reason: row === 0 ? 'Nothing goes on the surface yet' : 'The ladder shaft stays clear' };
    if (this.at(col, row)) return { ok: false, reason: 'Something is already there' };
    if (def.research && !this.isUnlocked(id)) return { ok: false, reason: 'Needs research first' };
    const mult = this.costMultiplier() || 1;
    const s = this.stratum(row);
    const dig = this.dug.has(this.key(col, row)) ? 0 : Math.round(s.digCost * mult);
    const room = Math.round(def.cost * mult);
    const cost = dig + room;
    const cash = this.ledger?.cash ?? Infinity;
    if (cost > cash) return { ok: false, cost, dig, room, stratum: s, reason: 'Not enough cash' };
    return { ok: true, cost, dig, room, stratum: s, seconds: this.buildSeconds(col, row, id) };
  }

  buildSeconds(col, row, id) {
    const dig = this.dug.has(this.key(col, row)) ? 0 : this.cfg.digSeconds[this.stratum(row).id] ?? 90;
    return dig + this.cfg.fitOutSeconds + Math.round((ROOM_CATALOG[id].cost / FIT_OUT_PER) * this.cfg.fitOutPer100k);
  }

  // ---------- actions ----------
  place(col, row, id, { style = DEFAULT_STYLE } = {}) {
    const q = this.quote(col, row, id);
    if (!q.ok) return q;
    const name = ROOM_CATALOG[id].name;
    if (q.dig) this.ledger?.record('builds', `Dig: ${q.stratum.name.toLowerCase()}`, -q.dig);
    this.ledger?.record('builds', `Build: ${name}`, -q.room);
    this._order = (this._order ?? 0) + 1;
    const cell = { col, row, id, style: STYLES[style] ? style : DEFAULT_STYLE, built: false, progress: 0, need: q.seconds, paid: q.room, digPaid: q.dig, order: this._order };
    this.cells.set(this.key(col, row), cell);
    this.emit({ type: 'place', cell, quote: q });
    return { ...q, cell };
  }

  /** Re-skin a placed room (design layer). Free at L0; the room keeps its build progress. */
  setStyle(col, row, style) {
    const cell = this.at(col, row);
    if (!cell || !STYLES[style]) return { ok: false, reason: cell ? 'Unknown style' : 'No room there' };
    const from = cell.style;
    cell.style = style;
    this.emit({ type: 'style', cell, from });
    return { ok: true, from, style };
  }

  remove(col, row) {
    const cell = this.at(col, row);
    if (!cell) return { ok: false, reason: 'Nothing to remove' };
    const name = ROOM_CATALOG[cell.id].name;
    let refund;
    if (!cell.built) {
      // Cancel: the crew hasn't finished. Refund everything, including any digging not yet done.
      refund = cell.paid + cell.digPaid;
      if (refund) this.ledger?.record('builds', `Cancelled: ${name}`, refund);
    } else {
      refund = Math.round(cell.paid * this.cfg.salvage);
      if (refund) this.ledger?.record('builds', `Salvage: ${name}`, refund);
    }
    this.cells.delete(this.key(col, row));
    this.emit({ type: 'remove', cell, refund });
    return { ok: true, refund, cancelled: !cell.built };
  }

  /** Crews work the queue in order, one job per crew. */
  tick(seconds) {
    if (!(seconds > 0)) return [];
    const crews = Math.max(0, this.crews());
    const finished = [];
    const active = this.queue.slice(0, crews);
    for (const job of active) {
      job.progress = Math.min(job.need, job.progress + seconds);
      if (job.digPaid && job.progress >= (this.cfg.digSeconds[this.stratum(job.row).id] ?? 0)) this.dug.add(this.key(job.col, job.row));
      if (job.progress >= job.need) {
        job.built = true;
        this.dug.add(this.key(job.col, job.row));
        finished.push(job);
      }
    }
    if (finished.length) this.emit({ type: 'built', cells: finished });
    else if (active.length) this.emit({ type: 'progress' });
    return finished;
  }

  /** Finish every queued job now (testing / fast-forward). */
  finishAll() {
    const done = [];
    const crews = this.crews;
    this.crews = () => Infinity;
    while (this.queue.length) done.push(...this.tick(1e9));
    this.crews = crews;
    return done;
  }

  /**
   * Hand the finished shelter over for sale: returns { name, rooms, occupants } and clears the
   * site for the next build. Refused while the crew is still working or nothing is built.
   */
  handOver(name = 'Shelter') {
    if (this.queue.length) return { ok: false, reason: 'The crew is still working' };
    if (!this.built.length) return { ok: false, reason: 'Build some rooms first' };
    const shelter = { name, rooms: this.built.map((r) => r.id), occupants: this.occupants };
    this.cells.clear();
    this.dug.clear();
    this.handedOver = (this.handedOver ?? 0) + 1;
    this.emit({ type: 'handover', shelter });
    return { ok: true, shelter };
  }

  // ---------- results ----------
  get occupants() {
    return this.cfg.baseOccupants + this.built.filter((r) => r.id === 'bunk').length * this.cfg.bedsPerBunk;
  }

  toShelter() {
    return { id: 'hq', name: this.name, owner: 'your board', occupants: this.occupants, rooms: this.built.map((r) => r.id), sold: false };
  }

  /** The shelter stat sheet. */
  stats() {
    const g = gradeShelter(this.toShelter());
    const counts = {};
    for (const r of this.built) counts[r.id] = (counts[r.id] ?? 0) + 1;
    const invested = this.rooms.reduce((s, r) => s + r.paid + r.digPaid, 0);
    const luxury = this.built.filter((r) => ROOM_CATALOG[r.id].kind === 'luxury').length;
    const survival = this.built.filter((r) => ROOM_CATALOG[r.id].kind === 'survival').length;
    const deepest = this.built.reduce((d, r) => Math.max(d, depthOfRow(r.row)), 0);
    return {
      occupants: g.occupants,
      supply: g.supply, // { air, water, food, prestige } in people kept alive
      ratios: g.ratios,
      grades: g.grades,
      weakest: g.weakest,
      survivors: g.survivors,
      outcome: g.outcome,
      prestige: g.prestige,
      isLuxury: g.prestige >= LUXURY_PRESTIGE,
      rooms: this.built.length,
      underConstruction: this.queue.length,
      luxury,
      survival,
      counts,
      invested,
      deepest,
      crews: this.crews(),
    };
  }

  // ---------- events / save ----------
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(e) { for (const fn of this.listeners) fn(e, this); }

  toJSON() {
    return { v: 1, cells: this.rooms.map((c) => ({ ...c })), dug: [...this.dug], order: this._order ?? 0, handedOver: this.handedOver ?? 0 };
  }
  load(d) {
    this.cells = new Map((d.cells ?? []).map((c) => [this.key(c.col, c.row), { ...c }]));
    this.dug = new Set(d.dug ?? []);
    this._order = d.order ?? this.cells.size;
    this.handedOver = d.handedOver ?? 0;
    this.emit({ type: 'load' });
  }
}
