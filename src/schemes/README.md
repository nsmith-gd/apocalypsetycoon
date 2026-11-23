# Crisis-stoking schemes and the edge (GDD: Schemes, Crises and tipping points; pillar 1)

- `schemes.js`
  - `SCHEMES`: six schemes, ids matching the research tree (podcast, memo, astroturf, deepfake, shortage, blackout),
    each pushing one crisis track, with cost, tension, heat and local leads. Provisional numbers.
  - `SchemeBoard({ crisis, market, ledger, pushback, isUnlocked })`
    - `run(schemeId, regionId)`: ledger `schemes` entry, `pushback.onScheme`, `crisis.addTension` scaled by the region's
      exposure (REACH high 1 / medium 0.7 / low 0.4), local leads via `market.addLeads`. If it tips the track (breach),
      half the region's waiting buyers flee to rivals (`market.flee`). Repeats in the same week cost +25% each.
    - `available(regionId)`: per scheme gain, cost, heat, lock reason (research, recovering, breached, paused, cash).
    - `edgeBonus(region)`: +30% price x exposure while a track the region is exposed to is at the Brink (within 10
      of its real, hidden tip). Feed it to `MapSales({ getEdgeBonus })`.
    - `trackView(track)`: tension, zone, the visible tip range (`crisis.visibleTip`) and where the edge could start.
  - `researchCrisis(crisis)`: crisis level for `ResearchTree.tick`, each track rescaled so its own tip lands on the
    research curve's tip: research peaks just below every real tipping point and drops after a breach.
- Runaway crisis = #26's breach (pause, containment window, heat, board confidence, Doom Clock), plus the buyer flight.
- UI: the world map's region panel (`createWorldMapScreen({ schemes })`) shows CRISES HERE bars (tension, $$$ edge band,
  hatched tip range) and the SCHEMES list with FUND buttons.
- Demos: `demo/world-map-demo.html` and the prototype `demo/hud-demo.html`.
