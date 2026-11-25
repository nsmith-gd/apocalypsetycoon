# Pixel-perfect rendering: test note (#127)

**Rule:** every pixel-art canvas shows at a whole number of **device** pixels per art pixel (the same on both axes),
its top-left sits on a device pixel, and it is drawn nearest-neighbour (`image-rendering: pixelated`). The pixel
font is drawn at a whole number of device pixels per font pixel. Whole CSS pixels are not enough: at Windows' 125%
a 2x CSS scale is 2.5 real pixels, so alternate art pixels come out 2 and 3 pixels wide.

**How:** `src/ui/pixel-perfect.js` (`deviceScale`, `sizeCanvas`, `fitCanvas`, `snapToDevice`, `onPixelRatioChange`,
and `installPixelPerfect`, which sets `--px-N`: N px rounded to device pixels, so the theme's font and frames are
whole at any ratio). The world map, shelter editor, Doom Clock face, Days Sealed emblem, title sky, Midnight
scene and `fitIntegerScale` all size through it. Leftover space is letterboxed (the map and Midnight scene are
centred; the title sky is painted at the window's size instead of being stretched). Moving a window to another
screen or zooming the browser re-fits.

**Camera:** the shelter grid and map have no free camera yet; the grid scrolls in its scroller (the browser scrolls
in whole device pixels) and map zoom is the window-size fit above. Any future pan or zoom should use `snapPx` for
offsets and `deviceScale` for zoom steps.

**Check:** serve the repo (`python3 -m http.server 8123`), then `node tools/pixel-perfect-check.cjs [outDir] [label]`.
It opens title, shelter, world map and Midnight at 9 sizes and measures every visible canvas and the font.

| Size | Viewport @ ratio | Before (main) | After |
|---|---|---|---|
| 1080p | 1920x1080 @1 | clock face 1.5x, emblem/grid squeezed | PASS |
| 1440p | 2560x1440 @1 | same + canvases at x.41 device px | PASS |
| 4K at 200% | 1920x1080 @2 | emblem 2.25x, font 3.67 px | PASS |
| 4K at 100% | 3840x2160 @1 | clock 1.5x, offsets | PASS |
| Ultrawide | 3440x1440 @1 | title sky 10.75 x 8 (stretched) | PASS |
| Laptop 125% | 1536x864 @1.25 | map 3.75x, font 2.5 px, clock 1.875x | PASS |
| Laptop 150% | 1280x720 @1.5 | map 1.5x, font 4.5 px | PASS |
| Windowed | 1280x720 @1 | clock 1.5x | PASS |
| Windowed odd | 1366x768 @1 | grid squeezed to 0.93x, sky 4.27x | PASS |

Before: 70 problems. After: 0. Results: `.ballast/media/t127/{before,after}-check.json`; screenshots alongside.
