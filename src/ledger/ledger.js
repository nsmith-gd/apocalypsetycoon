// The "one ledger" (pillar 2): every cash movement in the game goes through here,
// tagged with a category so the end-of-quarter report can itemise it.
//
// Systems call `ledger.record(category, label, amount)`:
//   positive amount = income, negative amount = expense.
// The ledger knows the current quarter via `ledger.setQuarter(q)` (called by the
// campaign clock), so callers never pass a quarter themselves.

export const CATEGORIES = Object.freeze({
  builds: { label: 'Builds', icon: '#' },
  sales: { label: 'Shelter sales', icon: '$' },
  schemes: { label: 'Schemes', icon: '!' },
  fines: { label: 'Fines & settlements', icon: 'X' },
  upkeep: { label: 'Upkeep & payroll', icon: '~' },
  research: { label: 'Research & development', icon: '?' },
  other: { label: 'Other', icon: '.' },
});

export class Ledger {
  constructor({ startingCash = 0, quarter = 1 } = {}) {
    this.startingCash = startingCash;
    this.quarter = quarter;
    this.entries = [];
    this.listeners = new Set();
    this.openingCash = new Map([[quarter, startingCash]]);
  }

  get cash() {
    return this.startingCash + this.entries.reduce((sum, e) => sum + e.amount, 0);
  }

  setQuarter(q) {
    if (q === this.quarter) return;
    this.quarter = q;
    if (!this.openingCash.has(q)) this.openingCash.set(q, this.cash);
    this.emit();
  }

  record(category, label, amount) {
    if (!CATEGORIES[category]) category = 'other';
    if (!Number.isFinite(amount) || amount === 0) return null;
    const entry = { quarter: this.quarter, category, label: String(label), amount: Math.round(amount) };
    this.entries.push(entry);
    this.emit(entry);
    return entry;
  }

  /** Itemised summary of one quarter, grouped by category, identical lines merged. */
  summary(quarter = this.quarter) {
    const qEntries = this.entries.filter((e) => e.quarter === quarter);
    const groups = [];
    for (const [key, meta] of Object.entries(CATEGORIES)) {
      const inCat = qEntries.filter((e) => e.category === key);
      if (!inCat.length) continue;
      const lines = new Map();
      for (const e of inCat) {
        const k = `${e.label}|${Math.sign(e.amount)}`;
        const line = lines.get(k) ?? { label: e.label, count: 0, amount: 0 };
        line.count += 1;
        line.amount += e.amount;
        lines.set(k, line);
      }
      const total = inCat.reduce((s, e) => s + e.amount, 0);
      groups.push({ category: key, ...meta, lines: [...lines.values()], total });
    }
    const income = qEntries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const expenses = qEntries.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);
    const opening = this.openingCash.get(quarter) ?? this.startingCash;
    return { quarter, opening, income, expenses, net: income + expenses, closing: opening + income + expenses, groups };
  }

  /** Most recent entries, newest first (for the always-on ledger rail). */
  recent(n = 8) {
    return this.entries.slice(-n).reverse();
  }

  /** Category totals for one quarter: { builds: -120, sales: 900, ... } (only non-zero). */
  totalsByCategory(quarter = this.quarter) {
    const out = {};
    for (const e of this.entries) if (e.quarter === quarter) out[e.category] = (out[e.category] ?? 0) + e.amount;
    return out;
  }

  /** One row per quarter played so far: opening, income, expenses, net, closing. */
  history() {
    const qs = new Set([...this.openingCash.keys(), ...this.entries.map((e) => e.quarter), this.quarter]);
    return [...qs].sort((a, b) => a - b).map((q) => {
      const { quarter, opening, income, expenses, net, closing } = this.summary(q);
      return { quarter, opening, income, expenses, net, closing };
    });
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(entry) {
    for (const fn of this.listeners) fn(entry, this);
  }
}

export function formatMoney(n, { sign = false } = {}) {
  const abs = Math.abs(Math.round(n));
  let s;
  if (abs >= 1e9) s = `${(abs / 1e9).toFixed(2)}B`;
  else if (abs >= 1e6) s = `${(abs / 1e6).toFixed(2)}M`;
  else if (abs >= 1e4) s = `${(abs / 1e3).toFixed(1)}K`;
  else s = abs.toLocaleString('en-US');
  const prefix = n < 0 ? '-' : sign && n > 0 ? '+' : '';
  return `${prefix}$${s}`;
}
