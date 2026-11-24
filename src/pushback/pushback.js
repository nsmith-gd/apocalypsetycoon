// Pushback systems — pillar 4: "Nothing is free".
//
// Four forces push back on the player:
//   HEAT      0-100  regulators & press. Rises with schemes, decays slowly. Crossing 50 opens an
//                    investigation (a choice); ending a quarter hot draws fines, and maxing it raids you.
//   TENSION   0-100  In the campaign there is ONE tension model: the CrisisSystem's tracks (#90).
//                    pb.useCrisis(crisis) makes pb.tension a read-only view of the hottest open track,
//                    pb.runaways the number of collapsed tracks, and Fund relief calms the hottest track.
//                    Without a crisis system (headless sims, pacing harness, old demos) a single stand-in
//                    world meter remains: schemes feed it, above MOMENTUM it feeds itself, 100 is a RUNAWAY.
//   LEVERAGE  per client. Every shelter buyer knows a little; their leverage grows with your heat.
//                    Clients make demands (pay for upgrades) or blackmail you (hush money or heat).
//   BOARD     sets a quarterly profit target that grows every quarter. Misses cost confidence and
//                    money; three strikes and the board ousts you.
//
// Plain ES module with no DOM, so the campaign clock, schemes and sales systems can drive it and
// tests can run it in node. Money flows through any ledger-like object with
// `record(category, label, amount)` (see src/ledger/ledger.js), or is tracked internally if none.
//
// Wiring (see README.md next to this file):
//   pb.onScheme({ label, heat, tension })    — schemes system, every time a scheme runs
//   pb.onSale({ client, price, region })      — world map, every shelter sold
//   pb.recordProfit(amount)                   — optional, if you aren't passing a ledger
//   const report = pb.endQuarter({ quarter, profit })   — campaign clock at quarter end
//   pb.pending / pb.resolve(eventId, optionId) — choice events for the UI
//   pb.on('event' | 'change' | 'resolved' | 'ousted' | 'runaway', fn)

import { PUSHBACK_DEFAULTS, MONEY } from '../config/tuning.js';
import { seededRng } from '../campaign/rng.js';
export { PUSHBACK_DEFAULTS }; // lives in the single tuning table (#77)

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const round = (n, to = 1_000) => Math.round(n / to) * to;
const PB = MONEY.fromStandIn.pushback; // #91: this module's stand-in money x PB = GDD dollars

/** Small seeded RNG so playthroughs and tests are reproducible. */
export function mulberry32(seed) { return seededRng(seed); } // saveable state (#80)

function deepMerge(base, over = {}) {
  const out = {};
  for (const [k, v] of Object.entries(base)) {
    out[k] = v && typeof v === 'object' ? { ...v, ...(over[k] ?? {}) } : over[k] ?? v;
  }
  return out;
}

const DEMANDS = [
  { want: 'a gold-plated panic room', cost: 40_000 * PB },
  { want: 'a private cryo pod for their yacht captain', cost: 60_000 * PB },
  { want: 'a wine cellar rated for nuclear winter', cost: 35_000 * PB },
  { want: 'a second helipad, "for the dog"', cost: 50_000 * PB },
];
const SECRETS = [
  'the leaked pandemic memo',
  'who paid for the doom podcast',
  'the shell company behind the riots',
  'your contractor’s missing safety inspections',
];

export class Pushback {
  constructor({ ledger = null, seed = 1, config = {}, startingCash = 0 } = {}) {
    this.cfg = deepMerge(PUSHBACK_DEFAULTS, config);
    this.ledger = ledger;
    this.rng = mulberry32(seed);
    this.heat = this.cfg.heat.start;
    this.crisis = null; // #90: when set, tension and runaways come from its tracks
    this._tension = this.cfg.tension.start; // stand-in world meter (sims and demos only)
    this._runaways = 0;
    this.quarter = 1;
    this.clients = []; // { id, name, region, price, leverage, appeased }
    this.board = {
      target: this.cfg.board.firstTarget,
      confidence: this.cfg.board.strikesToOust, // lives left
      strikes: 0,
      history: [], // { quarter, target, profit, met }
      buildCostMultiplier: 1,
      ousted: false,
    };
    this.schemeHeatMultiplier = 1; // the board's Scrutiny state raises it (src/board/board.js)
    this.pending = []; // choice events waiting on the player
    this.log = []; // everything that happened, newest last
    this.doomsdayShift = 0; // legacy runaway counter (stand-in meter only); the Doom Clock hears the crisis tracks
    this._ids = 0;
    this._investigatedThisQuarter = false;
    this._internalCash = startingCash; // only used when no ledger is attached
    this._quarterProfit = 0; // only used when no ledger is attached
    this._listeners = new Map();
  }

