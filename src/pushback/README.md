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

## Press, reputation, the Inspector and sieges (#31)
- `press.js`: `new Press({ pushback, crisis?, seed })`. Call `press.tickWeek()` once per in-game week.
  - Journalists: Iris Kemp (speed 1, accurate, trust 0-5; each trust point slows her stories 10% and takes 2 off the
    reputation hit) and Gil Marsh (speed 2.5, sloppy, his stories shove a random threat track +5 via
    `crisis.addTension`, or world tension if no crisis system is attached). Weekly growth = (2% + 1% per 10 heat) x speed
    (`storyGrowth`, `journalistGrowth`). At 100% the story runs: heat +25, reputation -15, every client +10 leverage.
  - Counters (`press.counter(journalistId, kind)`): bury ($120K, -25%, +50% per repeat), discredit ($80K: -60% on Gil;
    on Iris -10%, heat +10, trust -2), distraction ($50K, -20%, random track +8), kompromat (1 intel or $400K: kills the
    story, 8 quiet weeks, 25% leak: heat +15, reputation -10), interview (free, once a week: Iris under heat 70 gives
    trust +1, -15%, reputation +3; otherwise the story +15%).
  - Reputation 0-100, starts at 40 (`addReputation`, `reputationZone`).
  - Inspector: `press.inspect(siteId)`, $0.2M a walkthrough, once a quarter per site. Certifies (reputation +6) a site
    with security 3+ and at most 2 visible features, or lists the fixes.
  - Sieges: The Pitchforks opens when tension first reaches 60 (or `openPitchforks()`). Each week a siege happens with
    chance tension%, on the most visible free site. `siegeStrength = tension / 20 + visible features` vs
    `siteDefence = security (+2 with a Decoy Entrance)`. Stronger mob = occupied (reputation -5, that client +10
    leverage, -1 reputation a week) until `retake(siteId)` ($300K, heat +5). `buildDecoy(siteId)` $150K.
  - Sites: `press.addSite({ name, security, visible, clientId })` with ratings from `shelter/life.js` `simulate()`.
- `press-ui.js` + `press.css`: reputation HUD chip, PRESS DESK (P), and the front page when a story runs.
- Provisional (GDD body not readable here): speeds, start-heat thresholds, cooldowns, every counter's price and effect,
  the Inspector pass rule, the Pitchforks trigger, siege chance, occupation, retake and decoy numbers. All in `PRESS`.
- Demo: `demo/pushback-demo.html` (+1 WEEK / PLAY WEEKS, PRESS DESK).
- In the campaign (#149, `src/campaign/main.js`): `new Press({ pushback, crisis, reputationStore: crisis, sieges: false,
  getMinutes })`, ticked on every crisis week and saved as `press` (`press.load(saved)`). `reputationStore` makes the
  press read and write the crisis system's reputation, the single one that sets lead quality. `getMinutes` keeps every
  journalist quiet until 1:00 (`PRESS.story.firstStoryAt`, GDD unlock row 12); at 1:00 Iris calls for comment
  (`'call'` event, a dialog with Interview / No comment / Press desk) and opens her first story whatever the heat.
  Gil's track shove only picks open tracks. HUD: the REPUTATION [P] chip opens the press desk (journalists and
  counters; the sites section stays hidden until sieges are wired, #150). Front page when a story runs.

## GDD heat bands, decay and Notoriety (#148)
- `TUNING.heatBands` (tuning.js): Unnoticed 0, Whispers 30 (schemes +10%, a story starts), Investigation 55 (one audit a
  quarter = a week of lost construction, Sabotage locked, leverage growth x1.5), Hearings 75 (one hearing a quarter:
  reputation -10, board confidence -10; new leads -25%), Exposed 95 (4-week indictment).
- `pb.heatBand()`, `schemeCostMultiplier`, `sabotageLocked`, `leverageGrowthMultiplier`, `leadMultiplier`, `notoriety`,
  `heatDecayPerWeek`. `weekTick()` decays heat (difficulty base + 1 per Communications level, `getCommsLevel`) down to
  the Notoriety floor 0/5/10/20/30 (`getTierIndex`), then emits `heatBand`, `whispers`, `audit`, `hearing`, `indictment`.
- The old regulator fine (65) and raid (100) are retired (not in the GDD). The campaign's EndingWatch ends the game as
  Indicted after 4 weeks at 95+.
