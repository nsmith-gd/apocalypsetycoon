# GDD docx reconciliation (#83)

## 1. The docx

- **Path:** `gdd/current/Apocalypse_Tycoon_GDD.docx`, added by the director in commit `1494c92` ("Add files via upload").
- **SHA-256:** `1bfa8dc2…7c07c14`. Size: 598 KB.
- **Contents:** 16 sections plus a contents page, and about 22,900 words. It also holds 10 equations and 7 diagrams.
- **Repo copies:**
  - `gdd/current/gdd-full.md` is the team's working copy, converted from the docx by #11.
  - `gdd/current/page-ca_e8a1a5c85b.txt` is the repo's copy of the GDD page. It is still only the short design brief from the first round, not the page body.

## 2. Docx vs the GDD page

The page export the ticket names (`C:\Users\natha\.ballast\cloud\ca_e8a1a5c85b\page.md`) is on the director's PC, and agent sessions can't reach it. The live page is a Claude Doc, and these sessions have no Claude Docs connector. So the comparison below uses what is visible:

| What | Docx | GDD page | Verdict |
|---|---|---|---|
| Section list | Overview, Core loop, Shelter canvas, World canvas, Crises and tipping points, Clients and the upside-down needs ladder, The company and the board, Pushback systems, Research unlocks and fan-outs, Pacing: the 5+ hour campaign, Characters, Midnight and endings, Economy and tuning, Art audio and UI, Production plan, Systems review | 16 tabs with the same names, in the same order (Ballast's summary) | **Match.** The page uses short tab names: "Clients and needs ladder", "Company and board", "Research and unlocks", "Pacing". |
| Length | about 22,900 words | about 22,920 words (Ballast's summary) | **Match** (within 0.1%). |
| Repo copy of the page | full text | 2.4 KB brief: pitch, fantasy, pillars | **Out of date.** It is the stand-in from #11. Rules, numbers, unlock lists and endings can only be compared line by line once someone exports the page body into the repo (see the director flag below). |
| Brief vs docx | Startup has **2 crews** (Company tiers) | "one shovel crew" (the fantasy text) | **Differs.** The docx contradicts itself here too: the Overview says one crew. The game follows the tiers table (2). |

**Director flag:** to finish the docx-vs-page check line by line, export the Claude Doc "Apocalypse Tycoon — Game Design Document" as Markdown and commit it over `gdd/current/page-ca_e8a1a5c85b.txt`. An agent can then diff it against the docx in a few minutes.

## 3. Docx vs the working copy `gdd-full.md`

All prose matches word for word: every section's words are identical, apart from what's listed below. **The conversion dropped every equation, every diagram and one link.** These hold rules:

| Section | Lost in gdd-full.md | Matters because |
|---|---|---|
| World canvas | Leads formula: Leads_r = 0.5 + Σ F_i·e_i,r / 50 + R_r | The demand rule (the prose version survives in the tuning table) |
| Crises and tipping points | Doom Clock formula: M = min(F, 15 − ΣT_i / 40) | The prose survives; the formula pins min() against the floor |
| Clients and the needs ladder | Satisfaction = s · Σ w_k · met_k | **Not stated anywhere else.** No system implements it. |
| Clients and the needs ladder | Days Sealed = min_j stock_j / (use_j − production_j) | The bunker sim does this already |
| Clients and the needs ladder | P(survive) = min(1, Days Sealed / Required days) · f_seal · f_blast · f_security · f_morale | Midnight's survival rule; matches the code |
| Pushback systems | ΔT = d_band + 0.25·M + S and M_{t+1} = 0.75·M_t + I_t | Momentum. **The campaign doesn't run momentum** (only the isolated world module does). |
| Economy and tuning | Quota: Q_n = 6 × 1.3^(n−1) ($M) | **Differs from the game:** the board asks for $50K growing 8% a quarter (stand-in tuned by the old harness). The docx starts at $6M and grows 30%. |
| Economy and tuning | Price = Base × (1 + p) × c | The map price uses spec value × wealth × premium; the docx's c (class) and p (panic) should map onto that |
| Overview | Steam store link for "Home Sweet Bunker" (comparable title) | Reference only |
| 7 diagrams | Edge loop, Family Vault cutaway, crisis states, **domino map**, upside-down ladder, **campaign roadmap**, **system map** | Saved now in `docs/gdd-figures/`, see below |

### Data that exists only in the diagrams

- **Domino map** (`docs/gdd-figures/04-domino-map.png`): 10 directed links. The game's slot links (`src/world/tracks.js` SLOT_LINKS) disagree in four places. This belongs to **#65 (in progress)**.

  | Link (slots) | Game | Docx |
  |---|---|---|
  | Superstorm → Pitchforks (3→6) | medium | **no such link** |
  | Superstorm → Bloom (3→2) | missing | **medium** |
  | Optimizer → Atomic (4→1) | medium | **strong** |
  | Bloom → Hush (2→5) | weak | **strong** |
  | Pitchforks → Atomic (6→1) | strong | drawn thin, so **medium?** (it's the feedback loop; it is drawn in the loop colour, so the weight is ambiguous) |
  | Atomic → Pitchforks (1→6), Bloom → Pitchforks (2→6), Optimizer → Pitchforks (4→6), Hush → Pitchforks (5→6), Superstorm → Hush (3→5), Atomic → Superstorm (1→3) | as drawn | match |

- **Campaign roadmap** (`06`): chapter windows and names (Seed Round 0:00–0:55, Series A 0:55–1:50, Hypergrowth 1:50–3:20, Too Big to Fail 3:20–4:50, Final Quarter 4:50–6:15). Unlocks per chapter: 10 / 9 / 11 / 10 / 8. Tracks open per chapter: 1 / 2 / 4 / 6. Tier-up gates: 2, 6, 14 and 24 handovers. The handover gates are in the text too; the chapter names and unlock counts are only here.
- **System map** (`07`): the 14 systems-review findings, placed on the main loop, with "tension → Fear and demand" marked as the one link the design needs but never defines.
- **Upside-down ladder** (`05`): pay vs survival share by tier. Delusion is 35% of pay and 0% of survival; Status 35% / 5%; Comfort 20% / 20%; Survive 10% / 70%.

## 4. Docx content no ticket on the board covers

"Board" here means every ticket visible from the repo: merged #1–#17, #19, #25–#29, #31, #33, #37, #50–#52, #55–#58, #60, #62, #63, #66, #68–#71, #73–#84; in progress #18, #36, #53, #54, #64, #65, #67, #72; plus the feature sections named in the production gates. Tickets #20–#24, #30, #32, #34, #35, #38–#49, #59 and #61 have no branch, pull request or report, and their titles aren't visible from the repo, so some items below may already sit on one of those.

| Docx content (section) | Nearest ticket / feature | Gap |
|---|---|---|
| Client satisfaction formula, walkthroughs at 50% and 100%, change orders (+15%), retainers (4% a quarter), contract penalties (2% a week late) (Clients, Economy) | feature "Clients, needs ladder and contract lifecycle" | No ticket seen implements contracts. Shelters are sold finished, and retainers and change orders appear only as tuning rows. |
| Momentum on the campaign's crisis tracks (ΔT and M formulas; breach spillover +6 / +3 / +1.5 momentum a week) (Pushback, Crises) | feature "Threat tracks: bands, momentum…" | The campaign's crisis system has no momentum; only `src/world/momentum.js` (unused by the campaign) does. |
| Quota formula Q_n = 6 × 1.3^(n−1) and the money scale (Economy) | #18 (board review, in progress) | #18 should take the docx formula; the game's $50K / +8% is a stand-in. |
| Government contracts at Brink: high volume, low prestige, heat −1 each (Core loop) | — | No ticket seen. |
| Ten of the twelve endings: Indicted (heat 95+ for 4 weeks), The Last Resort (secret), Regrettably Stable, Under New Management, A Seat at the Table, Locked Out, Somebody Else's Apocalypse, The Clouds Won, and the epilogue cards and "The Dark" time-lapse (Midnight and endings) | #6 / #17 / #29 / #70 cover Lights Out, Off the Rails, Ousted and Overtime | Indicted and the story endings have no ticket seen. |
| Founder backgrounds (e.g. Ex-Realtor: lead quality +1 step, scheme heat +10%) (Characters > You) | feature "Company tiers…" mentions it | No ticket seen. |
| Seven named department heads' loyalty drivers, Knowledge, whistleblowers (25% a quarter), scapegoat, raises (Company) | feature "Company tiers, departments, staff loyalty and whistleblowers" | Only tiers and caps (#73) and the panel (#72) are seen. |
| Notoriety heat floor (0 to 30 by tier), weekly heat decay, Communications levels (Pushback) | feature "Heat, journalists…" | The game uses a stand-in quarterly heat decay. |
| Condo gossip (10% a week toward the highest resident), feuding neighbours (Pushback, Clients) | #36 (product lines) | Condo Silos are data at most; no gossip ticket seen. |
| Catch-up and runaway leaders (rescue lead when behind) (Pacing) | — | No ticket seen. |
| Accessibility (Art, audio and UI) | — | No ticket seen. |
| CI, Steam build, Steam Deck target (Production plan, Overview) | feature "Save/load, front end, CI and platform build" | CI exists (tests run on every change). No Steam / Deck build ticket seen. |
| Systems review findings 1–14 (Systems review) | #13 gap review | Each is "Resolved" in the docx itself. Finding 2 (tension → Fear) matches the game. Finding 6 (one demand rule) matches #27. Others aren't checked against code. |

## 5. How this was checked

- The docx was converted again from the file in the repo, and compared section by section and word by word with `gdd-full.md`.
- The 7 diagrams were pulled out of the docx and read.
- The domino map was compared link by link with `SLOT_LINKS`.
- The page side relies on Ballast's summary of the live Claude Doc (16 tabs, about 22,920 words) and the repo's page copy.