  // ---------- events ----------
  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
    return () => this._listeners.get(type).delete(fn);
  }
  _emit(type, payload) {
    for (const fn of this._listeners.get(type) ?? []) fn(payload, this);
  }
  _changed() {
    this._emit('change', this.snapshot());
  }

  // ---------- money ----------
  get cash() {
    return this.ledger ? this.ledger.cash : this._internalCash;
  }
  _pay(category, label, amount) {
    // amount < 0 = expense
    if (!amount) return;
    if (this.ledger) this.ledger.record(category, label, amount);
    else {
      this._internalCash += amount;
      this._quarterProfit += amount;
    }
  }
  /** Feed income/expenses from other systems when no ledger is attached. */
  recordProfit(amount) {
    this._internalCash += amount;
    this._quarterProfit += amount;
  }

  _note(kind, text, extra = {}) {
    const entry = { quarter: this.quarter, kind, text, ...extra };
    this.log.push(entry);
    return entry;
  }

  // ---------- the one tension model (#90) ----------
  /** Hand tension over to a CrisisSystem: its tracks become the only tension. */
  useCrisis(crisis) {
    this.crisis = crisis;
    crisis?.on?.('week', () => this._changed());
    crisis?.on?.('collapse', () => this._changed());
    this._changed();
    return this;
  }

  /** The hottest open crisis track (0-100), or the stand-in meter when no crisis system is attached. */
  get tension() {
    if (!this.crisis) return this._tension;
    return Math.max(0, ...Object.values(this.crisis.tracks).filter((t) => t.open !== false).map((t) => t.tension));
  }
  set tension(v) { if (!this.crisis) this._tension = v; }

  /** Runaway crises: collapsed tracks when a crisis system is attached. */
  get runaways() { return this.crisis ? Object.values(this.crisis.tracks).filter((t) => t.state === 'collapsed').length : this._runaways; }
  set runaways(v) { if (!this.crisis) this._runaways = v; }

  /** The hottest open track that can still be calmed (not collapsed, not locked). */
  hottestTrack() {
    if (!this.crisis) return null;
    const open = Object.values(this.crisis.tracks).filter((t) => t.open !== false && t.state !== 'collapsed' && t.state !== 'locked');
    return open.sort((a, b) => b.tension - a.tension)[0] ?? null;
  }

  // ---------- inputs from other systems ----------
  /** Call whenever a scheme runs. `heat`/`tension` are the scheme's raw amounts. */
  onScheme({ label = 'Scheme', heat = 0, tension = 0 } = {}) {
    if (this.board.ousted) return [];
    const fired = [];
    this.addTension(tension, label, fired);
    this.addHeat(heat * this.schemeHeatMultiplier, label, fired);
    this._changed();
    return fired;
  }

  /** Call whenever a shelter is sold. Every buyer becomes a client with leverage over you. */
  onSale({ client, price = 0, region = '', leverage = 0 } = {}) {
    const c = {
      id: ++this._ids,
      name: client ?? `Client #${this.clients.length + 1}`,
      region,
      price,
      leverage: this.cfg.leverage.perSale + Math.max(0, leverage), // + leverage earned in conversation (#55)
      appeased: 0,
    };
    this.clients.push(c);
    this._changed();
    return c;
  }

  /** One in-game week: heat cools by heat.decayPerWeek (GDD Difficulty: 2 / 1 / 0.5). */
  weekTick() {
    const d = this.cfg.heat.decayPerWeek ?? 0;
    if (!d || this.heat <= 0) return;
    this.heat = clamp(this.heat - d);
    this._changed?.();
  }

  addHeat(amount, source = '', fired = []) {
    const h = this.cfg.heat;
    const before = this.heat;
    this.heat = clamp(this.heat + amount);
    if (amount > 0) this._note('heat', `${source}: heat +${amount}`, { amount });
    if (before < h.investigationAt && this.heat >= h.investigationAt && !this._investigatedThisQuarter) {
      this._investigatedThisQuarter = true;
      fired.push(this._queue(this._investigation(source)));
    }
    if (this.heat >= h.raidAt && before < h.raidAt) fired.push(this._raid());
    return fired;
  }

  addTension(amount, source = '', fired = []) {
    if (this.crisis) return fired; // schemes push the crisis tracks themselves; there is no second meter
    const t = this.cfg.tension;
    const before = this.tension;
    this.tension = clamp(this.tension + amount);
    if (amount > 0) this._note('tension', `${source}: tension +${amount}`, { amount });
    // One runaway per quarter: past that the world is already on fire and tension just sits at the cap.
    if (this.tension >= t.runawayAt && before < t.runawayAt) {
      if (!this._runawayThisQuarter) {
        this._runawayThisQuarter = true;
        fired.push(this._runaway(source));
      } else {
        this.tension = t.runawayAt - 1; // held just under the line until next quarter
      }
    }
    return fired;
  }

  // ---------- consequences ----------
  _queue(evt) {
    this.pending.push(evt);
    this._note('event', evt.title, { eventId: evt.id });
    this._emit('event', evt);
    return evt;
  }

  _investigation(source) {
    const settle = Math.max(40_000 * PB, round(this.cash * 0.08));
    return {
      id: ++this._ids,
      type: 'investigation',
      icon: '!',
      title: 'Federal investigation opened',
      body: `Regulators traced "${source}" back to Last Resort Holdings. Heat is ${Math.round(this.heat)}.`,
      options: [
        { id: 'settle', label: `Settle quietly (-${fmt(settle)}, heat -25)`, cost: settle, heat: -25 },
        { id: 'lawyers', label: `Lawyer up (-${fmt(20_000 * PB)}, heat -8)`, cost: 20_000 * PB, heat: -8 },
        { id: 'stonewall', label: 'Stonewall (free, heat +12)', cost: 0, heat: 12 },
      ],
    };
  }

  _raid() {
    const h = this.cfg.heat;
    const fine = Math.max(h.raidFine, round(this.cash * 0.2));
    this._pay('fines', 'Federal raid', -fine);
    this.heat = h.raidHeatAfter;
    const evt = {
      id: ++this._ids,
      type: 'raid',
      icon: 'X',
      title: 'FEDERAL RAID',
      body: `Agents seized the servers. You paid ${fmt(fine)} in fines and bail. Heat drops to ${h.raidHeatAfter}.`,
      fine,
      options: [{ id: 'ok', label: 'Lawyers are on it' }],
    };
    return this._queue(evt);
  }

  _runaway(source) {
    const t = this.cfg.tension;
    const damage = Math.min(t.runawayDamageMax, Math.max(t.runawayDamageMin, round(this.cash * t.runawayDamagePct)));
    this._pay('fines', 'Runaway crisis damages', -damage);
    this.tension = t.runawayResetTo;
    this.runaways += 1;
    this.doomsdayShift += 1;
    // Clients panic: a runaway hands every client more leverage.
    for (const c of this.clients) c.leverage += 15;
    const evt = {
      id: ++this._ids,
      type: 'runaway',
      icon: '*',
      title: 'RUNAWAY CRISIS',
      body: `"${source}" tipped the world over the edge. Riots hit your sites (${fmt(damage)} in damages), clients panic, and the doomsday clock jumps forward.`,
      damage,
      options: [{ id: 'ok', label: 'Board up the windows' }],
    };
    this._emit('runaway', evt);
    return this._queue(evt);
  }

  _leverageEvents() {
    const L = this.cfg.leverage;
    const fired = [];
    const candidates = this.clients
      .filter((c) => c.leverage >= L.demandAt)
      .sort((a, b) => b.leverage - a.leverage);
    for (const c of candidates) {
      if (fired.length >= L.maxEventsPerQuarter) break;
      // chance scales with how far past the threshold they are
      const chance = clamp((c.leverage - L.demandAt) / 40 + 0.35, 0, 0.95);
      if (this.rng() > chance) continue;
      if (c.leverage >= L.blackmailAt) fired.push(this._queue(this._blackmail(c)));
      else fired.push(this._queue(this._demand(c)));
    }
    return fired;
  }

  _demand(c) {
    const d = DEMANDS[Math.floor(this.rng() * DEMANDS.length)];
    return {
      id: ++this._ids,
      type: 'demand',
      icon: '?',
      clientId: c.id,
      title: `${c.name} has demands`,
      body: `${c.name} wants ${d.want}, free of charge, or they start telling other buyers what they've seen.`,
      options: [
        { id: 'comply', label: `Comply (-$${d.cost / 1000}K, leverage resets)`, cost: d.cost, leverage: -c.leverage + 5 },
        { id: 'refuse', label: 'Refuse (heat +10, leverage +15)', cost: 0, heat: 10, leverage: 15 },
      ],
    };
  }

  _blackmail(c) {
    const secret = SECRETS[Math.floor(this.rng() * SECRETS.length)];
    const hush = Math.max(50_000 * PB, round(c.price * 0.4));
    return {
      id: ++this._ids,
      type: 'blackmail',
      icon: '$',
      clientId: c.id,
      title: `BLACKMAIL: ${c.name}`,
      body: `${c.name} knows about ${secret}. Pay, or it goes to the press.`,
      options: [
        { id: 'pay', label: `Pay hush money (-$${hush / 1000}K)`, cost: hush, leverage: -c.leverage + 10 },
        { id: 'refund', label: 'Refund their shelter & cut ties (heat +5)', cost: Math.round(c.price * 0.5), heat: 5, removeClient: true },
        { id: 'call-bluff', label: 'Call their bluff (heat +25)', cost: 0, heat: 25, leverage: -10 },
      ],
    };
  }

  /** Player picked an option on a pending event. */
  resolve(eventId, optionId) {
    const i = this.pending.findIndex((e) => e.id === eventId);
    if (i < 0) return null;
    const evt = this.pending[i];
    const opt = evt.options.find((o) => o.id === optionId) ?? evt.options[0];
    this.pending.splice(i, 1);
    const fired = [];
    const label = `${evt.title} — ${opt.label.replace(/ \(.*\)$/, '')}`;
    if (opt.cost) this._pay(evt.type === 'demand' ? 'builds' : 'fines', label, -opt.cost);
    const client = this.clients.find((c) => c.id === evt.clientId);
    if (client && opt.leverage) client.leverage = Math.max(0, client.leverage + opt.leverage);
    if (client && opt.removeClient) this.clients = this.clients.filter((c) => c !== client);
    if (opt.heat > 0) this.addHeat(opt.heat, evt.title, fired);
    else if (opt.heat < 0) this.heat = clamp(this.heat + opt.heat);
    this._note('resolved', label, { eventId, optionId: opt.id });
    this._emit('resolved', { event: evt, option: opt, fired });
    this._changed();
    return { event: evt, option: opt, fired };
  }

  // ---------- quarter end ----------
  /**
   * Call once at the end of each quarter, BEFORE advancing the clock.
   * `profit` = this quarter's net (ledger.summary(q).net). Omit it if no ledger is attached.
   * Returns { lines, events, board } for the quarter report.
   */
  endQuarter({ quarter = this.quarter, profit } = {}) {
    const H = this.cfg.heat;
    const T = this.cfg.tension;
    const B = this.cfg.board;
    const L = this.cfg.leverage;
    const lines = [];
    const events = [];
    if (profit == null) profit = this.ledger ? this.ledger.summary(quarter).net : this._quarterProfit;

    // 1. Board review — on operating profit, before this method's own fines/bonuses.
    let boardResult = null;
    if (B.enabled) boardResult = this._boardReview({ quarter, profit, lines, events });

    // 2. Heat: fines if you end the quarter hot, then natural cooling.
    if (this.heat >= H.fineAt) {
      const fine = round((this.heat - H.fineAt + 10) * H.finePerPoint * (1 + quarter * 0.15));
      this._pay('fines', 'Regulator fine', -fine);
      lines.push(`Regulator fine ${fmt(fine)} (heat ${Math.round(this.heat)}).`);
    }
    this.heat = clamp(this.heat - H.decayPerQuarter);

    // 3. Tension (stand-in meter only; with a crisis system the tracks drift on their own weeks).
    if (this.crisis) { /* one tension model: nothing to do here */ } else if (this.tension >= T.momentumAt) {
      lines.push(`Tension has momentum: +${T.momentumGain} on its own.`);
      this.addTension(T.momentumGain, 'Momentum', events);
    } else {
      this.tension = clamp(this.tension - T.decayPerQuarter);
    }

    // 4. Client leverage grows with heat, then clients may act on it.
    for (const c of this.clients) c.leverage += Math.round(this.heat * L.heatFactor);
    events.push(...this._leverageEvents());

    this.quarter = quarter + 1;
    this._investigatedThisQuarter = false;
    this._runawayThisQuarter = false;
    this._reliefUses = {};
    this._quarterProfit = 0;
    for (const l of lines) this._note('quarter', l);
    this._changed();
    return { lines, events, board: boardResult };
  }

  /** The legacy three-strikes profit target (used by the sim and demos; the campaign uses src/board). */
  _boardReview({ quarter, profit, lines, events }) {
    const B = this.cfg.board;
    const target = this.board.target;
    const met = profit >= target;
    this.board.history.push({ quarter, target, profit, met });
    this.board.buildCostMultiplier = 1;
    let boardResult;
    if (met) {
      const bonus = round(profit * B.beatBonusPct);
      if (bonus > 0) this._pay('other', 'Board performance bonus', bonus);
      if (this.board.strikes > 0) this.board.strikes -= 1;
      boardResult = { met, target, profit, bonus, strikes: this.board.strikes };
      lines.push(`Board target MET (${fmt(profit)} vs ${fmt(target)}). Bonus ${fmt(bonus)}.${this.board.strikes ? ` Strikes now ${this.board.strikes}.` : ''}`);
    } else {
      this.board.strikes += 1;
      const clawback = Math.min(B.missClawbackMax, Math.max(B.missClawbackMin, round(Math.max(0, this.cash) * B.missClawbackPct)));
      this._pay('fines', `Board penalty: missed target (strike ${this.board.strikes})`, -clawback);
      boardResult = { met, target, profit, clawback, strikes: this.board.strikes };
      lines.push(`Board target MISSED (${fmt(profit)} vs ${fmt(target)}). Strike ${this.board.strikes}/${B.strikesToOust}: ${fmt(clawback)} clawed back.`);
      if (this.board.strikes === B.strikesToOust - 1) {
        this.board.buildCostMultiplier = B.freezeMultiplier;
        lines.push(`Budget freeze: builds cost ${Math.round((B.freezeMultiplier - 1) * 100)}% more next quarter.`);
      }
      events.push(this._queue({
        id: ++this._ids,
        type: 'board',
        icon: 'B',
        title: this.board.strikes >= B.strikesToOust ? 'THE BOARD HAS VOTED' : 'The board is displeased',
        body: this.board.strikes >= B.strikesToOust
          ? `Three missed targets. The board removes you as CEO of Last Resort Holdings.`
          : `You made ${fmt(profit)} against a ${fmt(target)} target. ${fmt(clawback)} of executive pay is clawed back.` +
            (this.board.buildCostMultiplier > 1 ? ' One more miss and you are out. Until then, a budget freeze makes every build cost more.' : ''),
        options: [{ id: 'ok', label: this.board.strikes >= B.strikesToOust ? 'Clear out your desk' : 'It won’t happen again' }],
      }));
      if (this.board.strikes >= B.strikesToOust) {
        this.board.ousted = true;
        this._emit('ousted', boardResult);
      }
    }
    // Next target: after a hit, growth on top of the last target, nudged toward any overperformance
    // (a great quarter makes the board greedier, but not all at once). After a miss the board
    // recalibrates halfway toward what you actually made (never below the first target), so one
    // record quarter can't set a bar that the rest of the campaign can never clear.
    if (met) {
      const base = target + Math.max(0, profit - target) * B.ratchet;
      this.board.target = round(base * (1 + B.growth), 5_000 * PB);
    } else {
      this.board.target = round(Math.max(B.firstTarget, (target + Math.max(0, profit)) / 2), 5_000 * PB);
    }
    return boardResult;
  }

  // ---------- read-out ----------
  snapshot() {
    return {
      quarter: this.quarter,
      heat: this.heat,
      tension: this.tension,
      boardTarget: this.board.target,
      boardStrikes: this.board.strikes,
      boardOusted: this.board.ousted,
      buildCostMultiplier: this.board.buildCostMultiplier,
      clients: this.clients.map((c) => ({ ...c })),
      pending: this.pending.length,
      runaways: this.runaways,
      doomsdayShift: this.doomsdayShift,
    };
  }

  // ---------- relief valves ----------
  /** Current price of a relief action this quarter (rises with each use). */
  reliefCost(kind) {
    const R = this.cfg.relief;
    const used = this._reliefUses?.[kind] ?? 0;
    return Math.round(R[kind].cost * (1 + R.repeatMarkup) ** used);
  }

  /** Lay low: pay to shed heat. Returns what happened. */
  layLow() {
    return this._relief('layLow');
  }

  /** Fund disaster relief: pay to lower world tension (the press notices: a little heat). */
  fundRelief() {
    return this._relief('fundRelief');
  }

  _relief(kind) {
    if (this.board.ousted) return null;
    const r = this.cfg.relief[kind];
    const cost = this.reliefCost(kind);
    this._reliefUses = this._reliefUses ?? {};
    this._reliefUses[kind] = (this._reliefUses[kind] ?? 0) + 1;
    this._pay('schemes', r.label, -cost);
    const before = { heat: this.heat, tension: this.tension };
    if (r.tension && this.crisis) {
      const t = this.hottestTrack();
      if (t) this.crisis.addTension(t.id, r.tension, r.label);
    } else if (r.tension) this.tension = clamp(this.tension + r.tension);
    const fired = [];
    if (r.heat > 0) this.addHeat(r.heat, r.label, fired);
    else if (r.heat < 0) this.heat = clamp(this.heat + r.heat);
    this._note('relief', `${r.label}: -${fmt(cost)}`, { kind, cost });
    this._changed();
    return { kind, cost, heat: this.heat - before.heat, tension: this.tension - before.tension, fired, nextCost: this.reliefCost(kind) };
  }

  /**
   * Every pressure source in one data model: its value, its zone, and the next consequence the
   * player is heading for. `quarterProfit` (optional) fills in board progress.
   */
  pressures({ quarterProfit = null } = {}) {
    const H = this.cfg.heat;
    const T = this.cfg.tension;
    const L = this.cfg.leverage;
    const B = this.cfg.board;
    const heatNext = this.heat < H.investigationAt && !this._investigatedThisQuarter
      ? { at: H.investigationAt, what: 'Federal investigation opens' }
      : this.heat < H.fineAt ? { at: H.fineAt, what: 'Regulator fine at quarter end' }
      : this.heat < H.raidAt ? { at: H.raidAt, what: 'Federal raid' } : null;
    const tensionNext = this.tension < T.momentumAt
      ? { at: T.momentumAt, what: 'Tension starts feeding itself' }
      : { at: T.runawayAt, what: 'Runaway crisis' };
    const clients = this.clients.map((c) => {
      const zone = c.leverage >= L.blackmailAt ? 'blackmail' : c.leverage >= L.demandAt ? 'demand' : 'quiet';
      const next = c.leverage < L.demandAt ? { at: L.demandAt, what: 'Starts making demands' } : c.leverage < L.blackmailAt ? { at: L.blackmailAt, what: 'Turns to blackmail' } : null;
      return { id: c.id, name: c.name, leverage: c.leverage, zone, next };
    });
    const top = clients.reduce((a, c) => (!a || c.leverage > a.leverage ? c : a), null);
    return {
      heat: {
        value: this.heat, max: 100, zone: this.heatZone(), next: heatNext,
        perQuarter: -H.decayPerQuarter,
        relief: { action: 'layLow', cost: this.reliefCost('layLow'), effect: this.cfg.relief.layLow.heat },
      },
      tension: {
        value: this.tension, max: 100, zone: this.tensionZone(), next: tensionNext,
        selfFeeding: this.tension >= T.momentumAt,
        perQuarter: this.tension >= T.momentumAt ? T.momentumGain : -T.decayPerQuarter,
        runaways: this.runaways, runawayThisQuarter: !!this._runawayThisQuarter,
        relief: { action: 'fundRelief', cost: this.reliefCost('fundRelief'), effect: this.cfg.relief.fundRelief.tension },
      },
      leverage: {
        clients, highest: top,
        growthPerQuarter: Math.round(this.heat * L.heatFactor),
        zone: top?.zone ?? 'quiet',
      },
      board: {
        target: this.board.target, progress: quarterProfit,
        onTrack: quarterProfit == null ? null : quarterProfit >= this.board.target,
        strikes: this.board.strikes, strikesToOust: B.strikesToOust, ousted: this.board.ousted,
        buildCostMultiplier: this.board.buildCostMultiplier,
        zone: this.board.ousted ? 'ousted' : this.board.strikes >= B.strikesToOust - 1 ? 'last-chance' : this.board.strikes ? 'displeased' : 'content',
        next: this.board.ousted ? null : { what: this.board.strikes >= B.strikesToOust - 1 ? 'One more miss and you are ousted' : `A miss is strike ${this.board.strikes + 1} of ${B.strikesToOust}` },
      },
    };
  }

  // ---------- save / load ----------
  toJSON() {
    return {
      v: 1,
      heat: this.heat, tension: this.tension, quarter: this.quarter,
      clients: this.clients.map((c) => ({ ...c })),
      board: { ...this.board, history: this.board.history.map((h) => ({ ...h })) },
      pending: this.pending.map((e) => JSON.parse(JSON.stringify(e))),
      runaways: this.runaways, doomsdayShift: this.doomsdayShift, ids: this._ids,
      flags: { investigated: this._investigatedThisQuarter, runaway: !!this._runawayThisQuarter, reliefUses: { ...(this._reliefUses ?? {}) } },
      internalCash: this._internalCash, quarterProfit: this._quarterProfit,
    };
  }

  /** Rebuild from toJSON() output. The RNG restarts from `seed`. */
  static fromJSON(data, { ledger = null, seed = 1, config = {} } = {}) {
    const pb = new Pushback({ ledger, seed, config });
    Object.assign(pb, {
      heat: data.heat, tension: data.tension, quarter: data.quarter,
      clients: data.clients.map((c) => ({ ...c })),
      board: { ...data.board, history: data.board.history.map((h) => ({ ...h })) },
      pending: data.pending.map((e) => ({ ...e })),
      runaways: data.runaways, doomsdayShift: data.doomsdayShift, _ids: data.ids,
      _investigatedThisQuarter: data.flags.investigated, _runawayThisQuarter: data.flags.runaway,
      _reliefUses: { ...data.flags.reliefUses },
      _internalCash: data.internalCash, _quarterProfit: data.quarterProfit,
    });
    return pb;
  }

  heatZone() {
    const h = this.cfg.heat;
    if (this.heat >= h.fineAt) return 'hot';
    if (this.heat >= h.investigationAt - 15) return 'watched';
    return 'low';
  }
  tensionZone() {
    if (this.tension >= this.cfg.tension.momentumAt) return 'momentum';
    return 'contained';
  }
}

export function fmt(n) {
  const a = Math.abs(Math.round(n));
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `${(a / 1e3).toFixed(0)}K` : a.toLocaleString('en-US');
  return `${n < 0 ? '-' : ''}$${s}`;
}
