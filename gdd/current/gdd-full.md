# Apocalypse Tycoon

Game Design Document

Nathaniel

November 23, 2026

# Overview

Apocalypse Tycoon is a pixel-art management sim about building luxury doomsday shelters for the ultra-wealthy while quietly stoking the crises that sell them. One continuous campaign runs 5 to 6.5 hours across 12 in-game quarters and ends at Midnight: the apocalypse you either engineer on your terms or fail to contain.

**Pitch:** You don’t survive the apocalypse. You sell it.

## Player fantasy

You found Last Resort Holdings, a shelter builder with one shovel crew and a board that expects growth every quarter. Calm worlds don’t buy bunkers, so you learn to make the world a little less calm. The whole game asks one question: how close to the edge do you dare run it?

## Design pillars

1. **Profit lives at the edge.** Crises fund your research and inflate your prices, and the richest zone sits just below each tipping point.
2. **Two canvases, one ledger.** The shelter grid is what you build and the world map is what you sell. Every scheme changes demand, and every sale needs more crisis.
3. **Build what they want, grade what they need.** Clients pay for gold taps and cryo pods. Midnight grades air, water and food.
4. **Nothing is free.** Heat, runaway tension, client leverage and the board push back on every move, so power always feels precarious.

## At a glance

| Element | Spec |
|---|---|
| Genre | Management sim, dark corporate satire |
| Structure | One persistent campaign: 12 quarters in 5 chapters, then optional Overtime |
| Length | 5 to 6.5 hours to Midnight at mixed game speed |
| Shelter canvas | Side-view pixel cutaway, 1 tile = 1 m, five depth strata |
| World canvas | Situation-room map, 8 regions, 6 of 10 threat tracks per campaign, weekly event deck |
| Threat tracks | 10 in total, 6 per campaign: the Classic six (Atomic Standoff, The Bloom, Superstorm Season, The Optimizer, The Hush, The Pitchforks) plus four alternates (The Grey Goo, The Long Shade, The Kessler Rain, The Cloud Strike) |
| Clients | 5 wealth classes, 16 hero clients plus generated clients |
| Content | 73 rooms and fixtures, 37 schemes, 48 unlocks, 340 event cards, 12 endings |
| Art | 16 px pixel art on a strict grid, colour-coded by needs tier |
| Platform | PC (Steam) first, Steam Deck target (to confirm) |

## A campaign, not runs

The company, its sites and the world persist for the whole campaign. Depth comes from more threat tracks, deeper strata, richer clients and a Doom Clock whose floor only moves forward. If you reach the end of quarter 12 without Midnight, the board offers Overtime: endless quarters with escalating quotas until Midnight or your ouster.

## Tone

Dark satire aimed at excess, never at victims. People, companies and threats are fictional with real echoes, so the game ages well and stays playful. Violence is cartoony, deaths happen off-screen as epilogue lines, and the joke lands on the clients, the board, the system and you, their accomplice.

## Audience and positioning

The core audience is Bartle Planners and Scientists who love optimizing a system at its edge. The differentiators are Politician play (schemes, the board, client leverage) and a sanctioned home for the implicit Griefer. On Quantic Foundry’s model it targets Strategy, Design, Story and Power, plus a dose of Destruction at Midnight.

| Game | What we share | Where we differ |
|---|---|---|
| Plague Inc. | Ending the world is the fantasy | We profit from the edge and try to stop short of the end |
| Evil Genius 2 | Villain base, world schemes, heat | We serve clients whose vanity fights their survival |
| Fallout Shelter | Vertical bunker cutaway | We sell shelters, we don’t live in them |
| Two Point games | Comic management tone | Systemic world tension is our spine |
| Home Sweet Bunker: Bunker Tycoon (Nov 2026) | Dark-comic dig-down bunker | It is survivor-side defense; we are the cause |

## Sections in this document

- **Core loop:** the three time scales, the edge loop, the crisis dividend and the hold decision.
- **Shelter canvas:** the pixel grid, strata, product lines, the full room catalog, life systems, build rules and the design layer.
- **World canvas:** the 8 regions, the six Classic tracks and four alternates, all schemes, the event deck and the rivals.
- **Crises and tipping points:** crisis states, the hidden tipping point, breach and containment, recovery, collapse, the domino map and the Doom Clock.
- **Clients and the upside-down needs ladder:** the ladder, the two scores, wealth classes, client traits, the lifecycle and a sample contract.
- **The company and the board:** company tiers, departments, staff, money, the five-seat board, quarterly meetings and votes.
- **Pushback systems:** heat and journalists, runaway tension, client leverage, reputation and sieges, the board, how they interlock, and difficulty settings.
- **Research, unlocks and fan-outs:** research rules, the five branches, the full 48-unlock schedule with timing targets, and worked fan-out chains.
- **Pacing:** the five chapters, chapter targets, signature moments, cadence rules and moment-to-moment targets.
- **Characters:** the Founder, executives, the board, journalists, rivals, 16 hero clients and the story arcs.
- **Midnight and endings:** engineered and uncontrolled Midnight, the seal order, required sealed durations, grades, the twelve endings and epilogue cards.
- **Economy and tuning:** time, currencies, the quota, pricing, costs, RP income, tuning constants, balance targets and telemetry.
- **Art, audio and UI:** the pixel spec, tier colour language, the world canvas look, UI layout, accessibility, audio and writing voice.
- **Production plan:** the 13-week plan, content counts, the cut list, risks and open questions.
- **Systems review:** how the systems fit together, fourteen findings and their fixes.

# Core loop

Every lap sells shelters and buys research by pushing the world toward the edge, then pays you to pull it back just enough. Fear fades within weeks; danger accumulates for the whole campaign.

## Three time scales

| Loop | Real time at 1× | What the player does | What it feeds |
|---|---|---|---|
| Moment | Seconds | Dig tiles, place rooms, route utilities, approve schemes, answer headlines | The shelter grid and next week’s tension |
| Week | 2 minutes | Watch crews progress, tension drift and grants pay out; resolve one headline card | Cash, RP, demand, heat |
| Quarter | 26 minutes (13 weeks) | Board meeting, quota, directives, new unlocks, a contract wave | Board confidence, chapter progress |
| Campaign | 5 to 6.5 hours | Open new tracks, dig deeper strata, court richer clients, hold off Midnight | The Doom Clock floor and the ending |

## The edge loop

The edge loop: 6 steps, 1 decision

The quota makes calm unaffordable and fear fatigue makes every sale temporary, so the loop runs itself. The only way off it is the breach branch, and breach weeks pay double.

## Fear versus danger

- **Fear is temporary.** Each track has a Fear meter that rises only when its tension rises and decays 15% a week. Fear sets how many leads arrive; the band sets what they pay. Stoking sells shelters; holding pays research. A saturated client pool needs a new or bigger fear.
- **Tension is manageable.** Each track’s tension rises with schemes and falls with calming spend, and it drifts on its own by band.
- **Danger is permanent.** The Doom Clock has a floor that only moves forward: first Brink entries, breaches and collapses all ratchet it.

### The Fear meter

Fear is the public’s reaction to change, not to level, and it is what brings clients through the door.

- **Range:** 0 to 100 per track, shown as a second needle on each track gauge.
- **Gain:** each week, Fear rises by 2 for every point of tension the track gained. Falling tension adds nothing.
- **Panic:** every breach week adds 10 Fear on top.
- **Decay:** 15% a week, always.
- **Effect:** Fear sets lead volume through the demand rule in the World canvas section; the band still sets price.
A track held flat at Brink keeps paying grants and premiums, but its Fear drains in about a quarter, and its leads go with it. That is why the quota keeps pushing you to stoke something new.

## The crisis dividend

Crises pay three ways: research grants in RP, a panic premium on contract prices, and government contracts at the top bands. The richest band is Brink, where tension also climbs on its own.

| Band | Tension | Grants (RP per week) | Panic premium | Natural drift per week | Scheme heat |
|---|---|---|---|---|---|
| Calm | 0–19 | 0 | +0% | −1.0 | ×1.0 |
| Simmer | 20–44 | 2 | +10% | 0 | ×1.0 |
| Boil | 45–69 | 6 | +25% | +0.5 | ×1.1 |
| Brink | 70 to the tipping point | 15 | +50% | +1.5 | ×1.25 |
| Breach | At or above the tipping point | 0 (diverted to containment) | +100% | Locked | ×1.5 |

Grants are paid per track and stack, so two tracks at Brink pay 30 RP a week. Government shelter contracts (high volume, low prestige, heat −1 each) appear in any region where a track is at Brink.

Brink is never free. Every track at Brink adds 1 heat a week from public scrutiny and rolls its own volatility each week, up to ±3 tension at Startup and ±6 at The Last Resort. Calming schemes aimed at the same track lose 25% of their effect for each use within 8 weeks.

## The hold decision

At Brink, every week asks the same question: hold, push or cash out.

- **Hold:** spend on calming schemes to cancel the +1.5 weekly drift and keep the dividend flowing, while Fear and its leads drain away.
- **Push:** ride toward the tipping point for a bigger premium, without knowing exactly where it sits.
- **Cash out:** calm the track back to Boil and bank the contracts you sold at Brink prices.

## A typical quarter

1. The board meeting sets the quota and two directives (week 1).
2. You read the world map for demand: which tracks are hot and whose clients are panicking.
3. You pick one or two tracks to heat and fire schemes at them.
4. Leads arrive where Fear runs high, and you sign contracts priced with the panic premium.
5. Crews dig and fit out shelters; walkthroughs trigger change orders.
6. Grants fund research, and new rooms and schemes unlock.
7. Heat, leverage and drift build, and you spend to hold tracks below their tipping points.
8. Fear fades and demand sags just as the next meeting raises the quota.

## Session controls

Pause, 1×, 2× and 4× speed. The game auto-pauses on a breach, a client walkthrough, a story beat and a board meeting. A quarter is the natural session length, and every meeting ends on a new directive and a cliffhanger headline, so there is never a clean stop.

# Shelter canvas

Shelters are side-view pixel cutaways on a 1-metre grid: you dig down through five strata, snap rooms to the grid, and route air, water and power through a central spine. Every room is colour-coded by its needs tier, so the gap between what the client paid for and what will keep them alive is visible at a glance.

## Grid spec

| Element | Spec |
|---|---|
| Tile | 16 × 16 px = 1 m × 1 m |
| Floor pitch | 4 tiles: a 3-tile room interior plus a 1-tile slab |
| Room sizes | Small 3–4 wide, medium 6 wide, large 8 wide, grand 12–16 wide; double-height rooms take 7 tiles |
| Plot width | 16 tiles (Solo Pod) to 64 tiles (Ark) |
| Display | Integer scaling only: 2×, 3× or 4× |
| Layers | Rock, structure, rooms, utilities overlay, decor, occupants |

Family Vault cutaway: 4 floors on a 24-tile plot

Most of what a client tours sits in the top two floors. The scrubbers, tanks and generator that decide Midnight sit near or below the water table, where few clients ever look.

## Strata

| Stratum | Depth | Dig cost per tile | Crew speed (tiles per day) | Base blast rating | Unlocks at | Features |
|---|---|---|---|---|---|---|
| Topsoil | 0–10 m | $10k | 6 | 1 | Start | Cheap, but surface noise and visibility leak through |
| Clay | 10–25 m | $25k | 4 | 2 | 0:20 | Water table at 12 m needs sump pumps; a constant 12 °C suits wine |
| Bedrock | 25–60 m | $80k | 2 | 3 | 2:05 | No seepage; geothermal heat from 50 m |
| Deep Rock | 60–120 m | $200k | 1 | 4 | 3:40 | Aquifer at 80 m; reactor siting; pressure events |
| The Abyss | 120 m and below | $500k | 0.5 | 5 | 4:50 | Ark-scale caverns; heat and tremor events |

A room’s blast rating is its stratum’s base plus the best blast door between it and the surface (Mk I +1, Mk II +2, Mk III +3), capped at 5. Unlock times are real-time targets from the campaign start.

## Product lines

| Product | Occupants | Plot | Typical price | Unlocks at | Notes |
|---|---|---|---|---|---|
| Solo Pod | 2–4 | 16 wide, up to 3 floors | $3–5M | Start | The tutorial product |
| Family Vault | 4–8 | 24 wide, up to 5 floors | $8–15M | 0:50 | Multiple bedrooms, first real status rooms |
| Condo Silo | 4–8 households | 16 wide, 8–12 floors | $5–9M per unit | 1:22 | Shared systems, shared gossip, client feuds |
| Compound | 20–80 | 3 linked bunkers and tunnels | $40–80M | 4:20 | Spreads risk across sites; tunnels can flood or be breached |
| Ark | 200–500 | 64 wide, to the Abyss | $500M+ from a consortium | 5:00 | The endgame megaproject for The Table |

## Room catalog

### Survive tier (hazard-yellow trim)

| Room | Tiles (w × h) | Unlocks at | Provides | Draws |
|---|---|---|---|---|
| Airlock | 3 × 3 | Start | Entry, seal +1 | — |
| Bunk Room | 4 × 3 | Start | Sleeps 4 | — |
| Pantry | 3 × 3 | Start | Stores 6,000 meals | — |
| Water Tank | 3 × 3 | Start | Stores 20,000 L | — |
| Diesel Generator | 3 × 3 | Start | 12 kW | 40 L fuel per day, noise 3 |
| Hand-crank Scrubber | 2 × 3 | Start | Air for 4 | Crank labour, morale −1 |
| Blast Door Mk I / II / III | 1 × 3 fixture | 0:06 / 2:05 / 3:40 | Blast +1 / +2 / +3 | — |
| Utility Spine | 2 wide, full height | 0:15 | Elevator and utility trunk; connects floors | 1 kW per floor |
| Sump Pump | 2 × 2 | 0:20 | Clears seepage below 12 m | 2 kW, noise 1 |
| Med Bay | 4 × 3 | 0:38 | Treats 2 at a time | 3 kW, a medic |
| Decon Shower | 2 × 3 | 0:55 | Seal +2 against spores | 1 kW, 50 L per use |
| HEPA Scrubber Bay | 3 × 3 | 0:55 | Air for 12, filtered | 4 kW |
| Battery Bank | 3 × 3 | 1:38 | Stores 200 kWh | — |
| Solar Mast | 2 × 4, surface | 1:38 | 8 kW by day | Raises surface visibility |
| Hydroponics Bay | 6 × 3 | 1:45 | 30 meals per day | 6 kW, 400 L per day |
| Flood Seals and Storm Shutters | Fixtures | 1:58 | Flood seal +2 | — |
| Faraday Room | 4 × 3 | 2:35 | Shields analog backups from The Optimizer | — |
| Geothermal Plant | 6 × 4, at 50 m or deeper | 2:45 | 80 kW | 2 engineers |
| Deep Water Recycler | 4 × 3 | 3:05 | Recycles 90% of water | 5 kW |
| Aquaponics Bay | 6 × 4 | 3:20 | 60 meals per day with protein | 8 kW, 300 L per day |
| Protein Vats | 4 × 3 | 3:20 | 100 meals per day, needs no pollinators | 10 kW |
| Seed Vault | 3 × 3 | 3:20 | Crops can restart after The Hush | 1 kW |
| Security Post | 3 × 3, surface | 3:30 | Security +2 | 2 guards |
| Decoy Entrance | 3 × 3, surface | 3:30 | Diverts sieges | — |
| Armory | 3 × 3 | 3:30 | Security +1, arms guards | Heat +1 per site |
| Aquifer Well | 2 × 6, at 80 m or deeper | 3:40 | Unlimited water | 4 kW |
| Micro-reactor | 6 × 6, at 60 m or deeper | 4:00 | 500 kW | Shielding, 2 specialists, regulator heat |

