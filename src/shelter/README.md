# Shelter life systems (GDD: Shelter canvas, Clients > Two scores)

- `life.js` — rules only. A shelter is `{ occupants, rooms: [{ type, floor, col }] }` (floor 0 = surface, each floor
  5 m deeper, column 0 is the Utility Spine). #2's grid can pass its rooms straight in.
  - `simulate(shelter)`: the eight systems. Flows (air, water, food, power: stock / use / production in person-days)
    and ratings 0-5 (seal, blast, security, morale). `daysSealed` = min over the four flows of
    stock / (use - production); `limiting` names the one that runs out first.
  - Build rules (`validate`): every floor connects to the spine; depth gates (cellar 10 m, geothermal 50 m,
    reactor 60 m, aquifer 80 m); surface-only features; noise within 6 tiles of quarters costs comfort; adjacency
    bonuses (`ADJACENCY`); surface visibility costs security (1 per 2 visibility).
  - `STRATA`: topsoil, clay, sandstone, granite, deep bedrock, each with dig cost per tile, crew speed and blast
    base. Blast rating = stratum of the deepest floor + best blast door.
  - `survival(sim, req)`: P(survive) = f_seal x f_blast x f_security x f_morale x f_days, each f = 1 - 0.25 per
    rating point short; f_days = Days Sealed / required (capped at 1). `twoScores` = wants vs needs (0-100).
  - Construction: `digPlan`, `constructionPlan(shelter, { crews })` (survey, dig, shell, fit-out, 30-day pressure
    test, walkthrough, handover) and `ConstructionJob` (weekly; crews can change mid-build; the pressure test fails
    if Days Sealed < 30).
- Provisional until the GDD tables are in the repo: every room's flows and ratings, the strata numbers (bands,
  dig cost, crew speed, blast base), the adjacency list, phase lengths, morale formula and the per-person use.
  The four depth gates, 6-tile noise radius, 30-day pressure test and -0.25 per missing point are from the ticket.
- Demo: `demo/shelter-life-demo.html`.

# Shelter grid (#2: the build canvas)

- `grid.js` — `ShelterGrid({ ledger, costMultiplier, crews, isUnlocked })`, rules only. 10 x 6 cells, row 0 surface,
  column 0 the ladder shaft. Palette = `ROOM_CATALOG` (clients/rooms.js); research-gated rooms need `isUnlocked`.
  - `quote(col, row, id)` / `place(...)`: room price + digging the cell (`STRATA` by depth, 5 m per row) the first
    time, times the board's `buildCostMultiplier`. Booked in the ledger at once under Builds.
  - Crews (`crews()`, research adds more) work the queue one job each; `tick(gameSeconds)`. Dig time by stratum +
    fit-out time. Rooms count only once built.
  - `remove(col, row)`: unfinished job = full refund; finished room = 50% salvage; the hole stays dug.
  - `stats()`: occupants (2 + 4 per bunk room), air/water/food supply vs need with Midnight's grades, prestige,
    luxury/survival counts, invested, crew status. `toShelter()` feeds `computeMidnight`. `toJSON()/load()`.
- `grid-ui.js` + `grid.css` — palette strip, click-to-build canvas (hover quote, scaffolding + progress on jobs,
  floating cost text), right-click or DEMOLISH [X] to remove, stat sheet. Used by the campaign (`index.html`).
