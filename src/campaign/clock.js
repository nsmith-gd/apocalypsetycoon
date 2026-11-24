// Campaign clock: one continuous campaign of 12 quarters that ends at Midnight.
//
// Pure logic, no DOM, so it runs in the game, the tests and headless sims.
// Time is real seconds at x1. A quarter lasts PACING.quarterMinutes (27 min), so twelve
// quarters plus paused report/choice reading land inside the 5 to 6.5 hour target.
//
// When a quarter's time runs out the clock holds itself and runs every quarter-end hook
// (they may be async, e.g. the quarter report that waits for the player). Only once they
// have all settled does it move to the next quarter, or to Midnight after Q12.
//
//   const clock = new CampaignClock();
//   clock.onQuarterEnd(async ({ quarter, isFinal }) => { await ui.showQuarterReport({ quarter }); });
//   clock.onQuarterStart(({ quarter }) => ledger.setQuarter(quarter));
//   clock.onMidnight(() => showMidnight(...));
//   each frame: clock.tick(dtSeconds);

import { PACING } from '../debug/pacing.js';

export const TOTAL_QUARTERS = PACING.quarters;
export const QUARTER_SECONDS = PACING.quarterMinutes * 60;
export const SPEEDS = Object.freeze([0, 1, 2, 4]);

export class CampaignClock {
  constructor({ quarterSeconds = QUARTER_SECONDS, totalQuarters = TOTAL_QUARTERS, state = null } = {}) {
    if (!(quarterSeconds > 0)) throw new Error('quarterSeconds must be positive');
    this.quarterSeconds = quarterSeconds;
    this.totalQuarters = totalQuarters;
    this.quarter = 1;
    this.elapsed = 0; // seconds into the current quarter (game time)
    this.total = 0; // seconds into the campaign (game time)
    this.speed = 1;
    this.midnight = false;
    this.holds = new Set(); // reasons the clock is held (quarter report, modal, menu...)
    this._ending = false;
    this._hooks = { quarterEnd: [], quarterStart: [], midnight: [], change: [] };
    if (state) this.load(state);
  }

  // ---------- queries ----------
  get running() { return !this.midnight && !this._ending && this.speed > 0 && this.holds.size === 0; }
  get paused() { return this.speed === 0; }
  get ending() { return this._ending; }
  get quarterProgress() { return this.midnight ? 1 : Math.min(1, this.elapsed / this.quarterSeconds); }
  get campaignProgress() { return Math.min(1, this.total / (this.quarterSeconds * this.totalQuarters)); }
  get secondsLeft() { return Math.max(0, this.quarterSeconds - this.elapsed); }
  /** "Y1 Q3": four quarters a year, three years to Midnight. */
  get label() {
    if (this.midnight) return 'MIDNIGHT';
    return `Y${Math.floor((this.quarter - 1) / 4) + 1} Q${((this.quarter - 1) % 4) + 1}`;
  }

  // ---------- hooks ----------
  /** fn({ quarter, isFinal }) — may return a promise; the clock waits for it. */
  onQuarterEnd(fn) { return this._on('quarterEnd', fn); }
  /** fn({ quarter }) — after the clock moves into a new quarter (2..12). */
  onQuarterStart(fn) { return this._on('quarterStart', fn); }
  /** fn() — once, after the Q12 hooks settle. */
  onMidnight(fn) { return this._on('midnight', fn); }
  /** fn(clock) — speed, hold, quarter or midnight changed. */
  onChange(fn) { return this._on('change', fn); }

  _on(kind, fn) {
    this._hooks[kind].push(fn);
    return () => { this._hooks[kind] = this._hooks[kind].filter((h) => h !== fn); };
  }
  _emit(kind, payload) { for (const fn of [...this._hooks[kind]]) fn(payload, this); }

  // ---------- control ----------
  setSpeed(speed) {
    this.speed = Math.max(0, Number(speed) || 0);
    this._emit('change', this);
  }
  togglePause() { this.setSpeed(this.paused ? 1 : 0); }
  /** Hold the clock for a reason (e.g. 'menu', 'choice'); release() with the same reason. */
  hold(reason) { this.holds.add(reason); this._emit('change', this); }
  release(reason) { this.holds.delete(reason); this._emit('change', this); }

  /** Advance by real seconds, scaled by speed. Returns the quarter-end promise if one started. */
  tick(realSeconds) {
    if (!this.running || !(realSeconds > 0)) return null;
    return this.advance(realSeconds * this.speed);
  }

  /** Advance by game seconds ignoring speed/holds. Stops at the end of a quarter. */
  advance(seconds) {
    if (this.midnight || this._ending) return null;
    const step = Math.min(seconds, this.secondsLeft);
    this.elapsed += step;
    this.total += step;
    if (this.elapsed >= this.quarterSeconds) return this.endQuarter();
    return null;
  }

  /** End the current quarter now (debug, or an "end early" button). */
  skipQuarter() {
    if (this.midnight || this._ending) return this._pending ?? null;
    this.total += this.secondsLeft;
    this.elapsed = this.quarterSeconds;
    return this.endQuarter();
  }

  async endQuarter() {
    if (this._ending || this.midnight) return this._pending;
    this._ending = true;
    const quarter = this.quarter;
    const isFinal = quarter >= this.totalQuarters;
    this._emit('change', this);
    this._pending = (async () => {
      for (const fn of [...this._hooks.quarterEnd]) await fn({ quarter, isFinal }, this);
      this._ending = false;
      if (isFinal) {
        this.midnight = true;
        this._emit('change', this);
        this._emit('midnight');
      } else {
        this.quarter = quarter + 1;
        this.elapsed = 0;
        this._emit('quarterStart', { quarter: this.quarter });
        this._emit('change', this);
      }
    })();
    return this._pending;
  }

  // ---------- save ----------
  toJSON() {
    return { quarter: this.quarter, elapsed: this.elapsed, total: this.total, speed: this.speed, midnight: this.midnight, quarterSeconds: this.quarterSeconds };
  }
  load(s) {
    this.quarter = s.quarter ?? 1;
    this.elapsed = s.elapsed ?? 0;
    this.total = s.total ?? 0;
    this.speed = s.speed ?? 1;
    this.midnight = !!s.midnight;
    if (s.quarterSeconds > 0) this.quarterSeconds = s.quarterSeconds;
    this._emit('change', this);
  }
}

/** "27:00" style countdown. */
export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