### Comfort tier (warm walnut trim)

| Room | Tiles (w × h) | Unlocks at | Provides | Draws |
|---|---|---|---|---|
| Galley Kitchen | 4 × 3 | Start | Morale +1 for all | 2 kW |
| Master Suite | 6 × 3 | 0:10 | Comfort +3 for the owner | 2 kW |
| Lounge | 6 × 3 | 0:10 | Comfort +2 shared | 1 kW |
| Window Wall (LED sky) | 4 × 3 | 0:32 | Comfort +2, fakes daylight | 3 kW |
| Laundry | 2 × 3 | 0:32 | Comfort +1 | 2 kW, 100 L per day |
| Gym | 4 × 3 | 1:10 | Comfort +2, health | 1 kW |
| Guest Quarters | 4 × 3 | 1:22 | Sleeps 2, comfort +1 | 1 kW |
| Library and Game Room | 4 × 3 | 1:30 | Morale +2 under seal | — |
| Therapy Pod | 2 × 3 | 2:25 | Prevents morale collapse | 1 kW, a counsellor |
| Atrium Garden | 6 × 7, double height | 3:20 | Comfort +3, 10 meals per day | 12 kW, 300 L per day |

### Status tier (gold and emerald trim)

| Room | Tiles (w × h) | Unlocks at | Prestige | Draws |
|---|---|---|---|---|
| Wine Cellar | 4 × 3 | 1:10 | 8 (+50% at 10 m or deeper) | — |
| Home Cinema | 6 × 3 | 1:10 | 10 | 4 kW |
| Biohacking Lab | 4 × 3 | 1:10 | 9 | 5 kW |
| Broadcast Studio | 4 × 3 | 1:10 | 7 | 3 kW, leaks the bunker’s location if misused |
| Panic Room | 3 × 3, touching the Master Suite | 1:30 | 6 | — |
| Chef’s Kitchen | 6 × 3 | 1:30 | 10 | 6 kW, a chef |
| Art Vault | 6 × 3 | 2:15 | 14 | 3 kW climate control or prestige decays 2% per week |
| Heir Nursery | 4 × 3 | 2:15 | 8 | 1 kW |
| Trophy Garage | 8 × 3, surface lift | 2:15 | 12 | Raises surface visibility |
| Helipad | 6 × 1, surface | 2:15 | 10 | Raises surface visibility; enables evacuation |
| Cigar Lounge | 4 × 3 | 2:25 | 7 | Air +10 m³ per hour |
| Spa and Sauna | 6 × 3 | 3:05 | 12 | 8 kW, 500 L per day |
| Infinity Pool | 8 × 4 | 3:05 | 18 | Holds 30,000 L, 400 L per day, needs the recycler |

### Delusion tier (iridescent violet trim)

| Room | Tiles (w × h) | Unlocks at | Prestige | Draws |
|---|---|---|---|---|
| Museum of Me | 8 × 4 | 2:15 | 16 | 4 kW |
| Personal Mausoleum | 6 × 3 | 2:25 | 9 | Nothing, and does nothing |
| Throne Room | 8 × 4 | 3:50 | 20 | 5 kW |
| Mansion Replica Floor | 16 × 7, double height | 3:50 | 30 | 25 kW, 800 L per day |
| Private Forest Dome | 12 × 7, double height | 3:50 | 26 | 30 kW lights, 600 L per day |
| Pet Clone Lab | 4 × 3 | 3:50 | 14 | 8 kW |
| Legacy Broadcast Array | 3 × 4 plus a surface antenna | 4:30 | 15 | 6 kW; its signal raises siege risk |
| Cryo Pod Bay | 6 × 3 | 4:38 | 24 | 40 kW, reactor-grade power |
| Genetic Library | 4 × 3 | 5:10 | 18 | 6 kW |

### Alternate-track rooms (hazard-yellow trim)

These Survive-tier counters exist only in worlds running their track. The first two unlock with their track and the third about ten minutes later. The Classic counter rooms still unlock in every world, so alternates add to the catalog rather than replace it.

| Room | Tiles (w × h) | Unlocks at | Provides | Draws |
|---|---|---|---|---|
| Ceramic Lining | Fixture | 0:55, Grey Goo worlds | Seal +2 against nanobots | — |
| EMP Pulse Room | 3 × 3 | 0:55, Grey Goo worlds | Clears goo from ducts and conduits | 6 kW; resets every smart device on the floor |
| Thermal Cladding | Fixture | 1:58, Long Shade worlds | Heat loss −40% | — |
| Boiler Room | 4 × 3 | 1:58, Long Shade worlds | 15 kW of heat | 30 L fuel per day, noise 2 |
| Debris Cap | Surface fixture over the spine | 2:35, Kessler worlds | Blast +1 against falling debris; hides the surface footprint | — |
| Radio Room | 3 × 3 | 2:35, Kessler worlds | Long-wave contact with your other sites; morale +2 under seal | 2 kW, an operator |
| Atmospheric Condenser | 3 × 3 | 3:20, Cloud Strike worlds | 2,000 L of water per day from the air | 8 kW, noise 1 |
| Water Vault | 6 × 3 | 3:20, Cloud Strike worlds | Stores 120,000 L | — |
| Kiln Workshop | 4 × 3 | 1:05, Grey Goo worlds | Fires ceramic linings on site, so lining retrofits cost 40% less | 12 kW, noise 2 |
| Fuel Depot | 3 × 3 | 2:08, Long Shade worlds | Stores 10,000 L of fuel for boilers and generators | Fire risk: never beside a bedroom |
| Convoy Bay | 8 × 3, with a surface ramp | 2:45, Kessler worlds | Ground evacuation without satellites; Seal Order pickups need no helicopter | The ramp raises surface visibility |
| Cloud Embassy | 4 × 3, surface | 3:30, Cloud Strike worlds | +10 containment points to every Collective Bargaining; reputation +1 a quarter | A diplomat; raises surface visibility |

Ark modules (Governance Hall and Schoolhouse, 5:00) are covered in the Ark rules: 73 rooms and fixtures in total, 12 of them only in alternate worlds.

## Life systems

Every shelter simulates eight systems. Their combined result is **Days Sealed**: how long the occupants would last with the doors shut today, shown on every shelter and compared with each contract’s requirement.

| System | Unit | Need per occupant | Sources | If it fails |
|---|---|---|---|---|
| Air | m³ per hour | 30 (luxury rooms add more) | Scrubbers, HEPA bays | CO₂ rises: morale falls, then occupants die |
| Water | L per day | 50 basic, 150 for a luxury lifestyle | Tanks, recycler, aquifer well | Rationing, morale loss, then deaths |
| Food | Meals per day | 3 | Pantry stock, hydroponics, aquaponics, protein vats | Rationing, then deaths when stock runs out |
| Power | kW | 1.5 plus room draws | Diesel, battery, solar, geothermal, reactor | Rooms shut down in the priority order you set |
| Seal | Rating 0–5 | The threat’s requirement | Airlocks, decon, HEPA, flood seals | Contamination events |
| Blast | Rating 0–5 | The threat’s requirement | Depth and blast doors | Structural events |
| Security | Rating 0–5 | Siege strength | Security posts, decoys, armory, concealment | Break-in events |
| Morale | 0–100 | Above 30 | Comfort rooms, status rooms for status-driven clients, therapy | Feuds, sabotage, mutiny under seal |

## Build rules

- **The spine rule.** Every floor must touch a Utility Spine or its rooms stay dark. A second spine (2:45) adds redundancy: a failed spine halves capacity instead of cutting floors off.
- **Utilities.** Air (blue), water (teal) and power (yellow) conduits auto-route along tile edges from the spine. Players can reroute them by hand to free a tile.
- **Noise.** Generators, pumps and reactors emit noise 1–4 within 6 tiles. Each noise point costs a neighbouring bedroom or status room 1 comfort or prestige.
- **Depth gates.** Wine cellar bonus at 10 m, geothermal at 50 m, reactor at 60 m, aquifer well at 80 m.
- **Adjacency.** The Panic Room must touch the Master Suite. Same-style neighbours add 10% prestige each, up to 30%. Hydroponics beside a Window Wall shares its grow light and saves 2 kW.
- **Surface footprint.** Helipads, masts, garages and antennas are visible from the street, which raises siege risk once The Pitchforks track opens.

## Construction flow

1. **Survey:** reveal the plot’s geology and water table (1 week).
2. **Dig:** crews clear tiles stratum by stratum.
3. **Shell:** pour slabs and walls, set the spine and doors.
4. **Fit-out:** place rooms, fixtures and decor.
5. **Pressure test:** a 30-day sealed simulation reports Days Sealed and failure points.
6. **Walkthrough:** the client tours the shelter and requests change orders.
7. **Handover:** the shelter goes on retainer, and upgrade requests begin.

## The design layer

Shelter building is also self-expression. Six styles re-skin every room’s tiles and props, and matching a client’s style multiplies prestige by 1.25 (a clash multiplies it by 0.8).

| Style | Look | Loved by |
|---|---|---|
| Brutalist | Raw concrete, stencils, sodium light | Paranoid and control-freak clients |
| Gilded | Marble, gold leaf, velvet | Dynasties and collectors |
| Biophilic | Living walls, timber, water features | Pet parents and doomer romantics |
| Tech-Minimal | White panels, hidden screens, LED strips | Disruptors |
| Retro-Atomic | 1960s civil-defence pastels and chrome | Gourmands and nervous millionaires |
| Maximalist Kitsch | Neon, leopard print, mirrored ceilings | Influencers and moguls |

- **Blueprints (0:45):** save any room cluster or whole floor and stamp it into other shelters. This is the main tool against late-game busywork.
- **The Showroom:** a model shelter at headquarters that prospects tour. Its prestige sets the quality of incoming leads, so players have a reason to build one beautiful bunker just to show off.
- **Decor props:** paintings, rugs, statues and plants that add small prestige and fill the pixel scene with life.
- **Photo mode:** hides the UI and frames the cutaway for screenshots.

## Overlays

Air, Water, Power, Noise, Seal, Blast, Prestige heatmap, Days Sealed and **Client Gaze**. Client Gaze highlights only what the current client will actually look at on a walkthrough, which is almost never the scrubbers.

# World canvas

The world is a situation-room map of 8 regions and 6 threat tracks: you read it for demand, push it with schemes, and hold each track below a tipping point you can only estimate. It is a board of cards and meters, not a geopolitical simulation, which keeps it readable and keeps scope in check.

## Regions

Regions are fictional, with real echoes, so no real nation is ever the punchline. Each one has its own geology for shelter sites, its own exposure to each track, and its own pool of clients.

| Region | Shelter geology | Track exposure | Client pool | Site cost |
|---|---|---|---|---|
| The Heartland (start) | Topsoil over clay, cheap digging | Hush high, Pitchforks medium | Nervous millionaires | Low |
| Coastal Megacities | Deep clay, high water table | Superstorm high, Bloom medium | Disruptors, dynasties | High |
| Tech Corridor | Clay | Optimizer high | Disruptors | High |
| Old Capitals | Shallow bedrock | Atomic high, Pitchforks high | Dynasties, moguls | High |
| Northern Reaches | Granite near the surface | Atomic medium | Dynasties | Medium |
| Equatorial Belt | Deep topsoil | Bloom high, Superstorm high | Nervous millionaires, moguls | Low |
| Island Havens | Volcanic rock; helipad required | Superstorm medium | Moguls, The Table | Very high |
| The Frontier | Desert clay over bedrock; scarce water | Low on every track | Nervous millionaires, moguls | Medium |

Clients fear what is hot where they live. A track’s panic premium applies in full in high-exposure regions, at half in medium ones and at a quarter elsewhere. Sites in high-exposure regions also take the worst damage if that track breaches.

### Demand

Leads arrive every week by region, so the world canvas feeds the shelter canvas through one rule:

The 0.5 applies only in regions where you own a site. F is each track’s Fear (Core loop section), e is its exposure in that region (1 high, 0.5 medium, 0.25 low) and R is referrals from Influencer clients. Sales adds one more lead a week per level, sent to your best region. Lead quality follows the Showroom’s prestige and your reputation: every 20 points of either above 40 moves one lead in five up a wealth class. Unworked leads wait 4 weeks, then go to a rival.

## Threat tracks

| Track | Premise | What it sells | Containment op | Opens at |
|---|---|---|---|---|
| Atomic Standoff | Two great powers rattle sabres over a fictional border | Depth, blast doors, sealed air | Back-channel Summit | 0:25 |
| The Bloom | A glittering fungal spore that makes people very sleepy, then very mouldy | Decon showers, HEPA bays, seals | Fungicide Airdrop | 0:55 |
| Superstorm Season | Weather that has stopped respecting forecasts | Flood seals, power independence, depth | Cloud-Seeding Armada | 1:58 |
| The Optimizer | A corporate AI that has concluded humanity is overhead | Faraday rooms, analog backups, the end of smart homes | Pull the Plug | 2:35 |
| The Hush | Pollinators fall silent and crops fail | Protein vats, aquaponics, seed vaults | Robo-Bee Swarm | 3:20 |
| The Pitchforks | The public notices the bunkers | Security, decoys, concealment; it besieges your sites directly | Bread and Circuses | 3:30 |

The Pitchforks is special. Every other track’s breaches spill into it, and it is the only track that attacks your shelters before Midnight.

## Alternate tracks

Every campaign runs six track slots, and four of them have an alternate apocalypse. The first campaign always uses the Classic six above; after that, players choose Classic, Random or Custom at the start, so a second campaign ends the world differently while the pacing stays the same. Slot 1 (Atomic Standoff) and slot 6 (The Pitchforks) never change.

| Track | Replaces | Opens at | Premise | What it sells | Containment op | Hot regions |
|---|---|---|---|---|---|---|
| The Grey Goo | The Bloom (slot 2) | 0:55 | Self-replicating nanobots from a luxury skincare line that eat everything except ceramic | Ceramic linings, EMP pulse rooms, sealed ducts | Firmware Recall | Tech Corridor high, Coastal Megacities medium |
| The Long Shade | Superstorm Season (slot 3) | 1:58 | A billionaire’s orbital sunshade, launched to fix the climate, jams in the “on” position | Thermal cladding, boiler rooms, grow lights, depth | Bridge Round: you fund the startup’s repair | Northern Reaches high, Heartland medium |
| The Kessler Rain | The Optimizer (slot 4) | 2:35 | Rival satellite constellations collide, and the debris keeps colliding | Debris caps, radio rooms, wired everything | Orbital Sweep | Equatorial Belt high, Old Capitals medium |
| The Cloud Strike | The Hush (slot 5) | 3:20 | The clouds stop raining and issue a list of demands | Atmospheric condensers, water vaults, recyclers, aquifer wells | Collective Bargaining: you negotiate with the sky | Heartland high, The Frontier high |

