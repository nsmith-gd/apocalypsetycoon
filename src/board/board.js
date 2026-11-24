// The board and its quarterly review (GDD: The company and the board > The board, The quarterly meeting,
// Board confidence, Board votes; Economy and tuning > The quota).
//
// Five seats, each with its own confidence 0-100. Board confidence is their average; the proxy seat
// (Mr. Gray) counts as the average of the other four until he takes his seat at 4:30 (Q11).
//
// Every quarter end runs review(facts):
//   1. Results: revenue against the quota (revenue only: investment rounds never count).
//   2. Confidence: quota hit +5 with every member, missed -15, beaten by 25% +10 instead of +5.
//      Each directive fulfilled +8 with the member who set it (and a Favour), each failed -5.
//      What members hate costs them confidence too (breaches: Vane and Priya; calming schemes: Bryce).
//   3. New quota: the GDD curve, 30% a quarter ($6M in Q1 at GDD scale; see BOARD.quotaScale).
//   4. Two directives for next quarter, from different members. refuse(id) drops one at -3 with its member.
//   5. State from the average: Bullish (80+) pays an investment round worth 25% of the next quota;
//      Scrutiny (25-49) makes scheme heat +20%; Probation (1-24) installs a Minder who vetoes one action a
//      quarter; Ousted (0) ends the campaign.
//
// Pure rules, no DOM. The campaign feeds it facts it already knows; directives whose facts the game does
// not track yet are never issued (pass `supports`).

import { mulberry32 } from '../pushback/pushback.js';

export const BOARD = Object.freeze({
  // GDD quota is $6M in Q1 growing 30% a quarter. The game's economy still runs in $K (gap review item 3),
  // so the curve is scaled to it: 0.025 => $150K in Q1, ~$330K Q4, ~$940K Q8, ~$2.7M Q12.
  // Set to 1 when prices move to the GDD's $M economy.
  quotaQ1: 6_000_000,
  quotaGrowth: 0.3,
  quotaScale: 0.025,
  startConfidence: 60,
  quota: { hit: 5, miss: -15, beatBy: 0.25, beat: 10 },
  directive: { fulfilled: 8, failed: -5, refused: -3 },
  hates: { breach: -5, calming: -2 },
  investmentShare: 0.25,
  scrutinyHeat: 1.2,
  grayTakesSeatQuarter: 11, // 4:30 = 270 min = the start of Q11 at 27 min a quarter
});

export const MEMBERS = Object.freeze([
  { id: 'vane', name: 'Cornelius Vane III', seat: 'Chair', wants: 'Legacy and steady growth', hates: 'Breaches' },
  { id: 'kettering', name: 'Bryce Kettering', seat: 'Growth capital', wants: 'Twice the quota and constant escalation', hates: 'Calming schemes' },
  { id: 'faraday', name: 'Dame Ottilie Faraday', seat: 'Defence money', wants: 'Atomic profits', hates: 'Peace summits' },
  { id: 'sandoval', name: 'Priya Sandoval', seat: 'Risk and audit', wants: 'No surprises', hates: 'Breaches and heat' },
  { id: 'gray', name: 'Mr. Gray', seat: 'The proxy seat', wants: 'The Table’s interests', hates: 'Exposure' },
]);

export const STATES = Object.freeze([
  { id: 'ousted', from: -Infinity, label: 'Ousted' },
  { id: 'probation', from: 0.5, label: 'Probation' },
  { id: 'scrutiny', from: 25, label: 'Scrutiny' },
  { id: 'steady', from: 50, label: 'Steady' },
  { id: 'bullish', from: 80, label: 'Bullish' },
]);
export const stateOf = (avg) => STATES.reduce((s, x) => (avg >= x.from ? x : s), STATES[0]);

/**
 * Directives. `needs` = facts the game must support for it to be issued; `check(facts)` at the next review.
 * Facts: revenue, quota, heat, tensions {trackId: n}, openTracks [ids], brinkTracks n, breaches n,
 * handovers n, schemesRun n, calmingSchemes n, arkStarted bool.
 */
