// UI theme (#126): one look for every DOM panel. Installs
//   1. the pixel font (the game's own 3x5 glyphs as a web font, see pixel-font.js), and
//   2. the nine-slice frames from src/art/sprites-ui.js (UI_FRAMES_SRC) as CSS border images,
// then sets <html data-theme="pixel"> so src/ui/theme.css applies. Nothing here is new art: the font and the frames
// are existing sprites, drawn from the palette. `?theme=off` leaves the old look (for before/after captures).

import { UI_FRAMES_SRC } from '../art/sprites-ui.js';
import { HEX } from '../art/palette.js';
import { buildPixelFont, PIXEL_FONT_FAMILY } from './pixel-font.js';

/** Frame name -> CSS custom property. Each frame is used at a whole-number scale (theme.css). */
export const THEME_FRAMES = {
  panel: '--th-frame-panel',
  button: '--th-frame-button',
  buttonPressed: '--th-frame-button-down',
  buttonActive: '--th-frame-button-on',
  meter: '--th-frame-meter',
  tooltip: '--th-frame-tooltip',
  paper: '--th-frame-paper',
};

function frameURL(sprite) {
  const cv = document.createElement('canvas');
  cv.width = sprite.w; cv.height = sprite.h;
  const ctx = cv.getContext('2d');
  sprite.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const hex = HEX[row[x]];
      if (!hex) continue;
      ctx.fillStyle = hex; ctx.fillRect(x, y, 1, 1);
    }
  });
  return `url(${cv.toDataURL()})`;
}

let installed = null;

/** Install once; resolves when the font is ready (or failed, in which case the fallback mono font shows). */
export function installTheme({ root = document.documentElement, search = globalThis.location?.search ?? '' } = {}) {
  if (installed) return installed;
  if (/[?&]theme=off\b/.test(search)) return (installed = Promise.resolve(false));
  for (const [name, prop] of Object.entries(THEME_FRAMES)) {
    const f = UI_FRAMES_SRC[name];
    root.style.setProperty(prop, frameURL(f.sprite));
    root.style.setProperty(`${prop}-b`, String(f.border));
  }
  root.dataset.theme = 'pixel';
  let font = Promise.resolve(false);
  if (typeof FontFace !== 'undefined') {
    const face = new FontFace(PIXEL_FONT_FAMILY, buildPixelFont());
    font = face.load().then((f) => { document.fonts.add(f); return true; }).catch((e) => { console.warn('pixel font failed', e); return false; });
  }
  installed = font;
  return installed;
}
