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

## Tile-level bunker (#37) — now the in-game shelter view
- `bunker-catalog.js`: GDD strata (dig cost, crew speed, base blast), 52 objects (beds, scrubbers, tanks, generators, doors,
  blast doors, decor, status furniture...) with footprints in 1 m tiles and GDD system numbers, room types recognised from
  contents, `PRICE_SCALE` (GDD $ x 0.1 until the economy is rescaled).
- `bunker.js` `BunkerSite`: dig tiles, build walls/spine, lay air/water/power conduits, place objects (must stand on a floor;
  depth gates; surface items). Crews work a job queue and can only reach tiles connected to the surface. Rooms = enclosed
  spaces, typed by their furniture, with impressiveness (beauty, space, noise, raw rock, cramping). Networks power and plumb
  machines (load-shedding by priority). Days Sealed from air (CO2 buffer), water, food, power (fuel, battery); seal, blast,
  security, morale; seepage below the 12 m water table; survey and 30-day pressure test; `toShelter`/`handOver`/save.
- `bunker-ui.js` + `bunker.css`: the editor (drag tools, palette, ghosts with reasons, overlays, crews, room inspector).
- `computeMidnight` grades tile-built shelters from their simulated Days Sealed and ratings (`shelter.sealed`).
- Demo: `demo/bunker-demo.html?starter`. The old cell grid (`grid.js`) is no longer used by the campaign.

## Design layer: room styles (#62, L0 greybox)
- `styles.js`: six `STYLES` (only Brutalist and Gilded offered at L0: `PLACEHOLDER_STYLES`), `styleMultiplier(roomStyle,
  clientStyle)` = 1.25 match / 1.0 neutral / 0.8 clash (`CLASHES` pairs are provisional), `WTP_WEIGHTS` by wealth class (GDD),
  `satisfaction(client, rooms, { met })` = s x sum(w_k x met_k), capped at 100, where s averages the multiplier over the rooms
  the client looks at (Survive only for Paranoid / Engineer / Inspector). `styledPrestige`, `roomStyle`, `setRoomStyle(site, room, style)`.
- Cell-grid rooms: `grid.place(col, row, id, { style })` (default Brutalist) and `grid.setStyle(col, row, style)`; saved with the cell.
- Bunker rooms: the majority `style` of their objects (objects keep the field through save/load); `setRoomStyle` re-skins a room.
- Clients: every client type has a `wealthClass` and preferred `style`, copied onto each order.
- Placeholder until the needs-ladder work lands: `met_k` from room counts per tier (`TIER_TARGETS`).
- Demo: `demo/styles-demo.html`.

## Style kits: rooms made of pieces (#97)
- `STYLE_KITS` (bunker-catalog): Brutalist = board-formed concrete walls, polished slab, sodium lamps, black/ebony/leather;
  Gilded = gold damask, marble checker, chandelier glow, gold/ebony/burgundy/silk. Finishes carry `style`.
- `site.applyStyle(styleId, x, y)` dresses the room under (x, y): paints walls, floor and light (per m²) and recolours its
  furniture to the kit colour of each family. Pieces stay individually editable (PAINT, RECOLOUR).
- `site.roomStyle(room)` / `room.style` from `simulate()`: one vote each for walls, floor, light (majority of tiles), half a
  vote per kit-coloured piece; 2+ votes and a clear lead = that style. `styles.js` `satisfaction()` reads `room.style`.
- Editor: STYLE tool [Y] (pick a kit, click a room); the inspector shows the room's style and votes.
- `src/art/finish-art.js`: detailed per-pixel board concrete, damask, polished slab and marble checker, laid in world pixels.

## Megaprojects: Compound and Ark (#143, greybox)
- `megaprojects.js`: `MegaprojectBoard({ ledger, isUnlocked, seed, crews, siteOpts })`. Numbers in `MEGAPROJECTS` (tuning.js).
  - `startCompound()` (4:20): three BunkerSites A, B, C; tunnels A-B and B-C dug at a depth (`digTunnel(id, m)`); below the
    12 m water table a tunnel can flood each week, and next to a besieged site it can be breached (`besieged` set);
    `repairTunnel` pumps out / reseals. `summary()`: linked sites pool their stores; the Compound lasts as long as its
    weakest linked group.
  - `startArk(lead)` (5:00): only a Table (C5) lead commissions it; more Table leads join the consortium. A 64-wide,
    130 m-deep BunkerSite. `checklist()`: Abyss depth (120 m), Governance Hall and Schoolhouse (greybox: a room of a
    minimum width holding listed pieces), sleeps 200. `handOver()` pays the consortium price.
- `megaprojects-ui.js` + `.css`: PROJECTS screen (top bar) with a bunker editor per Compound site plus the tunnel panel,
  and the Ark editor plus checklist. World map: a Table lead card offers BEGIN THE ARK.
