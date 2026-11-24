# Apocalypse Tycoon

Pixel-art management sim. Plain ES modules, no build step.

- **Play:** serve the repo root (`python3 -m http.server`) and open `http://localhost:8000/` (the root `index.html`).
- **Tests:** `node --test tests/*.test.js` (also run by GitHub Actions on every push and PR)
- **Design doc:** `gdd/current/gdd-full.md` (converted from the uploaded .docx with `tools/docx_to_md.py`)
- Demos of individual systems live in `demo/`, listed on `demos.html` (linked from the main menu).

## Campaign (src/campaign)
- `clock.js` — `CampaignClock`: 12 quarters of `PACING.quarterMinutes` (27 min) each, then Midnight.
  Hooks: `onQuarterEnd(async ({ quarter, isFinal }) => ...)` (the clock waits for it, so the quarter report
  can block), `onQuarterStart`, `onMidnight`, `onChange`. Speeds x0/x1/x2/x4, `hold(reason)`/`release(reason)`
  for modals, `skipQuarter()`.
- `save.js` — one localStorage slot; systems `register(name, { toJSON, load })`. Autosaves at every quarter
  close and when going back to the menu; cleared at Midnight or when ousted.
- `main.js` — main menu → campaign scene → Midnight ending. Wires the clock, ledger/HUD, pushback, Doom Clock,
  research, audio, the shelter grid (build → hand over), and the world (crisis tracks, weekly leads, schemes,
  map sales, containment). A crisis week runs every 1/13 of a quarter. `window.__game` exposes the live systems.
  Demo-only so far: client orders, shelter life systems, engineered Midnight, journalists.

Controls: Space pause, , and . step speed, N end the quarter now, TAB shelter/world map, R research.
`?qs=20` makes each quarter 20 seconds (testing); `?seed=N` fixes the pushback RNG.
