// The Doom Clock (GDD: Crises and tipping points > The Doom Clock).
//
// Minutes to Midnight:  M = min(F, 15 - sum(tension) / 40)
//   - sum(tension) is the total tension across every crisis track (each 0-100).
//   - F is the FLOOR. It starts at 15 and only ever moves toward Midnight:
//       -0.25  the first time a track enters its Brink
//       -0.5   each chapter start
//       -1     each contained breach
//       -4     each collapse
//   - FRAGILITY: every floor minute lost lowers every tipping point by 1, never below 72.
//   - A SECOND collapse starts the FINAL COUNTDOWN: Midnight in 4 weeks, whatever M says.
//   - At M = 0 (or when the countdown runs out) Midnight arrives, uncontrolled.
//
// Pure rules, no DOM. Crisis tracks (#4) and the campaign clock (#1) drive it:
//   clock.setTensions({ pandemic: 62, unrest: 80 })   // whenever track tension changes
//   clock.brink('unrest')            // a track entered its Brink (only the first time per track counts)
//   clock.chapterStart(2)            // a new chapter began
//   clock.breachContained('unrest')  // a breach was brought back under control
//   clock.collapse('pandemic')       // a track collapsed
//   clock.advanceWeeks(1)            // in-game time passes (drives the Final Countdown)
//   clock.tippingPoint(90)           // a track's base tipping point after fragility
//   clock.on('tick' | 'floor' | 'brink' | 'countdown' | 'midnight', fn)

import { DOOM_CLOCK } from '../config/tuning.js';
export { DOOM_CLOCK }; // lives in the single tuning table (#77)

const round2 = (n) => Math.round(n * 100) / 100;

