# Social layer: events, guests, dialogue (#60, director note D2)

UI hooks for "go to events, talk to guests, come home with leads". The UI reads ONE view-model and never
touches the rules directly, so the final screens (#19 + art tasks) can replace the placeholder screens.

- `viewmodel.js` `SocialSession({ circuit (EventCircuit), leads (LeadInventory), getQuarter, getCash, addHeat,
  addReputation, pushback?, press?, dialogueFactory?, rng? })`
  - `screen`: `events` -> `guests` -> `dialogue` -> `result` -> (`guests` ...) -> `summary` -> `events`
  - views: `eventsView()`, `guestsView()`, `dialogueView()` (line, transcript, choices with risk `tags`:
    FEAR / FLATTER / PROMISE / PUSHY / RISKY), `resultView()`, `summaryView()`
  - actions: `attend(venueId)`, `talk(guestId)`, `choose(choiceId)`, `backToGuests()`, `leave()`, `close()`
  - A finished conversation runs `resolveOutcome` + `applyOutcome` (src/dialogue/outcomes.js): lead into the
    pipeline, heat, reputation, slips; marks the guest met in the EventCircuit.
- `tree-dialogue.js`: the default; plays the authored archetype trees (#56) via `Conversation`, falls back to the stub.
- `dialogue-stub.js`: STAND-IN runner + one placeholder conversation covering all seven #55 endings. The real
  engine (#54) and authored trees (#56) plug in via `dialogueFactory(guest, { venueId, journalistPresent, quarter })`,
  returning a session with `node()`, `choose(id)`, `done`, `ending`, `effects`, `transcript` (see the file header).
- `text-screens.js` + `social.css`: PLACEHOLDER text-only screens. Number keys pick items; 0 closes / leaves.
- Campaign: EVENTS button (or E) in the HUD; the venue catalog loads async; the EventCircuit is saved as `events`.
