# Threat track roster and the scheme list (#33; GDD: World canvas > Threat tracks, Alternate tracks, Schemes)

- `tracks.js` — data. `TRACKS`: 10 tracks in 6 slots (Classic six + Grey Goo, Long Shade, Kessler Rain, Cloud Strike in
  slots 2-5), each with premise, what it sells, containment op, opening time (campaign minutes) and hot regions on the
  GDD's eight fictional regions (`GDD_REGIONS`). `COUNTER_ROOMS`: the 12 alternate-only rooms, three per alternate.
  `selectRoster({ mode: 'classic' | 'random' | 'custom', picks, rng, firstCampaign })`, `openTracks`, `unusedTracks`
  (Overtime), `SLOT_LINKS` / `rosterLinks` (domino links belong to slots; weights provisional, the GDD map is a picture).
- `schemeCatalog.js` — data. `SCHEME_CATALOG`: all 37 schemes (11 escalate, 5 calm, 7 influence/intel, 6 Classic
  containment ops; alternates add 4 escalate + 4 ops) with department, target, momentum, cost ($ or RP), heat, payback,
  unlock time and effect text. `schemesForRoster`, `schemeTargets`, `SPECIAL_PROJECTS_LEVELS` / `schemeSlots`.
- `momentum.js` — rules. `ThreatWorld({ roster, minutes, ledger, onHeat, spLevel, rp })`: per-track tension and momentum;
  weekly: tension += band drift + 25% of momentum, momentum keeps 75%. Calming loses 25% per use on the same track within
  8 weeks. Special Projects slots by level (1..5), heat x band and -8% per Special Projects level. `BANDS` (Calm, Simmer,
  Boil, Brink: drift, heat multiplier, grants, premium).
- `world-ui.js` + `world.css` — `showWorldSetup` (CHOOSE YOUR APOCALYPSE: Classic / Random / Custom) and the in-game
  THREATS panel (T): six slots with open status and every scheme this world can use.
- In the campaign: the roster is chosen at the world setup (main menu WORLD SETUP; NEW CAMPAIGN after a finished
  campaign), saved, and its tracks open on schedule with a toast. `ThreatWorld` is not yet driving the map: the live
  crisis system still runs its five older tracks until the tension models are merged (gap review item 1).
