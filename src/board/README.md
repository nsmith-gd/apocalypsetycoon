# The board (#18) — GDD: The company and the board

`board.js` — `new Board({ ledger, seed, supports })`. Pure rules, no DOM. Wired in `src/campaign/main.js`.

- Five members (Vane, Kettering, Faraday, Sandoval, Mr. Gray), each with confidence 0-100 (start 60). The average is
  board confidence. Mr. Gray counts as the average of the other four until Q11 (4:30), then takes his seat and issues
  one of the two directives every meeting.
- `review(facts)` at every quarter end: revenue vs quota (+5 all / +10 if beaten by 25% / -15 if missed), last
  meeting's directives (+8 and a Favour / -5), hates (breaches -5 Vane and Priya each; calming schemes -2 Bryce),
  `confidenceShift` (crisis fallout), then state: Bullish 80+ (investment round = 25% of the next quota, cash only),
  Steady, Scrutiny 25-49 (scheme heat x1.2 via `pushback.schemeHeatMultiplier`), Probation 1-24 (`minderVeto()`:
  the campaign vetoes the first scheme each quarter), Ousted 0 (campaign over). Returns lines for the quarter report.
- Quota: `quotaFor(n)` = $6M x 1.3^(n-1) x `BOARD.quotaScale` (0.025 while the economy runs in $K; 1 at GDD scale).
  Revenue = all ledger income that quarter except investment rounds (`quarterRevenue`).
- `refuse(id)` (-3, one per meeting), `vote(need, { spendFavours })`, `toJSON()/load()`.
- `react(id, amount, why)` (#67): a member reacts mid-quarter (contained breaches); listed at the next review.
- Facts used by directives: revenue, heat, tensions, openTracks, brinkTracks, breaches, handovers, schemesRun,
  arkStarted. Only directives whose facts are in `supports` are issued.

Pushback's old three-strikes profit target is still there for the sim and demos (`board.enabled`), and is turned off
in the campaign.