export class DoomClock {
  constructor({ config = {} } = {}) {
    this.cfg = { ...DOOM_CLOCK, ...config, floorDrops: { ...DOOM_CLOCK.floorDrops, ...(config.floorDrops ?? {}) } };
    this.floor = this.cfg.startMinutes;
    this.tensions = {};
    this.brinked = new Set();
    this.chapters = new Set();
    this.collapses = [];
    this.breachesContained = 0;
    this.countdownWeeks = null; // null until the Final Countdown starts
    this.midnight = null; // { reason, week } once it strikes
    this.week = 0;
    this.history = []; // floor drops: { week, reason, track, drop, floor }
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

  // ---------- reading the clock ----------
  get tensionSum() {
    return Object.values(this.tensions).reduce((s, v) => s + Math.max(0, Math.min(100, v)), 0);
  }
  /** Minutes the tension alone would leave. */
  get tensionMinutes() {
    return this.cfg.startMinutes - this.tensionSum / this.cfg.tensionDivisor;
  }
  /** Minutes to Midnight: M = min(F, 15 - sum(tension)/40), never below 0. */
  get minutes() {
    if (this.midnight) return 0;
    return Math.max(0, round2(Math.min(this.floor, this.tensionMinutes)));
  }
  /** Floor minutes lost so far (drives fragility). */
  get minutesLost() {
    return this.cfg.startMinutes - this.floor;
  }
  /** A track's tipping point after fragility: base minus 1 per floor minute lost, never below 72. */
  tippingPoint(base) {
    const lowered = base - this.minutesLost * this.cfg.fragilityPerMinute;
    return Math.max(Math.min(base, this.cfg.tippingFloor), round2(lowered));
  }
  /** What the clock face reads, e.g. "11:47:30". */
  get timeString() {
    const totalSec = Math.round((12 * 60 - this.minutes) * 60);
    const h = Math.floor(totalSec / 3600) % 12 || 12;
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}:${String(m).padStart(2, '0')}${s ? `:${String(s).padStart(2, '0')}` : ''}`;
  }
  get finalCountdown() {
    return this.countdownWeeks != null;
  }

  // ---------- inputs ----------
  /** Merge in the latest tension of one or more tracks. Optionally auto-detect Brink entries. */
  setTensions(tracks, { tips = null } = {}) {
    Object.assign(this.tensions, tracks);
    if (tips) {
      for (const [id, v] of Object.entries(tracks)) {
        if (tips[id] != null && v >= this.tippingPoint(tips[id]) - this.cfg.brinkMargin) this.brink(id);
      }
    }
    this._tick('tension');
  }

  brink(track) {
    if (this.brinked.has(track)) return false;
    this.brinked.add(track);
    this._drop(this.cfg.floorDrops.brink, 'brink', track);
    this._emit('brink', { track });
    return true;
  }

  chapterStart(chapter) {
    if (this.chapters.has(chapter)) return false;
    this.chapters.add(chapter);
    this._drop(this.cfg.floorDrops.chapter, 'chapter', `chapter ${chapter}`);
    return true;
  }

  breachContained(track) {
    this.breachesContained += 1;
    this._drop(this.cfg.floorDrops.breachContained, 'breachContained', track);
  }

  collapse(track) {
    this.collapses.push({ track, week: this.week });
    this._drop(this.cfg.floorDrops.collapse, 'collapse', track);
    if (this.collapses.length >= this.cfg.collapsesForCountdown && this.countdownWeeks == null && !this.midnight) {
      this.countdownWeeks = this.cfg.countdownWeeks;
      this._emit('countdown', { weeks: this.countdownWeeks, track });
    }
    this._tick('collapse');
  }

  /** In-game weeks pass (13 per quarter). Runs the Final Countdown. */
  advanceWeeks(n = 1) {
    for (let i = 0; i < n && !this.midnight; i++) {
      this.week += 1;
      if (this.countdownWeeks != null) {
        this.countdownWeeks -= 1;
        this._emit('countdown', { weeks: this.countdownWeeks });
        if (this.countdownWeeks <= 0) this._strike('countdown');
      }
    }
    this._tick('week');
  }

  _drop(amount, reason, track) {
    if (this.midnight) return;
    const before = this.floor;
    this.floor = Math.max(0, round2(this.floor - amount)); // one-way: only ever toward Midnight
    const entry = { week: this.week, reason, track, drop: round2(before - this.floor), floor: this.floor };
    this.history.push(entry);
    this._emit('floor', entry);
    this._tick(reason);
  }

  _tick(reason) {
    if (this.midnight) return;
    const m = this.minutes;
    this._emit('tick', { minutes: m, floor: this.floor, reason });
    if (m <= 0) this._strike('clock');
  }

  _strike(reason) {
    if (this.midnight) return;
    this.midnight = { reason, week: this.week, uncontrolled: true };
    this._emit('midnight', this.midnight);
  }

  // ---------- data model / save ----------
  snapshot() {
    return {
      minutes: this.minutes,
      floor: this.floor,
      tensionMinutes: round2(this.tensionMinutes),
      tensionSum: this.tensionSum,
      minutesLost: round2(this.minutesLost),
      time: this.timeString,
      finalCountdown: this.finalCountdown,
      countdownWeeks: this.countdownWeeks,
      collapses: this.collapses.length,
      breachesContained: this.breachesContained,
      midnight: this.midnight,
      week: this.week,
    };
  }

  toJSON() {
    return {
      v: 1, floor: this.floor, tensions: { ...this.tensions }, brinked: [...this.brinked], chapters: [...this.chapters],
      collapses: this.collapses.map((c) => ({ ...c })), breachesContained: this.breachesContained,
      countdownWeeks: this.countdownWeeks, midnight: this.midnight, week: this.week, history: this.history.map((h) => ({ ...h })),
    };
  }

  static fromJSON(d, opts) {
    const c = new DoomClock(opts);
    Object.assign(c, {
      floor: d.floor, tensions: { ...d.tensions }, brinked: new Set(d.brinked), chapters: new Set(d.chapters),
      collapses: d.collapses.map((x) => ({ ...x })), breachesContained: d.breachesContained,
      countdownWeeks: d.countdownWeeks, midnight: d.midnight, week: d.week, history: d.history.map((h) => ({ ...h })),
    });
    return c;
  }
}

// #90: the pushback 'world' bridge is gone. The clock hears only the CrisisSystem's tracks (CrisisSystem._sync).
