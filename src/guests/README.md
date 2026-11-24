# Guest roster (#53, director note D2)

- `data/guests.json` — 15 archetypes (The Prepping Dentist ... The Table Envoy), 20 traits and the conversation
  approaches (`flattery, facts, fear, exclusivity, discount, charity, gossip, legacy`). Traits are personality (vain,
  paranoid, skeptical, generous, gossipy, impatient, competitive, sentimental) or the GDD's client traits (engineer,
  germaphobe, influencer, collector, penny-pincher, knows too much...). Each lists the approaches it `likes`/`dislikes`
  (for the dialogue engine, #54); `hidden` traits are revealed only in conversation; `fearBoost` multiplies a fear.
- `guests.js` — `loadGuestRoster()` / `parseGuestRoster(json)` (validates every reference: classes C1-C5, GDD regions,
  threat track ids from `src/world/tracks.js`, traits, approaches; throws listing every problem).
  `rollGuest(roster, rng, { archetypeId, wealthClass, region, world, tension, themes })` and
  `generateGuestList(roster, { seed, count, classes, region, world, tension, themes })` (seeded, no repeated archetype
  in a list while others fit). Fears move to the track running in the same slot of this world; hot tracks and venue
  themes raise a fear's weight.
- Events: `new EventCircuit({ ..., guestRoster, roster })` rolls each venue's crowd from the archetypes (falls back to
  the old name-only guests without a roster). Guests keep `{ id, name, wealthClass, region, fears, venueId }` for the
  lead pipeline and add `archetype, title, wealthTier, budget, dominantFear, traits, hiddenTraits`.
