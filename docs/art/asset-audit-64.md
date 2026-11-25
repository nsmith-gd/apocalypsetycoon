# Asset audit: the 64bit minimum (#114)

Art note D4 (director): "all assets need to be 64bit now minimum."

**Spec used:** every asset is at least **64 x 64 pixels at its native resolution** (shortest side >= 64 px; animation frames count individually; sprite sheets are judged by their frames). This is the most likely reading of "64bit" for pixel art ("64-bit sprites" = 64 px sprites). #113 is pinning the exact definition into the style guide; the minimum is one constant in `tools/check-asset-minimum.mjs` (#115), so a different number re-runs this audit unchanged. Under the other reading (64 bits per pixel, i.e. 16 bits per colour channel) every PNG we export fails: they are all 8 bits per channel.

**Result (after #116 rebuilt the placeholder tileset):** 218 assets scanned, **99 fall short**, 119 pass (the full-map layers and the map base, all 320 x 192). Generated from `node tools/asset-inventory.mjs`; owners come from the commit that created / last changed each source file.

**Owning tasks:** the board tickets #40–#49, #97 and #110 aren't visible to agents (docs/board-audit.md), so each asset lists the ticket that made it and the redo ticket that now picks it up: #116 rebuilds the #9 placeholder tileset (grid, map, UI); the rest are proposed tickets R40–R44 in .ballast/proposed-tickets.json.

| Category | Failing | Passing |
|---|---|---|
| map | 5 | 18 |
| UI | 1 | 8 |
| rooms and grid tiles | 9 | 6 |
| amenities and fixtures | 78 | 11 |
| characters | 1 | 0 |
| exported file | 5 | 57 |

## map

| | Asset | Current spec | Source | Made by / last changed | Picked up by |
|---|---|---|---|---|---|
| [ ] | `map-markers/city` | 9 x 10 px | `src/art/map-markers.js` | #102 / #102 | R42 (proposed: map markers and icons at 64) |
| [ ] | `map-markers/client` | 8 x 9 px | `src/art/map-markers.js` | #102 / #102 | R42 (proposed: map markers and icons at 64) |
| [ ] | `map-markers/bunker` | 10 x 11 px | `src/art/map-markers.js` | #102 / #102 | R42 (proposed: map markers and icons at 64) |
| [ ] | `map-markers/site` | 9 x 11 px | `src/art/map-markers.js` | #102 / #102 | R42 (proposed: map markers and icons at 64) |
| [ ] | `map-markers/hq` | 12 x 12 px | `src/art/map-markers.js` | #102 / #102 | R42 (proposed: map markers and icons at 64) |

## UI

| | Asset | Current spec | Source | Made by / last changed | Picked up by |
|---|---|---|---|---|---|
| [ ] | `font/glyph` | 3 x 5 px (bitmap font, 3x5 per glyph) | `src/art/font.js` | #9 / #9 | #116 (placeholder tileset rebuild) |

## rooms and grid tiles

| | Asset | Current spec | Source | Made by / last changed | Picked up by |
|---|---|---|---|---|---|
| [ ] | `bunker-tiles/strata-topsoil` | 16 x 16 px | `src/art/bunker-tiles.js` | R32 / R32 | R40 (proposed: strata and stage tiles at 64) |
| [ ] | `bunker-tiles/strata-clay` | 16 x 16 px | `src/art/bunker-tiles.js` | R32 / R32 | R40 (proposed: strata and stage tiles at 64) |
| [ ] | `bunker-tiles/strata-bedrock` | 16 x 16 px | `src/art/bunker-tiles.js` | R32 / R32 | R40 (proposed: strata and stage tiles at 64) |
| [ ] | `bunker-tiles/strata-deep` | 16 x 16 px | `src/art/bunker-tiles.js` | R32 / R32 | R40 (proposed: strata and stage tiles at 64) |
| [ ] | `bunker-tiles/strata-abyss` | 16 x 16 px | `src/art/bunker-tiles.js` | R32 / R32 | R40 (proposed: strata and stage tiles at 64) |
| [ ] | `bunker-tiles/stage-dig` | 16 x 16 px | `src/art/bunker-tiles.js` | R32 / R32 | R40 (proposed: strata and stage tiles at 64) |
| [ ] | `bunker-tiles/stage-shell` | 16 x 16 px | `src/art/bunker-tiles.js` | R32 / R32 | R40 (proposed: strata and stage tiles at 64) |
| [ ] | `bunker-tiles/stage-fitout` | 16 x 16 px (scaffold drawn at the object size (16 px per metre)) | `src/art/bunker-tiles.js` | R32 / R32 | R40 (proposed: strata and stage tiles at 64) |
| [ ] | `styled-rooms/room` | 32 x 32 px (one room template, every style) | `src/art/styleArt.js` | #63 / #88 | R43 (proposed: styled room template at 64) |

## amenities and fixtures

| | Asset | Current spec | Source | Made by / last changed | Picked up by |
|---|---|---|---|---|---|
| [ ] | `bunker-objects/door` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/airlock` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/blast_1` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/blast_2` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/blast_3` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/bunk` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [x] | `bunker-objects/bed` | 48 x 16 px (3x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: bed at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/king_bed` | 48 x 32 px (3x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: king_bed at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/crank_scrubber` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #119: crank_scrubber at 64 px per metre (`src/art/fixtures64.js`).**
| [x] | `bunker-objects/hepa` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #119: hepa at 64 px per metre (`src/art/fixtures64.js`).**
| [x] | `bunker-objects/o2_rack` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #119: o2_rack at 64 px per metre (`src/art/fixtures64.js`).**
| [x] | `bunker-objects/tank` | 32 x 48 px (2x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #119: tank at 64 px per metre (`src/art/fixtures64.js`).**
| [x] | `bunker-objects/recycler` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #119: recycler at 64 px per metre (`src/art/fixtures64.js`).**
| [x] | `bunker-objects/aquifer` | 32 x 48 px (2x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #119: aquifer at 64 px per metre (`src/art/fixtures64.js`).**
| [x] | `bunker-objects/sump` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #119: sump at 64 px per metre (`src/art/fixtures64.js`).**
| [x] | `bunker-objects/shelf` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #119: shelf at 64 px per metre (`src/art/fixtures64.js`).**
| [x] | `bunker-objects/fridge` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #119: fridge at 64 px per metre (`src/art/fixtures64.js`).**
| [x] | `bunker-objects/hydro` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #119: hydro at 64 px per metre (`src/art/fixtures64.js`).**
| [x] | `bunker-objects/grow_light` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #119: grow_light at 64 px per metre (`src/art/fixtures64.js`).**
| [x] | `bunker-objects/vat` | 32 x 48 px (2x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #119: vat at 64 px per metre (`src/art/fixtures64.js`).**
| [ ] | `bunker-objects/diesel` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/fuel` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/battery` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/solar` | 32 x 64 px (2x4 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/geothermal` | 96 x 48 px (6x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/reactor` | 96 x 48 px (6x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/stove` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [x] | `bunker-objects/chef_range` | 48 x 16 px (3x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: chef_range at 64 px per metre (`src/art/hd/amenities64.js`).**
| [ ] | `bunker-objects/toilet` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/shower` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/decon` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [x] | `bunker-objects/gold_taps` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: gold_taps at 64 px per metre (`src/art/hd/amenities64.js`).**
| [ ] | `bunker-objects/med_bed` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/gun_locker` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/guard_post` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/decoy` | 32 x 48 px (2x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/camera` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [x] | `bunker-objects/sofa` | 48 x 16 px (3x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: sofa at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/tv` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: tv at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/bookshelf` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: bookshelf at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/led_sky` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: led_sky at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/gym_rig` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: gym_rig at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/plant` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: plant at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/painting` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: painting at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/statue` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: statue at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/lamp` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: lamp at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/wine_rack` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: wine_rack at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/cinema_seats` | 48 x 16 px (3x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: cinema_seats at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/cinema_screen` | 48 x 32 px (3x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: cinema_screen at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/cryo_pod` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: cryo_pod at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/armchair` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: armchair at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/coffee_table` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: coffee_table at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/dining_table` | 48 x 16 px (3x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: dining_table at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/dining_chair` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: dining_chair at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/desk` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: desk at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/wardrobe` | 32 x 48 px (2x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: wardrobe at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/nightstand` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: nightstand at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/bathtub` | 48 x 16 px (3x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: bathtub at 64 px per metre (`src/art/hd/amenities64.js`).**
| [ ] | `bunker-objects/sink` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [x] | `bunker-objects/vanity` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: vanity at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/espresso` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: espresso at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/bar_counter` | 48 x 32 px (3x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: bar_counter at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/piano` | 48 x 32 px (3x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: piano at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/pool_table` | 48 x 16 px (3x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: pool_table at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/arcade` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: arcade at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/aquarium` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: aquarium at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/fireplace` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: fireplace at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/plant_tall` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: plant_tall at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/rug` | 48 x 16 px (3x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: rug at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/rug_persian` | 64 x 16 px (4x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: rug_persian at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/mirror` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: mirror at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/sconce` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: sconce at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/wall_shelf` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: wall_shelf at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/neon_sign` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: neon_sign at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/faux_window` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: faux_window at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/trophy` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: trophy at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/chandelier` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: chandelier at 64 px per metre (`src/art/hd/amenities64.js`).**
| [x] | `bunker-objects/pendant` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) | **Done in #118: pendant at 64 px per metre (`src/art/hd/amenities64.js`).**

## characters

| | Asset | Current spec | Source | Made by / last changed | Picked up by |
|---|---|---|---|---|---|
| [ ] | `bunker-residents/resident` | 10 x 16 px (per pose) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |

## exported file

| | Asset | Current spec | Source | Made by / last changed | Picked up by |
|---|---|---|---|---|---|
| [ ] | `assets/art/map-markers/bunker.png` | 11 x 12 px | `assets/art/map-markers/bunker.png` | #102 / #102 | #116 (placeholder tileset rebuild) |
| [ ] | `assets/art/map-markers/city.png` | 10 x 11 px | `assets/art/map-markers/city.png` | #102 / #102 | #116 (placeholder tileset rebuild) |
| [ ] | `assets/art/map-markers/client.png` | 9 x 10 px | `assets/art/map-markers/client.png` | #102 / #102 | #116 (placeholder tileset rebuild) |
| [ ] | `assets/art/map-markers/hq.png` | 13 x 13 px | `assets/art/map-markers/hq.png` | #102 / #102 | #116 (placeholder tileset rebuild) |
| [ ] | `assets/art/map-markers/site.png` | 10 x 12 px | `assets/art/map-markers/site.png` | #102 / #102 | #116 (placeholder tileset rebuild) |

## Passing

- `shelter-tiles/earth`: 64 x 64 px
- `shelter-tiles/earthDeep`: 64 x 64 px
- `shelter-tiles/rock`: 64 x 64 px
- `shelter-tiles/surface`: 64 x 64 px
- `shelter-tiles/roomEmpty`: 64 x 64 px
- `shelter-tiles/shaft`: 64 x 64 px
- `shelter-amenities/bunk`: 64 x 64 px
- `shelter-amenities/gold_taps`: 64 x 64 px
- `shelter-amenities/air_vent`: 64 x 64 px
- `shelter-amenities/water_tank`: 64 x 64 px
- `shelter-amenities/pantry`: 64 x 64 px
- `shelter-amenities/hydroponics`: 64 x 64 px
- `shelter-amenities/water_recycler`: 64 x 64 px
- `shelter-amenities/cryo_pod`: 64 x 64 px
- `shelter-amenities/mil_scrubber`: 64 x 64 px
- `shelter-amenities/wine_cellar`: 64 x 64 px
- `shelter-amenities/ai_butler`: 64 x 64 px
- `map-tiles/ocean`: 64 x 64 px
- `map-tiles/shallows`: 64 x 64 px
- `map-tiles/land`: 64 x 64 px
- `map-tiles/forest`: 64 x 64 px
- `map-tiles/desert`: 64 x 64 px
- `map-tiles/ice`: 64 x 64 px
- `map-tiles/mountain`: 64 x 64 px
- `map-tiles/city`: 64 x 64 px
- `map-markers-old/bunker`: 80 x 80 px
- `map-markers-old/client`: 64 x 64 px
- `map-markers-old/hq`: 96 x 96 px
- `crisis-icons/pandemic`: 80 x 80 px
- `crisis-icons/fire`: 80 x 80 px
- `crisis-icons/radiation`: 80 x 80 px
- `crisis-icons/unrest`: 80 x 80 px
- `crisis-icons/flood`: 80 x 80 px
- `crisis-icons/crash`: 80 x 80 px
- `crisis-icons/blackout`: 80 x 80 px
- `crisis-overlays/uneasy`: 64 x 64 px
- `crisis-overlays/edge`: 64 x 64 px
- `crisis-overlays/tipping`: 64 x 64 px
- `crisis-overlays/selected`: 64 x 64 px
- `ui-frames/panel`: 96 x 96 px
- `ui-frames/paper`: 96 x 96 px
- `ui-frames/button`: 64 x 64 px
- `ui-frames/buttonPressed`: 64 x 64 px
- `ui-frames/buttonActive`: 64 x 64 px
- `ui-frames/meter`: 96 x 64 px
- `ui-frames/tooltip`: 96 x 96 px
- `ui-icons/cash`: 96 x 96 px
- `ui-icons/quarter`: 96 x 96 px
- `ui-icons/heat`: 96 x 96 px
- `ui-icons/tension`: 96 x 96 px
- `ui-icons/board`: 96 x 96 px
- `ui-icons/research`: 96 x 96 px
- `ui-icons/crew`: 96 x 96 px
- `ui-icons/lock`: 96 x 96 px
- `ui-icons/alarm`: 96 x 96 px
- `ui-icons/midnight`: 96 x 96 px
- `ui-icons/map`: 96 x 96 px
- `ui-icons/shelter`: 96 x 96 px
- `ui/logo`: 192 x 64 px
- `map-base/world`: 320 x 192 px
- `map-regions/state-layer`: 320 x 192 px
- `map-heat/heat-layer`: 320 x 192 px
- `assets/art/crisis-icons.png`: 161 x 566 px
- `assets/art/crisis-overlays.png`: 129 x 259 px
- `assets/art/map-base.png`: 320 x 192 px
- `assets/art/map-heat/afr-edge.png`: 320 x 192 px
- `assets/art/map-heat/afr-tipping.png`: 320 x 192 px
- `assets/art/map-heat/afr-uneasy.png`: 320 x 192 px
- `assets/art/map-heat/eas-edge.png`: 320 x 192 px
- `assets/art/map-heat/eas-tipping.png`: 320 x 192 px
- `assets/art/map-heat/eas-uneasy.png`: 320 x 192 px
- `assets/art/map-heat/eur-edge.png`: 320 x 192 px
- `assets/art/map-heat/eur-tipping.png`: 320 x 192 px
- `assets/art/map-heat/eur-uneasy.png`: 320 x 192 px
- `assets/art/map-heat/lat-edge.png`: 320 x 192 px
- `assets/art/map-heat/lat-tipping.png`: 320 x 192 px
- `assets/art/map-heat/lat-uneasy.png`: 320 x 192 px
- `assets/art/map-heat/mea-edge.png`: 320 x 192 px
- `assets/art/map-heat/mea-tipping.png`: 320 x 192 px
- `assets/art/map-heat/mea-uneasy.png`: 320 x 192 px
- `assets/art/map-heat/nam-edge.png`: 320 x 192 px
- `assets/art/map-heat/nam-tipping.png`: 320 x 192 px
- `assets/art/map-heat/nam-uneasy.png`: 320 x 192 px
- `assets/art/map-heat/oce-edge.png`: 320 x 192 px
- `assets/art/map-heat/oce-tipping.png`: 320 x 192 px
- `assets/art/map-heat/oce-uneasy.png`: 320 x 192 px
- `assets/art/map-heat/sas-edge.png`: 320 x 192 px
- `assets/art/map-heat/sas-tipping.png`: 320 x 192 px
- `assets/art/map-heat/sas-uneasy.png`: 320 x 192 px
- `assets/art/map-markers.png`: 96 x 290 px
- `assets/art/map-regions/afr-hover.png`: 320 x 192 px
- `assets/art/map-regions/afr-idle.png`: 320 x 192 px
- `assets/art/map-regions/afr-selected.png`: 320 x 192 px
- `assets/art/map-regions/eas-hover.png`: 320 x 192 px
- `assets/art/map-regions/eas-idle.png`: 320 x 192 px
- `assets/art/map-regions/eas-selected.png`: 320 x 192 px
- `assets/art/map-regions/eur-hover.png`: 320 x 192 px
- `assets/art/map-regions/eur-idle.png`: 320 x 192 px
- `assets/art/map-regions/eur-selected.png`: 320 x 192 px
- `assets/art/map-regions/lat-hover.png`: 320 x 192 px
- `assets/art/map-regions/lat-idle.png`: 320 x 192 px
- `assets/art/map-regions/lat-selected.png`: 320 x 192 px
- `assets/art/map-regions/mea-hover.png`: 320 x 192 px
- `assets/art/map-regions/mea-idle.png`: 320 x 192 px
- `assets/art/map-regions/mea-selected.png`: 320 x 192 px
- `assets/art/map-regions/nam-hover.png`: 320 x 192 px
- `assets/art/map-regions/nam-idle.png`: 320 x 192 px
- `assets/art/map-regions/nam-selected.png`: 320 x 192 px
- `assets/art/map-regions/oce-hover.png`: 320 x 192 px
- `assets/art/map-regions/oce-idle.png`: 320 x 192 px
- `assets/art/map-regions/oce-selected.png`: 320 x 192 px
- `assets/art/map-regions/sas-hover.png`: 320 x 192 px
- `assets/art/map-regions/sas-idle.png`: 320 x 192 px
- `assets/art/map-regions/sas-selected.png`: 320 x 192 px
- `assets/art/map-tiles.png`: 129 x 519 px
- `assets/art/shelter-amenities.png`: 129 x 714 px
- `assets/art/shelter-tiles.png`: 64 x 389 px
- `assets/art/ui-frames.png`: 96 x 678 px
- `assets/art/ui-icons.png`: 192 x 1454 px

Note: the map base passes as one 320 x 192 image, but its terrain still follows an 8 px cell layout; if #113 decides the minimum applies to map cells too, the map base and its overlays fail as well.
