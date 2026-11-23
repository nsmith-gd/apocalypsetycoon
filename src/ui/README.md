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
