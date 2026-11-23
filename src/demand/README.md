# Fear and weekly lead demand (GDD: Core loop > The Fear meter, World canvas > Demand)

- `demand.js`
  - `nextFear(fear, gained, breachWeek)`: last week's Fear decays 15%, then +2 per tension point gained and +10 on a
    breach week, capped 0-100. Flat tension, even at the Brink, stops adding Fear, so demand drains in about a quarter.
  - `regionLeads(region, fear, { siteOwned, referrals })` = 0.5 (site owned) + sum(Fear x exposure)/50 + referrals,
    exposure high 1 / medium 0.5 / low 0.25.
  - `panicPremium(region, tensions, { breachMultiplier })`: price multiplier, each track's premium scaled by exposure
    (full / half / quarter), doubled during a breach (`crisis.panicMultiplier` from src/crisis).
  - `REGIONS`: 8 regions with exposure tables, client pools (weights over src/clients types), site cost and base wealth
    class; `art` maps each onto the six-region placeholder world map.
  - `LeadMarket`: `week({ tensions, breaching })` updates Fear and spawns leads (fractions carry over), each with a
    client type from the region's pool and a wealth class (+1 with Showroom prestige AND reputation above 40);
    unworked leads go to a rival after 4 weeks. `ownSite`, `setShowroom`, `setReferrals`, `work(id)`,
    `regionDemand()` (what the map shows), `snapshot()`.
  - `attachCrisis(market, crisisSystem)`: runs a market week after every crisis week, using its tensions and breaches.
- `demand-ui.js`: `drawTrackGauge` (tension needle + red Fear needle) and `createDemandMap` (world map tinted by
  demand, with a scrolling leads/price ticker).
- #3 (world map) should read `regionDemand()` for its sales screen and call `ownSite()` when a site is bought.
- Provisional until the GDD tables are in the repo: the 8 regions' exposure tables, client pools, site costs and base
  wealth classes, the max panic premium (+50%), and Showroom prestige >= 1 for the upgrade.
- Demo: `demo/demand-demo.html`.
