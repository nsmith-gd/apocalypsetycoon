# Midnight ending (pillar 3: "Midnight grades air, water and food")

- `midnight.js`: the rules only (no DOM). `computeMidnight({ shelters, world: { tension, heat, runaways }, cash })`.
  - `shelters`: every shelter sold plus the ones you keep: `{ id, name, owner, occupants, rooms: [roomId...], sold }`.
    The shelter grid and world map should hand these over at the end of Q12.
  - `ROOM_STATS` maps room ids (same ids as the build palette) to AIR / WATER / FOOD supply (in people kept alive)
    and prestige. Luxury rooms carry prestige but nothing Midnight grades. Gold taps leak water.
  - Control = 100 − 25 per runaway crisis − 3 per tension point above 90 − heat/5. At 50 or more, Midnight is
    ENGINEERED; below that it FAILED TO CONTAIN, and every shelter needs 30% more of everything.
  - Each shelter's survivors = occupants × (worst supply ratio)², with full supply keeping everyone.
    Six endings: engineered (Architect of the End / Managed Decline / Gilded Tombs) and
    failed (The Ark Held / Ashes and Receipts / Nobody Left to Bill), by the share of people who survive.
- `midnight-ui.js` + `midnight.css`: `await showMidnight({ root, result, onRestart })`, the ending screen.
- Campaign clock: after the Q12 quarter report, call `computeMidnight(...)` then `showMidnight(...)`.
- Demo: serve the repo root and open `demo/midnight-demo.html` (`?preset=architect|gilded|ark|nobody` jumps to Q12 with a set-up world).
