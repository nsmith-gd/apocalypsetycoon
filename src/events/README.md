# Social events (venues) — director note D2

Leads come from going to **events** and talking to guests. This folder holds the rules for that.

- `data/venues.json` — the venue catalog (data only). Each entry: `id`, `name`, `kind`
  (gala/expo/summit/funeral/auction/retreat/sport/dinner), `region` (GDD region id), `quarters` (1-12 it runs in),
  `cost` `{ cash, days }` (dollars and CEO agenda days), `guestPool` `{ size, classes: { C1..C5: weight } }`,
  `guestList` `{ min, max }` (guests you get to talk to per visit), `exposure` `{ heat, reputation, press }`
  (per visit; press = chance a journalist is there), `themes` (threat track ids whose Fear warms guests up), `blurb`.
- `venues.js` — `loadVenueCatalog()` (fetch in browser, fs in Node), `parseVenueCatalog(json)` (validates against
  `VENUE_SCHEMA`, throws listing every bad field), `validateVenue(v)`. A catalog has `venues`, `byId`,
  `inQuarter(q)` (13+ = Q12's line-up), `inRegion(id)`, `uncoveredQuarters()`.

## How venues relate to the weekly event deck (#35)

They are separate systems that share no data:

| | Weekly event deck | Venues |
|---|---|---|
| Who chooses | The world: one card is drawn every week | The player: picks where to go |
| What it is | Headlines, opportunities, threats about the crisis tracks | Places to meet people |
| Output | Tension nudges, cash, heat, client problems | A guest list → dialogue → leads |
| Cadence | Exactly one per week | Limited by cash and agenda days per quarter |

Planned touch points (not built yet, deck-side work): an Opportunity card may *spotlight* a venue (cheaper, a bigger
pool, or a one-off guest of a higher class), and a Threat card may *taint* one (press chance up). A deck card should
reference a venue only by `id`, so the catalog stays the single source of venue facts.

Venue leads are in addition to the GDD's weekly region demand (`src/demand`), not a replacement; #50 owns how a
lead is stored in the pipeline.

## Attending (`attend.js`, #52)

`new EventCircuit({ catalog, ledger, seed, clock, addHeat, addReputation })` — pure game state, no UI yet.

- `options(quarter)` lists this quarter's venues with `canAttend` and a plain `reason` when not
  (not running, already attended, crowd not arrived, not enough agenda days, not enough cash, at an event already).
- `attend(id, { quarter, from })` pays cash (ledger, "Event: <name>") and agenda days (6 per quarter, no carry-over),
  applies heat/reputation, rolls the press, holds the clock (`'event'`) and returns the visit with its `guests`.
- Guests come from the venue's fixed pool (stable per campaign seed), only classes that have arrived by that quarter
  (GDD arrival times), never someone you already `meet()`-ed at that venue.
- `leave()` closes the visit, releases the clock and returns `{ visit, returnTo: from }`.
- `toJSON()/load()` for the save slot (an open visit is closed on load). Not wired into `main.js` yet; the
  event screen ticket registers it as `slot.register('events', circuit)`.
