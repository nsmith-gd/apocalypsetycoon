// Draw 64 px art at the resolution the canvas is really showing (director: zoomable shelter grid).
//
// The bunker editor draws in metres x 16 px and zooms by scaling the context (2x = 32 px per metre, 4x = 64).
// A plain drawImage of a 16 px copy would then be a blocky upscale. `drawCrisp` reads the context's current
// scale and asks for the art at tile x scale instead (the 64 px original at 4x), then draws it 1:1 in device
// space at the same spot. Callers pass `get(tile)`, which returns a canvas for that many px per metre.
//
//   drawCrisp(ctx, (tile) => amenityCanvas(kind, v, { tile }), px, py, 16, { flip })

/** Whole-number scale of the context's current transform (1 when it isn't scaled). */
export function ctxScale(ctx) {
  const m = ctx.getTransform?.();
  return m ? Math.max(1, Math.round(m.a)) : 1;
}

export function drawCrisp(ctx, get, px, py, tile = 16, { flip = false } = {}) {
  const s = ctxScale(ctx);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (s > 1) {
    const m = ctx.getTransform();
    const cv = get(Math.min(64, tile * s));
    const dx = Math.round(m.a * px + m.e), dy = Math.round(m.d * py + m.f);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (flip) { ctx.translate(dx + cv.width, dy); ctx.scale(-1, 1); ctx.drawImage(cv, 0, 0); } else ctx.drawImage(cv, dx, dy);
  } else {
    const cv = get(tile);
    if (flip) { ctx.translate(px + cv.width, py); ctx.scale(-1, 1); ctx.drawImage(cv, 0, 0); } else ctx.drawImage(cv, px, py);
  }
  ctx.restore();
}
