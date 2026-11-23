# Pushback systems (pillar 4: "Nothing is free")

- `pushback.js`: `new Pushback({ ledger, seed })`, the rules only (no DOM). All numbers live in `PUSHBACK_DEFAULTS`.
  - Schemes system: `pb.onScheme({ label, heat, tension })` every time a scheme runs.
  - World map / sales: `pb.onSale({ client, price, region })` every shelter sold (each buyer becomes a client with leverage).
  - Campaign clock: `pbui.hold(); const r = pb.endQuarter({ quarter, profit })` at quarter end, then
    `ui.showQuarterReport({ quarter, board: r.board, notes: r.lines.slice(1) })`, then `await pbui.drain()`.
  - Builds: multiply costs by `pb.board.buildCostMultiplier` (budget freeze after a second strike).
  - Events: `pb.on('runaway' | 'ousted' | 'event' | 'change' | 'resolved', fn)`; `pb.runaways` feeds Midnight's control score.
- Rules
  - Heat: 50 opens an investigation (settle / lawyer up / stonewall), ending a quarter at 65+ draws a regulator fine,
    100 is a federal raid. Cools by 8 a quarter.
  - Tension: at 75+ it feeds itself (+6 a quarter); 100 is a runaway crisis (damages capped at $600K, clients
    panic). At most one runaway per quarter.
  - Client leverage: grows with heat each quarter. 30+ makes demands, 55+ blackmails.
  - Board: quarterly operating-profit target, +8% a quarter after a hit (nudged toward overperformance), recalibrated
    toward actual profit after a miss. A miss is a strike and a clawback (capped at $200K); two strikes freeze the
    budget, three oust you.

## Pressure data model, relief valves and save/load (#14)
- `pb.pressures({ quarterProfit })`: every source in one object (`heat`, `tension`, `leverage` per client, `board`),
  each with `value`, `zone`, `next` (the threshold and what happens there), per-quarter drift and, for heat and
  tension, the relief action and its current price. Example: `.ballast/media/t14/pressures-data-model.json`.
- Relief: `pb.layLow()` (heat -15, $40K) and `pb.fundRelief()` (tension -14 but heat +3, $50K). Each use in a quarter
  costs 50% more; prices reset at quarter end. Both are booked in the ledger under Schemes.
- Save/load: `JSON.stringify(pb)` and `Pushback.fromJSON(data, { ledger, seed })` restore every pressure.
- UI: `pushback-ui.js` (choice cards, client leverage panel, ticker), `pressure-gauge.js` (the PRESSURE panel with all
  four bars, the next consequence for each and the relief buttons), styles in `pushback.css`.
- Demos: `demo/pushback-demo.html` and `demo/midnight-demo.html`.
