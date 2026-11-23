# Debug: pacing harness, fast-forward and per-quarter log

- `pacing.js`: `PACING` is the real-time model (27 min per quarter on the clock, which pauses for reports and
  choice cards; target 5–6.5 h). `PacingLog` attaches to the ledger, pushback and research and records one row
  per quarter: modelled hours, real minutes, cash, net, crisis, heat, sales, revenue, schemes, fines, board,
  strikes, runaways and events. `toCSV()` exports it.
- `sim.js`: headless campaigns. `BOTS` (cautious, edge, luxury, late arsonist, reckless) play the real ledger,
  pushback, research and Midnight code; `SIM` holds the stand-ins for systems not built yet (scheme list,
  shelter packages, world demand, a tension cool-down). Swap those for the real systems as they land.
  `runHarness()` returns runs + checks.
- `debug-panel.js` + `debug.css`: in game, press ` (backquote) for the panel: pick a bot, AUTO-PLAY 1 QUARTER,
  AUTO-PLAY TO MIDNIGHT, DOWNLOAD CSV, and read the live per-quarter log. Wired into `demo/midnight-demo.html`
  (`?debug` opens it).
- CLI: `node tools/pacing-harness.mjs` (exit 1 if a check fails), `--bot edge --seed 3` for one run's table,
  `--log` for one table per bot, `--out <dir>` to write CSVs and `summary.json`.
- Browser: `demo/pacing-harness.html` shows every run on a timeline against the target and each run's log.