The Cloud Strike is the one threat that reaches The Frontier, the Classic world’s safe haven.

Each alternate inherits its slot’s place in the unlock schedule, its links on the domino map and its retrofit wave. Alternates add to a world rather than strip it: the Classic counter rooms still unlock on schedule as general research, so a Cloud Strike world still gets Protein Vats, and each alternate brings three counter rooms of its own (Shelter canvas section). In a Kessler world, for example, the Disruptors’ satellite-linked smart bunkers go dark at 2:35, exactly when The Optimizer would have hijacked them.

### Alternate schemes

| Scheme | Department | Effect | Cost | Heat | Unlocks at |
|---|---|---|---|---|---|
| Skincare Beta Test | Special Projects | +15 momentum on The Grey Goo | $3M | 8 | 1:15 |
| Sunshade Series B | Special Projects | +15 momentum on The Long Shade; your stake pays $2M back | $3M | 5 | 1:58 |
| Launch Party | Special Projects | +15 momentum on The Kessler Rain | $3M | 5 | 2:35 |
| Water Futures Fund | Special Projects | +15 momentum on The Cloud Strike; pays $3M back | $2M | 7 | 3:20 |

Debunk works on whichever slot-2 and slot-4 tracks are running. The four new escalation schemes and four new containment ops bring the game to 37 schemes.

### Overtime opens the rest

In Overtime, the four tracks your world didn’t use open one per quarter. A long enough game runs all ten at once, and because the Doom Clock sums every open track, Midnight comes fast.

## Reading the map

- **Track gauges:** tension 0–100, a momentum arrow, the current band and the estimated tipping-point band.
- **Hotspots:** regions pulse in a track’s colour where it runs hottest.
- **Demand ticker:** waiting leads per region, tagged with the fears that brought them in.
- **Sites:** your shelters, each showing Days Sealed against the threats exposed in its region.
- **Rival pins:** competitor sites and the schemes they are running, once Intel I is researched.

## Schemes

Schemes are the verbs of the world canvas. Each one costs cash, takes 1–4 weeks, adds or removes momentum, and generates heat multiplied by the target track’s band. Special Projects runs one scheme at a time at level 1 and up to five at level 5. Momentum decays by 25% a week, so a single scheme fades unless it is renewed.

### Escalate

| Scheme | Department | Effect | Cost | Heat | Unlocks at |
|---|---|---|---|---|---|
| Leak | Special Projects | +8 momentum on one track | $0.5M | 3 | 0:25 |
| Distraction | Special Projects | +6 momentum on a chosen track; stalls a journalist’s story 3 weeks | $1M | 4 | 1:00 |
| Doom Influencer Network | Special Projects | +12 momentum in one region’s hotspot | $1M | 5 | 1:15 |
| Think Tank Grant | Special Projects | +2 momentum per week for 8 weeks | $2M | 2 | 1:15 |
| Weather Mod Contract | Special Projects | +15 momentum on Superstorm Season | $3M | 6 | 1:58 |
| Arms Broker | Special Projects | +15 momentum on Atomic Standoff; pays $2M back | $1M | 8 | 2:10 |
| Lab Leak | Special Projects | +20 momentum on The Bloom | $4M | 12 | 2:15 |
| Feature Creep | Special Projects | +15 momentum on The Optimizer | $3M | 5 | 2:35 |
| Sabotage | Special Projects | +25 momentum on any track | $6M | 15 | 3:12 |
| Pesticide Partnership | Special Projects | +15 momentum on The Hush | $3M | 7 | 3:20 |
| Gentrify | Special Projects | +10 momentum on The Pitchforks; pays $3M in land | $2M | 6 | 3:30 |

### Calm

| Scheme | Department | Effect | Cost | Heat | Unlocks at |
|---|---|---|---|---|---|
| Everything Is Fine | Communications | −8 momentum on one track | $1M | −2 | 1:15 |
| Peace Summit Sponsorship | Communications | −15 momentum on Atomic Standoff | $5M | −3 | 2:10 |
| Philanthropy Gala | Communications | −5 momentum on every track; reputation +5 | $8M | −5 | 2:25 |
| Debunk | Communications | −10 momentum on The Bloom or The Optimizer | $2M | −1 | 2:35 |
| Firebreak | Special Projects | Halves one track’s spillover for 6 weeks | $6M | 3 | 4:10 |

### Influence and intel

| Scheme | Department | Effect | Cost | Heat | Unlocks at |
|---|---|---|---|---|---|
| Shelter Subsidy Lobby | Corporate | +30% demand in one region for 8 weeks, with no tension added | $3M | 2 | 1:30 |
| Brink Analysts (Intel I) | Special Projects | Tipping-point band narrows from ±10 to ±5; rival schemes shown | 120 RP | 0 | 1:50 |
| Poach Clients | Sales | Steals one lead from a rival | $1M | 2 | 2:55 |
| Kompromat | Special Projects | −30 leverage on one client, or a journalist’s story −25% | $2M | 6 | 3:12 |
| Intel II | Special Projects | Band narrows to ±3; the domino map is revealed | 300 RP | 0 | 4:10 |
| Deep Throat (Intel III) | Special Projects | Band narrows to ±1 | 350 RP | 2 | 4:30 |
| Hostile Takeover | Corporate | Buys a rival and all its sites | $150M | 10 | 4:45 |

Containment ops, one per track, run only during a breach and are listed in the Crises section. With them, the Classic six have 29 schemes; the alternate tracks add 8 more.

## The event deck

One headline arrives every in-game week. Cards are drawn from each open track’s deck according to its band, plus a general deck: 30 cards per track and 40 general, 220 in total.

| Card type | Share of draws | What it does |
|---|---|---|
| Headline | 40% | Flavour and a small tension nudge, sometimes with a cheap choice |
| Opportunity | 20% | A government contract, a celebrity lead, a cheap land deal |
| Threat | 20% | A journalist breakthrough, staff doubts, an audit |
| Client | 15% | A new demand, a feud, a payment problem |
| Wildcard | 5% | A rival move, or an organic shock of ±10 tension |

### Sample cards

| Card | Track and band | Choices | Outcomes |
|---|---|---|---|
| Senator Promises a Bunker in Every Backyard | Atomic, Boil | Lobby for it ($3M) / Mock it on air | Heartland demand +30% for 8 weeks, heat +2 / Bryce Kettering’s confidence −3 |
| Sourdough Starters Glowing Faintly | Bloom, Simmer | Fund a study ($1M) / Ignore it | +20 RP and Bloom +2 / Bloom +4 |
| Smart Fridge Refuses to Open | Optimizer, Boil | Buy the fridge maker ($10M) / Run the ad “Our doors have handles” | Optimizer +6 and a new revenue line / Disruptor demand +20% |
| Last Honeybee Granted State Funeral | Hush, Brink | Sponsor the funeral ($4M) / Sell honey futures | Hush −6, reputation +3 / +$5M, Hush +5, heat +4 |
| Iris Kemp Requests Comment | General threat | No comment / Off the record / Invite her to the Showroom | Story +10% / Story stalls, Marcus Dell’s leverage +5 / Iris trust +1, story stalls 4 weeks, heat risk |
| Halcyon Signs the Ashcombes | Wildcard | Poach them back ($3M) / Let them go | Lady Ashcombe returns, Halcyon schemes on slot 3 / Lose the lead, Cornelius Vane confidence −5 |

## Rivals

Rivals run on the same rules you do. When a rival’s demand sags, it fires schemes at its favourite tracks, so a track you are holding steady can be pushed by someone else. Favourites are set by slot, so they hold in every world.

| Rival | CEO | Brand | Favourite tracks | Behaviour |
|---|---|---|---|---|
| Halcyon Vaults | Seraphine Ash | Old money, Gilded style | Slot 3 (Superstorm Season or The Long Shade) and Atomic Standoff | Arrives at 2:55, courts dynasties, schemes when its demand sags |
| Bunkr | Kai Rook | App-based bunker subscriptions | Slot 4: its app runs on The Optimizer, or on the satellites The Kessler Rain destroys | In the background from chapter 2, goes public at 4:45, can be taken over |

# Crises and tipping points

Each track can be held anywhere below its tipping point. Cross it and you get a short containment window; fail, and the collapse shoves linked tracks toward breaches of their own. The skill of the game is staying as close to the edge as your nerve and your budget allow.

## Crisis states

Crisis states: 4 bands, 4 outcomes

Bands are reversible; breaches are not. A contained breach comes back to Boil with a scar, and a failed one only moves toward Midnight.

| State | Tension | What the player sees | Way out |
|---|---|---|---|
| Calm | 0–19 | A grey gauge, no grants | Schemes push it up; drift pulls it down |
| Simmer | 20–44 | The track’s colour appears; light demand | Holds steady without input |
| Boil | 45–69 | Hotspots pulse on the map; strong demand | Creeps upward on its own |
| Brink | 70 to the tipping point | The gauge flashes; rumbles near the edge | Climbs on its own; needs calming spend to hold |
| Breach | At or above the tipping point | Auto-pause; the containment window opens | Contain it (back to Boil, scarred) or fail (collapse) |
| Recovery | Reset to 60, locked 3 weeks | Grey hatching on the gauge | Drift resumes after 3 weeks |
| Collapse | Pinned at 100 for good | The track burns across its regions | None; it feeds every linked track |

Drift, grants and premiums per band are in the Core loop section.

## The hidden tipping point

- **Rolled at opening.** Each track’s tipping point is 90 plus a hidden offset between −8 and +4, so it lands between 82 and 94.
- **Shown as a band.** The gauge shows an estimate of ±10 at first, narrowing to ±5, ±3 and ±1 with the three Intel unlocks.
- **Rumbles.** Within 5 points of the real tipping point, the track gives tells: a tick on its gauge, a low tone and a specific kind of headline. Attentive players can read the edge without paying for intel.
- **Scars.** Every contained breach lowers that track’s tipping point by 3 for good, so the edge creeps closer each time you cross it. Scars and fragility together never push a tipping point below 72.
- **Revealed after a breach.** Once a track has breached, its exact tipping point is shown for the rest of the campaign. Players learn the edge by crossing it once.

## Breach and containment

When a track crosses its tipping point:

1. The game auto-pauses and a containment window opens: 6 weeks for a track’s first breach, 4 for its second, and 3 for every breach after that.
2. Tension locks at the tipping point and the track’s grants stop.
3. You must fill a containment bar to 100 points before the window closes.
4. Every breach week spills momentum into linked tracks, adds 2 heat and costs 2 board confidence.
5. The panic premium doubles. Breach weeks are the most lucrative sales window in the game, which is exactly the temptation.

| Containment source | Points | Cost | Notes |
|---|---|---|---|
| Containment op | +40 after 2 weeks | $10M × the track’s breach count | One per track at a time |
| Crash research program | +15 per week | 40 RP per week | Needs R&D at level 2 or higher |
| Calming schemes on the breached track | Half their momentum value | As listed | Everything Is Fine gives +4 |
| Government partnership | +25, once per breach | Reputation 50 or more | Heat −5 |
| Executive heroics | +20, once per executive per campaign | Story beat | Ruth’s engineering fix, June’s media blackout, or Theo’s dirty fix (heat +10) |

A first breach is comfortably containable, a second is tight, and a third usually needs heroics.

### Shelter-in-place tests

During a breach, clients in that track’s high-exposure regions move into their shelters, and each handed-over shelter is checked against its contract’s Days Sealed and the track’s critical ratings (Midnight and endings section). Shelters still under construction there lose a week instead. A pass earns 2 reputation. A failure costs 5 reputation and adds 15 to that client’s leverage, and a badly failed shelter can lose occupants. Survivability matters from the first breach, not only at Midnight. The Readiness Audit at 5:20 runs the full Midnight version of the same check.

## Recovery

When containment succeeds:

- Tension resets to 60 and locks for a 3-week recovery window, with no drift and no schemes on that track.
- The track takes a scar (tipping point −3), and its exact tipping point is revealed.
- The Doom Clock floor moves 1 minute toward Midnight.
- The board reacts: Priya Sandoval −10, Cornelius Vane −5, Bryce Kettering +5 (he loves a thrill).
- Every contract sold during the breach stands.

## Collapse and the domino

When containment fails:

- The track collapses and stays at 100 for the rest of the campaign. Its hot regions fill with ruin events: sites there take damage checks, retainers stop and clients demand evacuation.
- The Doom Clock floor moves 4 minutes toward Midnight.
- Linked tracks take an immediate shove: +15 tension if strongly linked, +8 for medium, +4 for weak.
- The collapsed track’s weekly spillover doubles for good.
- A second collapse starts the Final Countdown: Midnight arrives in 4 weeks, whatever the clock says.
During a breach, weekly spillover is +6 momentum to strongly linked tracks, +3 to medium and +1.5 to weak.

## The domino map

Domino map: 6 tracks, 10 links

Line weight is spillover strength during a breach or a collapse, using the values above. Every track eventually feeds The Pitchforks, and The Pitchforks feeds Atomic Standoff straight back: the most dangerous pair to run hot together.

The map shows the Classic world. Links belong to slots, so each alternate inherits its slot’s links: The Grey Goo takes The Bloom’s, The Long Shade takes Superstorm Season’s, The Kessler Rain takes The Optimizer’s and The Cloud Strike takes The Hush’s. Each alternate was written so those links make sense, such as debris blinding the early-warning satellites that keep Atomic Standoff calm.

## The Doom Clock

The Doom Clock shows minutes to Midnight. Tension can pull the hand forward or let it fall back, but never past the floor, which only moves toward Midnight.

Here M is the minutes shown, T is each open track’s tension (0–100), and F is the floor: the most time the world can ever show again. F starts at 15. With all six tracks at 100, the hand reaches Midnight.

| Event | Floor moves toward Midnight by |
|---|---|
| A track enters Brink for the first time | 0.25 minutes |
| Each chapter starts | 0.5 minutes |
| Each contained breach | 1 minute |
| Each collapse | 4 minutes |

**Fragility.** Every minute the floor moves toward Midnight also lowers every track’s tipping point by 1, including tracks not yet open. The edge creeps closer for the whole world, not only for the track that breached.

Midnight arrives when M reaches zero, when the Final Countdown ends, or when the player engineers it in chapter 5.

## Holding patterns

