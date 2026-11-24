# GDD catalog as data (#36)

The GDD's room, product and unlock tables, one file each. Pure data, no DOM; `tests/catalog.test.js` checks it.

- `rooms.js` — `GDD_ROOMS`: all 73 rooms and fixtures (Survive 29, Comfort 10, Status 13, Delusion 9, 12 alternate-world
  counter rooms). Size, unlock time, provides/draws (GDD text + `stats` in numbers), GDD cost (exact where the GDD
  gives one, otherwise placed in the tier's price range by unlock time). Links to the live tables: `objects`
  (bunker objects), `roomType` (grid room recognition), `amenity` (client-package rooms), `track` (alternates;
  ids match `COUNTER_ROOMS`). `roomsForRoster(roster)` = the rooms in a given world.
- `identify.js` — room identity (director review of #36): a room is an enclosed space, and the objects inside it
  decide which room it is. Every enclosed GDD room has a `requires` definition (objects and counts). `identifyRoom(counts)`
  returns ONE identity: the most specific definition met, then the one with more of its defining objects inside, then
  the higher needs tier, then the more valuable defining objects, then the later unlock. Nothing met = Storeroom; nothing
  inside = Empty room. It also returns a hint: the closest room the space is not yet, and what to add. The shelter grid
  (`src/shelter/bunker.js`) uses it for every room; its old hand-written room list is gone. Fixtures (doors, linings,
  seals), the spine and surface builds are catalogued but are not rooms (`kind`). Rooms whose defining object is not in
  the bunker catalog yet (e.g. the Throne Room's throne) exist as data and are never recognised until it is added.
- `products.js` — `PRODUCT_LINES`: Solo Pod, Family Vault, Condo Silo, Compound, Ark with occupants, plots, prices.
- `unlocks.js` — `UNLOCK_SCHEDULE`: the 48 rows (39 research, 9 free) with gate, RP, cash, what each unlocks and its
  fan-out; `nodes` = the live research nodes (`src/research/tree-data.js`) that implement a row today.
  `nodeTargets()` gives each node's target time (the pacing harness's `GDD_UNLOCK_TARGETS` must agree);
  `lockedShelf(minute)` gives the next three; `ALTERNATE_FOLLOW_UPS` lists each alternate's third room.

Prices are GDD dollars; multiply by `PRICE_SCALE` (`src/shelter/bunker-catalog.js`) for today's $K economy.
The live research tree has 28 nodes; 21 map onto rows here, 7 are pre-GDD stand-ins (`NODES_OUTSIDE_SCHEDULE`),
and 27 research rows have no live node yet. Growing the tree to the 39 GDD nodes is the next step.
