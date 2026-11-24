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

## Shelter interiors (src/shelter)
- `bunker.js` — `BunkerSite`: tile-level dig/build/conduits plus layered objects (`rug`, `floor`, `wall`,
  `ceiling`: a painting hangs over a sofa, a rug sits under it, a chandelier hangs from the slab),
  `paint(kind, finish, x, y, { single })` for room-wide wall/floor/lighting finishes, `recolor` and `flip`.
- `residents.js` — `ResidentSim` (`site.people`): one billionaire per bed slot, Sims-style needs, walking and
  climbing the spine to use objects, admiring decor, chatting, complaining about broken or busy objects.
  Residents run on their own clock (`RESIDENTS.hourSeconds`, a resident day is 2 min at 1x).
- `bunker-sprites.js` — procedural pixel sprites for furniture (in its chosen colour) and residents (per pose).
- `showcase.js` — `furnishedSuite(site)`; open `demo/bunker-demo.html?surveyed&suite&instant` to see it.
