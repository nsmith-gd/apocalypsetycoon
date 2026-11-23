# GDD gap review (provisional)

**Status:** the full GDD (`mwtmo5e4-Apocalypse_Tycoon_GDD.docx`) is not reachable from agent sessions.
It is not in the repository on any branch, no computer folder is shared with the sessions, and the
claude.ai copy is a Claude Doc whose body can only be read with the Claude Docs connector, which agent
sessions don't have. This review therefore compares the **design brief**
(`gdd/current/page-ca_e8a1a5c85b.txt`) and what playtesting with the pacing harness found against the
board. Re-run it once the docx is converted:

```
python3 -I tools/docx_to_md.py gdd/current/<file>.docx gdd/current/gdd-full.md
```

## Board coverage of the brief

| Brief item | Ticket(s) | State on main |
|---|---|---|
| 12-quarter campaign, game loop, clock | #1 | not on main yet |
| Shelter grid: rooms and amenities | #2 | not on main yet (art tiles from #9 exist) |
| World map: regional demand, crisis levels, sales | #3 | not on main yet (art from #9 exists) |
| Schemes, tipping points, profit-at-the-edge curve | #4 | not on main yet |
| Pillar 1: crises fund research | #7 | done (research tree) |
| Pillar 4: heat, runaway tension, leverage, board | #5, #14 | done (#5); #14 in progress |
| Pillar 3: Midnight grades air, water, food | #6 | done |
| HUD, quarter report, ledger, grid/map toggle | #8 | done |
| Pixel-art style and placeholder tiles | #9 | done |
| Music and SFX | #10 | done |
| 5–6.5 h pacing check | #12 | done (harness) |

## Gaps: systems the brief implies with no ticket

1. **Integration into the real game.** Every finished system (pushback, Midnight, research, HUD, audio)
   runs in its own demo page. Nothing yet wires them into #1's loop and clock, or into #2/#3 once they land.
2. **A way to lower tension.** Above 75, tension feeds itself and nothing lowers it, so every edge
   strategy ends in a runaway (pacing harness, #12). The brief's "richest zone just below the tipping
   point" needs a de-escalation lever (e.g. fund disaster relief, PR spin).
3. **Engineering Midnight on your terms.** The brief says Midnight is the apocalypse you engineer or
   fail to contain. Today it always lands at the end of Q12. There is no player action to choose the
   moment or the kind of apocalypse.
4. **Client wants and pricing.** "Clients pay for gold taps and cryo pods" implies clients with
   wish lists that raise a shelter's price. #3 covers sales and demand, but nothing ties a client's
   wants to the rooms built on the grid.
5. **Save and load.** A single 5–6.5 hour campaign needs saving and resuming.
6. **Front end and flow.** Title screen, new campaign, pause and settings (volume, mute), and a
   game-over flow for being ousted by the board.
7. **First-quarter onboarding.** Teaching the two canvases, the ledger and the edge in Q1.
8. **Balance pass on the real economy.** Re-run the pacing harness once #2–#4 replace its stand-ins.

## Questions the real GDD should answer

- The list of schemes and regions, with their numbers (#3/#4 currently invent them).
- Client types and what each one wants.
- Whether quarters run on a real-time clock (the harness assumes 27 minutes) or are player-paced.
- Whether a board ousting ends the run.
