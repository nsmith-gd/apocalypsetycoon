# Crisis states over the world map: region x state check (#104)

Run against the map that is in the game today. The redone base, borders, markers and heat overlay (#100-#103)
have not landed yet. Re-run with `node tools/map-crisis-check.cjs` (repo served on :8123) when they do.

AUTO = measured: the state's art stays inside the region, covers every visible land cell, and reads stronger
than the state below. EYE = judged on the x4 contact sheets (state-*.png, state-mixed.png).

| Region | Uneasy (40-69) | Edge (70-89) | Tipping (90+) | Selected outline |
|---|---|---|---|---|
| North America | AUTO pass · EYE fail (weak) | pass | pass | pass |
| Latin America | AUTO pass · EYE fail (weak) | pass | pass | pass |
| Europe | AUTO pass · EYE fail (weak) | pass | pass | pass |
| Africa | AUTO pass · EYE fail (weak) | AUTO pass · EYE fail (Sahara: low contrast) | pass | pass |
| Middle East | AUTO pass · EYE fail (weak) | AUTO pass · EYE fail (desert: low contrast) | pass | pass |
| South Asia | AUTO pass · EYE fail (weak) | pass | pass | pass |
| East Asia | AUTO pass · EYE fail (weak; strip) | AUTO pass · EYE fail (strip) | AUTO pass · EYE fail (strip) | pass |
| Oceania | AUTO pass · EYE fail (weak) | AUTO pass · EYE fail (desert: low contrast) | pass | pass |

Calm (under 40) has no overlay by design and is the reference frame for every diff.
Measured coverage of a region's pixels: uneasy 6-8%, edge 21-26%, tipping 40-50%. No state drew a single pixel
outside its own region (bleed 0 everywhere).

## Failures, for #47's art
1. **Uneasy reads as texture, not a state.** Sparse gold dots (6-8% of the region) sit on grass tiles that already
   carry yellow-green flecks; at a glance an uneasy region looks calm. Suggest a faint tinted wash or denser
   dither, still lighter than Edge.
2. **Edge over desert is low-contrast.** The orange dither on the sand/clay desert tiles (Middle East, the Sahara,
   central Oceania) is close to the base colours. Suggest the Edge colour carry a darker outline pixel or a value
   step that separates it from sand.
3. **East Asia paints a thin strip beside South Asia.** The region split gives East Asia the land column east of
   South Asia, so East Asia's state shows as a stripe running down next to South Asia (state-mixed.png, right
   side). This is a region-border issue for #101's borders, not #47's art.
4. **Tipping buries the terrain.** Readable as an alarm, but it hides all base detail. On a reference-fidelity
   base (#100) that loses the new art; suggest the tipping dither leave the base visible through roughly half
   its pixels, with the blink doing the alarm work.

## Risk once the redone base lands
All states are drawn as whole 8x8 cells. On a base with pixel-level coastlines like the reference
(ffd5a215d5-pixel-earth.png), a cell that is half sea will get state art on its water pixels. The overlays should
be masked to land pixels. The check will catch this: it counts bleed against region cells, and should be
tightened to land pixels once the new base exposes a land mask.
