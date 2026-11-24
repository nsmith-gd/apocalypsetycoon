# Doom Clock (GDD: Crises and tipping points > The Doom Clock)

- `doomclock.js`: `new DoomClock()`. M = min(F, 15 - sum(tension)/40). The floor F starts at 15 and only moves toward
  Midnight: -0.25 on a track's first Brink, -0.5 per chapter start, -1 per contained breach, -4 per collapse.
  Fragility: `clock.tippingPoint(base)` = base minus 1 per floor minute lost, never below 72. The second collapse
  starts the Final Countdown (Midnight in 4 weeks, `advanceWeeks`). At M = 0, or when the countdown ends, it emits
  `midnight` ({ reason: 'clock' | 'countdown', uncontrolled: true }).
  - Crisis tracks (#4): `setTensions({ id: tension }, { tips })` (auto-detects Brink within 10 of the fragile tip),
    `brink(id)`, `breachContained(id)`, `collapse(id)`. Campaign clock (#1): `chapterStart(n)`, `advanceWeeks(n)`.
  - `snapshot()`, `toJSON()` / `DoomClock.fromJSON()`.
  - `attachPushback(clock, pushback)`: until #4's tracks land, pushback's world tension is one track and each runaway
    counts as a Brink plus a contained breach (replaces pushback's old `doomsdayShift` counter).
- `doomclock-hud.js` + `doomclock.css`: the DOOM CLOCK in the centre of the top bar (#71): a crown strip at the top of the
  HUD holds the pixel face (red wedge = time lost to the floor), time, minutes and floor, a 15-to-0 minutes track with the
  floor wedge and a pin for now, and a FINAL COUNTDOWN box in weeks. `center: false` gives the old inline chip.
  The campaign advances the clock one week at a time from the campaign clock (13 a quarter), so the countdown ticks weekly.
- Uncontrolled Midnight: pass `forceType: 'failed', cause` to `computeMidnight` (src/midnight).
- Demos: `demo/doom-clock-demo.html` (five stand-in tracks, AUTO-PLAY watches it tick to Midnight) and the
  Midnight demo's campaign (chapters at Q4, Q7, Q10; 13 weeks per quarter).
