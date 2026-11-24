# Doom Clock (GDD: Crises and tipping points > The Doom Clock)

- `doomclock.js`: `new DoomClock()`. M = min(F, 15 - sum(tension)/40). The floor F starts at 15 and only moves toward
  Midnight: -0.25 on a track's first Brink, -0.5 per chapter start, -1 per contained breach, -4 per collapse.
  Fragility: `clock.tippingPoint(base)` = base minus 1 per floor minute lost, never below 72. The second collapse
  starts the Final Countdown (Midnight in 4 weeks, `advanceWeeks`). At M = 0, or when the countdown ends, it emits
  `midnight` ({ reason: 'clock' | 'countdown', uncontrolled: true }).
  - Crisis tracks (#4): `setTensions({ id: tension }, { tips })` (auto-detects Brink within 10 of the fragile tip),
    `brink(id)`, `breachContained(id)`, `collapse(id)`. Campaign clock (#1): `chapterStart(n)`, `advanceWeeks(n)`.
  - `snapshot()`, `toJSON()` / `DoomClock.fromJSON()`.
  - In the campaign the clock is fed by the `CrisisSystem` running the roster's six tracks (#69): every week, and on every
    tension change, it pushes each OPEN track's tension and pre-fragility tip (`setTensions(open, { tips })`) (the campaign
    clock's sync turns the Doom Clock's weeks; `clockWeeks: true` lets a CrisisSystem do it elsewhere). Closed tracks don't count toward the sum, but fragility lowers their rolled tip
    all along, so they open fragile. `attachPushback` (pushback's single world track) is no longer used by the campaign;
    it stays only for the old demos.
- `doomclock-hud.js` + `doomclock.css`: the DOOM CLOCK in the centre of the top bar (#71): a crown strip at the top of the
  HUD holds the pixel face (red wedge = time lost to the floor), time, minutes and floor, a 15-to-0 minutes track with the
  floor wedge and a pin for now, and a FINAL COUNTDOWN box in weeks. `center: false` gives the old inline chip.
  The campaign advances the clock one week at a time from the campaign clock (13 a quarter), so the countdown ticks weekly.
- Uncontrolled Midnight: pass `forceType: 'failed', cause` to `computeMidnight` (src/midnight).
- Demos: `demo/doom-clock-demo.html` (five stand-in tracks, AUTO-PLAY watches it tick to Midnight) and the
  Midnight demo's campaign (chapters at Q4, Q7, Q10; 13 weeks per quarter).
