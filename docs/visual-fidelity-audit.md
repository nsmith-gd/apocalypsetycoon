# Visual fidelity audit, v2 (#160): the game is all interface

Director review of v1 (#125): *"Still so ugly, nobody wants purely UI based games."*

v1 (kept below) ranked interface problems: fonts, frames, spacing. That was the wrong lens. The complaint is that the
game **is** interface: the player spends the session reading panels, not watching a world. v2 measures that and
re-ranks every item by one question: **does it put the world on screen, alive, or does it add more interface?**

Re-capture: serve the repo on port 8123, then `node tools/world-share-capture.cjs` (writes the screenshots and
`world-share.json` to `.ballast/media/t160/`).

## Measured: how much of each screen is world (1440x900)

"World" = the pixel-art scene (shelter cutaway, world map, Midnight scene), minus any panel floating over it.
The director's references are 85-100% world, with a few small lit signs as the interface.

| Screen | World | Text on screen | Buttons | Capture |
|---|---|---|---|---|
| Shelter (where you build) | **18%** | 2,990 characters | 111 | `02-shelter.png` |
| World map | 43% | 1,461 characters | 24 | `03-map.png` |
| A breach | 18% | 4,027 characters | 117 | `04-breach.png` |
| Seal order (Midnight) | 18% | 3,348 characters | 112 | `05-seal-order.png` |
| Midnight ending | 27% | 3,996 characters | 112 | `06-midnight.png` |
| Shelter, world-first mock | 42% | 391 characters | 26 | `02b-shelter-world-first-mock.png` |
| Map, world-first mock | 43%+ (map wider, panel floats) | 1,297 characters | 21 | `03b-map-world-first-mock.png` |

The shelter, the screen the player builds on for five hours, is under a fifth world and about 3,000 characters
of text. Even with every panel hidden (the mock), what's left is **an empty brown rectangle**. At the start of a
campaign there is no surface, no estate, no crew, no people and nothing moving. Removing interface doesn't fix that,
because there's nothing behind it. That's the #1 finding.

## Ranked: world first

Tags: **covered by #N** = an existing task owns it; **new gameplay task** = proposed below (W1-W10).

| # | What the player sees now | What it should be | Tag |
|---|---|---|---|
| 1 | The shelter opens on blank dirt in a narrow strip between two columns of text. Nothing happens until you place things. | A lived-in cutaway that fills the screen. The surface shows the client's estate, sky and weather, and a crew truck. A starter shaft is already dug, the crew is visibly digging, lit rooms glow under the ground, and the panels are collapsed to the edges. | **new gameplay task W1** (shelter scene: surface, starter shaft, framing at 2-3x); rooms covered by #117/#118/#120 |
| 2 | Nobody is visible. Crews are a number ("2 crews"), clients are names in a list. | People in the world: the dig crew with picks and barrows on the job tiles, and clients touring their bunker. Residents already exist at 64 px (#122) but only appear after hand-over. | **new gameplay task W2** (crews on the grid); residents covered by #122, R41 |
| 3 | Building is silent bookkeeping: a progress bar fills on a tile. | Building you can watch: dirt falls, rubble piles, concrete is poured, sparks fly, and the room lights up on completion. | stage art covered by R40 (strata and stage tiles at 64, in progress); motion is **new gameplay task W3** (build animation and completion beat) |
| 4 | The map is a static picture; crises are numbers in a side panel. | Crises happen on the map: storm cells over the Superstorm's regions, smoke and fires where the Pitchforks riot, spore haze for the Bloom, sirens over Atomic hotspots. Cities glow at night, planes and ships move. | crisis tints covered by #124; **new gameplay task W4** (crisis events drawn on the map) and **W5** (map life: city lights, traffic) |
| 5 | Big moments are text boxes. A breach is a red-bordered form with 117 buttons on screen; the Midnight strike is digits on black. | The moment is shown in the world: the map zooms to the breached region as it turns red and the alarm sounds. At Midnight the camera pulls back from the shelter as the sky goes white, and the doors seal on the residents. | **new gameplay task W6** (breach moment in-world), **W7** (Midnight sequence in-world); lighting covered by #130 |
| 6 | Every decision is a panel of text and buttons: build list, schemes, threats, events, R&D. | Act on the world: click a region to see a small sign floating over it, click a room to see its card next to it. Lists become tooltips and pop-outs, not permanent columns. | **new gameplay task W8** (contextual pop-outs replace standing panels: build palette as a tool tray, region card over the map) |
| 7 | The HUD is two rows across the full width (eight readouts plus the clock). | Cash and the Doom Clock always visible; heat, tension and the rest appear when they change or on hover. | **new gameplay task W9** (HUD down to cash + clock + alerts) |
| 8 | Lighting is flat: the dirt and map are evenly lit, with no day/night and no lamp light in rooms. | Light tells the story: lamps in finished rooms, darkness in the dig, the world dimming and reddening as Midnight nears. | covered by #130 (lighting and atmosphere, in progress) |
| 9 | Events and dialogue are text lists ("3 guests worth meeting"). | The venue is a scene with the guests standing in it; you click a person to talk. | **new gameplay task W10** (event venue scene with guests, using #122's 64 px people) |
| 10 | The ending is a table of grades. | Each shelter's cutaway photo (Client Gaze, #121) with its fate stamped on it. | covered by #32 (endings, in progress) + #121; v1 item G6 |
| 11 | Interface styling (fonts, frames, buttons). | Done: thin lit glass instead of brown boxes. | covered by #159 |

## Proposed new gameplay tasks

| ID | Title | Done when | Screens |
|---|---|---|---|
| W1 | Shelter scene: surface estate, starter shaft, world-first framing | A new campaign opens on a full-width cutaway at 2-3x: the client's estate and sky on the surface and a starter shaft with lit entrance; panels collapsed; the world is over 60% of the screen (`tools/world-share-capture.cjs`) | 02 |
| W2 | Dig crews on the grid | Each crew is a 64 px worker walking to and working its job tile (pick, barrow, welder), visible at the editor scale | 02 |
| W3 | Watchable construction | Dig, pour and fit-out animate (dirt falling, concrete rising, sparks), and a finished room lights up with a sound beat | 02 |
| W4 | Crisis events drawn on the map | Each track has an on-map effect in its hot regions (storm, smoke, spore haze, alarm rings, fields going grey) scaling with tension | 03 |
| W5 | Map life | City lights on the night side, a moving terminator, planes and ships on routes; quiet, under 10% of map pixels changing per second | 03 |
| W6 | Breach in the world | The map zooms to the region, which flashes red with an alarm; the containment card is small and docked, not a full-screen form | 04 |
| W7 | Midnight in the world | Midnight plays as a sequence over the shelter and map (the sky flares, the doors seal on the residents), then the ending | 05, 06 |
| W8 | Pop-outs instead of standing panels | The build list, room inspector, region card and schemes open next to what you clicked and close after; nothing permanently covers the world except the HUD | 02, 03 |
| W9 | HUD down to cash, clock and alerts | Only cash and the Doom Clock show by default; other readouts slide in when they change or on hover | all |
| W10 | Event venues as scenes | Events show the venue with the guests standing in it, and you click a person to talk | events |

**Order:** W1 and W8 first: they turn the main screen from 18% world into a scene. Then W2 and W3 (life in
the shelter), W4 and W6 (crises you can see), W9, W5, W7 and W10.

---

# v1 (#125), kept for reference


Director note D5: *"The whole game just looks so ugly and low fidelity."*

I played the build at 1440x900 (title, new campaign, shelter, world map with live crises, every overlay, an event and
dialogue, a weekly card, a breach, the Midnight strike, the seal order and the ending) and captured each screen into
`.ballast/media/t125/`. Below is what reads as ugly or low fidelity, ranked by **player impact**: how much of a
session the player spends looking at it, multiplied by how badly it hurts.

Every item has one tag:

- **covered by #N**: an existing art task (#20–#49, #110–#124) or the UI theme pass (#126) already fixes it. Don't
  duplicate it.
- **new gameplay task**: nobody owns it yet. Proposed tickets are listed at the end (G1–G12).

Re-capture: serve the repo on port 8123 (`python3 -m http.server 8123`), then `node tools/fidelity-audit-capture.cjs`.

## The short version

The art (map, rooms, residents) is being rebuilt at 64 px by #110–#124. What makes the game *look cheap* even after
that lands is everything *around* the art: the whole interface is one system monospace font at one small size, every
panel is the same flat brown box with a 1 px border, there is no motion or light, and moments that should land
(breach, Midnight, a sale) are plain text boxes. That is the gap below.

## Ranked list

| # | Where | What looks ugly / low fidelity | Tag |
|---|-------|-------------------------------|-----|
| 1 | Everywhere (02, 04, 06, 07, 12) | **Body text is the browser's Courier New at 10–12 px**, not a pixel font. It's anti-aliased, blurry next to crisp pixel art, and too small to read; every panel is a wall of it. | covered by #126 (pixel font at integer scale) |
| 2 | Everywhere | **Every panel and button is the same flat brown box with a 1 px tan border.** HUD tiles, build list, map side panel, cards and modals are indistinguishable; nothing has depth, bevel or a frame. | covered by #126 (9-slice panel/button frames) |
| 3 | HUD (02) | **Top bar is eight equal stat boxes plus a clock box**; heat/tension/board bars are 1 px tall empty troughs, numbers are tiny, money doesn't look like money. The most-watched part of the screen has the least hierarchy. | covered by #126 (semantic colours) for colours; layout/hierarchy is **new gameplay task G1** |
| 4 | Shelter (02) | **The shelter view is a narrow 384 px strip between two dense side columns**; most of the screen is text, the actual game (dig site) is small and mostly flat brown dirt with a purple sky band. | **new gameplay task G2** (shelter layout: give the dig site the centre); dirt/strata tiles covered by #117 / R32 |
| 5 | Shelter (02) | Build menu: 30 near-identical rows with a 10 px colour square as the only icon; locked items are grey-on-brown and unreadable. | icons covered by #116/#119 (placeholder tiles → fixtures at 64); row styling covered by #126 |
| 6 | World map (04) | Right-hand map panel: 6 track bars with tiny hatched "tips 82–94?" zones, red/yellow FUND buttons, scheme text at 10 px and a long scroll. Reads as a spreadsheet. | covered by #126 (theme) for frames/colours; **new gameplay task G3** (group, collapse and give the track rows icons; ties to R30 scheme icons) |
| 7 | Breach (15) | **A world-ending breach is a red-bordered text box** with five plain option tiles. No screen shake, no flash, no siren, no art of the crisis. Three "crisis profits" toasts stack on top of it. | crisis art covered by #47/#124; the moment (shake, flash, staging) and toast stacking are **new gameplay task G4** |
| 8 | Midnight strike (16) | The climax is **11:59 in grey Courier on pure black** with three yellow tick marks. | Doom Clock face covered by R28 (proposed under #46/#123); the staging (zoom from HUD clock, light, sound sync) is **new gameplay task G5** |
| 9 | Ending (18) | The ending skyline is good, but below it is a plain HTML table and four stat boxes; grades are plain letters; the strike-through "LOST" shelter is just CSS line-through. | **new gameplay task G6** (ending report card: per-shelter cards with the shelter photo from #121, stamped grades) |
| 10 | Modals (06, 07, 10, 11, 12) | **Every overlay is a centred box over a 70% black dim**; no open/close transition, no title art, list rows are separated by 1 px lines. R&D (07) is a 5-column wall of 10 px text with blue link-coloured "build X" lists. | frames covered by #126; **new gameplay task G7** (modal open/close motion; R&D as a tree with icons) |
| 11 | Events / dialogue (10, 11, 12) | Events and guests have **no faces or venue art**: a guest is a name in a box; the dialogue is three text buttons. The game's best writing has no picture next to it. | portrait art not covered by any art task → **new gameplay task G8** (guest portrait frame + venue header, using resident 64 px looks from #122 as a stopgap) |
| 12 | Map (03, 04) | Region name plates are a different (pixel) font from the rest of the UI; legend under the map is 10 px. | plates covered by #123 / R27; legend covered by #126 |
| 13 | Weekly card (13) | The newspaper card (serif, cream) is the best-looking UI in the game but clashes with everything else: different font family, different palette, no frame shared with the theme. | card frame covered by R31 (proposed); the theme hook is covered by #126 |
| 14 | Feedback | **No feedback when money moves**: a sale, a scheme funding or a weekly choice changes a number silently. No count-up, no floating "+$4.85M", no colour flash on the HUD tile. | **new gameplay task G9** (number tween + float-up + tile pulse) |
| 15 | Lighting | Nothing is lit: the shelter has no lamp light, the map has no day/night or crisis glow beyond overlays, the HUD doesn't change as Midnight nears. | room/map light covered by #117/#123; **HUD mood shift toward Midnight (vignette, red tint, clock pulse) is new gameplay task G10** |
| 16 | Title (01) | Title screen: flat rectangles for a skyline, scattered single-pixel stars, a tan box for a bunker, system font buttons stacked with uneven gaps; "System demos" is a bare underlined link. | skyline/bunker art: **new gameplay task G11** (title scene reusing the ending skyline renderer + #122 door); buttons covered by #126 |
| 17 | Seal order (16–17) | Seal order is a purple-bordered table: purple appears nowhere else in the palette. | covered by #126 (one palette) |
| 18 | Bottom bar (02) | Time strip is 12 empty grey boxes; speed buttons and six text buttons in a row with no grouping. | covered by #126 for buttons; strip as quarter pips is **new gameplay task G12** |
| 19 | Clients panel (02) | Top-right clients panel is empty most of the game and floats unaligned with the columns below it. | covered by G2 (shelter layout) |
| 20 | Quarter report | Couldn't trigger it in the capture window (needs a full quarter at x4). From code it uses the same `.report-overlay` box as 06/07, so items 2 and 10 apply. | covered by #126 + G7 |

Screens: `01-title`, `02-shelter-grid`, `03-world-map`, `04-world-map-crises-schemes`, `05-scheme-panel-scrolled`,
`06-threats-panel`, `07-research`, `08-ledger`, `09-settings`, `10-events`, `11-event-guests`, `12-dialogue`,
`13-weekly-card`, `15-breach-card`, `16-midnight-strike`, `17-seal-order`, `18-midnight-ending` (all `.png` in
`.ballast/media/t125/`).

## Already covered (so nobody redoes them)

- Map base, coastline, terrain: #110, #112, #136, #138. Regions/borders/heat at 64: #123. Crisis states: #124, #111, #134.
- Room tiles #117 (from #40), luxury amenities #118 (#41), room styles #120 (#43), fixtures #119, placeholder tiles #116.
- Client Gaze / photo mode #121 (#44). Doors, residents, Days Sealed #122 (#45).
- 64 px rule and checks: #113, #114, #115. Style guide: #39 / #24.
- UI font, panels, buttons, spacing, semantic colours: #126 (this batch).

## Proposed new gameplay tasks

| ID | Title | Screens | Impact |
|----|-------|---------|--------|
| G1 | HUD hierarchy: cash and Doom Clock big, heat/tension as thick bars, secondary stats collapsed | 02 | High: on screen 100% of the time |
| G2 | Shelter layout: dig site takes the centre at integer scale; side panels narrower and collapsible | 02 | High: the main screen |
| G3 | Map side panel: track rows with icons, collapsed schemes list, less scrolling | 04, 05 | High |
| G4 | Breach moment: flash, shake, siren, crisis art header; toasts queue behind modals | 15 | Medium-high: happens several times a run |
| G5 | Midnight staging: HUD clock zooms to full screen, tick sound sync, lit clock face | 16 | Medium-high: the climax |
| G6 | Ending report card: shelter photo cards and stamped grades instead of a table | 18 | Medium |
| G7 | Modal motion (slide/scale in, 150 ms) and R&D as an icon tree | 06, 07, 10 | Medium |
| G8 | Guest portraits and venue headers for events and dialogue | 10–12 | Medium |
| G9 | Money feedback: tweened numbers, floating deltas, HUD tile pulse | all | Medium: small but constant |
| G10 | Mood shift toward Midnight: vignette and red tint grow as the clock nears zero | all | Medium |
| G11 | Title scene: pixel skyline, bunker door, falling ash, themed buttons | 01 | Low-medium: first impression |
| G12 | Quarter pips in the bottom bar; group speed and menu buttons | 02 | Low |
