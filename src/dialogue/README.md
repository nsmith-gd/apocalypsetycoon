# Dialogue (director note D2)

- `engine.js` (#54) — the dialogue runtime. `DialogueRunner(tree, { guest, context, onEffect, fill })`: nodes, choices,
  `alt` lines, `onEnter` effects, `once` choices, end states. Conditions: trait / notTrait / archetype / wealthClass /
  reputation / heat / crisis (tension of the guest's fear or any track) / var / flag / visited, composed with all / any /
  not, plus the crisis-aware keys from `world-state.js` (#57). Context values may be functions (read live).
  Effects: conversation-local (`set`, `add`, `trust`, `flag`, `reveal`) are applied by the engine; EVERY effect, local,
  world (`heat`, `reputation`) or outcome (`fear`, `trait`, `aggressive`, `slip`, `promise`, `learn`), goes to the one
  `onEffect(effect, runner)` sink. `result()` -> `{ ending, path, effects, vars, flags, revealed }`, which feeds
  `resolveOutcome` (#55) unchanged. `runHeadless(tree, { guest, context, pick })` plays without a UI.
  `validateDialogue(tree, { endings, traits, tracks })`: missing nodes, unreachable nodes, dead loops (an ending must be
  reachable from every node), all-gated nodes, unknown conditions / effects / endings.
- `script.js` (#54) — minimal authoring format: `parseScript(text)` compiles a short text script (`= node speaker`,
  `* [cond] text -> next {effects}`, `? [cond] alt text`, `> {effects}`) to engine data. Example:
  `data/dialogue/example.dlg`. Errors carry line numbers.
- `trees.js` + `trees/` (#56) — authored archetype trees and their stricter content rules; `Conversation` is the
  small runner the social screens use today (`src/social/tree-dialogue.js`). The trees are valid engine input and the
  engine tests play all of them; switching the adapter over to `DialogueRunner` is a follow-up.
- `outcomes.js` (#55), `world-state.js` (#57), `dialogue-ui.js`.