| Pattern | How | Yield | Risk |
|---|---|---|---|
| Simmer farm | Keep many tracks at Simmer | Low and steady | The quota outgrows it by chapter 3 |
| Brink rider | Hold one track at Brink with calming spend | The best grants per track | One bad wildcard means a breach |
| Double brink | Two unlinked tracks at Brink | 30 RP a week | Rivals and wildcards can tip either |
| Controlled burn | Deliberately breach a track you can contain | A breach-length window of doubled premiums | A scar, heat and a shorter window next time |
| Firebreak | Never run strongly linked tracks hot together | Safer dominoes | Fewer high-yield combinations |

## A breach, week by week

| Week | What happens |
|---|---|
| 0 | The Bloom sits at 87 against an estimated band of 84–94. A rival’s Lab Leak adds 6 momentum, and The Bloom reaches 90.3; its real tipping point was 89. Breach, auto-pause, 6-week window. |
| 1 | You launch Fungicide Airdrop ($10M) and a crash research program. Three Condo Silo units sell at the doubled premium. Containment: 15. |
| 2 | The airdrop lands. Spillover has pushed The Hush from 58 to 67. Containment: 70. |
| 3 | Iris Kemp’s story jumps 15%. You run Everything Is Fine on The Hush to keep it under Brink. Containment: 85. |
| 4 | The crash program finishes the job. Containment: 100. The Bloom resets to 60, its tipping point is now 86 and revealed, and the Doom Clock floor moves 1 minute. |

# Clients and the upside-down needs ladder

Clients pay for the top of the ladder and Midnight grades the bottom: the tier that decides 70% of survival earns about 10% of what a client will pay. Every shelter is a negotiation between what sells and what saves.

## The ladder

The upside-down ladder: 4 tiers, pay against survival

Read the left side as an inverted pyramid and the right as a normal one. That mismatch is the whole business model, and the reason Midnight grades are rarely Platinum.

## The four tiers

| Tier | Needs | Does the client look? | Example rooms |
|---|---|---|---|
| Survive | Air, water, food, power, seal, blast, medical, security | Only Paranoid or Engineer clients, or with an Inspector | Scrubbers, tanks, generators, blast doors |
| Comfort | Sleep, privacy, light, exercise, good food | Half the time | Master Suite, Window Wall, Gym |
| Status | Display, hosting, rarity, beating their peers | Always | Wine Cellar, Art Vault, Infinity Pool |
| Delusion | Immortality, legacy, control, the mansion reborn | Obsessively | Cryo Pod Bay, Museum of Me, Throne Room |

Willingness-to-pay weights shift by wealth class (below). The survival weights never do.

## Two scores, one shelter

Every shelter carries two scores. **Satisfaction** is what the client sees and pays for; **Survivability** is what Midnight grades.

Here w is the client’s willingness-to-pay weight for tier k, met is the share of that tier’s needs the shelter meets (0 to 1), and s is the style multiplier: 1.25 for a match, 1.0 neutral, 0.8 for a clash.

This runs over air, water, food and power, and a system whose production covers its use never runs out.

Each f is 1 when the shelter meets the apocalypse’s requirement and drops by 0.25 for every missing rating point, to a minimum of 0.

## How the inversion plays

- **Client Gaze walkthroughs.** Clients tour at 50% and 100% fit-out. They inspect Status and Delusion rooms every time, Comfort rooms half the time, and Survive rooms only if a trait or an Inspector makes them.
- **Change orders.** Walkthroughs produce requests, and 80% of them climb the ladder. Each pays 15% of the room’s cost on top and adds 1–2 weeks to the build.
- **The space war.** Every tile spent on a pool is a tile not spent on protein vats. Plots have fixed widths, and each stratum down costs more per tile.
- **The sign-off shortcut.** Contracts state a required Days Sealed, but a client with Satisfaction of 90% or more will sign off even if the shelter falls short. The game lets you take that deal, and Midnight remembers it.
- **Keeping up with the Vanderbunkers.** When one client gets a new Status or Delusion room, every client of the same class wants it within 4 weeks. These retrofit requests are the biggest source of retainer revenue.
- **Morale under seal.** Status-driven clients without their status rooms lose morale fast at Midnight, and a bunker of furious billionaires sabotages itself. The top of the ladder isn’t worthless, only overpriced.

## Wealth classes

| Class | Budget per shelter | Willingness-to-pay weights (Survive / Comfort / Status / Delusion) | Signature demands | Arrives at |
|---|---|---|---|---|
| C1 The Comfortably Nervous | $3–12M | 25 / 40 / 30 / 5 | A deep pantry, a Master Suite, a Window Wall | Start |
| C2 The Disruptors | $10–40M | 10 / 25 / 40 / 25 | Biohacking Lab, Broadcast Studio, smart everything | 1:10 |
| C3 The Dynasties | $30–120M | 5 / 20 / 40 / 35 | Art Vault, Heir Nursery, Museum of Me | 2:15 |
| C4 The Moguls | $80–400M | 5 / 10 / 30 / 55 | Throne Room, Mansion Replica Floor, Private Forest Dome | 3:50 |
| C5 The Table | $500M+ as a consortium | 5 / 10 / 25 / 60 | The Ark, Cryo Pod Bay, Genetic Library | 4:30 |

The Disruptors’ smart bunkers become a liability the moment slot 4 opens: The Optimizer turns them into Faraday retrofits, and The Kessler Rain into Radio Room retrofits.

## Client traits

Each client has 1–3 traits. Some are hidden until the consultation.

| Trait | Effect | Pushback hook |
|---|---|---|
| Paranoid | Inspects the Survive tier and demands more Days Sealed | Signs off slowly |
| Engineer | Inspects everything and tells peers about flaws | Raises standards across their class |
| Germaphobe | Needs Decon and a Med Bay; fears The Bloom twice as much | Change orders mid-build |
| Gourmand | Wants a Chef’s Kitchen and Wine Cellar; eats 1.5× the food | Morale crash when luxuries run out under seal |
| Pet Parent | Pet decor, later a Pet Clone Lab | Animals count as extra mouths |
| Influencer | Wants a Broadcast Studio; doubles referral leads | Leaks: heat +3 a quarter unless under NDA |
| Collector | Wants an Art Vault and a Museum of Me | Climate power around the clock |
| Dynast | Wants an Heir Nursery; +2 occupants per generation | Long Days Sealed requirements |
| Health Optimizer | Biohacking Lab, then Cryo Pods | Always wants the newest unlock |
| Control Freak | Demands override codes to every system | Leverage +10 at handover; a security risk |
| Penny-Pincher | Haggles 15% off | Pays late |
| Secretly Broke | May default on retainers | You hold leverage over them, for once |
| Knows Too Much | Starts with 30 leverage over you | Blackmail arrives early |
| Feuding | Hates one named client; morale −20 if they share a silo | Condo drama, sabotage under seal |
| Doomer Romantic | Wants a Window Wall that shows a last sunset | Small budget, big story beats |
| Philanthropist | Funds a public shelter wing | Reputation +5, heat −3 |

## Client lifecycle

1. **Lead:** arrives from the demand ticker, tagged with fears, class and visible traits.
2. **Consultation:** reveals needs, style, budget and hidden traits; you quote a price.
3. **Contract:** price, deadline, required Days Sealed, fears covered, occupants, style and penalties.
4. **Build:** survey, dig, shell and fit-out.
5. **Walkthroughs** at 50% and 100%: change orders and a satisfaction check.
6. **Handover:** the balance is paid, satisfaction locks in and leverage is set.
7. **Retainer:** 4% of the build price every quarter, plus retrofits as peers upgrade and new fears open, and a shelter-in-place test whenever a feared track breaches in their region.
8. **Seal order:** at Midnight the client has to physically reach the shelter.
9. **Epilogue:** their outcome under seal.

## Sample contract

| Field | Value |
|---|---|
| Client | Lady Eleanor Ashcombe (C3): Dynast, Feuding with the Whitlocks |
| Product and site | Family Vault, Old Capitals |
| Price | $60M: $48M base plus a 25% panic premium while Atomic Standoff is at Boil |
| Deadline | 26 weeks |
| Required Days Sealed | 730 (two years) |
| Fears covered | Atomic Standoff, The Pitchforks |
| Occupants | 9 family across three generations, plus 4 staff |
| Style | Gilded |
| Must-haves | Heir Nursery, Art Vault, Museum of Me, blast rating 4 |
| Penalties | 2% of the price per week late; leverage +10 if late |

# The company and the board

Last Resort Holdings grows from two crews in the Heartland to a conglomerate with eight sites and an Ark, and every quarter a five-seat board raises the bar. The company is run through menus and panels, not a third build canvas, so the craft budget stays on the shelters and the world.

## Company tiers

| Tier | Reached at | Sites | Departments | Crews | Department level cap | What it adds |
|---|---|---|---|---|---|---|
| Startup | Start (Q1) | 1 | Sales, Engineering; Special Projects at 0:25 | 2 | 2 | The grid, Solo Pods, the first scheme |
| Boutique | 0:55 (Q3) | 2 | + R&D, Communications | 4 | 3 | Grants, calming schemes, Condo Silos |
| Firm | 1:50 (Q5) | 4 | + Legal at 2:25 | 6 | 4 | Brink, containment, leverage |
| Conglomerate | 3:20 (Q8) | 6 | + Security at 3:30 | 10 | 5 | Dominoes, sieges, reactors |
| The Last Resort | 4:50 (Q11) | 8, plus the Ark | All | 16 | 5 | The endgame |

A tier-up arrives at a chapter’s last board meeting when the quota is hit and a handover milestone is met (2, 6, 14 and 24 shelters handed over). Missing it delays the tier one quarter and costs 10 board confidence. The Boutique tier-up also brings a 60 RP research budget, so chapter 2’s first research isn’t starved.

## Departments

| Department | Head | Does | Each level adds | Pushback it touches |
|---|---|---|---|---|
| Sales and Concierge | Avery Lin | Leads, quotes, walkthroughs, retainers | +1 lead per week, better haggling; the Inspector from level 3 | Client leverage: happy clients gain it slower |
| Engineering | Ruth Abernathy | Survey, dig, shell and fit-out crews | +15% crew speed, +1 crew slot | Staff loyalty and whistleblowers |
| R&D | Dr. Hana Sato | Research | +3 RP per week; a second research slot at level 3 | None directly |
| Special Projects | Theo Lisk | Escalation and intel schemes | +1 scheme slot, scheme heat −8% | Heat |
| Communications | June Okafor | Calming schemes and the press | +1 heat decay per week | Heat and reputation |
| Legal | Marcus Dell | NDAs, burying stories, enforcing contracts | NDAs 20% cheaper; journalist stories −5% a week | Client leverage and journalists |
| Security | Bo Kowalski | Siege defence and staff vetting | +1 security on every site; leak chance −10% | The Pitchforks and whistleblowers |

## Staff

- **Heads** are named characters with Loyalty (0–100) and Knowledge (0–100: how much of Special Projects they have seen).
- **Loyalty** rises with raises, wins and being told the truth. It falls with broken promises, and each head has drivers of their own (below).
- **Whistleblowers.** Each quarter, a head with Loyalty below 30 and Knowledge above 50 has a 25% chance to go to Iris Kemp: heat +20 and her story +30%.
- **Crews** are generic and level up with use. Every site also needs operating staff (medics, engineers, guards, chefs) who take up bunks at Midnight. Leaving staff outside the door is cheaper, and the epilogue notices.

### Loyalty drivers

| Head | Gains loyalty | Loses loyalty | Below 30 |
|---|---|---|---|
| Avery Lin | +2 per on-time handover | −3 per late handover | Two leads a quarter leak to Halcyon Vaults |
| Ruth Abernathy | +4 a quarter when Survive rooms are at least 30% of build spending | −2 per escalation scheme | Whistleblower checks begin |
| Dr. Hana Sato | +1 per research node finished | −8 per scar | Research slows by 25% |
| Theo Lisk | +2 per escalation scheme | −2 per calming scheme | Rogue schemes in chapter 4; Somebody Else’s Apocalypse in chapter 5 |
| June Okafor | +4 when a quarter ends with heat below 40 | −1 per week at heat 55 or more | Quits during Hearings; calming schemes cost 25% more until she is replaced |
| Marcus Dell | +2 per NDA | −10 per scapegoat | Legal costs double |
| Bo Kowalski | +3 per siege repelled | −5 per siege lost | Guards walk out: every site’s security −1 |

Every head also gains 5 from a raise ($1M each, once a quarter) and loses 10 for each broken promise made on an event card. Whistleblower checks apply to any head below 30 loyalty with Knowledge above 50, except Theo, who goes rogue instead. Knowledge rises 10 a quarter for heads who work with Special Projects: Theo, June and Marcus every quarter, and Ruth and Hana in any quarter with a breach.

## Money

| Revenue stream | How it pays | Target share of income in chapter 3 |
|---|---|---|
| Contracts | 30% at signing, 40% at the first walkthrough, 30% at handover | 55% |
| Retainers | 4% of the build price every quarter | 15% |
| Change orders | The room’s cost plus 15% | 10% |
| Government contracts | Volume shelters in Brink regions, low prestige | 10% |
| Scheme kickbacks | Arms Broker, Gentrify and similar | 5% |
| Investment rounds | Board injections at high confidence | 5% |

The quota counts revenue, not profit. Investment rounds are cash, not revenue, so they never cover a missed quota. The board is exactly as short-sighted as it sounds.

## The board

Five seats, five agendas, and two directives at every quarterly meeting.

| Member | Seat | Wants | Sample directive | Hates |
|---|---|---|---|---|
| Cornelius Vane III | Chair | Legacy and steady growth | Land a Dynasty client this quarter | Breaches |
| Bryce Kettering | Growth capital | Twice the quota and constant escalation | Push any track to Brink | Calming schemes |
| Dame Ottilie Faraday | Defence money | Atomic profits | End the quarter with Atomic Standoff at 70 or above | Peace summits |
| Priya Sandoval | Risk and audit | No surprises | Keep heat below 40 | Breaches and heat |
| Mr. Gray | The proxy seat | The Table’s interests | Begin the Ark | Exposure |

Until 4:30 the proxy seat votes silently with the majority. Then Mr. Gray takes it in person and reveals who he speaks for. From then on he issues one of the two directives at every meeting.

## The quarterly meeting

1. **Results:** revenue against the quota, breaches, heat and handovers.
2. **Confidence:** a hit quota is +5 with every member, a miss −15, and beating it by 25% is +10; each directive fulfilled is +8 with the member who set it, and each failed is −5 with them.
3. **New quota:** 30% higher than the last (see Economy and tuning).
4. **Two directives** from different members. You may refuse one, at −3 with that member.
5. **Votes** on pending big decisions.
6. **Announcements:** tier-ups, new tracks, new client classes.
7. **A cliffhanger headline** to carry you into the next quarter.

## Board confidence

Each member keeps their own confidence from 0 to 100, and board confidence is the average of the five. Directives and reactions move only the member involved. Quota results move every member. The proxy seat counts as the average of the other four until Mr. Gray takes it, and the thresholds below use the board average.

