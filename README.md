# Apocalypse Tycoon

Pixel-art management sim. Plain ES modules, no build step.

- **Play:** serve the repo root (`python3 -m http.server`) and open `http://localhost:8000/` (the root `index.html`).
- **Tests:** `node --test tests/*.test.js`
- Demos of individual systems live in `demo/`.

## Campaign (src/campaign)
- `clock.js` — `CampaignClock`: 12 quarters of `PACING.quarterMinutes` (27 min) each, then Midnight.
  Hooks: `onQuarterEnd(async ({ quarter, isFinal }) => ...)` (the clock waits for it, so the quarter report
  can block), `onQuarterStart`, `onMidnight`, `onChange`. Speeds x0/x1/x2/x4, `hold(reason)`/`release(reason)`
  for modals, `skipQuarter()`.
- `save.js` — one localStorage slot; systems `register(name, { toJSON, load })`. Autosaves at every quarter
  close and when going back to the menu; cleared at Midnight or when ousted.
- `main.js` — main menu → campaign scene (HUD, shelter/world views, clock bar) → Midnight ending.
  `window.__game` exposes the live systems. The shelter and world views are placeholders for their own tasks.

Controls: Space pause, 1/2/3 speed, N end the quarter now, TAB shelter/world map, R research.
`?qs=20` makes each quarter 20 seconds (testing); `?seed=N` fixes the pushback RNG.
