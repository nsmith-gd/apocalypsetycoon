// Telemetry (#78; GDD: Economy and tuning > Telemetry). Two logs, both exportable as CSV:
//   WEEKLY  one row per in-game week: tension and momentum per track, heat, cash, RP, board confidence,
//           and leverage per client.
//   EVENTS  one row per thing that happened: scheme, breach, containment, collapse, domino, track open,
//           quota (board result), directive, unlock, choice card, runaway, ousting, ending.
// Works in the browser campaign and headless (the harness, #79): attach() subscribes to whichever real
// systems you pass; anything missing is skipped. Systems that have no event yet log through event().
//
//   const tm = new Telemetry({ getTime: () => ({ quarter, week, minutes }) });
//   tm.attach({ crisis, pushback, ledger, tree, schemes });
//   tm.quota(quarter, boardResult); tm.event('directive', {...}); tm.event('ending', {...});
//   tm.csv('weekly') / tm.csv('events'); tm.download() in the browser.

const r2 = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : n);

export function toCSV(rows, columns = null) {
  const cols = columns ?? [...rows.reduce((s, r) => { for (const k of Object.keys(r)) s.add(k); return s; }, new Set())];
  const cell = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
}

export class Telemetry {
  constructor({ getTime = () => ({}), label = 'campaign' } = {}) {
    this.getTime = getTime;
    this.label = label;
    this.weeks = [];
    this.events = [];
    this.sys = {};
    this._offs = [];
  }

  _stamp() {
    const t = this.getTime() ?? {};
    return { quarter: t.quarter ?? null, week: t.week ?? this.sys.crisis?.week ?? null, minutes: t.minutes != null ? r2(t.minutes) : null };
  }

  /** Log one event row. `data` is flattened into columns (objects become JSON). */
  event(type, data = {}) {
    const row = { ...this._stamp(), type };
    for (const [k, v] of Object.entries(data)) row[k === 'type' ? 'kind' : k] = r2(v); // never clobber the event type
    this.events.push(row);
    return row;
  }

  /** Snapshot the meters into one weekly row. */
  snapshot() {
    const { crisis, pushback: pb, ledger, tree } = this.sys;
    const row = { ...this._stamp() };
    for (const t of Object.values(crisis?.tracks ?? {})) {
      row[`tension_${t.id}`] = r2(t.tension);
      row[`momentum_${t.id}`] = r2(t.momentum ?? 0);
      row[`state_${t.id}`] = t.open === false ? 'closed' : t.state;
    }
    row.heat = r2(pb?.heat ?? null);
    row.world_tension = r2(pb?.tension ?? null);
    row.cash = ledger ? Math.round(ledger.cash) : null;
    row.rp_bank = tree ? r2(tree.pool) : null;
    row.rp_earned = tree ? r2(tree.totalEarned) : null;
    row.rp_last_week = tree?.lastWeek?.total ?? null;
    row.board_confidence = r2(crisis?.boardConfidence ?? null);
    row.board_strikes = pb?.board?.strikes ?? null;
    row.reputation = r2(crisis?.reputation ?? null);
    const clients = pb?.clients ?? [];
    row.clients = clients.length;
    row.leverage_max = clients.length ? Math.max(...clients.map((c) => c.leverage)) : 0;
    row.leverage_by_client = clients.map((c) => `${c.name}:${Math.round(c.leverage)}`).join('; ');
    this.weeks.push(row);
    return row;
  }

  /** Subscribe to the real systems. Each is optional. */
  attach({ crisis = null, pushback = null, ledger = null, tree = null, schemes = null, mapSales = null } = {}) {
    Object.assign(this.sys, { crisis, pushback, ledger, tree, schemes, mapSales });
    const name = (id) => crisis?.tracks?.[id]?.name ?? id;
    if (crisis?.on) {
      this._offs.push(crisis.on('week', () => this.snapshot()));
      this._offs.push(crisis.on('open', (e) => this.event('track_open', { track: e.track, name: name(e.track) })));
      this._offs.push(crisis.on('breach', (e) => this.event('breach', { track: e.track, name: name(e.track), breach_no: e.breachNo, window_weeks: e.weeks, tension: crisis.tracks[e.track]?.tension })));
      this._offs.push(crisis.on('contribute', (e) => this.event('containment', { track: e.track, source: e.source, bar: e.bar })));
      this._offs.push(crisis.on('contained', (e) => this.event('contained', { track: e.track, name: name(e.track), new_tip: e.tip })));
      this._offs.push(crisis.on('collapse', (e) => this.event('collapse', { track: e.track, name: name(e.track) })));
      this._offs.push(crisis.on('domino', (e) => this.event('domino', { from: e.from, to: e.to, strength: e.strength, shove: e.shove })));
    }
    if (schemes?.onChange) this._offs.push(schemes.onChange((e) => { if (e?.type === 'run') this.event('scheme', { scheme: e.scheme?.id, name: e.scheme?.name, region: e.region?.id ?? e.region, track: e.track, gain: e.gain, cost: e.cost ?? e.offer?.cost, breached: !!e.breached }); }));
    if (tree?.onUnlock) this._offs.push(tree.onUnlock((n) => this.event('unlock', { node: n.id, name: n.name, branch: n.branch, tier: n.tier })));
    if (pushback?.on) {
      this._offs.push(pushback.on('event', (e) => this.event('choice_card', { card: e.type, title: e.title, client: e.clientId ?? null })));
      this._offs.push(pushback.on('resolved', (e) => this.event('choice_made', { card: e.event?.type, option: e.option?.id })));
      this._offs.push(pushback.on('runaway', (e) => this.event('runaway', { title: e.title })));
      this._offs.push(pushback.on('ousted', () => this.event('ending', { ending: 'ousted', title: 'Ousted by the board' })));
    }
    if (mapSales?.onChange) this._offs.push(mapSales.onChange((e) => { if (e?.type === 'sale') this.event('sale', { shelter: e.record.name, client: e.record.owner, region: e.record.region, price: e.record.price, via_lead: !!e.record.viaLead }); }));
    return this;
  }

  /** The quarterly board result (quota hit or missed). */
  quota(quarter, board = {}) {
    return this.event('quota', { q: quarter, met: !!board.met, target: board.target, profit: board.profit, strikes: board.strikes });
  }

  /** A Midnight result (computeMidnight). */
  ending(result = {}) {
    return this.event('ending', { ending: result.ending?.id, title: result.ending?.title, midnight: result.type, grade: result.grade?.name, survival: result.survivalRate, apocalypse: result.apocalypse?.name ?? null, control: result.control });
  }

  csv(which = 'weekly') { return toCSV(which === 'weekly' ? this.weeks : this.events); }

  /** Browser: save both logs as CSV files. */
  download() {
    for (const which of ['weekly', 'events']) {
      const blob = new Blob([this.csv(which)], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `apocalypse-tycoon-${this.label}-${which}.csv`;
      document.body.append(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }
  }

  toJSON() { return { weeks: this.weeks, events: this.events }; }
  load(d = {}) { this.weeks = d.weeks ?? []; this.events = d.events ?? []; }
  detach() { for (const off of this._offs) off?.(); this._offs = []; }
}
