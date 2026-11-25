STATUS: DONE
The bunker builder now zooms and pans. The 64 px ground, furniture and fixtures sharpen as you zoom in instead of being stretched.
- Zoom levels are 1× (the whole site, as before), 2×, 4× (the 64 px art at full detail) and 8× (close-up). Use the − / + / FIT buttons next to PHOTO, the + / − / 0 keys, or Ctrl + mouse wheel (trackpad pinch); wheel zoom keeps the spot under the cursor in place.
- To pan, scroll as before, drag with the middle mouse button, or hold Space and drag. Clicking, digging and placing still land on the right tile at every zoom, and photo mode still frames the shot.
- Zoomed in, only the part of the site on screen is redrawn, so it stays smooth: about 7 ms a frame at 4×, against 17 ms for the whole site at 1×.
- Older pieces not yet redrawn at 64 px (the generator, fuel and battery boxes, and the people) look blocky up close. They belong to the furniture redo.
- Assumptions: the view opens at 1×, the whole site, like today. Plain scrolling still scrolls, and zooming needs Ctrl, so the page doesn't zoom by accident.
- Captures: zoom-1x-whole-site.png, zoom-2x.png, zoom-4x.png, zoom-4x-lounge-native.png, zoom-8x.png, zoom-8x-panned.png and zoom-4x-hover.png.
PR: https://github.com/nsmith-gd/apocalypsetycoon/pull/PRNUM

## Questions
### Should the bunker builder open zoomed in rather than showing the whole site?
Context: the builder still opens at 1×, where the whole plot fits on screen but each metre is small and most of the new detail is averaged away. Zooming to 4× shows the rooms at full detail, but you see a few rooms at a time and pan to the rest.
Options: - Open at 1× (whole site; zoom in for detail) - Open at 2× centred on the built rooms - Open at 4× centred on the built rooms
Going with: open at 1×, the same as before, so nobody loses the overview; zoom is one key or click away.
Capture: zoom-4x-lounge-native.png