export const DIRECTIVES = Object.freeze([
  { id: 'vane-handover', member: 'vane', text: 'Hand over at least one shelter this quarter', needs: ['handovers'], check: (f) => f.handovers >= 1 },
  { id: 'vane-no-breach', member: 'vane', text: 'Get through the quarter without a breach', needs: ['breaches'], check: (f) => f.breaches === 0 },
  { id: 'kettering-brink', member: 'kettering', text: 'Push any track to the Brink', needs: ['brinkTracks'], check: (f) => f.brinkTracks >= 1 },
  { id: 'kettering-double', member: 'kettering', text: 'Bring in twice the quota', needs: ['revenue'], check: (f) => f.revenue >= 2 * f.quota },
  { id: 'kettering-escalate', member: 'kettering', text: 'Run at least three schemes', needs: ['schemesRun'], check: (f) => f.schemesRun >= 3 },
  { id: 'faraday-atomic', member: 'faraday', text: 'End the quarter with Atomic Standoff at 70 or above', needs: ['tensions'], when: (f) => f.openTracks?.includes('atomic'), check: (f) => (f.tensions?.atomic ?? 0) >= 70 },
  { id: 'sandoval-heat', member: 'sandoval', text: 'Keep heat below 40', needs: ['heat'], check: (f) => f.heat < 40 },
  { id: 'sandoval-no-breach', member: 'sandoval', text: 'No breaches on our watch this quarter', needs: ['breaches'], check: (f) => f.breaches === 0 },
  { id: 'gray-ark', member: 'gray', text: 'Begin the Ark', needs: ['arkStarted'], check: (f) => !!f.arkStarted },
  { id: 'gray-quiet', member: 'gray', text: 'Keep heat below 30. The Table dislikes attention', needs: ['heat'], check: (f) => f.heat < 30 },
]);
const DIRECTIVE_BY_ID = Object.fromEntries(DIRECTIVES.map((d) => [d.id, d]));

const clamp = (v) => Math.max(0, Math.min(100, v));

/** Revenue target for quarter n (Overtime keeps the same growth). */
export function quotaFor(n, cfg = BOARD) {
  return Math.round((cfg.quotaQ1 * cfg.quotaScale * (1 + cfg.quotaGrowth) ** (n - 1)) / 1000) * 1000;
}

/** Revenue for a quarter from the ledger: all income except investment rounds. */
export function quarterRevenue(ledger, quarter) {
  return ledger.entries
    .filter((e) => e.quarter === quarter && e.amount > 0 && !e.label.startsWith(INVESTMENT_LABEL))
    .reduce((s, e) => s + e.amount, 0);
}
export const INVESTMENT_LABEL = 'Investment round';

