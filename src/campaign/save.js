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

// Systems with static fromJSON(): rebuild a fresh copy, then copy its state into the live
// instance so existing listeners and UI stay attached.
export function restoreInto(target, fresh, fields) {
  for (const k of fields) if (k in fresh) target[k] = fresh[k];
}

const PUSHBACK_FIELDS = ['heat', 'tension', 'quarter', 'clients', 'board', 'pending', 'runaways', 'doomsdayShift', '_ids',
  '_investigatedThisQuarter', '_runawayThisQuarter', '_reliefUses', '_internalCash', '_quarterProfit'];
export const pushbackSaveable = (pb, Pushback) => ({
  toJSON: () => pb.toJSON(),
  load(d) {
    restoreInto(pb, Pushback.fromJSON(d, { ledger: pb.ledger }), PUSHBACK_FIELDS);
    pb._changed?.();
  },
});

const DOOM_FIELDS = ['floor', 'tensions', 'brinked', 'chapters', 'collapses', 'breachesContained', 'countdownWeeks', 'midnight', 'week', 'history'];
export const doomClockSaveable = (doom, DoomClock) => ({
  toJSON: () => doom.toJSON(),
  load(d) { restoreInto(doom, DoomClock.fromJSON(d), DOOM_FIELDS); },
});
