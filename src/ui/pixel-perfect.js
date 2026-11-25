// Pixel-perfect display (#127): every pixel-art canvas shows at a whole number of DEVICE pixels per art pixel, sits on
// a device pixel, and is drawn with nearest-neighbour filtering. Whole CSS pixels are not enough: a 125% Windows
// laptop turns a 2x CSS scale into 2.5 real pixels, so every other art pixel comes out a pixel wider.
//
//   const k = deviceScale(nativeW, nativeH, availCssW, availCssH)  // whole device px per art px (>= 1)
//   sizeCanvas(canvas, nativeW, nativeH, k)                         // CSS size = native * k / dpr, pixelated
//   fitCanvas(canvas, availCssW, availCssH)                         // both of the above for a canvas's own size
//   snapToDevice(el)                                                // nudge el so its top-left lands on a device px
//   snapPx(v)                                                       // a CSS length rounded to whole device px
//   onPixelRatioChange(fn)                                          // browser zoom / moving to another screen
//   installPixelPerfect()                                           // page-wide: theme units + snapping (boot)

export const dpr = () => (typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1);

/** Whole device pixels per art pixel for the largest fit inside the available CSS box (at least 1). */
export function deviceScale(nativeW, nativeH, availW, availH = Infinity, { max = Infinity } = {}) {
  const r = dpr();
  return Math.max(1, Math.min(max, Math.floor(Math.min((availW * r) / nativeW, (availH * r) / nativeH) + 1e-6)));
}

/** CSS length (px) of `n` art pixels at `k` device px each. */
export const cssLen = (n, k) => (n * k) / dpr();

/** Size a canvas at `k` device px per art pixel. Returns k. */
export function sizeCanvas(canvas, nativeW, nativeH, k) {
  const w = `${cssLen(nativeW, k)}px`, h = `${cssLen(nativeH, k)}px`;
  if (canvas.style.width !== w) canvas.style.width = w;
  if (canvas.style.height !== h) canvas.style.height = h;
  canvas.style.imageRendering = 'pixelated';
  canvas.dataset.px = String(k);
  return k;
}

/** Fit a canvas (its own width/height are the art size) into an available CSS box at a whole device scale. */
export function fitCanvas(canvas, availW, availH = Infinity, opts) {
  return sizeCanvas(canvas, canvas.width, canvas.height, deviceScale(canvas.width, canvas.height, availW, availH, opts));
}

/** A CSS length rounded to whole device pixels. */
export const snapPx = (v) => Math.round(v * dpr()) / dpr();

/**
 * Move `el` by less than a device pixel so its top-left sits exactly on one (layout above it can leave it at x.4).
 * Uses `translate`, so it doesn't disturb layout; safe to call again after any layout change.
 */
export function snapToDevice(el) {
  if (!el?.isConnected) return;
  el.style.translate = '';
  const r = el.getBoundingClientRect(), d = dpr();
  const fx = r.left * d - Math.round(r.left * d), fy = r.top * d - Math.round(r.top * d);
  if (Math.abs(fx) > 0.01 || Math.abs(fy) > 0.01) el.style.translate = `${-fx / d}px ${-fy / d}px`;
}

/** Call fn when the device pixel ratio changes (browser zoom, dragging the window to another screen). */
export function onPixelRatioChange(fn) {
  if (typeof matchMedia !== 'function') return () => {};
  let mq = null, stop = false;
  const arm = () => {
    if (stop) return;
    mq = matchMedia(`(resolution: ${dpr()}dppx)`);
    mq.addEventListener('change', fire, { once: true });
  };
  const fire = () => { fn(dpr()); arm(); };
  arm();
  return () => { stop = true; mq?.removeEventListener('change', fire); };
}

// ------------------------------------------------------------------------------------------ page-wide setup
/**
 * Sets CSS custom properties the theme sizes from, so the pixel font and frame pixels are whole device pixels at any
 * pixel ratio:  --px-1 = one art pixel at "1x" (1 device px per CSS px, rounded), --px-2 = at "2x", ...
 * e.g. at 125%: --px-2 = 2/1.25 px = 1.6px CSS = exactly 2 device px.
 * Also keeps every canvas marked `data-snap` on a device pixel.
 */
let installed = false;
export function installPixelPerfect(root = globalThis.document?.documentElement) {
  if (installed || !root) return;
  installed = true;
  const setUnits = () => {
    const d = dpr();
    for (let n = 1; n <= 8; n++) root.style.setProperty(`--px-${n}`, `${Math.max(1, Math.round(n * d)) / d}px`);
    root.dataset.dpr = String(d);
  };
  setUnits();
  onPixelRatioChange(() => { setUnits(); snapAll(); });
  const snapAll = () => { for (const el of document.querySelectorAll('[data-snap]')) snapToDevice(el); };
  let queued = false;
  const later = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; snapAll(); }); };
  addEventListener('resize', later);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(later).observe(document.body ?? root);
  if (typeof MutationObserver !== 'undefined') new MutationObserver(later).observe(document.body ?? root, { childList: true, subtree: true });
}
