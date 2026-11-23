# HUD, view toggle and quarter ledger

- `src/ledger/ledger.js` — the one ledger. Every system records cash through it:
  `ledger.record('builds' | 'sales' | 'schemes' | 'fines' | 'upkeep' | 'other', label, amount)`
  (positive = income, negative = expense). `ledger.summary(q)` returns the itemised quarter.
- `src/ui/hud.js` — `createGameUI({ root, ledger, views: { grid, map } })` returns
  `{ update(state), setView(name), showQuarterReport(opts) }`.
  `state` = `{ quarter, totalQuarters, heat (0-100), tension (0-100), boardTarget }`.
  `showQuarterReport()` resolves when the player clicks Continue — the campaign clock should await it
  before advancing the quarter. TAB toggles shelter grid / world map.
- `src/ui/ui.css` — styles (include once).
- Demo with stand-in systems: serve the repo root (`python3 -m http.server`) and open `demo/hud-demo.html`.
- Tests: `node --test tests/*.test.js`.

# Research (crisis-funded)

- `src/research/research.js` — `ResearchTree`: `tick(dtSeconds, crisis0to100)` accrues RP at
  `researchRate(crisis)` (0.5 RP/s calm → 4.5 RP/s just below the tipping point at 90 → falls past it).
  `start(nodeId)`, `onUnlock(fn)`, `isUnlocked(unlockId)`, `crewCount`, `toJSON()/load()`.
  Unlock ids: amenities `hydroponics, water_recycler, cryo_pod, mil_scrubber, wine_cellar, ai_butler`;
  schemes `astroturf, deepfake, shortage, blackout`; crews add +1 each.
- `src/ui/researchPanel.js` — HUD chip + tree overlay (R key) + unlock toast.
- The demo page wires these to a stand-in build palette (locked amenities show "R&D").
