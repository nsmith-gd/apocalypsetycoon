# Board re-scope (#86)

Built from `docs/board-audit.md` (#85) and `docs/gdd-docx-reconciliation.md` (#83). Agents can't edit the Ballast board, so this file and **`.ballast/proposed-tickets.json`** (the same 33 tickets as data, ready to import) are the change set. IDs R1–R33 are placeholders; Ballast assigns real numbers.

Every new ticket is **one session** and sits **at L0, or one level above what is built (never above L1)**, so none needs a gate the director hasn't passed. Each names the files to start from and a checkable done-condition.

## Changes to existing tickets

| Ticket | Change | Why |
|---|---|---|
| #24, #39 (art) | **Covered by #9.** Close #24 and #39; their remaining scope becomes the per-section L0 art tickets R27–R33. | #9 delivered the palette, style guide, shelter, map and UI tilesets. Three open "art" tickets overlapped it. |
| #84 | **Covered** (merged). Close. | It is "Changes to #37: Changes to #28"; #37 and #84 are both merged, and the shelter-life work lives in the tile bunker. |
| #37 | **Covered** (merged). Close if still open. | Same. |
| #72 | **Covered by #73.** Close, or rescope to "GDD layout for the company panel" (L1, after the director passes the company L0). | #73 shipped the greybox company panel (tier chip, departments, caps). |
| #53 | **Rescope:** "Move the guest archetypes into one roster data file and use the hero clients' slot fears for named guests." One session. | #56 shipped 12 archetypes with traits; #75 shipped the 16 hero clients. |
| #54 | **Rescope:** "Add conditions and variables to dialogue trees (a choice shown only if a guest fear or world state holds)." One session. | #56 shipped a tree runner; #60 shipped the session interface. |
| #36 | **Rescope:** "Extend `src/research/tree-data.js` to the GDD's 48 unlocks and `src/shelter/bunker-catalog.js` to the 25 slice rooms." Split in two if it overruns. | The data files already exist (#16, #28/#84). A third catalog would duplicate them. |
| #18 | **Rewritten to start now (R24):** board members and directives in greybox on the current $K quota. The money rescale moves to its own ticket (R25), after R24. | It waited on a money rescale no ticket owned. |
| #67 | **Rewritten to start now (R26):** collapse reactions with a stub member list, swapped for R24's members when they land. | It waited on #18's board members. |
| #64 | **Point it at `src/config/tuning.js`** (`BREACH.sources`); the GDD values are in the Crises section. Claimable now. | After #77, the values live in one table. |
| #65 | **Claimable now:** the domino data is in `docs/gdd-figures/04-domino-map.png`, and the 4 mismatches are tabled in the reconciliation. | It was blocked on a picture-only data source. |
| #59, #61 | **Ballast to check against #58 and #60**, then close or rescope. | They sit in the social-layer batch that #58 and #60 completed. |
| #20–#24, #30, #32, #34, #38–#49 | **Not visible to agents.** If they are feature-level tickets, the per-section tickets below are their one-session children. Close any that duplicate them. | See #85. |

## Every focus section has claimable work

| Section | In game today | Claimable (one session each) |
|---|---|---|
| Campaign loop, time scales and session controls | Clock, speeds, pause, quarter checkpoint save | R1 chapter boundaries, R2 focus pause and controls card |
| Shelter grid, digging and construction flow | Tile bunker, strata, crews, research gating | R3 hand-over checklist, R4 why a job waits; art R32 |
| Doom Clock, floor, fragility and Final Countdown | Floor, fragility, countdown in the HUD | R5 apocalypse forecast; art R28 |
| Heat, journalists, reputation and client leverage | Heat, leverage, relief in game; journalists are demo-only | R6 journalists in the campaign, R7 weekly heat decay and Notoriety |
| Schemes: escalate, calm, influence and intel | 6 stand-in schemes on the map; the 37-scheme GDD catalog is unused | R8 GDD catalog on the map, R9 Intel I; art R30 |
| World map, regions, sites, Fear and lead demand | Map sales, Fear, leads, HQ site only | R10 buy a second site, R11 GDD region names; art R27 |
| HUD, rails, canvas switch and quarter report | HUD, ledger rail, Tab switch, quarter report | R12 richer quarter report |
| Threat tracks: bands, momentum, tipping points and sieges | Tracks, tips, breaches in game; bands and momentum only in an unused module; sieges demo-only | R13 momentum, R14 bands and drift, R15 sieges; art R29 |
| Design layer: styles, Blueprints, Showroom, Client Gaze and photo mode | Two styles on the old grid only | R16 styles on the bunker, R17 Blueprints, R18 Showroom, R19 Client Gaze, R20 photo mode; art R33 |
| Clients, needs ladder and contract lifecycle | Client data and orders demo; leads | R21 contract greybox, R22 Satisfaction |
| Weekly event deck and rival companies | Weekly card greybox (#74) | R23 rivals; art R31. More cards wait on the deck's L0 gate. |
| Company and board / Crises / Economy | Tiers (#73), crises, tuning (#77) | R24 board greybox (#18), R26 collapse reactions (#67), R25 money rescale |

## Claimable count

- **New one-session tickets: 33** (26 gameplay, 7 art), all at or below L1, none waiting on another ticket except R25 (after R24).
- **Existing tickets made claimable: 6** (#18 via R24, #67 via R26, #64, #65, #53, #54), plus #36 after its rescope.
- **To close as covered: 5** (#24, #39, #37, #84, #72).
- With about 8–10 agents running, every agent has at least three claimable tickets in a focus section, and no two tickets touch the same files' core logic, apart from R13/R14 (both in the crisis tracks: take them in order) and R24/R25.
