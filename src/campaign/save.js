// Save/load stub: one slot in localStorage. Every system that wants to persist hands the
// campaign a { toJSON(), load(data) } pair via registerSaveable(); unknown keys are ignored.
// Storage can be unavailable (private window, blocked site data), so everything is try/catch.

export const SAVE_KEY = 'apocalypse-tycoon.slot1';
export const SAVE_VERSION = 1;

export function createSaveSlot({ storage = globalThis.localStorage, key = SAVE_KEY } = {}) {
  const parts = new Map();
  return {
    /** name → { toJSON(): any, load(data): void } */
    register(name, part) { parts.set(name, part); },
    has() {
      try { return storage?.getItem(key) != null; } catch { return false; }
    },
    peek() {
      try {
        const raw = storage?.getItem(key);
        const data = raw ? JSON.parse(raw) : null;
        return data?.version === SAVE_VERSION ? data : null;
      } catch { return null; }
    },
    save() {
      const data = { version: SAVE_VERSION, savedAt: Date.now(), parts: {} };
      for (const [name, part] of parts) {
        try { data.parts[name] = part.toJSON(); } catch { /* skip a part that can't serialise */ }
      }
      try { storage.setItem(key, JSON.stringify(data)); return true; } catch { return false; }
    },
    load() {
      const data = this.peek();
      if (!data) return false;
      for (const [name, part] of parts) if (name in data.parts) part.load(data.parts[name]);
      return true;
    },
    clear() {
      try { storage?.removeItem(key); } catch { /* ignore */ }
    },
  };
}

// Adapters for systems that predate the save slot.
export const ledgerSaveable = (ledger) => ({
  toJSON: () => ({ startingCash: ledger.startingCash, quarter: ledger.quarter, entries: ledger.entries, openingCash: [...ledger.openingCash] }),
  load(d) {
    ledger.startingCash = d.startingCash;
    ledger.entries = d.entries ?? [];
    ledger.openingCash = new Map(d.openingCash ?? []);
    ledger.quarter = d.quarter ?? 1;
    ledger.emit();
  },
});

const PUSHBACK_FIELDS = ['heat', 'tension', 'quarter', 'clients', 'board', 'runaways', 'doomsdayShift', 'log', '_ids'];
export const pushbackSaveable = (pb) => ({
  toJSON: () => Object.fromEntries(PUSHBACK_FIELDS.map((k) => [k, pb[k]])),
  load(d) {
    for (const k of PUSHBACK_FIELDS) if (k in d) pb[k] = d[k];
    pb._changed?.();
  },
});
