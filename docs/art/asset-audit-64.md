# Asset audit: the 64bit minimum (#114)

Art note D4 (director): "all assets need to be 64bit now minimum."

**Spec used:** every asset is at least **64 x 64 pixels at its native resolution** (shortest side >= 64 px; animation frames count individually; sprite sheets are judged by their frames). This is the most likely reading of "64bit" for pixel art ("64-bit sprites" = 64 px sprites). #113 is pinning the exact definition into the style guide; the minimum is one constant in `tools/check-asset-minimum.mjs` (#115), so a different number re-runs this audit unchanged. Under the other reading (64 bits per pixel, i.e. 16 bits per colour channel) every PNG we export fails: they are all 8 bits per channel.

**Result:** 218 assets scanned, **166 fall short**, 52 pass (the full-map layers and the map base, all 320 x 192). Generated from `node tools/asset-inventory.mjs`; owners come from the commit that created / last changed each source file.

**Owning tasks:** the board tickets #40–#49, #97 and #110 aren't visible to agents (docs/board-audit.md), so each asset lists the ticket that made it and the redo ticket that now picks it up: #116 rebuilds the #9 placeholder tileset (grid, map, UI); the rest are proposed tickets R40–R44 in .ballast/proposed-tickets.json.

| Category | Failing | Passing |
|---|---|---|
| rooms and grid tiles | 15 | 0 |
| amenities and fixtures | 89 | 0 |
| map | 20 | 3 |
| icons | 19 | 0 |
| UI | 9 | 0 |
| characters | 1 | 0 |
| exported file | 13 | 49 |

## rooms and grid tiles