| Confidence | State | Effect |
|---|---|---|
| 80–100 | Bullish | An investment round worth 25% of the next quota |
| 50–79 | Steady | None |
| 25–49 | Scrutiny | Priya’s audits: scheme heat +20% |
| 1–24 | Probation | A Minder, Bryce’s protégé, vetoes one action a quarter and may launch schemes on their own |
| 0 | Ousted | The campaign ends |

## Board votes

Big decisions need 3 of 5 votes: a site in a new region, Sabotage, a Hostile Takeover, the Ark and Engineered Midnight. Each fulfilled directive earns a Favour with that member, and spending a Favour secures their vote once. Otherwise a member votes yes when their own confidence is 50 or more.

# Pushback systems

Four systems push back on every move: heat punishes being seen, runaway tension punishes waiting, client leverage punishes being known, and the board punishes standing still. Each has a meter, clear thresholds and at least two counters, and each one feeds the others.

## At a glance

| System | Meter | Rises with | Falls with | Worst case |
|---|---|---|---|---|
| Heat | 0–100, company-wide | Schemes, leaks, breaches, armouries, reactors | Weekly decay, calming schemes, Legal, scapegoats | Indictment |
| Runaway tension | Momentum and drift per track | Brink drift, spillover, rivals, wildcards | Calming schemes, firebreaks | A breach that dominoes |
| Client leverage | 0–100 per client | Secrets learned, late builds, gossip, high heat | Satisfaction, NDAs, kompromat, cutting ties | A client takes a cut, or defects |
| The board | Confidence 0–100 | Hit quotas and directives | Missed quotas, breaches, refused directives | Ouster |

## Heat

| Heat | Level | Effects |
|---|---|---|
| 0–29 | Unnoticed | None |
| 30–54 | Whispers | A journalist opens a story; scheme costs +10% |
| 55–74 | Investigation | One site audited per quarter (a week of lost construction); Sabotage locked; client leverage grows 1.5× |
| 75–94 | Hearings | A public hearing each quarter: reputation −10, board confidence −10, new leads −25% |
| 95–100 | Exposed | Indictment proceedings: 4 weeks to get below 95 or the campaign ends |

Heat decays by 1 a week, plus 1 per Communications level, but never below your Notoriety: a floor of 0 at Startup, then 5, 10, 20 and 30 as the company tiers up. Once per campaign you can name a **scapegoat**: an executive leaves, their department drops two levels, every other head loses 15 loyalty, and heat falls by 40.

### Journalist stories

- Each journalist builds a story from 0 to 100%, gaining 2% a week plus 1% for every 10 heat.
- At 100% the story runs: heat +25, reputation −15, and every client gains 10 leverage.
- **Counters:** Bury (Legal, $2M, −15%), Discredit (Communications, $3M, −20%, but a 25% chance of heat +2), Distraction (stalls it 3 weeks, heats another track), Kompromat (−25%), or The Interview (invite her to the Showroom: risky, and the only road to the Last Resort ending).
- **Iris Kemp** is slow and accurate. **Gil Marsh** is fast and wild: his stories add only 10 heat, but they push a random track +5 when they air.

## Runaway tension

Each week, every track’s tension moves by its band’s drift, its momentum and any spillover, and momentum decays toward zero as new impulses arrive.

Here d is the band’s drift (Core loop section), M is momentum, S is spillover from breached or collapsed tracks, and I is this week’s impulses: schemes up or down, rival schemes and wildcards.

Momentum releases a quarter of itself as tension each week, so a scheme’s momentum value is the total tension it delivers: a Leak adds 8 in all, most of it in the first few weeks.

- **Brink drift** is +1.5 a week, so standing still at Brink means sliding toward the edge.
- **Rivals** fire schemes at their favourite tracks whenever their own demand sags.
- **Wildcards** (5% of event draws) shift a track by up to ±6 at Startup tier, growing to ±14 at The Last Resort. Pressure scales with your success.
- **Influencer clients** post doom content: +1 to their feared track each quarter.
The holding cost is the core trade. Keeping a track at Brink against drift and noise takes three to four Everything Is Fine campaigns a quarter, because repeat calming loses strength: roughly $4M and 13 heat a quarter per track, against 195 RP in Brink grants and a Fear meter that drains the whole time you hold.

## Client leverage

| Leverage | Level | Effect |
|---|---|---|
| 0–39 | Client | Normal |
| 40–69 | Demands | A free upgrade or 10% off, every quarter |
| 70–89 | Blackmail | Pay 5% of their contract each quarter, or they leak: heat +15 |
| 90–100 | Cut-in | They want a board seat or 5% of revenue. Refuse and they defect to a rival with your secrets: heat +25 and rival schemes aimed at you |

**Sources:** the Knows Too Much trait (starts at 30), Control Freaks (+10 at handover), late delivery (+10), and schemes run in a client’s region while heat is 55 or more (+5 each).

**Condo gossip:** in a Condo Silo, leverage spreads. Each week every resident moves 10% of the way toward the highest resident’s leverage.

**Counters:** Satisfaction above 80% halves leverage gains. An NDA (Legal, $1M) cuts 20, once per client. Kompromat cuts 30. Secretly Broke clients can be leveraged right back. Cutting ties cancels the contract with a 50% refund and costs 5 reputation.

At Midnight, high-leverage clients insist on the first seats in the seal order.

## Reputation, the Inspector and sieges

**Reputation** runs from 0 to 100 and starts at 40. It rises with on-time handovers (+1 each), galas, philanthropy and passed shelter-in-place tests, and falls with failed tests, published stories and hearings. Together with the Showroom it sets the quality of incoming leads, and government partnerships need 50 or more. It sits in the top bar beside heat.

**The Inspector** is a Sales hire from level 3, at $0.2M per walkthrough. Clients on an inspected walkthrough see the Survive tier: they ask for more of it, and their leverage grows half as fast.

**Sieges** begin once The Pitchforks opens. Each week, every site in a Pitchforks hot region faces a check: siege strength is The Pitchforks’ tension divided by 20, plus 1 for each visible surface feature (helipad, garage, mast or antenna). If strength beats the site’s security rating, the site is occupied. Construction and retainers stop there, and heat rises 1 a week until Security retakes it (a 2-week op) or Communications negotiates (reputation −5). Security rating comes from Security Posts (+2 each), an Armory (+1) and the Security department (+1 per level). A Decoy Entrance absorbs the first lost siege at its site each quarter, and every repelled siege adds 1 reputation.

## The board

The board is the engine that makes calm unaffordable. Its quota rises 30% a quarter, and by quarter 5 it outgrows anything a world held at Simmer can pay. Directives, confidence thresholds and votes are in the Company and board section.

## How they interlock

| When | It feeds | Effect |
|---|---|---|
| Heat reaches 55 | Client leverage | Leverage grows 1.5× |
| You refuse a blackmailing client | Heat | +15 |
| A track is in breach | Heat and the board | +2 heat and −2 confidence every week |
| Bryce directs you to Brink | Runaway tension | You are paid to approach the edge |
| You run a Distraction against a story | Runaway tension | A second track heats up |
| You name a scapegoat | Staff | Every head loses 15 loyalty |
| You run calming schemes | The board | Bryce −2 confidence per use |
| A head’s loyalty falls below 30 | Heat | Whistleblower checks begin |

## Difficulty

| Setting | Tipping-point range | Brink drift per week | Heat decay per week | Quota growth per quarter | For |
|---|---|---|---|---|---|
| Investor | 86–94 | +1.0 | 2 | 20% | Players here for the satire |
| Founder (default) | 82–94 | +1.5 | 1 | 30% | The intended balance |
| Hostile Takeover | 78–92 | +2.0 | 0.5 | 35% | Brink riders |

# Research, unlocks and fan-outs

48 unlocks land across the campaign: 39 research nodes in five branches and 9 story, board and tier unlocks. Research is funded mostly by the crisis dividend, so the hotter you run the world, the faster you unlock.

## Research rules

- **Chapter 1 runs on cash.** Tier 1 nodes cost $0.5–2M and take one week. RP arrives with R&D at 0:55 and grants at 1:05.
- **RP flows into the active node.** There is no separate timer: a node finishes when its RP is paid. R&D starts with one slot and gains a second at level 3.
- **Always a choice.** From chapter 2, at least two research nodes are open at once.
- **The locked shelf.** The next three unlocks are always visible, with their gates and costs.
- **Income versus the tree.** Chapter 4’s RP income covers about 85% of its nodes, so players must choose.

## Branches

| Branch | Focus | Headline unlocks |
|---|---|---|
| Structure | Digging, strata, blast doors | Clay, Bedrock, Deep Rock and Abyss digging |
| Life systems | Air, water, food, power, seals | Hydroponics, Geothermal, Protein Vats, Micro-reactor, Readiness Audit |
| Luxury | Comfort, Status and Delusion rooms | Wine Cellar, Art Vault, Throne Room, Cryo Pod Bay |
| Special Projects | Schemes, intel, containment | Brink Analysts, containment ops, Kompromat, The Final Product |
| Corporate | Products, departments, logistics | Condo Silo, Compound, the Ark, Seal Order logistics |

## The unlock schedule

Times are real-time targets from the campaign start at mixed game speed. A dash in the cost column means the unlock is free: it comes from the story, the board or a tier-up. In alternate worlds, rows 11, 21, 26 and 31 open the alternate track and add its first two counter rooms and its scheme at the same time and cost, while the Classic counter rooms in those rows still unlock. Each alternate’s third room follows about ten minutes later as a Life node of the same tier.

| # | Target time | Unlock | Gate | Cost | Fan-out: what it asks for next |
|---|---|---|---|---|---|
| 1 | 0:00 | Starter kit: Topsoil digging, Airlock, Bunk Room, Pantry, Water Tank, Diesel Generator, Hand-crank Scrubber, Galley Kitchen | Start | — | The first Solo Pod contract |
| 2 | 0:06 | Blast Door Mk I | Structure 1 | $0.5M | Contracts start asking for blast 2 |
| 3 | 0:10 | Master Suite, Lounge | Luxury 1 | $0.5M | More power, a second generator, noise in the layout |
| 4 | 0:15 | Utility Spine | Structure 1 | $1M | Multi-floor shelters; every floor must touch it |
| 5 | 0:20 | Clay digging, Sump Pump | Structure 1 | $1.5M | Seepage below 12 m, pumps, more power |
| 6 | 0:25 | Special Projects, Leak; Atomic Standoff opens | Board | — | Atomic demand for depth and blast doors |
| 7 | 0:32 | Window Wall, Laundry | Luxury 1 | $1M | Comfort demand and more power |
| 8 | 0:38 | Med Bay | Life 1 | $1M | A medic to hire and house |
| 9 | 0:45 | Blueprints | Corporate 1 | $2M | Saved floors stamped into new shelters |
| 10 | 0:50 | Family Vault, a third crew | Corporate 1 | $2M | Bigger plots, more floors, spine capacity |
| 11 | 0:55 | Boutique tier: R&D, Communications; The Bloom opens; Decon Shower, HEPA Scrubber Bay | Tier and story | — | Spore retrofits for every shelter sold |
| 12 | 1:00 | Heat, Iris Kemp’s first story, Distraction | Story | — | Heat management and Communications upgrades |
| 13 | 1:05 | Resilience Grants: the crisis dividend | Board | — | A reason to heat a second track |
| 14 | 1:10 | Disruptor clients; Wine Cellar, Home Cinema, Biohacking Lab, Broadcast Studio, Gym | Story and Luxury 2 | 50 RP, $2M | Status tier, cellar depth, bigger plots |
| 15 | 1:15 | Everything Is Fine, Doom Influencer Network, Think Tank Grant | Special Projects 2 | 40 RP, $1M | Holding a track at Boil becomes possible |
| 16 | 1:22 | Condo Silo, Guest Quarters | Corporate 2 | 60 RP, $3M | Shared systems, feuds, condo gossip |
| 17 | 1:30 | Second site; Panic Room, Chef’s Kitchen, Library; Shelter Subsidy Lobby | Tier and Luxury 2 | 50 RP, $2M | Regional exposure and a second client pool |
| 18 | 1:38 | Battery Bank, Solar Mast | Life 2 | 40 RP, $1M | Surface visibility, which matters later |
| 19 | 1:45 | Hydroponics Bay | Life 2 | 60 RP, $2M | Water, grow-light power, bigger tanks |
| 20 | 1:50 | Firm tier; Brink Analysts (Intel I) | Tier and Special Projects 3 | 120 RP | Brink riding becomes readable |
| 21 | 1:58 | Superstorm Season opens; Flood Seals, Storm Shutters; Weather Mod Contract | Story and Life 3 | 120 RP, $4M | Coastal retrofits, power independence |
| 22 | 2:05 | Bedrock digging, Blast Door Mk II | Structure 3 | 180 RP, $6M | Geothermal within reach |
| 23 | 2:10 | Containment ops; Arms Broker, Peace Summit Sponsorship | Special Projects 3 | 150 RP, $5M | A first breach becomes survivable |
| 24 | 2:15 | Dynasty clients; Art Vault, Heir Nursery, Museum of Me, Trophy Garage, Helipad; Lab Leak | Story and Luxury 3 | 200 RP, $8M | Climate power, surface visibility, bigger families |
| 25 | 2:25 | Legal, NDAs; Therapy Pod, Cigar Lounge, Personal Mausoleum; Philanthropy Gala | Corporate 3 | 150 RP, $5M | Leverage management |
| 26 | 2:35 | The Optimizer opens; Faraday Room; Feature Creep, Debunk | Story and Life 3 | 160 RP, $5M | Every Disruptor’s smart bunker needs a retrofit |
| 27 | 2:45 | Geothermal Plant, a second spine | Life 3 | 220 RP, $8M | Engineers to house, heat exchangers |
| 28 | 2:55 | Halcyon Vaults arrives; Poach Clients | Story | — | Competition for Dynasty leads |
| 29 | 3:05 | Deep Water Recycler, Infinity Pool, Spa and Sauna | Life 3 and Luxury 3 | 200 RP, $8M | Water budgets that fight at Midnight |
| 30 | 3:12 | Kompromat, Sabotage | Special Projects 3 | 180 RP, $6M | Leverage counters; Sabotage needs a board vote |
| 31 | 3:20 | Conglomerate tier; The Hush opens; Aquaponics, Protein Vats, Seed Vault, Atrium Garden; Pesticide Partnership | Tier, story and Life 4 | 280 RP, $14M | Food-independence retrofits everywhere |
| 32 | 3:30 | Security; The Pitchforks opens; Security Post, Decoy Entrance, Armory; Gentrify | Story and Corporate 4 | 250 RP, $12M | Sieges, guards; surface footprint becomes a liability |
| 33 | 3:40 | Deep Rock digging, Aquifer Well, Blast Door Mk III | Structure 4 | 320 RP, $18M | Reactor siting, unlimited water |
| 34 | 3:50 | Mogul clients; Throne Room, Mansion Replica Floor, Private Forest Dome, Pet Clone Lab | Story and Luxury 4 | 300 RP, $16M | Enormous power and water draws |
| 35 | 4:00 | Micro-reactor | Life 4 | 350 RP, $20M | Shielding, specialists, regulator heat |
| 36 | 4:10 | Intel II: the domino map; Firebreak | Special Projects 4 | 300 RP | Planning dominoes instead of guessing |
| 37 | 4:20 | Compound | Corporate 4 | 280 RP, $15M | Tunnels between sites, spread risk |
| 38 | 4:30 | Mr. Gray reveals The Table; Table leads; Legacy Broadcast Array; Deep Throat (Intel III) | Story and Special Projects 4 | 350 RP | The Ark becomes the goal |
| 39 | 4:38 | Cryo Pod Bay | Luxury 4 | 300 RP, $20M | Reactor-grade power in Dynasty and Mogul shelters |
| 40 | 4:45 | Bunkr goes public; Hostile Takeover | Story | — | A rival’s sites and secrets for sale |
| 41 | 4:50 | The Last Resort tier; Project Lights Out; Abyss digging | Tier and Structure 5 | 350 RP, $40M | Ark-depth excavation |
| 42 | 5:00 | The Ark; Governance Hall, Schoolhouse | Corporate 5 | 400 RP, $60M | A consortium build for hundreds of occupants |
| 43 | 5:10 | Genetic Library | Luxury 5 | 250 RP, $40M | The Table’s final vanity |
| 44 | 5:20 | Readiness Audit: simulate Midnight for any shelter | Life 5 | 300 RP, $40M | Find weak shelters before Midnight does |
| 45 | 5:30 | The Final Product: an engineered breach option per track | Special Projects 5 and a board vote | 400 RP, $80M | Choose which apocalypse to sell |
| 46 | 5:40 | Seal Order logistics: convoys and helicopter lift | Corporate 5 | 200 RP, $30M | Getting clients inside on time |
| 47 | 5:45 | The Last Resort path (hidden) | Story: Iris Kemp trust 3+, Ruth Abernathy loyalty 70+ | — | The whistleblower ending |
| 48 | 5:50 | The Overtime offer | Board | — | Endless quarters past quarter 12 |

