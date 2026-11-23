// Pacing: the real-time model and the per-quarter log.
//
// The campaign promise is 5 to 6.5 hours over 12 quarters. Until the campaign clock lands, this
// file is the single place that says how long things take, so the harness and the in-game debug
// panel agree. Two clock models are supported:
//   fixed  — each quarter runs on a real-time clock (QUARTER_MINUTES, the research tree is tuned for
//            27) that pauses while a modal (choice card, quarter report) is open.
//   paced  — the player ends each quarter when they are done; time = actions + reading + planning.

export const PACING = Object.freeze({
  targetHours: [5, 6.5],
  quarters: 12,
  clock: 'fixed',
  quarterMinutes: 27,
  // Clock-paused reading/deciding time (minutes)
  choiceCardMinutes: 0.5,
  quarterReportMinutes: 1.5,
  midnightMinutes: 3,
  introMinutes: 4,
  // Player-paced estimates (seconds per action, minutes of planning per quarter)
  actionSeconds: { build: 25, sell: 45, scheme: 35, research: 20 },
  planningMinutes: 3,
});

/** Real minutes a quarter takes under a clock model, given what happened in it. */
export function quarterMinutes({ builds = 0, sales = 0, schemes = 0, research = 0, choices = 0 } = {}, p = PACING) {
  const paused = choices * p.choiceCardMinutes + p.quarterReportMinutes;
  const actions = (builds * p.actionSeconds.build + sales * p.actionSeconds.sell + schemes * p.actionSeconds.scheme + research * p.actionSeconds.research) / 60;
  return {
    fixed: p.quarterMinutes + paused,
    paced: p.planningMinutes + actions + paused,
    actions,
    paused,
  };
}

/**
 * One row per quarter: cash, crisis, heat, sales and the rest. Works headless (the harness) and
 * in game (the debug panel), with either simulated minutes or the real wall clock.
 */
export class PacingLog {
  constructor({ ledger, pushback, research = null, label = 'run', pacing = PACING } = {}) {
    this.ledger = ledger;
    this.pb = pushback;
    this.research = research;
    this.label = label;
    this.pacing = pacing;
    this.rows = [];
    this.counts = this._zero();
    this.minutes = { fixed: pacing.introMinutes, paced: pacing.introMinutes };
    this.wallStart = typeof performance !== 'undefined' ? performance.now() : 0;
    this.ending = null;
    this._offs = [];
    if (ledger?.onChange) {
      this._offs.push(ledger.onChange((e) => {
        if (!e) return;
        if (e.category === 'builds' && e.amount < 0) this.counts.builds++;
        if (e.category === 'sales' && e.amount > 0) { this.counts.sales++; this.counts.salesRevenue += e.amount; }
        if (e.category === 'schemes') this.counts.schemes++;
        if (e.category === 'fines') this.counts.fines += -e.amount;
      }));
    }
    if (pushback?.on) {
      this._offs.push(pushback.on('event', (evt) => { this.counts.choices++; this.counts.events.push(evt.type); }));
    }
    if (research?.onUnlock) this._offs.push(research.onUnlock((n) => { this.counts.research++; this.counts.unlocks.push(n.name); }));
  }

  _zero() {
    return { builds: 0, sales: 0, salesRevenue: 0, schemes: 0, fines: 0, choices: 0, research: 0, events: [], unlocks: [] };
  }

  /** Call right after pushback.endQuarter(). `board` is its result; extra fields are merged in. */
  endQuarter(quarter, board = null, extra = {}) {
    const c = this.counts;
    const t = quarterMinutes(c, this.pacing);
    this.minutes.fixed += t.fixed;
    this.minutes.paced += t.paced;
    const wall = typeof performance !== 'undefined' ? (performance.now() - this.wallStart) / 60000 : 0;
    const summary = this.ledger?.summary ? this.ledger.summary(quarter) : { net: 0 };
    const row = {
      quarter,
      hours: +(this.minutes.fixed / 60).toFixed(2),
      pacedHours: +(this.minutes.paced / 60).toFixed(2),
      wallMinutes: +wall.toFixed(1),
      cash: Math.round(this.ledger?.cash ?? 0),
      net: Math.round(summary.net),
      crisis: Math.round(this.pb?.tension ?? 0),
      heat: Math.round(this.pb?.heat ?? 0),
      sales: c.sales,
      salesRevenue: Math.round(c.salesRevenue),
      builds: c.builds,
      schemes: c.schemes,
      fines: Math.round(c.fines),
      events: c.events.join(' '),
      boardTarget: board?.target ?? null,
      boardMet: board?.met ?? null,
      strikes: this.pb?.board?.strikes ?? 0,
      runaways: this.pb?.runaways ?? 0,
      unlocks: c.unlocks.join(', '),
      ...extra,
    };
    this.rows.push(row);
    this.counts = this._zero();
    return row;
  }

  finish(ending) {
    this.minutes.fixed += this.pacing.midnightMinutes;
    this.minutes.paced += this.pacing.midnightMinutes;
    this.ending = ending;
    return this.summary();
  }

  summary() {
    const [lo, hi] = this.pacing.targetHours;
    const hours = +(this.minutes.fixed / 60).toFixed(2);
    const pacedHours = +(this.minutes.paced / 60).toFixed(2);
    return {
      label: this.label,
      quarters: this.rows.length,
      hours,
      pacedHours,
      inTarget: hours >= lo && hours <= hi && this.rows.length === this.pacing.quarters,
      pacedInTarget: pacedHours >= lo && pacedHours <= hi,
      ending: this.ending,
      totalSales: this.rows.reduce((s, r) => s + r.sales, 0),
      finalCash: this.rows.at(-1)?.cash ?? 0,
      peakCrisis: Math.max(0, ...this.rows.map((r) => r.crisis)),
      peakHeat: Math.max(0, ...this.rows.map((r) => r.heat)),
    };
  }

  toCSV() {
    if (!this.rows.length) return '';
    const cols = Object.keys(this.rows[0]);
    const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    return [cols.join(','), ...this.rows.map((r) => cols.map((k) => esc(r[k])).join(','))].join('\n');
  }

  detach() { this._offs.forEach((off) => off()); }
}