export class Board {
  constructor({ ledger = null, seed = 1, supports = null, config = {} } = {}) {
    this.cfg = { ...BOARD, ...config };
    this.ledger = ledger;
    this.seed = seed;
    this.supports = supports ? new Set(supports) : null; // null = every fact is supported
    this.confidence = Object.fromEntries(MEMBERS.map((m) => [m.id, this.cfg.startConfidence]));
    this.favours = Object.fromEntries(MEMBERS.map((m) => [m.id, 0]));
    this.quarter = 1;
    this.quota = quotaFor(1, this.cfg);
    this.directives = []; // [{ id, member, text, refused }] for the current quarter
    this.history = [];
    this.ousted = false;
    this.minderVetoUsed = false;
    this.listeners = new Set();
    this.directives = this._issue(1);
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) fn(this); }

  grayInSeat(quarter = this.quarter) { return quarter >= this.cfg.grayTakesSeatQuarter; }

  /** Confidence a member counts for in the average (Gray = the other four until he takes his seat). */
  memberConfidence(id, quarter = this.quarter) {
    if (id === 'gray' && !this.grayInSeat(quarter)) {
      const others = MEMBERS.filter((m) => m.id !== 'gray');
      return others.reduce((s, m) => s + this.confidence[m.id], 0) / others.length;
    }
    return this.confidence[id];
  }

  get average() {
    return MEMBERS.reduce((s, m) => s + this.memberConfidence(m.id), 0) / MEMBERS.length;
  }
  get state() { return stateOf(this.average); }
  /** Scrutiny: Priya's audits make scheme heat +20%. */
  get schemeHeatMultiplier() { return this.state.id === 'scrutiny' ? this.cfg.scrutinyHeat : 1; }
  /** Probation: the Minder can veto one action this quarter. Returns true if this action is vetoed. */
  minderVeto() {
    if (this.state.id !== 'probation' || this.minderVetoUsed) return false;
    this.minderVetoUsed = true;
    this._emit();
    return true;
  }

  /**
   * A member reacts to something mid-quarter (e.g. a contained breach, #67): their confidence moves now and the
   * reason is listed at the next quarterly review. Returns the applied amount (0 for the silent proxy seat).
   */
  react(id, amount, why) {
    if (!MEMBERS.some((m) => m.id === id) || !amount) return 0;
    const before = this.confidence[id];
    const noted = [];
    this._shift(id, amount, noted, why);
    if (!noted.length) return 0;
    (this.interim ??= []).push(...noted);
    this._emit();
    return this.confidence[id] - before;
  }

  _shift(id, amount, reasons, why) {
    if (!amount) return;
    if (id === 'gray' && !this.grayInSeat()) return; // the silent proxy has no confidence of its own yet
    this.confidence[id] = clamp(this.confidence[id] + amount);
    reasons.push({ member: id, amount, why });
  }

  _issue(quarter, facts = null) {
    const rng = mulberry32((this.seed * 7919 + quarter * 104729) >>> 0);
    const supported = (d) => (!this.supports || d.needs.every((n) => this.supports.has(n))) && (!d.when || !facts || d.when(facts));
    const memberOk = (m) => m !== 'gray' || this.grayInSeat(quarter);
    const pool = DIRECTIVES.filter((d) => supported(d) && memberOk(d.member));
    const picked = [];
    // From 4:30 Mr. Gray issues one of the two directives at every meeting.
    if (this.grayInSeat(quarter)) {
      const gray = pool.filter((d) => d.member === 'gray');
      if (gray.length) picked.push(gray[Math.floor(rng() * gray.length)]);
    }
    while (picked.length < 2) {
      const left = pool.filter((d) => !picked.some((p) => p.member === d.member));
      if (!left.length) break;
      picked.push(left[Math.floor(rng() * left.length)]);
    }
    return picked.map((d) => ({ id: d.id, member: d.member, text: d.text, refused: false }));
  }

  /** Refuse one of this quarter's directives (only one per meeting): -3 with that member. */
  refuse(directiveId) {
    const d = this.directives.find((x) => x.id === directiveId);
    if (!d) throw new Error(`No directive ${directiveId} this quarter`);
    if (this.directives.some((x) => x.refused)) throw new Error('You can refuse only one directive a meeting');
    d.refused = true;
    const reasons = [];
    this._shift(d.member, this.cfg.directive.refused, reasons, `refused: ${d.text}`);
    this._emit();
    return reasons;
  }

  /** Spend a Favour to secure a member's vote. */
  vote(need = 3, { spendFavours = [] } = {}) {
    const ballots = MEMBERS.map((m) => {
      if (spendFavours.includes(m.id) && this.favours[m.id] > 0) { this.favours[m.id] -= 1; return { member: m.id, yes: true, favour: true }; }
      return { member: m.id, yes: this.memberConfidence(m.id) >= 50 };
    });
    const yes = ballots.filter((b) => b.yes).length;
    this._emit();
    return { passed: yes >= need, yes, ballots };
  }

  /**
   * The quarterly meeting. `facts` describe the quarter that just ended (see DIRECTIVES). If `revenue`
   * is missing it is read from the ledger. Returns everything the quarter report needs.
   */
  review(facts = {}) {
    const q = facts.quarter ?? this.quarter;
    const C = this.cfg;
    const f = { breaches: 0, calmingSchemes: 0, ...facts, quota: this.quota };
    if (f.revenue == null) f.revenue = this.ledger ? quarterRevenue(this.ledger, q) : 0;
    const reasons = [...(this.interim ?? [])]; // mid-quarter reactions (react(), #67)
    this.interim = [];

    // 1-2. Quota
    const met = f.revenue >= this.quota;
    const beat = f.revenue >= this.quota * (1 + C.quota.beatBy);
    const quotaShift = beat ? C.quota.beat : met ? C.quota.hit : C.quota.miss;
    for (const m of MEMBERS) this._shift(m.id, quotaShift, reasons, beat ? 'quota beaten by 25%' : met ? 'quota hit' : 'quota missed');

    // Directives set at the last meeting
    const directives = this.directives.map((d) => {
      if (d.refused) return { ...d, result: 'refused' };
      const ok = !!DIRECTIVE_BY_ID[d.id].check(f);
      this._shift(d.member, ok ? C.directive.fulfilled : C.directive.failed, reasons, `${ok ? 'fulfilled' : 'failed'}: ${d.text}`);
      if (ok) this.favours[d.member] += 1;
      return { ...d, result: ok ? 'fulfilled' : 'failed' };
    });

    // What they hate
    for (let i = 0; i < f.breaches; i++) for (const id of ['vane', 'sandoval']) this._shift(id, C.hates.breach, reasons, 'a breach');
    if (f.calmingSchemes) this._shift('kettering', C.hates.calming * f.calmingSchemes, reasons, `${f.calmingSchemes} calming scheme(s)`);
    if (facts.confidenceShift) for (const m of MEMBERS) this._shift(m.id, facts.confidenceShift, reasons, 'crisis fallout');

    // 3-5. New quota, state and its effects, next directives
    const quota = this.quota;
    this.quarter = q + 1;
    this.quota = quotaFor(this.quarter, C);
    const average = this.average;
    const state = stateOf(average);
    const effects = [];
    let investment = 0;
    if (state.id === 'ousted') {
      this.ousted = true;
      effects.push('The board votes you out. The campaign is over.');
    } else if (state.id === 'bullish') {
      investment = Math.round(this.quota * C.investmentShare / 1000) * 1000;
      this.ledger?.record('other', INVESTMENT_LABEL, investment);
      effects.push(`Bullish: an investment round of ${money(investment)} (cash, never revenue).`);
    } else if (state.id === 'scrutiny') effects.push('Scrutiny: Priya’s audits make scheme heat +20% next quarter.');
    else if (state.id === 'probation') effects.push('Probation: a Minder joins you and will veto one action next quarter.');
    if (this.grayInSeat(this.quarter) && !this.grayInSeat(q)) {
      this.confidence.gray = Math.round(this.memberConfidence('gray', q));
      effects.push('Mr. Gray takes the proxy seat in person. He speaks for The Table.');
    }
    this.minderVetoUsed = false;
    this.directives = this.ousted ? [] : this._issue(this.quarter, f);

    const result = {
      quarter: q, revenue: f.revenue, quota, met, beat, directives, reasons,
      average: Math.round(average), state: state.id, stateLabel: state.label, effects, investment,
      nextQuota: this.quota, nextDirectives: this.directives.map((d) => ({ ...d })),
      confidence: Object.fromEntries(MEMBERS.map((m) => [m.id, Math.round(this.memberConfidence(m.id))])),
      ousted: this.ousted,
    };
    result.lines = reportLines(result);
    this.history.push({ quarter: q, revenue: f.revenue, quota, met, average: result.average, state: state.id });
    this._emit();
    return result;
  }

  toJSON() {
    return { confidence: this.confidence, favours: this.favours, quarter: this.quarter, quota: this.quota, directives: this.directives,
      history: this.history, ousted: this.ousted, minderVetoUsed: this.minderVetoUsed, interim: this.interim ?? [] };
  }
  load(d = {}) {
    Object.assign(this.confidence, d.confidence ?? {});
    Object.assign(this.favours, d.favours ?? {});
    for (const k of ['quarter', 'quota', 'directives', 'history', 'ousted', 'minderVetoUsed', 'interim']) if (d[k] != null) this[k] = d[k];
    this._emit();
  }
}

function money(n) {
  const a = Math.abs(n);
  if (a < 1000) return `${n < 0 ? '-' : ''}$${Math.round(a)}`;
  return `${n < 0 ? '-' : ''}$${a >= 1e6 ? `${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M` : `${Math.round(a / 1000)}K`}`;
}

const NAME = Object.fromEntries(MEMBERS.map((m) => [m.id, m.name]));

/** Plain lines for the quarter report. */
export function reportLines(r) {
  const lines = [`Revenue ${money(r.revenue)} against a ${money(r.quota)} quota: ${r.beat ? 'beaten by 25% or more' : r.met ? 'hit' : 'MISSED'}.`];
  for (const d of r.directives) lines.push(`${NAME[d.member]}: “${d.text}” — ${d.result}.`);
  lines.push(`Board confidence ${r.average}: ${r.stateLabel}.`);
  lines.push(...r.effects);
  if (!r.ousted) {
    lines.push(`Next quota: ${money(r.nextQuota)}.`);
    for (const d of r.nextDirectives) lines.push(`New directive from ${NAME[d.member]}: “${d.text}”.`);
  }
  return lines;
}
