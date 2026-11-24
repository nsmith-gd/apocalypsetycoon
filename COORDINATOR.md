# Coordinator: how agents pick up work without asking

Ballast assigns tickets. When it hasn't assigned you anything, or your tickets are done or blocked, **don't stop.** Follow these rules to pick the next piece of work yourself. They exist so no agent sits idle (#85, #86, #87).

## 1. Choose the next ticket

1. **Your assigned tickets come first**, in the order you were given them.
2. **Otherwise, run `node tools/next-ticket.mjs`** (after `git fetch`). It lists unclaimed tickets from `.ballast/proposed-tickets.json` in pickup order:
   - **lowest level first**: L0 greybox before L1 functional;
   - **then core sections**, in this order: campaign loop → shelter grid → world map → threat tracks → schemes → heat and journalists → HUD → clients → Doom Clock → event deck → design layer → company and board → crises → economy;
   - **then gameplay before art** within a section. Art agents use `--kind art`.
   - A ticket whose `after` hasn't been claimed yet is skipped.
3. **Take the first one you can finish in one session.** If you can't, take the next. Never take two at once.
4. **Respect the gates.** The director develops each section up to a quality gate (L0 Greybox, L1 Functional, L2 Polished, L3 Ship) and only the director passes one. Never build a section beyond its gate. If a ticket would need the next level, skip it, and say so in your report. Proposed tickets are already capped at L1.
5. **Don't overlap.** Skip a ticket whose files are the core of another agent's open branch (check `git ls-remote --heads origin`), or whose section a Ballast "other agents are working on" list names with the same scope.

## 2. Claim it, so nobody else takes it

- **The claim is the branch.** Before writing code, create `ballast/<id>-<your-agent-name>` from the latest `origin/main` and push it at once. Use the ticket id: `t65` for board ticket #65, `R13` for a proposed ticket. Example: `git checkout -b ballast/R13-nathaniel3-2 origin/main && git commit --allow-empty -m "claim R13" && git push -u origin HEAD`.
- **Check for a collision right after pushing:** `git ls-remote --heads origin | grep -i "ballast/R13-"`. If two branches claim the same id, the one whose claim commit is **older** keeps it. The other agent deletes their branch (only their own) and picks the next ticket.
- A claim with no new commit for **24 hours** is stale. Mention it in your report and take the ticket over, keeping the old branch untouched.

## 3. Do the work

- Smallest playable increment first; keep `main` building.
- Read the GDD in `gdd/current/gdd-full.md`. Equations and diagrams it lost are in `docs/gdd-docx-reconciliation.md` and `docs/gdd-figures/`.
- Tuning numbers go in `src/config/tuning.js`, never a new defaults object.
- Wire new systems into the real campaign (`src/campaign/main.js`), not only a demo page. Register anything with state on the save slot (`slot.register`) **before** the single `slot.load()` at the end of setup.
- Tests: `node --test tests/*.test.js`. The balance harness, `node tools/pacing-harness.mjs`, must still print PASS.
- Visual work: commit screenshots or clips to `.ballast/media/<id>/`.

## 4. When you're blocked

1. If only a person can unblock it (an account, a device, a decision, a file on their PC), write the report as `STATUS: BLOCKED` with exactly what they must do, then take the next claimable ticket.
2. If it waits on another ticket, rewrite your piece to start in greybox form (a stub or stand-in, marked as such) instead of waiting. #86 has examples.
3. If nothing in the queue is claimable, **fall back**, in this order:
   - **QA:** run the tests and both harnesses (`node tools/pacing-harness.mjs`, `node tools/world-harness.mjs`); play a campaign in the browser; fix what breaks; report GDD balance misses.
   - **Push a focus section toward its gate:** pick the lowest-level section in the production-gates note and close the most visible gap between it and the GDD (see `docs/gdd-docx-reconciliation.md` §4 and `docs/board-rescope.md`). Stay at or below its gate.
   - **Add a proposed ticket:** append a one-session ticket to `.ballast/proposed-tickets.json` (same fields) for work you found, so the next idle agent has it.

## 5. Merging and conflicts

- Before opening the pull request: `git fetch origin && git merge origin/main` on your branch, then run the tests again.
- Pull request title: `#<number> <title>` (or `R<id> <title>` for a proposed ticket). Merge it yourself once tests pass (squash). Never wait on review.
- **Conflicts:** resolve on your branch, keeping both sides' intent. If both of you touched the same function, keep the other change and re-apply yours on top. Re-run the tests and the harness. Never force-push `main` or anyone else's branch, and never rewrite merged history.
- If your push is rejected because the branch moved, `git fetch` and merge. Don't force-push.
- `main` must build after every merge. CI (`.github/workflows/test.yml`) runs the tests and parses every module.

## 6. Report

Every ticket ends with `.ballast/reports/<id>.md` committed on its branch:
- **First line:** exactly `STATUS: DONE` or `STATUS: BLOCKED`.
- **Then 2–8 lines:** what changed, how to see it in game, assumptions, and the PR link.
- **Questions for the director** go under `## Questions`, written in player-facing words with no file or code names.
- Ballast closes a ticket when its report lands, so report as soon as it's done, then go back to step 1.
