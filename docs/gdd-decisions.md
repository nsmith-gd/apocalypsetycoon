# GDD decisions: settled contradictions (#96)

The GDD contradicted itself in a few places, so tickets quoted different numbers. Each item below picks one value; `gdd/current/gdd-full.md` is edited to match. Where the game already ran a sensible value, the GDD follows the game.

**Rule for tickets:** quote the value in this file. If the GDD and this file disagree, this file wins, until the director changes it.

| # | Topic | The conflict | Decision | Why |
|---|---|---|---|---|
| 1 | Starting crews | Overview: "one shovel crew". Company tiers: Startup has **2** crews. | **2 crews** at Startup. The Overview now says "two shovel crews". | The tiers table is the rule, and the game already gives Startup 2 crews. The Overview line was flavour text. |
| 2 | Quarter length | Economy: a quarter is 13 weeks at 120 s, so **26** minutes at 1×. Pacing: "about 26 to about 32" minutes. The game's clock runs **27**. | A quarter is **27 minutes of game clock at 1×** (13 weeks of about 125 s each). Real time per quarter, counting paused reading and decisions, is **about 29 to 32 minutes**. | Follows the game. The campaign roadmap's own chapter windows (0:55 for chapter 1's two quarters, 6:15 for twelve) work out to 27.5 to 31 minutes a quarter, which 27 fits better than 26. Moving the clock to 26 shifts the late unlocks into a later quarter, a balance change this docs ticket shouldn't make. The two Pacing numbers measure different things: the clock, and real time with pauses. |
| 3 | Event deck size | World canvas: **220** cards. Content counts: **340**. Cut list: "drop from 220 to 150". | **220 cards per campaign** (6 tracks × 30 + 40 general). **340 in the full game**: the four alternate tracks add 120 (4 × 30). The cut list cuts the Classic deck from 220 to 150; the 120 alternate cards ship with the alternates. | All three numbers were right about different things. The text now names which is which. |
| 4 | Starting reputation | Old code started reputation at **50**. The GDD says **40** (Pushback, Economy tuning table). | **40**. | The GDD is consistent, and #77 already moved the campaign to 40. The lead market's last fallback of 50 now reads the tuning table too. The "50" that remains is the separate threshold for government partnerships ("reputation 50 or more"), which is intended. |

## What changed

- `gdd/current/gdd-full.md`:
  - Overview: two shovel crews.
  - Core loop time table: Week "About 2 minutes", Quarter "27 minutes".
  - Content line and Content counts: 340 split as 220 Classic + 120 alternate.
  - Event deck: 220 per campaign, 340 in the full game.
  - Pacing: 27-minute clock, 29 to 32 real minutes.
  - Economy timing table: about 125-second week, 27-minute quarter.
  - Cut list: the Classic deck goes from 220 to 150.
- `src/demand/demand.js`: the default reputation reads the tuning table (40), not 50. The campaign already passed the real value, so play doesn't change.

## Not settled here

- The live GDD page (the Claude Doc) still carries the old numbers. #95 exports the page body into the repo; whoever finishes it should apply these four edits to the page as well, or hand them to the director.
- `gdd/current/page-ca_e8a1a5c85b.txt` (the short design brief) now says "two shovel crews" (#107). Agents and the repo's docs read it as the repo copy of the page, and #95 (exporting the live page over it) is still waiting on a person, so it was corrected in place.

## Page edits to apply (for the director, on the live Claude Doc)

The repo copies follow the decisions above; the live page "Apocalypse Tycoon — Game Design Document" still needs these edits:

- [ ] **Overview / Player fantasy:** "one shovel crew" → "two shovel crews" (Startup has 2 crews).
- [ ] **Core loop, time table:** Week "about 2 minutes" (about 125 s at 1×); Quarter "27 minutes".
- [ ] **Economy and tuning, Time table:** In-game week "about 125 seconds at 1× (27 minutes ÷ 13)"; Quarter "13 weeks: 27 minutes at 1×".
- [ ] **Pacing:** the quarter clock is 27 minutes; real time per quarter, with paused screens, is about 29 to 32 minutes.
- [ ] **World canvas, event deck:** 220 cards per campaign (6 tracks × 30 + 40 general); 340 in the full game with the four alternate tracks (+120).
- [ ] **Production plan, content counts:** event cards 340 = 220 Classic + 120 alternate.
- [ ] **Production plan, cut list:** "Event cards drop from 220 to 150" → "The Classic event deck drops from 220 to 150; the 120 alternate cards ship with the alternates."
- [ ] **Pushback / Economy tuning table:** reputation starts at 40 (the 50 that remains is the government-partnership threshold, which is intended).
