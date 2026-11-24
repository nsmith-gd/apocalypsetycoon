# Crisis breach, containment, recovery and collapse (GDD: Crises and tipping points)

- `breach.js`: `new CrisisSystem({ seed, pushback, doomClock, ledger, shelters })`. Five tracks (pandemic, climate,
  unrest, markets, war) with hidden tipping points rolled at 90 + (-8..+4); scars (-3) and Doom Clock fragility lower
  them (never below 72). `visibleTip(id)` is a range until a containment reveals the exact point.
  - Tension changes go through `addTension(id, n)` / `setTension(id, v)` so locks, pins and breaches apply
    (#4's schemes and the world drift should call these).
  - Breach: auto-pause (`pause` event), 6/4/3-week window, 100-point bar. `sourceOffer(id, key)` / `contribute(id, key)`
    for op ($10M x breach count), research (pauses research), calming (runs pushback's Fund relief), government (+heat),
    heroics (-board confidence). Breach weeks: +2 heat, -2 board confidence, panic premium x2 (`panicMultiplier`).
  - Contained: tension 60, locked 3 weeks, scar, revealed; Doom Clock `breachContained`.
  - Collapse: pinned at 100, Doom Clock `collapse`, linked tracks shoved +15/+8/+4 via `DOMINO_LINKS` (10 links).
  - Shelter-in-place on each breach: every sold shelter is tested (default: air, water and food cover its occupants):
    pass +2 reputation, fail -5 reputation and +15 leverage for its client.
  - `advanceWeek()` once per in-game week. `snapshot()` for UI/save.
- `breach-ui.js` + `breach.css`: the containment card (pauses the game until resolved or the player advances).
- Provisional until the GDD text is in the repo: the five sources' point values (op 40, research 25, calming 10 x3,
  government 30, heroics 15) and their side costs, the strength of each domino link, the starting reputation (50) and
  board confidence (60), and the 6/4/3 window mapping (by the track's own breach number). All live in `BREACH` / `DOMINO_LINKS`.
- Demo: `demo/breach-demo.html`.
