# GDD gap review

**Status (2026-11-24):** the full GDD is now in the repo at `gdd/current/gdd-full.md` (dated
November 23, 2026; about 22k words, 16 top-level sections). This review compares every section against
what exists on `main` today: the real game (`index.html` -> `src/campaign/main.js`), the system modules
under `src/`, their READMEs and the demo pages in `demo/`. It replaces the provisional review, which only
had the design brief to go on.

"In game" means `src/campaign/main.js` imports and runs it. "Demo only" means the code exists and is
tested, but only a page in `demo/` uses it. "Partial" means some of the GDD's rules are in the game but
the core of the section is not.

## Coverage by GDD section

| GDD section | What the GDD asks for | What exists | State |
|---|---|---|---|
| Overview | 12 quarters in 5 chapters, 6 of 10 tracks, Overtime, 73 rooms / 37 schemes / 48 unlocks / 340 cards / 12 endings | Campaign shell, main menu and save slot (`src/campaign/main.js`, `save.js`) | partial |
| Core loop | 2-minute weeks, 26-minute quarters, bands with drift and RP grants, the Fear meter, momentum, hold/push/cash out | 27-min quarter clock with 13 weeks (`src/campaign/clock.js`); Fear in `src/demand/demand.js`. No bands, drift, grants or momentum | partial |
| Shelter canvas | 1 m tiles, 4-tile floors, 16-64-tile plots, 5 strata, 73 rooms, 8 life systems, Days Sealed, build rules, construction flow, 6 styles, Blueprints, overlays | 10x6 cell grid, 11 rooms, one crew (`src/shelter/grid.js`, `src/clients/rooms.js`). Life systems, strata, build rules, construction flow (`src/shelter/life.js`) | partial (life systems demo only) |
| World canvas | 8 fictional regions, 6 named tracks opening on a schedule, 29+8 schemes, weekly event deck, 2 rivals | 8 real-world regions and the lead market (`src/demand`), map sales (`src/worldmap`), 6 schemes (`src/schemes`). No event deck or rivals | partial |
| Crises and tipping points | Hidden tipping points, breach windows, containment, recovery, collapse, domino map, Doom Clock with fragility | `src/crisis/breach.js` (5 tracks, 10 links), `src/doomclock/doomclock.js` | in game |
| Clients and needs ladder | 4 tiers, Satisfaction vs Survivability, 5 wealth classes, 16 traits, lifecycle, contracts, walkthroughs, change orders, retainers | `src/clients/clients.js` (5 client types, orders, wants vs Midnight forecast) | demo only |
| Company and board | 5 company tiers, 7 departments with named heads, loyalty, revenue quota, 5 board members with own confidence, directives, votes, Favours | `src/pushback/pushback.js` board: one profit target, 3 strikes | partial |
| Pushback systems | Heat bands 30/55/75/95, journalists, leverage 40/70/90, reputation, Inspector, sieges, interlocks, 3 difficulties | Heat, world tension, leverage, board, relief valves (`src/pushback/pushback.js`, pressure gauge) in game. Journalists, reputation, Inspector, sieges (`src/pushback/press.js`) | partial (press demo only) |
| Research and unlocks | 39 nodes in 5 branches + 9 story unlocks on a timed schedule, cash in ch. 1, RP from grants, locked shelf | `src/research/research.js`: 13 nodes in 3 branches, RP per second from one tension value | partial |
| Pacing | 5 chapters (Q1-2, Q3-4, Q5-7, Q8-10, Q11-12), timed signature moments, cadence rules, catch-up | Pacing harness and bots (`src/debug/pacing.js`, `sim.js`, `tools/pacing-harness.mjs`) | partial |
| Characters | Founder backgrounds, 7 executives, 5 board members, 2 journalists, 2 rivals, 16 hero clients, 6 arcs | Iris Kemp and Gil Marsh in `src/pushback/press.js` | demo only (2 of 32) |
| Midnight and endings | Engineered road (Lights Out, Final Product, vote), Last Call, Seal Order, Days Sealed per apocalypse, 5 grades, 12 endings, epilogues, Ledger | In game: `computeMidnight` with control score, 6 survival-share endings, GDD grades via `gradeFor`. `src/midnight/engineered.js`: projects, Last Call, Seal Order, 10 apocalypses, Overtime | partial (engineered road demo only) |
| Economy and tuning | $M economy: $6M Q1 quota +30%/quarter, $3-5M Solo Pods, room and dig costs, RP costs, tuning constants, telemetry | One ledger (`src/ledger/ledger.js`); all prices in $K; per-quarter CSV log | partial |
| Art, audio and UI | 16 px tiles, 48-colour palette, tier trims, track colours and patterns, top bar / rails layout, Tab swap, accessibility, layered audio | 28-colour palette and sprites (`src/art`), HUD, ledger rail, Tab toggle (`src/ui`), synthesized music and SFX (`src/audio`) | partial |
| Production plan | 13-week plan, slice gate at week 5, content counts, cut list | n/a (process); see content counts and tickets below | n/a |
| Systems review | 14 fixes (momentum, Fear, Brink costs, fragility, shelter-in-place, demand rule, per-member confidence, loyalty, Notoriety, ...) | In game: fixes 2, 4, 5 (air/water/food only) and 6. Demo only: 10. Missing: 1, 3, 7, 8, 9, 11, 13, 14 | partial |

