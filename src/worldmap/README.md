# World map sales (GDD: World canvas; pillar 2 "the world map is what you sell")

Built on #27's demand model (`src/demand/demand.js`), not beside it: demand on the map IS the LeadMarket.

- `sales.js`
  - `regionCrisis(region, tensions)`: a region's crisis level, 0-100 = its worst crisis track x exposure weight
    (high 1 / medium 0.5 / low 0.25), plus which track it is.
  - `specValue(shelter)` = $150K + room costs x2; `salePrice(shelter, wealth, premium)` x wealth class
    (comfortable 0.8 / rich 1 / ultra 1.35 / apex 1.8) x the region's panic premium.
  - `MapSales({ market, ledger, pushback, getTensions, getBreachMultiplier, getQuarter })`
    - `addFinished({ name, rooms, occupants })`: a shelter has reached handover and goes into stock.
    - `overview()`: per region crisis, buyers waiting (open leads), leads/week, price premium.
    - `regionView(id)`, `quote(id, shelterId)`, `sell(id, shelterId)`: sells to the richest waiting buyer, works that
      lead (local demand falls by one), records a `sales` ledger entry, calls `pushback.onSale`, stores a
      Midnight-ready record (`sheltersForMidnight()`). No buyer or no stock: refused, nothing moves.
- `worldmap-ui.js` + `worldmap.css`: `createWorldMapScreen({ root, sales, onSold })`. Eight clickable regions (the art
  map's "Asia" is split into Middle East / South Asia / East Asia), crisis overlays, buyer count and sold bunkers per
  region, a side panel with crisis bar, buyer list and a SELL button with the price for each finished shelter.
  Plugs into the HUD's WORLD MAP view (`createGameUI({ views: { map } })`).
- Demo: `demo/world-map-demo.html` (`?region=lat` opens a region).
- Provisional: spec markup and base fee, wealth-class multipliers.
