# Midnight ending (pillar 3: "Midnight grades air, water and food")

- `midnight.js`: the rules only (no DOM). `computeMidnight({ shelters, world: { tension, heat, runaways }, cash })`.
  - `shelters`: every shelter sold plus the ones you keep: `{ id, name, owner, occupants, rooms: [roomId...], sold }`.
    The shelter grid and world map should hand these over at the end of Q12.
  - `ROOM_STATS` maps room ids (same ids as the build palette) to AIR / WATER / FOOD supply (in people kept alive)
    and prestige. Luxury rooms carry prestige but nothing Midnight grades. Gold taps leak water.
  - Control = 100 − 25 per runaway crisis − 3 per tension point above 90 − heat/5. At 50 or more, Midnight is
    ENGINEERED; below that it FAILED TO CONTAIN, and every shelter needs 30% more of everything.
  - Each shelter's survivors = occupants × (worst supply ratio)², with full supply keeping everyone.
    Six endings: engineered (Architect of the End / Managed Decline / Gilded Tombs) and
    failed (The Ark Held / Ashes and Receipts / Nobody Left to Bill), by the share of people who survive.
- `midnight-ui.js` + `midnight.css`: `await showMidnight({ root, result, onRestart })`, the ending screen.
- Campaign clock: after the Q12 quarter report, call `computeMidnight(...)` then `showMidnight(...)`.
- Demo: serve the repo root and open `demo/midnight-demo.html` (`?preset=architect|gilded|ark|nobody` jumps to Q12 with a set-up world).

## Engineered Midnight, Seal Order and Overtime (#29)
- `engineered.js` (numbers from the GDD's Midnight and Research tabs): `PROJECTS` (Project Lights Out, research 41 at
  4:50; The Final Product, research 45 at 5:30 with a 3-of-5 `boardVote`), research 46 = Seal Order helicopters,
  48 = Overtime (`RESEARCH_UNLOCKS`). `APOCALYPSES`: the GDD's ten (Atomic Standoff ... The Cloud Strike) with required
  Days Sealed, numeric critical ratings and the named rooms they also need; `TRACK_APOCALYPSE` maps the game's five track
  ids onto them. `combinedRequirement`: the longer duration + 180 days, both sets. `EngineeredMidnight`: `start({ project, target, weeks 4-12 })`,
  `salesMultiplier` (x3 during LAST CALL), `advanceWeek()` (heat +3/week, then a 2-week Seal Order, then `midnight`),
  `callOff()` (once, -20 board confidence). `runSealOrder(clients)` (distance, sieges, high leverage -> late/lost;
  helicopters cut distance risk). `GRADES` / `gradeFor` (Platinum 90%+ which also needs an engineered Midnight, no collapses and heat under 75; Gold
  75%; Silver 50%; Bronze 25%; The Gerald; -1 if uncontrolled). `Overtime`
  (quota +30% a quarter, the 4 unused tracks open one per quarter).
- `computeMidnight({ ..., apocalypse, pickups })` applies Seal Order outcomes (lost = nobody arrives, late = 75% get in)
  and, for life-systems shelters (rooms with floors), the apocalypse's Days Sealed and critical ratings; it returns `grade`.
- `engineered-ui.js`: planner, LAST CALL / SEAL ORDER banner, Seal Order board, Overtime offer.
- In `demo/midnight-demo.html`: ENGINEER MIDNIGHT (unlocks at Q10 / Q11, or `?unlock`), +1 WEEK, and the Overtime offer
  at the end of Q12.

## The uncontrolled road (#70)
- `uncontrolled.js`: when the Doom Clock strikes zero or the Final Countdown runs out, the campaign takes the uncontrolled
  road instead of grading straight away. `uncontrolledRoad({ reason, crisis, doom })` picks the apocalypse that arrived
  (countdown: the two collapsed tracks as a combined apocalypse; clock: the hottest open track), `sealOrderClients`
  turns every sold shelter into a Seal Order pickup (distance from HQ, sieges where a high-exposure track is at 90+,
  client leverage), and `resolveUncontrolled` runs the Seal Order and `computeMidnight` with that apocalypse, the
  pickups and `forceType: 'failed'`: graded one step down, ending OFF THE RAILS.
- Campaign: clock strike -> Seal Order board -> ending screen. The end of Q12 still grades straight away.
- Debug presets on a new campaign: `index.html?preset=countdown&qs=26` (two collapses, Midnight 4 weeks later) and
  `?preset=clockzero` (the floor falls to zero 3 seconds in).

## Twelve endings, epilogue cards and The Ledger (#32)
- `endings.js`: `ENDINGS` (all 12, GDD wording), `EndingWatch` (weekly `week(snapshot)` → an ending id when a trigger fires;
  `atMidnight({ road })` → Lights Out / Off the Rails / A Seat at the Table; `note(key, value)` for systems that report
  in; `force(id)` for the debug panel; saved on the slot as `endings`), `endingCard(id, { result })` (grade: as graded,
  -2 for Somebody Else's Apocalypse, the Ark alone, or quarters survived for Overtime; closing line).
  STAND-INS until their systems exist: Ruth/Theo loyalty, Mr. Gray's Favours and the Ark, Cut-in board seats, sites lost
  to sieges, the leaked dossier, Collective Bargaining wins (`STAND_INS`; they never trigger on their own). Iris Kemp's
  trust is read from the press system when the campaign has one.
- `epilogues.js`: `epilogues({ result, sold, endingId })` (one line per client: the 16 hero clients' own lines by outcome,
  generated clients by type and the supply that failed, late or lost Seal Order pickups; Gerald's wine always last) and
  `buildLedger(...)` (clients saved, staff saved and left outside (stand-in: 4 per crew), revenue, RP, scars, final heat,
  world population, closing line).
- `endings-ui.js`: `showFinale({ epilogues, ledger })`: epilogues, then The Ledger, then the ending card.
- Campaign: Midnight now runs grade, then epilogues, Ledger and ending card. Ousted and the mid-campaign triggers end the
  campaign through the same screens. Debug: `demo/endings-demo.html` (force any trigger), or in a campaign
  `__game.endings.end('indicted')`.
