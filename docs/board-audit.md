# Board audit: why agents are idle with open tickets (#85)

Audited 24 Nov 2026 from the repository: branches, pull requests, `.ballast/reports`, `docs/`, and the ticket lists Ballast hands to agents.

**Limit:** the board lives in Ballast, not in GitHub (the repo has no issues), and no copy of it is in the repository. An agent sees a ticket's title only when Ballast assigns it or lists it as "in progress". Tickets with no branch, report or mention anywhere have unknown titles here. They are listed by number and categorised from the evidence that exists.

## Evidence

- **84 numbers used** (#1–#85, minus #85 itself). 53 tickets have a merged pull request and a report; all 53 reports say **STATUS: DONE** and none says BLOCKED. Every `ballast/t*` branch is merged. Agents finish what they are handed: in this session, 20 assigned tickets were each delivered and merged within the same session.
- **8 tickets are listed to agents as "in progress"** (#18, #36, #53, #54, #64, #65, #67, #72), but **none has a pushed branch**. Agents here normally push within minutes of starting, so these may be claimed but not moving.
- **23 tickets have no trace at all:** #20–#24, #30, #32, #34, #35, #38–#49, #59, #61. Only #35 is named anywhere ("the weekly event deck", referenced by #51 and #74). Its L0 child (#74 Greybox weekly card) is merged.
- **The production-gates note** names about 20 feature sections. Feature tickets carry L0–L3 scope, and child tickets exist for the L0 pieces (for example #72/#73 under Company tiers, #75 under Alternate tracks, #76 under Characters, #77–#79 under Economy, #80/#81 under Save/load).

## Every open ticket

| Ticket | What it is (as visible) | Category | Unblocking action |
|---|---|---|---|
| #18 | Quarterly board review and growth targets | **Blocked by an unfinished dependency** (claimed, no branch) | Confirm an agent is on it. It should use the docx quota Q_n = 6 × 1.3^(n−1) $M (lost from gdd-full.md, see `docs/gdd-docx-reconciliation.md`). It depends on the money rescale ($K→$M) that no ticket owns: create that ticket or fold it into #18. |
| #36 | Full room catalog, product lines and 48-unlock schedule as data | **Duplicate or overlapping** (claimed, no branch) | Overlaps #16 (`src/research/tree-data.js` already holds 29 GDD-schedule nodes with costs and effects) and #84 (bunker catalog). Rescope #36 to "extend tree-data.js and bunker-catalog.js to the full 73 rooms and 48 unlocks", not a new data file. |
| #53 | Guest roster: archetypes, wealth, fears and traits | **Duplicate or overlapping** (claimed, no branch) | #56 shipped 12 archetypes with traits, #52 the per-venue guest pool, and #75 the 16 hero clients with slot fears. Rescope to "replace the class-based archetype guess with a roster file", or close as done. |
| #54 | Dialogue tree engine | **Duplicate or overlapping** (claimed, no branch) | #56 shipped a working tree runner (`Conversation`), and #60 a session interface the UI uses. Rescope to the missing parts only (conditions, variables, save mid-conversation), or close. |
| #64 | GDD containment source values | **Blocked by an unfinished dependency** (claimed, no branch) | Values now live in `src/config/tuning.js` (BREACH.sources) after #77. Point the ticket there. The GDD numbers are in the Crises section. |
| #65 | Domino map by slot | **Blocked by an unfinished dependency** (was: the data only existed as a picture) | Unblocked by #83: the docx diagram is in `docs/gdd-figures/04-domino-map.png`, with the 4 link mismatches tabled. Claimable as soon as the agent picks it up. |
| #67 | Collapse consequences and per-member reactions | **Blocked by an unfinished dependency** (claimed, no branch) | Per-member board reactions need #18's five board members. Sequence it after #18 or stub the members. |
| #72 | Company panel greybox | **Duplicate or overlapping** (claimed, no branch) | #73 already shipped a greybox company panel (tier chip, departments, LEVEL UP with caps; `src/company/company-panel.js`). Close #72 as done, or rescope to "replace the greybox panel with the GDD layout". |
| #35 | Weekly event deck and rival companies (feature) | **Waiting on the director's quality gate** | L0 (#74 greybox weekly card) is merged. L1 (the 60 slice cards, rivals acting) waits for the director to pass L0. |
| #20, #21, #22, #23, #24 | Not visible (likely feature-level tickets created with #19–#29) | **Unclear done-condition** (not visible to agents); likely **too big for one session** if feature-level | Ballast: publish their titles and gates in the repo (see the actions below). If they are features, split each into L0/L1 child tickets the way #72–#81 were. |
| #30, #32, #34 | Not visible | **Unclear done-condition** (not visible to agents) | Same as above. |
| #38–#49 (12 tickets) | Not visible | **Unclear done-condition** (not visible to agents); the numbering sits between the feature batch and the social-layer batch (#50+) | Same as above. Several may be the production-gate feature sections; each needs its current gate level stated. |
| #59, #61 | Not visible; they sit inside the social-layer batch (#50–#60) | **Unclear done-condition** (not visible to agents); possibly **already done** (#58 and #60 delivered the lead-redemption and UI parts of that batch) | Ballast: check them against #58 / #60 and close or rescope. |
| #83 | Find the docx GDD and reconcile it | **Already done** (merged, PR #55) | Close. |
| #85 | This audit | **Already done** when this merges | Close. |

**Count:** 36 open tickets (#18, #20–#24, #30, #32, #34–#36, #38–#49, #53, #54, #59, #61, #64, #65, #67, #72, #83, #85).

| Category | Tickets | Count |
|---|---|---|
| Waiting on the director's quality gate | #35 | 1 |
| Blocked by an unfinished dependency | #18, #64, #67 (and #65 until now) | 3 (+1 just unblocked) |
| Too big for one session | likely among the 22 invisible ones, if they are features | — |
| Duplicate or overlapping | #36, #53, #54, #72 | 4 |
| Unclear done-condition (invisible to agents) | #20–#24, #30, #32, #34, #38–#49, #59, #61 | 22 |
| Already done | #83, #85 | 2 |
| Unblocked by this audit and #83 | #65 | 1 |

## How many tickets are claimable right now

- **Confirmed claimable now: 1** (#65, the domino map: its data is now in the repo).
- **Claimable after a quick rescope: 4** (#36, #53, #54, #72): each is partly or fully covered by merged work, and needs a scope that names only what is missing.
- **Claimable once sequenced: 3** (#18 now; #64 pointed at the tuning table; #67 after #18).
- **Unknown: 22** (#20–#24, #30, #32, #34, #38–#49, #59, #61): nobody outside Ballast can see what they ask. Some are probably feature tickets waiting on a gate, which can't be claimed until the director passes the level below.
- **Not tickets yet:** the GDD content no ticket covers (12 items in `docs/gdd-docx-reconciliation.md` §4: contracts and the lifecycle, campaign momentum, government contracts, 10 of 12 endings, founder backgrounds, staff loyalty and whistleblowers, notoriety, condo gossip, catch-up, accessibility, Steam / Deck build, the $M economy rescale). These are the largest pool of real, claimable work, and they need tickets first.

## Why agents are idle

1. **The board is invisible to agents.** They can only work what Ballast assigns, two tickets at a time. When assignment pauses, agents sit idle even with 36 open tickets, because they can't tell which are real, sized and unblocked.
2. **Claimed tickets with no visible work.** All 8 "in progress" tickets have no branch; 4 of them overlap merged work. An agent that finds its ticket already done may stall, or may be waiting on an answer that never comes.
3. **Feature tickets wait on gates.** Feature-level tickets above their section's gate can't move until the director passes the level below, and the gate status isn't recorded anywhere agents can read.
4. **Missing tickets for real GDD work.** The docx holds about a dozen systems no ticket covers, so nothing is queued even though the work exists.

## Unblocking actions (for Ballast and the director)

1. **Ballast:** write the board to the repo on every change (for example `.ballast/board.json` with each ticket's number, title, feature, gate level, status, claimant and dependencies). Agents could then pick up, audit and sequence work themselves.
2. **Ballast:** for the 8 "in progress" tickets with no branch, ping or reassign. Close #72 as covered by #73, and rescope #36, #53 and #54 as above.
3. **Director:** record each section's current gate (L0/L1/...) in that same file, and pass the L0 gates already met: Weekly event deck (#74); Company tiers (#73); Alternate tracks (#75); Characters (#76); Economy L1 (#77–#79); Save/load L0 (#80, #81).
4. **Ballast:** create tickets for the uncovered GDD items in `docs/gdd-docx-reconciliation.md` §4, sized like #72–#81 (one session each).
