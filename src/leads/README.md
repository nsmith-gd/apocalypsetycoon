# Leads: the sales pipeline (#50, director note D2)

Leads come from events: you attend a venue (`src/events/attend.js`), talk to guests (dialogue: a later ticket),
and a good conversation becomes a lead you hold. Shelter sales on the world map consume leads.

- `leads.js` `LeadInventory({ getQuarter, getReputation, getShowroomPrestige })`
  - `fromDialogue({ guest, venueId, outcome: { interest 0-100, lead?, traits?, note? } })` -> a lead or null. `guest`
    is the shape `attend.js` hands out: `{ id, name, wealthClass, region, fears, venueId }`.
  - `create({...})` for other sources (deck cards, rescue leads, poaching).
  - Lead: `source { type, venueId, quarter, guestId }`, `guest`, `region` (GDD id), `wealthClass` C1-C5, `quality` 0-100,
    `tier` cold/warm/hot, `fears`, `traits`, `createdQuarter`, `expiresQuarter`, `status` open/consumed/expired/lost.
  - Lifetime: cold leads last their quarter, warm one more, hot two more; `expire()` at the start of each quarter.
  - Quality: the outcome's interest, +10 per 20 points of reputation or Showroom prestige above 40 (GDD Demand rule).
  - `open({ region })` best first; `consume(id, { saleId })`; `lose(id)`; cap of 24 open leads (oldest cold dropped).
  - `sell(sales, shelterId, leadId)` sells through the world map and consumes the lead; `asBuyer(lead)` is the buyer shape.
  - `toJSON()/load()` for the save slot.
- World map hook (`src/worldmap/sales.js`): `quote/sell(regionId, shelterId, { lead })` accepts a pipeline lead as the
  buyer. Same price rule; the lead must be in that region. No other sales rule changed.
- Until the map uses the GDD regions, `GDD_TO_SALES_REGION` and `CLASS_TO_SALES_WEALTH` translate (provisional).
