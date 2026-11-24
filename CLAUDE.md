# Apocalypse Tycoon

- **No assignment, or blocked? Never sit idle.** Follow [COORDINATOR.md](COORDINATOR.md): run `git fetch && node tools/next-ticket.mjs`, claim the top ticket by pushing a `ballast/<id>-<your-agent-name>` branch, and build it at or below its section's quality gate.
- Tests: `node --test tests/*.test.js`. Balance: `node tools/pacing-harness.mjs`.
- GDD: `gdd/current/gdd-full.md`, plus `docs/gdd-docx-reconciliation.md` for the formulas and diagrams it lost. Tuning numbers live in `src/config/tuning.js`.