## Content counts

GDD numbers are from Production plan > Content counts. Repo counts are from the code.

| Content | GDD full game | GDD vertical slice | Repo today | Where |
|---|---|---|---|---|
| Rooms and fixtures | 73 | 25 | 11 in game; 31 in `LIFE_ROOMS` (demo); 34 distinct ids. About 23 match a GDD room by name (7 of the 11 in game) | `src/clients/rooms.js` `ROOM_CATALOG`, `src/shelter/life.js` `LIFE_ROOMS` |
| Threat tracks | 10 (6 per campaign) | 2 | 5 generic tracks, none with a GDD name, all open from Q1. The GDD's 10 exist only as Midnight requirements (`APOCALYPSES`) | `src/crisis/breach.js` `TRACKS`, `src/midnight/engineered.js` |
| Schemes | 37 | 6 | 6, none with a GDD name, plus 2 relief valves (Lay low, Fund relief) and 5 containment sources | `src/schemes/schemes.js` `SCHEMES`, `src/pushback/pushback.js` |
| Event cards | 340 | 60 | 0 (no deck; only pushback choice cards and press front pages) | none |
| Unlocks | 48 | 19 | 13 research nodes (amenities, schemes, crews) | `src/research/research.js` `RESEARCH_NODES` |
| Hero clients | 16 | 6 | 0 (5 generic client types, demo only) | `src/clients/clients.js` `CLIENT_TYPES` |
| Named characters | 32 | 12 | 2 (Iris Kemp, Gil Marsh), demo only | `src/pushback/press.js` |
| Styles | 6 | 2 | 0 | none |
| Regions | 8 | 2 | 8 (real-world names) | `src/demand/demand.js` `REGIONS` |
| Endings | 12 | 0 | 6 survival-share endings + an Ousted screen in game; GDD grades in game; Overtime demo only. 0 GDD endings by name | `src/midnight/midnight.js` `ENDINGS`, `src/campaign/main.js` |

## Biggest mismatches with the GDD

1. **Two tension models run side by side.** The GDD has one tension per track. The game runs
   `CrisisSystem`'s 5 tracks and pushback's single "world" tension, which still drives research
   (`tree.tick(g, pb.tension)`), audio (`src/audio/audio.js` `wireAudio`), Midnight's control score and the
   HUD. `attachPushback(doom, pb)` in `src/campaign/main.js` also feeds world tension into the Doom Clock as
   a sixth track next to the five crisis tracks, so the clock sums both (`src/doomclock/doomclock.js`).