| | Asset | Current spec | Source | Made by / last changed | Picked up by |
|---|---|---|---|---|---|
| [ ] | `shelter-tiles/earth` | 16 x 16 px | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `shelter-tiles/earthDeep` | 16 x 16 px | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `shelter-tiles/rock` | 16 x 16 px | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `shelter-tiles/surface` | 16 x 16 px | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `shelter-tiles/roomEmpty` | 16 x 16 px | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `shelter-tiles/shaft` | 16 x 16 px | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
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
| [ ] | `shelter-amenities/bunk` | 16 x 16 px | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `shelter-amenities/gold_taps` | 16 x 16 px | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `shelter-amenities/air_vent` | 16 x 16 px, 2 frames | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `shelter-amenities/water_tank` | 16 x 16 px | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `shelter-amenities/pantry` | 16 x 16 px | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `shelter-amenities/hydroponics` | 16 x 16 px | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `shelter-amenities/water_recycler` | 16 x 16 px | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `shelter-amenities/cryo_pod` | 16 x 16 px, 2 frames | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `shelter-amenities/mil_scrubber` | 16 x 16 px | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `shelter-amenities/wine_cellar` | 16 x 16 px | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `shelter-amenities/ai_butler` | 16 x 16 px, 2 frames | `src/art/sprites-shelter.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `bunker-objects/door` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/airlock` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/blast_1` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/blast_2` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/blast_3` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/bunk` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/bed` | 48 x 16 px (3x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/king_bed` | 48 x 32 px (3x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/crank_scrubber` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/hepa` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/o2_rack` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/tank` | 32 x 48 px (2x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/recycler` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/aquifer` | 32 x 48 px (2x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/sump` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/shelf` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/fridge` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/hydro` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/grow_light` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/vat` | 32 x 48 px (2x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/diesel` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/fuel` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/battery` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/solar` | 32 x 64 px (2x4 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/geothermal` | 96 x 48 px (6x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/reactor` | 96 x 48 px (6x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/stove` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/chef_range` | 48 x 16 px (3x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/toilet` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/shower` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/decon` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/gold_taps` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/med_bed` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/gun_locker` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/guard_post` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/decoy` | 32 x 48 px (2x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/camera` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/sofa` | 48 x 16 px (3x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/tv` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/bookshelf` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/led_sky` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/gym_rig` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/plant` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/painting` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/statue` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/lamp` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/wine_rack` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/cinema_seats` | 48 x 16 px (3x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/cinema_screen` | 48 x 32 px (3x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/cryo_pod` | 16 x 48 px (1x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/armchair` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/coffee_table` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/dining_table` | 48 x 16 px (3x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/dining_chair` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/desk` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/wardrobe` | 32 x 48 px (2x3 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/nightstand` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/bathtub` | 48 x 16 px (3x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/sink` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/vanity` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/espresso` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/bar_counter` | 48 x 32 px (3x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/piano` | 48 x 32 px (3x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/pool_table` | 48 x 16 px (3x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/arcade` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/aquarium` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/fireplace` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/plant_tall` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/rug` | 48 x 16 px (3x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/rug_persian` | 64 x 16 px (4x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/mirror` | 16 x 32 px (1x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/sconce` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/wall_shelf` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/neon_sign` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/faux_window` | 32 x 32 px (2x2 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/trophy` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/chandelier` | 32 x 16 px (2x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |
| [ ] | `bunker-objects/pendant` | 16 x 16 px (1x1 m at 16 px per metre) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |

## map

| | Asset | Current spec | Source | Made by / last changed | Picked up by |
|---|---|---|---|---|---|
| [ ] | `map-tiles/ocean` | 8 x 8 px, 2 frames | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `map-tiles/shallows` | 8 x 8 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `map-tiles/land` | 8 x 8 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `map-tiles/forest` | 8 x 8 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `map-tiles/desert` | 8 x 8 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `map-tiles/ice` | 8 x 8 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `map-tiles/mountain` | 8 x 8 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `map-tiles/city` | 8 x 8 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `map-markers-old/bunker` | 10 x 10 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `map-markers-old/client` | 8 x 8 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `map-markers-old/hq` | 12 x 12 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `crisis-overlays/uneasy` | 8 x 8 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `crisis-overlays/edge` | 8 x 8 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `crisis-overlays/tipping` | 8 x 8 px, 2 frames | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `crisis-overlays/selected` | 8 x 8 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `map-markers/city` | 9 x 10 px | `src/art/map-markers.js` | #102 / #102 | R42 (proposed: map markers and icons at 64) |
| [ ] | `map-markers/client` | 8 x 9 px | `src/art/map-markers.js` | #102 / #102 | R42 (proposed: map markers and icons at 64) |
| [ ] | `map-markers/bunker` | 10 x 11 px | `src/art/map-markers.js` | #102 / #102 | R42 (proposed: map markers and icons at 64) |
| [ ] | `map-markers/site` | 9 x 11 px | `src/art/map-markers.js` | #102 / #102 | R42 (proposed: map markers and icons at 64) |
| [ ] | `map-markers/hq` | 12 x 12 px | `src/art/map-markers.js` | #102 / #102 | R42 (proposed: map markers and icons at 64) |

## icons

| | Asset | Current spec | Source | Made by / last changed | Picked up by |
|---|---|---|---|---|---|
| [ ] | `crisis-icons/pandemic` | 10 x 10 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `crisis-icons/fire` | 10 x 10 px, 2 frames | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `crisis-icons/radiation` | 10 x 10 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `crisis-icons/unrest` | 10 x 10 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `crisis-icons/flood` | 10 x 10 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `crisis-icons/crash` | 10 x 10 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `crisis-icons/blackout` | 10 x 10 px | `src/art/sprites-map.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-icons/cash` | 12 x 12 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-icons/quarter` | 12 x 12 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-icons/heat` | 12 x 12 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-icons/tension` | 12 x 12 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-icons/board` | 12 x 12 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-icons/research` | 12 x 12 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-icons/crew` | 12 x 12 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-icons/lock` | 12 x 12 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-icons/alarm` | 12 x 12 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-icons/midnight` | 12 x 12 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-icons/map` | 12 x 12 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-icons/shelter` | 12 x 12 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |

## UI

| | Asset | Current spec | Source | Made by / last changed | Picked up by |
|---|---|---|---|---|---|
| [ ] | `ui-frames/panel` | 24 x 24 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-frames/paper` | 24 x 24 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-frames/button` | 16 x 16 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-frames/buttonPressed` | 16 x 16 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-frames/buttonActive` | 16 x 16 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-frames/meter` | 12 x 8 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui-frames/tooltip` | 12 x 12 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `ui/logo` | 48 x 16 px | `src/art/sprites-ui.js` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `font/glyph` | 3 x 5 px (bitmap font, 3x5 per glyph) | `src/art/font.js` | #9 / #9 | #116 (placeholder tileset rebuild) |

## characters

| | Asset | Current spec | Source | Made by / last changed | Picked up by |
|---|---|---|---|---|---|
| [ ] | `bunker-residents/resident` | 10 x 16 px (per pose) | `src/shelter/bunker-sprites.js` | #84 / #84 | R41 (proposed: bunker furniture and residents at 64) |

## exported file

| | Asset | Current spec | Source | Made by / last changed | Picked up by |
|---|---|---|---|---|---|
| [ ] | `assets/art/crisis-icons.png` | 21 x 76 px (sprite sheet; each frame is listed with its sprite) | `assets/art/crisis-icons.png` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `assets/art/crisis-overlays.png` | 17 x 35 px (sprite sheet; each frame is listed with its sprite) | `assets/art/crisis-overlays.png` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `assets/art/map-markers/bunker.png` | 11 x 12 px | `assets/art/map-markers/bunker.png` | #102 / #102 | #116 (placeholder tileset rebuild) |
| [ ] | `assets/art/map-markers/city.png` | 10 x 11 px | `assets/art/map-markers/city.png` | #102 / #102 | #116 (placeholder tileset rebuild) |
| [ ] | `assets/art/map-markers/client.png` | 9 x 10 px | `assets/art/map-markers/client.png` | #102 / #102 | #116 (placeholder tileset rebuild) |
| [ ] | `assets/art/map-markers/hq.png` | 13 x 13 px | `assets/art/map-markers/hq.png` | #102 / #102 | #116 (placeholder tileset rebuild) |
| [ ] | `assets/art/map-markers/site.png` | 10 x 12 px | `assets/art/map-markers/site.png` | #102 / #102 | #116 (placeholder tileset rebuild) |
| [ ] | `assets/art/map-markers.png` | 12 x 38 px (sprite sheet; each frame is listed with its sprite) | `assets/art/map-markers.png` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `assets/art/map-tiles.png` | 17 x 71 px (sprite sheet; each frame is listed with its sprite) | `assets/art/map-tiles.png` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `assets/art/shelter-amenities.png` | 33 x 186 px (sprite sheet; each frame is listed with its sprite) | `assets/art/shelter-amenities.png` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `assets/art/shelter-tiles.png` | 16 x 101 px (sprite sheet; each frame is listed with its sprite) | `assets/art/shelter-tiles.png` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `assets/art/ui-frames.png` | 24 x 174 px (sprite sheet; each frame is listed with its sprite) | `assets/art/ui-frames.png` | #9 / #9 | #116 (placeholder tileset rebuild) |
| [ ] | `assets/art/ui-icons.png` | 48 x 254 px (sprite sheet; each frame is listed with its sprite) | `assets/art/ui-icons.png` | #9 / #9 | #116 (placeholder tileset rebuild) |

## Passing

- `map-base/world`: 320 x 192 px
- `map-regions/state-layer`: 320 x 192 px
- `map-heat/heat-layer`: 320 x 192 px
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

Note: the map base passes as one 320 x 192 image, but its terrain still follows an 8 px cell layout; if #113 decides the minimum applies to map cells too, the map base and its overlays fail as well.
