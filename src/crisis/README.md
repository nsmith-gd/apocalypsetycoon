# Crisis breach, containment, recovery and collapse (GDD: Crises and tipping points)

- `breach.js`: `new CrisisSystem({ seed, pushback, doomClock, ledger, shelters })`. Five tracks (pandemic, climate,
  unrest, markets, war) with hidden tipping points rolled at 90 + (-8..+4); scars (-3) and Doom Clock fragility lower
  them (never below 72). `visibleTip(id)` is a range until a containment reveals the exact point.
  - Tension changes go through `addTension(id, n)` / `setTension(id, v)` so locks, pins and breaches apply
    (#4's schemes and the world drift should call these).
  - Breach: auto-pause (`pause` event), 6/4/3-week window, 100-point bar. `sourceOffer(id, key, opts)` returns points,
    cost, `available` and a plain `reason` when it can't be used; `contribute(id, key, opts)` spends it. GDD values (#64):
    - op: +40 two breach weeks after launch, $10M x breach count, one per track at a time (pending ops tick weekly);
    - research (crash program): +15 every breach week, 40 RP a week (`spendRp` hook; stops when RP runs out), needs
      R&D level 2 (`rdLevel` hook; no hook = ungated), pauses normal research; `stopResearch(id)`;
    - calming: half the calming scheme's momentum (`opts.scheme`, default Everything Is Fine: +4), at that scheme's cost
      and heat, 3 per breach;
    - government: +25 once per breach, needs reputation 50, heat -5;
    - heroics: +20, each executive once per campaign (`opts.exec`: ruth, june, theo; Theo's dirty fix heat +10),
      board confidence -5; used executives are saved (`heroicsUsed`).
    Breach weeks: +2 heat, -2 board confidence, panic premium x2 (`panicMultiplier`).
  - Contained: tension 60, locked 3 weeks, scar, revealed; Doom Clock `breachContained`.
  - Collapse: pinned at 100, Doom Clock `collapse`, linked tracks shoved +15/+8/+4 via `DOMINO_LINKS` (10 links).
  - Shelter-in-place on each breach: every sold shelter is tested (default: air, water and food cover its occupants):
    pass +2 reputation, fail -5 reputation and +15 leverage for its client.
  - `advanceWeek()` once per in-game week. `snapshot()` for UI/save.
- `breach-ui.js` + `breach.css`: the containment card (pauses the game until resolved or the player advances).
- Still provisional: the strength of each domino link, the starting board confidence (60), the 6/4/3 window mapping
  (by the track's own breach number), and the heroics board-confidence cost (the GDD lists none). All in `BREACH` /
  `DOMINO_LINKS` (src/config/tuning.js).
- Demo: `demo/breach-demo.html`.