## Fan-out chains

Every unlock should trigger three or more follow-on builds, and headline unlocks five or more. These chains are the pattern to design every unlock against.

**The Wine Cellar (1:10)**

1. A Disruptor wants a Wine Cellar, and its prestige bonus needs 10 m of depth.
2. Clay digging takes the cellar below the 12 m water table, so it needs a sump pump.
3. The pump and the new cinema push power past one generator, so you add a second.
4. The second generator’s noise reaches the Master Suite: re-lay the floor or add a Battery Bank.
5. Every other Disruptor now wants a cellar too, and the retrofits begin.
**The Optimizer (2:35)**

1. The track opens, and every Disruptor’s smart bunker loses survivability against it.
2. Faraday Room retrofits roll out across every sold site as change orders.
3. Analog backups return: hand-crank scrubbers and mechanical locks.
4. The retrofit wave jams your crews, so you hire more and level Engineering.
5. Bunkr, which runs on The Optimizer, becomes a takeover target later.
**Bedrock and geothermal (2:05 to 2:45)**

1. Bedrock digging reaches 50 m, where the Geothermal Plant can go.
2. The plant needs two engineers, who need bunks and meals.
3. More meals mean a bigger Hydroponics Bay, which needs more water.
4. More water means the Deep Water Recycler.
5. The recycler is exactly what the Infinity Pool needs, and the client has noticed.
**The Pitchforks (3:30)**

1. Sieges begin on visible sites.
2. Security Posts and Decoy Entrances go up, staffed by guards who need bunks.
3. Guards want an Armory, which adds heat at every site.
4. Heat means more Communications spend.
5. Helipads and trophy garages turn into liabilities to conceal or remove.
**The Cryo Pod Bay (4:38)**

1. Each bay needs 40 kW of reactor-grade power.
2. That means a Micro-reactor, sited at 60 m or deeper.
3. That means Deep Rock digging, shielding and two specialists.
4. Reactors draw regulators, and regulators draw heat.
5. Heat means Legal, and Legal means another department level.

## Alternate fan-out chains

Each alternate meets the same rule: three or more follow-on builds, and five for its headline unlock.

**The Grey Goo (0:55)**

1. Every client wants Ceramic Lining wherever goo could reach, and every sold shelter needs a retrofit.
2. Lining by hand is slow and expensive, so you build a Kiln Workshop (1:05) to fire it on site.
3. The kiln’s 12 kW and noise push power past one generator and drive bedrooms away from it.
4. An EMP Pulse Room clears the ducts but resets every smart device on its floor, so Disruptor clients order analog backups.
5. Sealed ducts become a contract requirement, and every new shelter needs a bigger HEPA bay to push air through them.
**The Long Shade (1:58)**

1. The cold makes Thermal Cladding a retrofit for every shelter already sold.
2. Cladding alone isn’t enough, so each shelter needs a Boiler Room.
3. Boilers burn fuel all winter, which means a Fuel Depot (2:08) that can never sit beside a bedroom.
4. Boiler fumes and noise add air load and reshuffle layouts, so scrubber bays grow.
5. With the sun dimmed, hydroponics needs more grow light, and the Geothermal Plant at 2:45 becomes the real fix.
**The Kessler Rain (2:35)**

1. Satellite-linked smart bunkers go dark, and the Disruptors demand Radio Rooms.
2. Radio Rooms need operators, who need bunks and meals.
3. Falling debris makes every helipad, mast and garage a target, so Debris Caps go over every surface footprint.
4. Helipads are useless under the debris, so the Seal Order needs a Convoy Bay (2:45) with a surface ramp.
5. Ramps mean more digging and more crews, and each ramp raises siege risk once The Pitchforks opens.
**The Cloud Strike (3:20)**

1. Days Sealed collapses on water everywhere, and every client wants a Water Vault.
2. A 6-tile vault forces re-layouts or wider digs in sold shelters.
3. Atmospheric Condensers fill the vaults at 8 kW each, pushing power toward geothermal or a reactor.
4. Pools and forest domes now drain the vault, and clients who won’t give them up order covers and recyclers instead.
5. The Cloud Embassy (3:30) lets you bargain with the sky, but its diplomat needs a bunk and its surface footprint draws sieges.

# Pacing: the 5+ hour campaign

Twelve quarters in five chapters take 5 to 6.5 hours at mixed speed. Something new lands every 5–6 minutes in the first two chapters and every 8–9 minutes after, and each later unlock is bigger than the ones before it.

## The campaign at a glance

Campaign roadmap: 5 chapters, 4 tier-up gates

Each gate opens when the chapter’s last quota is hit and its handover milestone is met. A missed gate slips the tier by one quarter.

## Chapter targets

| Chapter | Quarters | Real time | Tracks open by the end | Doom Clock (minutes) | Sites | Shelters handed over by the end | Unlocks | What it teaches |
|---|---|---|---|---|---|---|---|---|
| 1. Seed Round | Q1–Q2 | 0:00–0:55 | 1 | 15 → 14 | 1 | 2 | 10, one every 5.5 min | The grid, the Survive tier, a first scheme |
| 2. Series A | Q3–Q4 | 0:55–1:50 | 2 | 14 → 12 | 2 | 6 | 9, one every 6 min | Heat, the crisis dividend, the Status tier, condos |
| 3. Hypergrowth | Q5–Q7 | 1:50–3:20 | 4 | 12 → 9 | 4 | 14 | 11, one every 8 min | Brink, the hidden tipping point, the first breach, leverage, the Delusion tier |
| 4. Too Big to Fail | Q8–Q10 | 3:20–4:50 | 6 | 9 → 6 | 6 | 24 | 10, one every 9 min | Dominoes, sieges, reactors, The Table |
| 5. The Final Quarter | Q11–Q12 | 4:50–6:15 | 6 | 6 → 0 | 8 plus the Ark | 30 plus the Ark | 8, one every 8 min | Engineered Midnight and the endings |

Real minutes per quarter rise from about 26 to about 32 as decisions get denser and players pause more. The handover milestones match the tier-up gates in the Company and board section.

## Signature moments

| Time | Moment | Purpose |
|---|---|---|
| 0:03 | The first contract is signed | Fast competence |
| 0:25 | First board meeting: “Calm worlds don’t buy bunkers.” Leak unlocks | The premise lands |
| 1:00 | Iris Kemp calls for comment | The world is watching |
| 1:22 | The first Condo Silo, with two feuding neighbours | Story from simulation |
| 2:10–2:30 | The first breach. If the player hasn’t breached by 2:30, a wildcard nudges a Brink track over. Shelters in its hot regions face their first shelter-in-place test | Teach containment while the stakes are low |
| 2:35 | The Optimizer turns smart bunkers into liabilities | The retrofit wave |
| 3:30 | The first siege at a visible site | Surface footprint matters |
| 4:30 | Mr. Gray takes his seat | The real client is revealed |
| 4:50 | Project Lights Out | The ending becomes a choice |
| 5:50–6:15 | Midnight and the epilogue | The payoff |

## Cadence rules

1. **Pain before tool.** Every tool unlocks within one quarter after the problem it solves appears, and never before.
2. **No dead zones.** Never more than 8 minutes without a new room, client, scheme or story beat in chapters 1–2, or 12 minutes after that.
3. **Two goals in flight.** At any moment the player has a contract deadline less than 5 minutes away, plus a research node or a band edge less than 3 minutes away.
4. **Fan-out of three or more** for every unlock (Research and unlocks section).
5. **The locked shelf.** The next three unlocks are always visible with their gates.
6. **Visible tier-ups.** Shelters get deeper, the Showroom gets grander, and the map gets hotter.
7. **Pressure pegged to success.** Wildcard size and rival aggression scale with company tier, not with the clock.
8. **One new system per quarter**, at most.
9. **Branch choice** from chapter 2: at least two research nodes open at once.
10. **Front-load density, back-load magnitude.** Small and frequent early; rare and transformative late.

## Moment-to-moment targets

| Metric | Target |
|---|---|
| First room placed | Under 60 seconds |
| First contract signed | Under 3 minutes |
| First handover | Under 12 minutes |
| First scheme | 25 minutes |
| First heat event | About 60 minutes |
| First breach | 2:10–2:30 |
| First collapse | Not before 3:30 unless the player forces it |
| Board meetings | Every 26–32 minutes |
| Headline cards | One per in-game week, about every 2 minutes at 1× |
| Client walkthroughs | One every 5–8 minutes |
| Quarters with the quota hit | About 75% on Founder difficulty |

## Catch-up and runaway leaders

- **Behind:** if handovers lag the tier gate by a quarter, Avery Lin brings a rescue lead: a modest, easy contract with a generous deadline.
- **Ahead:** if the quota is beaten by 50%, rivals’ aggression steps up one level and wildcards grow by 2.

## Session shape

One quarter is one session. Each board meeting resolves the last quarter and ends on a new directive and a cliffhanger headline, so stopping always feels like walking out of a meeting mid-sentence.

# Characters

32 named characters carry the satire: seven executives, a five-seat board, two journalists, two rival CEOs and 16 hero clients. Generated clients fill the gaps between them, built from the same classes and traits. Every fear is written by slot: the Fears column names the Classic track, and in an alternate world the client fears whatever fills that slot (The Grey Goo for The Bloom, The Long Shade for Superstorm Season, The Kessler Rain for The Optimizer, The Cloud Strike for The Hush).

## You

The Founder is player-named and never shown in full: you exist as a desk, a signature on memos and a voice in meetings. At the start you pick one background, which shapes the opening hour.

| Background | Bonus | Cost |
|---|---|---|
| Ex-Realtor | Lead quality +1 step | Scheme heat +10% |
| Ex-Spook | Scheme heat −15% | Staff start with 10 less loyalty |
| Ex-Engineer | A free Inspector on every walkthrough | Status rooms cost 10% more |

## Executives

| Name | Role | Personality | Arc | Risk |
|---|---|---|---|---|
| Avery Lin | Sales and Concierge | A relentless closer who calls bunkers “residences” | Slowly learns which clients are worth saving | Overpromises Days Sealed |
| Ruth Abernathy | Engineering | Ex-mining engineer, dry, the only person who reads scrubber specs | The conscience of the company; key to the Last Resort ending | Whistleblower if loyalty falls below 30 |
| Dr. Hana Sato | R&D | A real scientist funding real science with doom money | Discovers the tipping-point maths and asks if the grants are worth it | Quits if two tracks collapse |
| Theo Lisk | Special Projects | Ex-intelligence, cheerful, unbothered by anything | Ambition: with low loyalty he runs schemes of his own in chapter 4 | Rogue schemes and heat |
| June Okafor | Communications | A spin artist who believes every line she writes | “Everything Is Fine” goes from slogan to meme to personal mantra | Burns out during Hearings |
| Marcus Dell | Legal | An NDA virtuoso | Keeps a dossier on you as insurance | Holds leverage over you if you name a scapegoat |
| Bo Kowalski | Security | Ex-military, loyal to whoever signs the cheque | The sieges make him a hero or a liability | Armory heat |

## The board

| Member | Seat | Personality | Arc |
|---|---|---|---|
| Cornelius Vane III | Chair | Third-generation old money who calls the apocalypse “the next market cycle” | Wants a legacy and breaks with Bryce in chapter 4 |
| Bryce Kettering | Growth capital | A venture capitalist who says “escalate” like a breathing exercise | If board confidence is below 40 in chapter 4, he forces a vote to replace you, which passes if three members’ own confidence is below 50 |
| Dame Ottilie Faraday | Defence money | Heiress to a missile fortune, charming and terrifying | Lobbies for Atomic Standoff as the Final Product |
| Priya Sandoval | Risk and audit | A former actuary and the only adult in the room | Becomes your ally in the Last Resort ending, or the vote that ousts you |
| Mr. Gray | Proxy seat | Silent, polite, always on the call with his camera off | Reveals The Table at 4:30, commissions the Ark, and may offer you A Seat at the Table |

## Journalists

| Name | Outlet | Personality | Mechanics |
|---|---|---|---|
| Iris Kemp | Investigative reporter | Patient, precise, incorruptible | A trust track from 0 to 5. Interviews, honest answers and a leaked dossier raise it; at 3 or more, with Ruth loyal, the Last Resort ending opens |
| Gil Marsh | Host of The Marsh Report podcast | Loud, half-right, enormously popular | His stories raise tension as well as heat, and he can be fed disinformation: Distraction counts double on him |

## Rivals

| Name | Company | Personality | Arc |
|---|---|---|---|
| Seraphine Ash | Halcyon Vaults | Old guard, sells “heritage resilience” | Arrives at 2:55 and courts dynasties; can be beaten, merged or bought |
| Kai Rook | Bunkr | A 24-year-old founder selling bunker subscriptions by app | Goes public at 4:45; Bunkr runs on whatever fills slot 4, which ends badly |

## Hero clients

