// UI theme (#126, overhauled in #159): one look for every DOM panel, set by src/ui/theme.css.
// #159 replaced #126's bunker-brown frames and 3x5 capitals with the director's reference look: the world fills the
// screen and the interface is thin, lit instrument glass over it (dark glass, teal hairlines, corner brackets,
// neon-sign buttons), lettered in two open-licence pixel fonts vendored in assets/fonts:
//   Jersey 10 (titles, numbers, buttons; crisp at 20/30/40 px) and VT323 (labels and sentences; crisp at 16 px).
// This marks <html data-theme="pixel"> and waits for the fonts. `?theme=off` keeps the old look for comparisons.

export const THEME_FONTS = ["20px 'Jersey 10'", "16px 'VT323'"];

let installed = null;

/** Install once; resolves when both fonts are ready (true), or false with `?theme=off` / no font loading. */
export function installTheme({ root = document.documentElement, search = globalThis.location?.search ?? '' } = {}) {
  if (installed) return installed;
  if (/[?&]theme=off\b/.test(search)) return (installed = Promise.resolve(false));
  root.dataset.theme = 'pixel';
  installed = document.fonts?.load
    ? Promise.all(THEME_FONTS.map((f) => document.fonts.load(f))).then(() => true).catch(() => false)
    : Promise.resolve(false);
  return installed;
}