2. **Tracks.** GDD: "the Classic six (Atomic Standoff, The Bloom, Superstorm Season, The Optimizer, The
   Hush, The Pitchforks)", opening at 0:25, 0:55, 1:58, 2:35, 3:20 and 3:30. Code: `pandemic, climate,
   unrest, markets, war`, all open at start with seeded tensions 10-30 (`src/crisis/breach.js` `TRACKS`,
   `START_TENSION` in `main.js`). No Pitchforks track, so sieges have nothing to key off in game.
3. **Bands, drift and momentum.** GDD: Calm 0-19 / Simmer 20-44 / Boil 45-69 / Brink 70 to the tip, with
   drift -1/0/+0.5/+1.5 and "momentum releases a quarter of itself as tension each week". Code: a track is
   "brink" within 10 of its hidden tip (`BREACH.brinkMargin`), there is no drift, and schemes add tension
   instantly (`src/schemes/schemes.js` `run`).
4. **Research income.** GDD: chapter 1 runs on cash, then "Grants (RP per week)" of 2/6/15 per track by
   band. Code: `researchRate(crisis)` pays 0.5-4.5 RP per second from one crisis value
   (`src/research/research.js`).
5. **Time.** GDD: "In-game week: 120 seconds at 1x. Quarter: 13 weeks: 26 minutes". Code: 27-minute
   quarters (`PACING.quarterMinutes` in `src/debug/pacing.js`), so a week is about 125 s.
6. **Chapters.** GDD: chapters 2-5 start at Q3, Q5, Q8 and Q11. Code: `doom.chapterStart` fires on
   `(quarter - 1) % 3 === 0`, so at Q4, Q7 and Q10 (`src/campaign/main.js`, `onQuarterStart`).
7. **Board and money scale.** GDD: "$6M in Q1" revenue quota rising 30% a quarter, five members with their
   own confidence 0-100, ousted at 0. Code: a $50K quarterly *profit* target, +8% a quarter, ousted after 3
   strikes (`PUSHBACK_DEFAULTS.board`); starting cash $400K (`STARTING_CASH`); rooms cost $12K-$200K against
   the GDD's $0.2-25M. `CrisisSystem` keeps a second, separate `boardConfidence` (`src/crisis/breach.js`).
8. **Heat and leverage thresholds.** GDD heat: 30 Whispers, 55 Investigation, 75 Hearings, 95 Exposed,
   decay 1 a week. Code: investigation at 50, fine at 65, raid at 100, decay 8 a quarter. GDD leverage:
   40 Demands, 70 Blackmail, 90 Cut-in. Code: 30 and 55 (`src/pushback/pushback.js`).
9. **Shelter grid.** GDD: "16 x 16 px = 1 m x 1 m", "Floor pitch 4 tiles", rooms 2-16 tiles wide, plots 16-64
   tiles wide. Code: 10x6 cells, one room per cell, 5 m per row, a ladder shaft in column 0 instead of a
   Utility Spine (`GRID` in `src/shelter/grid.js`, `FLOOR_METERS` in `src/shelter/life.js`).
10. **Strata.** GDD: Topsoil 0-10 m / Clay 10-25 / Bedrock 25-60 / Deep Rock 60-120 / The Abyss, dig $10k,
    $25k, $80k, $200k, $500k, blast base 1-5. Code: topsoil / clay 10-30 / sandstone / granite / deep
    bedrock, $8k-$110k, blast base 0-4 (`STRATA` in `src/shelter/life.js`).
11. **Room ids and names.** In-game rooms not in the GDD catalog: `gold_taps`, `air_vent`, `mil_scrubber`,
    `ai_butler`; `wine_cellar` is "Wine cellar & panic room" (two separate GDD rooms); `water_recycler` is
    "Deep-well recycler" (GDD: Deep Water Recycler). GDD starter rooms missing in game: Airlock, Diesel
    Generator, Hand-crank Scrubber, Galley Kitchen. Two catalogs disagree (`ROOM_CATALOG` vs `LIFE_ROOMS`,
    e.g. `cellar` vs `wine_cellar`).
12. **Regions.** GDD: "Regions are fictional, with real echoes, so no real nation is ever the punchline"
    (The Heartland, Coastal Megacities, Tech Corridor, ...). Code: North America, Latin America, Europe,
    Middle East, Africa, South Asia, East Asia, Oceania (`REGIONS` in `src/demand/demand.js`).
13. **Clients.** GDD: wealth classes C1-C5 with willingness-to-pay weights and 16 traits. Code: client types
    `tech_founder, oil_heir, celebrity, politician, prepper` and four wealth tiers (comfortable / rich /
    ultra / apex) in `src/worldmap/sales.js`.
14. **Containment numbers.** GDD: op +40 after 2 weeks, crash research +15/week for 40 RP, calming = half
    momentum, government +25 at reputation 50+ with heat -5, heroics +20. Code: research 25, calming 10,
    government 30 with heat +10, heroics 15 (`BREACH.sources`). Starting reputation is 50 in
    `CrisisSystem` and 40 in `Press` (GDD: 40).
15. **Midnight road.** GDD: engineered Midnight is a player action (Project Lights Out, The Final Product, a
    3-of-5 vote). In game, "engineered" vs "failed" is decided by a control score >= 50
    (`controlScore` in `src/midnight/midnight.js`); the player-driven road is only in
    `src/midnight/engineered.js` (demo).
16. **Save.** `CrisisSystem`, `LeadMarket` and `SchemeBoard` have no `toJSON`, and `main.js` does not register
    them, so CONTINUE re-rolls tipping points and resets track tensions.

GDD inconsistencies to settle: the Overview says "one shovel crew" but Company tiers give Startup 2 crews;
quarters are 26 minutes in Economy and tuning but "rise from about 26 to about 32" in Pacing; the event deck
is 220 cards in World canvas and 340 in Content counts (340 includes the 120 alternate-track cards).
**Settled in #96:** see `docs/gdd-decisions.md` (2 crews, 27-minute quarters, 220 per campaign / 340 total, reputation starts at 40).

## Suggested next tickets (vertical slice first)

The slice gate (Production plan, weeks 3-5): "testers reach 1:50 and want to keep going, and they read Days
Sealed and Satisfaction without a tutorial", with 25 rooms, two tracks, heat and Iris Kemp, board
meetings, the Condo Silo and 60 event cards.

1. **One tension model.** Retire pushback's world tension. Drive research, audio, the HUD and Midnight
   from `CrisisSystem`, drop `attachPushback` from the Doom Clock, and save crisis, market and schemes.
2. **GDD tracks, bands and momentum.** Rename tracks to GDD slots, open Atomic Standoff (0:25) and The
   Bloom (0:55) on schedule, add Calm/Simmer/Boil/Brink with drift, Brink heat and volatility, and
   momentum (fixes 1 and 3). Replace `researchRate` with weekly band grants plus cash-bought tier-1 nodes.
3. **Rebase the economy and the board.** Move to $M prices, the $6M revenue quota at +30%, five board
   members with their own confidence, two directives a meeting and ouster at 0 (fix 7). Merge the
   crisis system's board confidence into it.
4. **Wire the life systems into the grid.** One room catalog with GDD ids for the slice's 25 rooms, Days
   Sealed on every shelter, the GDD strata table and the construction flow from `src/shelter/life.js`.
   Decide whether the grid moves to 1 m tiles now (it touches art, rules and save format).
5. **Clients and contracts in game.** Wire `src/clients` into the lead market as contracts with
   Satisfaction vs Survivability, required Days Sealed, walkthroughs and C1-C2 classes and traits. Add the
   Condo Silo and 6 hero clients. This is the half of the gate about reading the two scores.
6. **Event deck.** A weekly headline card system (type shares from World canvas) and the slice's 60 cards.
7. **Heat to GDD bands and Iris Kemp in game.** Wire `src/pushback/press.js`, move heat and leverage to
   the GDD thresholds and weekly decay, and use one reputation (start 40).
8. **Unlock schedule rows 1-19** with the locked shelf (next three unlocks visible), replacing the
   current 13-node tree.
9. **Fictional regions.** Rename `REGIONS` to the GDD's eight with their exposure tables; the slice needs
   The Heartland plus a second site region.
10. **Pacing pass to 1:50.** Fix chapter boundaries (Q3/Q5/Q8/Q11), set the week to 120 s, and point the
    pacing harness at the GDD's moment-to-moment targets (first contract under 3 min, first handover under 12).

Later (content build, chapters 3-5): the other four Classic tracks, rivals, departments and executives,
leverage at the GDD tiers, sieges, wiring `engineered.js` into the campaign, the 12 named endings, styles
and Blueprints.