| Client | Class | Traits | Style | Fears | Story beat |
|---|---|---|---|---|---|
| Gerald Pemberton-Wick | C1 | Gourmand, Penny-Pincher | Retro-Atomic | Atomic Standoff | Haggles over every cork; his wine count is the running joke and the game’s last line |
| Dana and Doug Fairweather | C1 | Pet Parent | Biophilic | The Bloom | Want an underground dog park for three retrievers |
| Marla Quist | C1 | Paranoid, Engineer | Brutalist | Every track | The tutorial for Survive-tier inspection; tells peers when you cut corners |
| Skyler Thorne | C2 | Health Optimizer, Control Freak | Tech-Minimal | The Optimizer | His company built whatever fills slot 4 (The Optimizer, or the satellites behind The Kessler Rain), and he wants cryo before anyone |
| Lexi Monroe | C2 | Influencer | Maximalist Kitsch | The Bloom | Livestreams her walkthroughs: leads and leaks in equal measure |
| Ravi Castellanos | C2 | Knows Too Much | Tech-Minimal | The Optimizer | An ex-Bunkr engineer who knows exactly what you’re doing |
| Juno Achterberg | C2 | Doomer Romantic | Biophilic | Superstorm Season | Wants a Window Wall playing the last sunset on a loop |
| Lady Eleanor Ashcombe | C3 | Dynast, Feuding with the Whitlocks | Gilded | Atomic Standoff, The Pitchforks | Three generations under one roof; the sample contract |
| Baron Felix von Strelitz | C3 | Collector | Gilded | Atomic Standoff | Half his art vault is forged and the other half is stolen |
| Harold and Bunny Whitlock | C3 | Feuding with the Ashcombes, Gourmand | Gilded | The Pitchforks | Buy the condo unit directly above the Ashcombes, on purpose |
| Rex Calloway | C4 | Control Freak, Paranoid | Brutalist | The Pitchforks | A shipping magnate whose private army wants the override codes |
| Imelda Sorrentino | C4 | Gourmand, Collector | Maximalist Kitsch | Superstorm Season | Wants her villa rebuilt underground, fountain included |
| Castor and Pollux Drummond | C4 | Feuding with each other | Tech-Minimal and Gilded | The Hush | Twins who demand one shelter in two incompatible styles |
| Odette Lamarr | C4 | Secretly Broke, Dynast | Gilded | Atomic Standoff | Can’t pay her retainer, so for once you hold the leverage |
| The Admiral | C5 | Control Freak | Brutalist | Atomic Standoff | The Table’s security chief; wants the Ark’s armoury |
| The Philanthropist | C5 | Philanthropist, Health Optimizer | Biophilic | The Hush | Funds the Ark’s Schoolhouse, then asks who the school is for |

## Story arcs

1. **Iris Kemp’s investigation (chapters 2–5).** Her first call at 1:00, her first story in chapter 2 or 3, Hearings if heat allows, and the dossier choice in chapter 5.
2. **Ruth’s conscience (chapters 3–5).** She asks to see the Special Projects budget during the first breach, then quietly upgrades Survive tiers over budget. In chapter 5 she walks out, blows the whistle, or joins you in the Last Resort.
3. **Theo’s ambition (chapters 3–4).** With loyalty below 40 he runs Sabotage without approval, then sides with Bryce. Below 30 in chapter 5, he triggers Somebody Else’s Apocalypse.
4. **The board war (chapter 4).** Bryce against Cornelius, a coup vote, and Priya deciding which side you’re on.
5. **The Table (4:30 to the end).** Mr. Gray, the Ark commission, and the slow realisation that the Final Product may have been their plan all along.
6. **Gerald’s wine (the whole campaign).** A running gag that pays off in the last epilogue card.

# Midnight and endings

Midnight ends the campaign. Engineer it on your terms in chapter 5 for the best grade, or lose control earlier and watch unready shelters get graded anyway. Twelve endings cover success, failure, two peaceful exits and a handful of betrayals.

## Two roads to Midnight

| Road | Trigger | What you control |
|---|---|---|
| Engineered | Project Lights Out (4:50), The Final Product (5:30) and a 3-of-5 board vote | Which track or linked pair breaches, and the date |
| Uncontrolled | The Doom Clock reaches zero, or the Final Countdown runs out after a second collapse | Only the last 4 weeks |

An engineered Midnight names one track, or two linked tracks for a combined apocalypse with harsher requirements and a bigger payout. You set the date 4 to 12 weeks ahead. Until then, Last Call sales run at triple the panic premium and heat rises 3 a week because everyone is watching. You can call it off once, at −20 board confidence.

## The Midnight sequence

1. **Last Call:** final sales at triple premium while you plan the seal order.
2. **Seal Order:** two in-game weeks to get every client into their shelter by convoy or helicopter. Distance, sieges and high-leverage clients pushing in line can make people late, or lost.
3. **The Dark:** the world goes black. Each shelter runs its sealed simulation over the apocalypse’s required duration as a time-lapse of its pixel cutaway, with event cards for failures, feuds, births and mutinies.
4. **Epilogues:** one card per client.
5. **The Ledger:** company totals and a final line.
6. **The ending card.**

## Required sealed duration

| Apocalypse | Days Sealed required | Critical ratings | What goes wrong under seal |
|---|---|---|---|
| Atomic Standoff | 730 (2 years) | Blast 4, seal 3 | Fallout through a cheap airlock; the diesel runs dry |
| The Bloom | 420 | Seal 4, decon, HEPA | Spores in the ducts; a germaphobe locks himself in the cinema |
| Superstorm Season | 540 | Flood seal 3, power independence | Lower floors flood; solar masts are torn away |
| The Optimizer | 1,095 (3 years) | Faraday Room, analog backups | Smart locks open for the AI; the AI butler stops serving dinner |
| The Hush | 1,460 (4 years) | Food production, Seed Vault | Pantries run dry in year two without vats or aquaponics |
| The Pitchforks | 365 | Security 4, concealment | Sieges at visible shelters; the staff left outside knock |
| The Grey Goo | 600 | Seal 4, ceramic lining, EMP Pulse Room | Goo gets into the ducts and eats the scrubbers; the gold taps go first |
| The Long Shade | 900 | Heating, thermal cladding, grow lights | Pipes freeze, and the Infinity Pool becomes an ice rink |
| The Kessler Rain | 480 | Blast 3, debris cap, Radio Room | The helipad is flattened; satellite-linked locks stop answering |
| The Cloud Strike | 1,200 | Water production and a Water Vault | The pool is drained first, then the wine cellar |
| Combined (two tracks) | The longer duration plus 180 | Both sets | All of the above, at once |

## Grades

| Grade | Clients surviving | Also needs | Tone of the final press release |
|---|---|---|---|
| Platinum | 90% or more | An engineered Midnight, no collapses, heat under 75 | “The market has spoken” |
| Gold | 75–89% | — | Smug |
| Silver | 50–74% | — | Defensive |
| Bronze | 25–49% | — | Lawsuits from beyond |
| The Gerald | Under 25% | — | Named for the client whose wine ran out first |

An uncontrolled Midnight drops the result one grade.

## Endings

| Ending | Trigger | What happens |
|---|---|---|
| Lights Out | Engineered Midnight | You sold the end of the world on schedule, and it is graded |
| Off the Rails | Uncontrolled Midnight | The apocalypse you didn’t plan, graded one step down |
| Ousted | Board confidence reaches 0 | Bryce’s protégé replaces you; the epilogue shows him triggering Midnight within a year |
| Indicted | Heat stays at 95 or more for 4 weeks | A perp walk; your shelters become evidence |
| The Last Resort (secret) | Iris Kemp trust 3+, Ruth Abernathy loyalty 70+, and you leak the full dossier while any track is at Brink | The company falls, the Doom Clock rolls back 5 minutes, and every shelter you built opens to the public. The clients are furious |
| Overtime | Quarter 12 ends without Midnight | Endless quarters with the quota rising 30% each, until Midnight or ouster; scored by quarters survived |
| Regrettably Stable | In chapter 5, every open track stays below 20 for 13 straight weeks while you still hit the quota. The hardest ending in the game | The board calls it a failure of imagination. You become a mid-sized firm that maintains very nice basements, and Iris Kemp’s next story is about potholes |
| Under New Management | The Pitchforks is the first track to collapse, and sieges take half your sites | The public moves into the shelters you built while your clients queue outside. Gerald runs the soup kitchen and is, for the first time, beloved |
| A Seat at the Table | The Ark is finished, you hold 3 Favours with Mr. Gray, and you accept his offer at Midnight | You abandon the company for a berth in the Ark. It is in the staff quarters: The Table needed someone who knows how the scrubbers work. Graded on the Ark alone |
| Locked Out | Three or more clients reach Cut-in and you accept their board seats | Your clients take over the board, engineer Midnight on a date of their choosing, and leave you off the door codes |
| Somebody Else’s Apocalypse | In chapter 5, Theo Lisk’s loyalty falls below 30 before you set a Midnight date | Theo breaches a track you weren’t watching. There is no Last Call, and your shelters are graded as they stand, two grades down |
| The Clouds Won | Cloud Strike worlds only: you contain The Cloud Strike three times with Collective Bargaining | The clouds’ union expands to every kind of weather, and the Doom Clock freezes while the sky negotiates. You sign the first labour agreement with the atmosphere. Rain resumes on Tuesdays |

## Epilogue cards

Each client gets one line, generated from their traits and what happened under seal.

| Client | Sample outcome |
|---|---|
| Gerald Pemberton-Wick | Survived. The wine ran out in month four, and he is still talking about it. |
| Lady Eleanor Ashcombe | Survived with all three generations. Has not spoken to the Whitlocks upstairs in 700 days. |
| Skyler Thorne | Revived from cryo on schedule by an AI that has opinions now. |
| Rex Calloway | His private army took the override codes in week six. He is now a guest in his own bunker. |
| Lexi Monroe | Livestreamed the apocalypse to 11 followers. |
| Dana and Doug Fairweather | All three dogs made it. So did the Fairweathers, mostly thanks to the dogs. |
| Castor and Pollux Drummond | Divided the shelter down the middle with tape. Both halves failed separately. |
| Odette Lamarr | Never paid the retainer. Survived anyway. |

## The Ledger

The final screen lists clients saved, staff saved and staff left outside, revenue, RP, scars, final heat and the world’s remaining population, then one closing line. The default reads: “Humanity: down 99.7%. Shareholder value: record high.” The Last Resort ending has its own: “Company value: $0. People sheltered: 41,000.”

# Economy and tuning

These are starting values for the first balance pass. They are set so the quota outgrows a calm world by quarter 5, and so the Brink trade pays only for players who keep paying attention.

## Time

| Unit | Value |
|---|---|
| In-game week | 120 seconds at 1× |
| Quarter | 13 weeks: 26 minutes at 1× |
| Speeds | Pause, 1×, 2×, 4× |
| Campaign | 12 quarters: 5 to 6.5 hours real time at mixed speed |

## Currencies

| Currency | Earned by | Spent on |
|---|---|---|
| Cash | Contracts, retainers, change orders, government contracts, kickbacks, investment rounds | Digging, rooms, crews, staff, schemes, departments, sites |
| Research points (RP) | Crisis grants by band, R&D levels | Research nodes, crash programs, intel |
| Favours | Fulfilled directives, one per member each time | Securing that member’s vote once |

The meters (heat, board confidence, reputation, leverage, tension, Fear and the Doom Clock) are defined in their own sections.

## The quota

Q is the revenue target in $M for quarter n: $6M in Q1, about $13M in Q4, about $38M in Q8 and about $108M in Q12. Overtime keeps the same growth.

## Contract pricing

Base is the shelter’s dig and room cost plus a 40% margin. p is the panic premium for the client’s fears in their region, scaled by exposure (Core loop and World canvas sections). c is the class multiplier: 1.0 for C1, 1.1 for C2, 1.2 for C3, 1.35 for C4 and 1.5 for C5. Penny-Pinchers knock 15% off.

## Build and running costs

| Item | Cost |
|---|---|
| Survive rooms | $0.2–1.5M each; the Micro-reactor is $25M |
| Comfort rooms | $0.3–1M |
| Status rooms | $0.8–4M; the Infinity Pool is $6M |
| Delusion rooms | $2–12M; the Mansion Replica Floor is $20M |
| Fit-out time | 1–3 crew-weeks for small rooms, up to 8 for the largest |
| Crews | $0.1M per crew per week |
| Operating staff | $0.05M per person per week |
| Department levels 2 / 3 / 4 / 5 | $2M / $4M / $8M / $16M |
| Sites by region cost | Low $2M, medium $5M, high $12M, very high $25M |

Dig costs per stratum are in the Shelter canvas section.

## Research costs

| Tier | RP | Cash | Typical time to fund at that chapter’s income |
|---|---|---|---|
| 1 | — | $0.5–2M | Bought outright, one week to install |
| 2 | 40–60 | $1–3M | 5–7 weeks |
| 3 | 120–220 | $4–8M | 4–6 weeks |
| 4 | 250–350 | $12–20M | 5–6 weeks |
| 5 | 200–400 | $30–80M | 4–6 weeks |

## RP income by chapter

| Chapter | R&D level | Typical grant mix | RP per week |
|---|---|---|---|
| 1 | None yet | None | 0 |
| 2 | 1–2 | One track at Boil, one at Simmer | 9–12 |
| 3 | 3 | One at Brink, two at Boil, one at Simmer | 35–40 |
| 4 | 4 | Two at Brink, two at Boil, two at Simmer | 55–60 |
| 5 | 5 | Three at Brink, two at Boil | 65–75 |

## Tuning constants

The single list engineers tune from. Each value is explained in the section named beside it.

| Constant | Value | Explained in |
|---|---|---|
| Momentum carried into the next week | 75%, with a quarter released as tension each week | Pushback systems |
| Fear | +2 per point of tension gained, +10 per breach week, −15% per week | Core loop |
| Tipping point | 90 plus an offset from −8 to +4 | Crises and tipping points |
| Tipping-point band shown | ±10, then ±5, ±3, ±1 with intel | Crises and tipping points |
| Scar per contained breach | Tipping point −3 | Crises and tipping points |
| Containment window | 6, then 4, then 3 weeks | Crises and tipping points |
| Breach spillover, strong / medium / weak | +6 / +3 / +1.5 momentum per week | Crises and tipping points |
| Collapse shove, strong / medium / weak | +15 / +8 / +4 tension | Crises and tipping points |
| Doom Clock | 15 minutes, tension sum divided by 40 | Crises and tipping points |
| Heat decay | 1 per week plus 1 per Communications level, floored at Notoriety (0 to 30 by company tier) | Pushback systems |
| Whistleblower chance | 25% per quarter when eligible | Company and board |
| Condo gossip | 10% per week toward the highest resident | Pushback systems |
| Retainer | 4% of build price per quarter | Clients and needs ladder |
| Change-order markup | 15% | Clients and needs ladder |
| Brink costs | +1 heat per week per Brink track; volatility up to ±3, rising to ±6 at The Last Resort | Core loop |
| Repeat calming | −25% effect per use on the same track within 8 weeks | Core loop |
| Fragility | Every tipping point −1 per floor minute; never below 72 | Crises and tipping points |
| Shelter-in-place test | Pass: reputation +2. Fail: reputation −5, client leverage +15 | Crises and tipping points |
| Leads | 0.5 a week where you own a site, plus Fear × exposure ÷ 50; unworked leads wait 4 weeks | World canvas |
| Reputation | 0–100, starting at 40 | Pushback systems |
| Siege strength | Pitchforks tension ÷ 20, +1 per visible surface feature | Pushback systems |
| Loyalty drivers | Set per head; raises +5, broken promises −10 | Company and board |

## Balance targets

| Metric | Target | Main knob |
|---|---|---|
| Campaign length | 5 to 6.5 hours median | Week length, research costs |
| Quarters with the quota hit | About 75% | Quota growth |
| Players with a natural first breach by 2:30 | 60% | Brink drift, wildcard size |
| First breaches contained | 70% | Containment points, window length |
| Players holding a track at Brink in chapter 3 | Over 50% | Brink grants against holding cost |
| Median heat in chapter 3 | 40 | Scheme heat, decay |
| Engineered versus uncontrolled Midnight, first campaign | 60 / 40 | Tipping-point range, spillover |
| Median grade | Silver | Days Sealed requirements |

## Telemetry

Log every week: tension and momentum per track, heat, cash, RP, board confidence and leverage per client. Log every event: schemes, breaches, containment results, collapses, quota results, directive results, unlock times and the ending. The unlock times are the main check against the Pacing section’s targets.

# Art, audio and UI

Pixel art on a strict 16-pixel grid keeps hundreds of rooms legible, and each needs tier has its own trim colour, so the upside-down ladder can be read at a glance across a whole cutaway. The style is 1960s civil-defence signage meeting luxury real-estate brochures.

## Pixel spec

| Element | Spec |
|---|---|
| Tile | 16 × 16 px; every room, door and fixture snaps to it |
| Characters | 16 × 24 px sprites: a 4-frame walk, a 2-frame idle and 6 job animations |
| Rooms | Interiors 3 tiles (48 px) tall, with a 16 px slab between floors |
| Palette | One fixed 48-colour palette, and nothing outside it |
| Scaling | Integer only: 2× at 1080p, 3× at 1440p, 4× at 4K |
| Outlines | A 1 px dark outline on characters only, so rooms read as flat backdrops |
| Light | Drawn as palette ramps, never real-time lighting |
| UI type | Pixel fonts at 8 px for body text and 16 px for headers, plus a clean-font option |
| Animation budget | One ambient loop per room, up to 6 frames |

## Tier colour language

| Tier | Trim | Materials | Light |
|---|---|---|---|
| Survive | Hazard yellow and stencil black | Concrete, steel, rivets | Cold fluorescent |
| Comfort | Warm walnut | Wood, wool, rugs | Amber lamps |
| Status | Gold leaf and emerald | Marble, brass, velvet | Spotlights and picture lights |
| Delusion | Iridescent violet | Mirror, chrome, holograms | A slow dithered shimmer |

The six styles re-skin materials and props, but the tier trim always stays, so a Brutalist art vault still reads as Status. The Prestige overlay uses the same four colours.

## The world canvas look

- **A situation-room table:** flat pixel continents on a dark CRT-green grid, faint scanlines, and a paper headline ticker along the bottom.
- **Track colours:** Atomic Standoff orange, The Bloom chartreuse, Superstorm Season cyan, The Optimizer magenta, The Hush honey amber, The Pitchforks torch red. Each also has its own pattern (hatching, dots, waves, grid, hexes, flames) for colour-blind players. The alternates are The Grey Goo silver, The Long Shade frost white, The Kessler Rain steel violet and The Cloud Strike sky blue, patterned with scales, snowflakes, streaks and droplets.
- **States on the map:** hotspots pulse, breached regions flicker, and collapsed regions turn to smoking ash tiles.

## UI layout

- **Top bar:** the Doom Clock in the centre and always visible; cash and RP on the left; heat, reputation and board confidence on the right.
- **Left rail:** six track gauges, each with its band, momentum arrow, Fear needle and estimated tipping-point band.
- **Right rail:** the selected client or contract card, with leverage and Days Sealed.
- **Bottom bar:** build tools on the shelter canvas, schemes on the world canvas.
- **Canvas switch:** the Tab key swaps canvases with a 0.4-second elevator transition; both share the top bar and rails.
- **Overlays:** keys 1–9 on the shelter canvas toggle Air, Water, Power, Noise, Seal, Blast, Prestige, Days Sealed and Client Gaze.

## Accessibility

Colour-blind patterns on every track, two text sizes plus a clean-font option, full key rebinding, pause at any time, configurable auto-pause, reduced flashing for breach alerts, and subtitles for every voice line.

## Audio

| Layer | Treatment |
|---|---|
| Music | Lounge muzak that detunes and slows as the Doom Clock falls; each track’s leitmotif bleeds in once it reaches Boil |
| The Doom Clock | A soft tick under everything, speeding up below 5 minutes |
| Rumbles | A low sub tone when a track is within 5 of its real tipping point |
| Board room | Polite jazz, coffee cups, and one cough from Mr. Gray’s muted line |
| Shelters | A hum per life system that changes when a system fails |
| Midnight | Silence, then only the ventilation hum |

## Writing voice

Corporate euphemism throughout: bunkers are “residences”, schemes are “market activation” and breaches are “volatility events”. Headlines are deadpan, and the joke always lands on the powerful.

| Context | Sample line |
|---|---|
| Board memo | “Q3 outlook: the world is regrettably stable.” |
| Everything Is Fine ad | “Relax. Someone is handling it.” |
| Gerald on a walkthrough | “Is that a scrubber? Never mind. Where’s the cellar?” |
| Breach headline | “Experts Urge Calm, Then Leave Early” |
| Ruth, chapter 3 | “I read the budget. You’ve been selling the weather.” |

# Production plan

A 13-week plan reaches a shippable 5-hour campaign by keeping the world layer to cards and meters and spending the craft budget on the shelter grid. Each phase ends on a gate that must pass before content scales up.

## Phases

1. **Weeks 1–2, prototype.** The grid, digging, 10 Survive and Comfort rooms, the air, water and power simulation, one track, one client and one scheme. Gate: the build-sell-stoke loop is fun for 15 minutes in grey boxes.
2. **Weeks 3–5, vertical slice (chapters 1–2).** The pixel art pipeline, 25 rooms, two tracks, heat and Iris Kemp, board meetings, the Condo Silo and 60 event cards. Gate: testers reach 1:50 and want to keep going, and they read Days Sealed and Satisfaction without a tutorial.
3. **Weeks 6–9, content build (chapters 3–4).** Brink, tipping points, containment, collapse and dominoes, leverage, Legal and Security, four more tracks, rooms up to 61, 160 more cards and the rivals. Gate: most testers hit a first breach between 2:10 and 2:30, and 70% contain it.
4. **Weeks 10–11, the ending (chapter 5).** The Ark, the Final Product, the seal order, the Midnight simulation, the epilogue generator, twelve endings and Overtime. Gate: a full campaign runs from start to Midnight without blockers.
5. **Week 12, balance.** A telemetry pass against the Pacing and Economy targets.
6. **Week 13, polish and launch.** Audio, accessibility, store assets and the Steam page.
The four alternate tracks and six extra endings add an estimated 3 to 4 weeks: 12 rooms, 8 schemes, 120 event cards, 4 Midnight rule sets and 6 ending sequences. Either plan a 17-week schedule, or ship the Classic world in 13 weeks and release the alternates and their endings as the first free world update.

## Content counts

| Content | Full game | Needed for the vertical slice |
|---|---|---|
| Rooms and fixtures | 73 | 25 |
| Threat tracks | 10 (6 per campaign) | 2 |
| Schemes | 37 | 6 |
| Event cards | 340 | 60 |
| Unlocks | 48 | 19 |
| Hero clients | 16 | 6 |
| Named characters | 32 | 12 |
| Styles | 6 | 2 |
| Regions | 8 | 2 |
| Endings | 12 | 0 |

## Cut list

If the schedule slips, cut in this order:

1. Overtime moves to a post-launch update.
2. Styles drop from 6 to 3: Brutalist, Gilded and Tech-Minimal.
3. The Compound product goes; the Ark stays.
4. Regions drop from 8 to 6.
5. Tracks drop from 6 to 5, folding The Hush into Superstorm Season as crop failure.
6. Event cards drop from 220 to 150.
Never cut the hidden tipping point, the two scores, containment windows, the board or Midnight. They are the game.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The world layer grows into a second game | Schedule | It stays cards, meters and map states, with no unit simulation |
| The hidden tipping point feels unfair | Players quit after a first breach | Rumbles, intel, a revealed tipping point after each breach, and a generous first window |
| Late-game busywork across eight sites | Fatigue in chapter 4 | Blueprints, auto-retrofits by Ruth’s crews, batched walkthroughs |
| Tone misfires | Reviews and platform risk | Fictional threats, satire aimed at excess, and a sensitivity read on every card |
| Five interlocking meters are hard to balance | Long tuning | Telemetry from week 3 and one constants table |
| Read as “Evil Genius with bunkers” | Weak differentiation | The client economy and the upside-down ladder lead every trailer and the store page |
| Pixel art volume | Art schedule | Shared room templates with tier trims and styles built as palette swaps |

## Open questions

- ☐ Final title: Apocalypse Tycoon, or something more ownable such as Last Resort?
- ☐ Is Steam Deck verification in scope for launch?
- ☐ Is the Midnight simulation watch-only, or do players make a few choices under seal?
- ☐ Should the Founder be a visible character with a portrait?
- ☐ Voice acting for the board, or text barks only?
- ☐ Does Overtime ship at launch or as the first update?

# Systems review

The design mostly holds together, but five joins on the main loop are loose enough to break the edge game: the scheme maths, the fear model, a Brink that is too safe, a Doom Clock floor with no teeth, and survivability that only counts at Midnight. All fourteen fixes are now in the GDD, and the open decision was settled: references by slot, Classic and alternate rooms side by side, and the fan-out rule met for every alternate.

## What already integrates well

The pressure inversion works: the quota pushes escalation, grants reward it and breaches punish it, with no scripted push needed. The two-score ladder ties every room to both canvases, and shrinking containment windows give the late game a natural squeeze. Slot-based alternates add variety without touching pacing.

## The system map

System map: 12 systems, 9 weak joins marked

The main loop runs clockwise from the quota. It shows the design as reviewed: the dashed link is now defined by the Fear meter (Core loop) and the demand rule (World canvas).

## Findings

| # | Finding | Fix | Where | Severity | Status |
|---|---|---|---|---|---|
| 1 | Scheme momentum delivers four times its stated value. With 75% carry-over added in full each week, a +8 Leak adds 32 tension, Sabotage adds 100, and one Everything Is Fine holds a Brink track for about five months. | Release a quarter of momentum as tension each week, so a scheme’s value is the total tension it delivers | Pushback systems | High | Resolved |
| 2 | Fear and tension are the same meter. Leads and prices both follow the band, so a track held at Brink sells forever and fear fatigue never bites. | A separate Fear meter per track that rises only when tension rises and decays 15% a week. Fear sets lead volume; the band sets price | Core loop | High | Resolved |
| 3 | Brink is the safest place to be. It pays the top grants, government contracts and calming schemes both lower heat, and wildcards (5% of weekly draws) rarely land. | Brink tracks add 1 heat a week and roll their own weekly volatility; repeat calming on one track loses 25% per use within 8 weeks | Core loop | High | Resolved |
| 4 | The Doom Clock floor has no teeth. It caps the clock but cannot cause Midnight before two collapses, so “danger is permanent” is cosmetic. | Fragility: each minute the floor moves lowers every track’s tipping point by 1 | Crises and tipping points | High | Resolved |
| 5 | Survivability only matters at Midnight. Players can sell prestige-only bunkers for five hours and retrofit in chapter 5. | Shelter-in-place tests during breaches, scored against that track’s Midnight requirements | Crises and tipping points | High | Resolved |
| 6 | The two canvases connect only in prose. Lead volume and quality are spread across Sales, the Showroom, reputation, referrals and exposure with no single rule. | One demand rule: leads per region from Fear and exposure, plus a baseline and referrals | World canvas | Medium | Resolved |
| 7 | Board confidence is one number, yet members react one by one (Priya −10, Bryce −2), and votes have no rule. | Per-member confidence, averaged for the board; a member votes yes at 50 or more, or for a Favour | Company and board | Medium | Resolved |
| 8 | Loyalty runs backwards for Theo. Every head loses loyalty to dirty schemes, so the Special Projects chief resents his own job and Somebody Else’s Apocalypse fires for the wrong reason. | Loyalty drivers per head | Company and board | Medium | Resolved |
| 9 | Heat flattens out mid-game. Decay reaches 6 a week at Communications 5, so Hearings rarely trigger. | Notoriety: a heat floor that rises with company tier | Pushback systems, Economy and tuning | Medium | Resolved |
| 10 | Rules lean on things never defined: reputation, the Inspector, and siege outcomes, which the Under New Management ending depends on. | Define all three | Pushback systems | Medium | Resolved |
| 11 | Alternate worlds break fixed references. Rival favourites, hero-client fears and fan-outs assume the Classic six, and swapping row 31 removes Protein Vats from Cloud Strike worlds. | See the open decision below | World canvas, Characters, Research and unlocks | Medium | Resolved |
| 12 | Investment rounds could count toward the quota and cover a missed quarter. | Rounds are cash, never revenue | Company and board | Low | Resolved |
| 13 | A Seat at the Table can become impossible: Mr. Gray appears at 4:30 and directives come from two random members. | Mr. Gray issues a directive at every meeting after the reveal | Company and board | Low | Resolved |
| 14 | Chapter 2 is starved of RP: the 1:10 Status unlock needs 50 RP while income is about 5 a week. | A 60 RP research budget at the Boutique tier-up | Company and board | Low | Resolved |

## How the fixes fit together

Fixes 1–4 work as a set. Once momentum delivers what it says, Fear separates selling from holding, Brink costs heat and attention, and fragility makes every crossing permanent. Tune them together: changing one alone will throw the others off, and the holding-cost and RP-income targets in Economy and tuning should be re-checked once they land.

## The open decision

Finding 11 needs a design call. Three changes would fix it, smallest first:

1. Define rival favourite tracks and hero-client fears by slot rather than by name, so every world reads correctly.
2. Keep the Classic counter rooms (Protein Vats, Faraday Room and the rest) as general research in every world, and add each alternate’s rooms on top.
3. Give each alternate a third counter room and a full fan-out chain, to meet the GDD’s own fan-out rule.
**Decided: all three.** Fears and rival favourites are written by slot, the Classic counter rooms unlock in every world, and each alternate now has three counter rooms and a full fan-out chain.
