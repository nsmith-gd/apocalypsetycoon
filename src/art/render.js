// Pixel-art renderer: turns pixel-map sprites into cached canvases and draws them
// at integer scale only (pixel-perfect). Works in any browser canvas.
//
// Sprite format: { w, h, rows: ['..KK..', ...] } where every character is a key
// from PALETTE ('.' or ' ' = transparent). Rows shorter than w are padded with '.'.
// Optional `frames: [rows, rows, ...]` for animation (rows = frames[0]).

import { HEX } from './palette.js';

const cache = new Map();

export function validateSprite(name, s) {
  const errors = [];
  const frames = s.frames ?? [s.rows];
  frames.forEach((rows, f) => {
    if (rows.length !== s.h) errors.push(`${name}[${f}]: ${rows.length} rows, expected ${s.h}`);
    rows.forEach((row, y) => {
      if (row.length > s.w) errors.push(`${name}[${f}] row ${y}: ${row.length} chars, expected <= ${s.w}`);
      for (const ch of row) if (ch !== '.' && ch !== ' ' && !HEX[ch]) errors.push(`${name}[${f}] row ${y}: unknown colour '${ch}'`);
    });
  });
  return errors;
}

/** Returns an offscreen canvas holding the sprite at 1x. */
export function spriteCanvas(sprite, frame = 0) {
  const key = sprite;
  let frames = cache.get(key);
  if (!frames) {
    frames = (sprite.frames ?? [sprite.rows]).map((rows) => {
      const cv = document.createElement('canvas');
      cv.width = sprite.w;
      cv.height = sprite.h;
      const ctx = cv.getContext('2d');
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const hex = HEX[row[x]];
          if (!hex) continue;
          ctx.fillStyle = hex;
          ctx.fillRect(x, y, 1, 1);
        }
      });
      return cv;
    });
    cache.set(key, frames);
  }
  return frames[frame % frames.length];
}

/** The size a sprite occupies in its slot: a remastered sprite (#116) keeps its master's footprint. */
export const footprint = (sprite, native = false) => (!native && sprite.base ? sprite.base : { w: sprite.w, h: sprite.h });

/**
 * Draw a sprite at (x, y) in the context's own pixel space. Integer positions only.
 * Remastered sprites (#116) draw into their master's footprint, so every existing slot still lines up;
 * pass { native: true } to draw them at full resolution (e.g. a 4x zoomed view), or { size: [w, h] }.
 */
export function drawSprite(ctx, sprite, x, y, { frame = 0, flip = false, native = false, size = null } = {}) {
  ctx.imageSmoothingEnabled = false;
  const cv = spriteCanvas(sprite, frame);
  const { w, h } = size ? { w: size[0], h: size[1] } : footprint(sprite, native);
  if (!flip) return ctx.drawImage(cv, Math.round(x), Math.round(y), w, h);
  ctx.save();
  ctx.translate(Math.round(x) + w, Math.round(y));
  ctx.scale(-1, 1);
  ctx.drawImage(cv, 0, 0, w, h);
  ctx.restore();
}

/** Tile a sprite over a rectangle (e.g. earth fill). */
export function tileSprite(ctx, sprite, x, y, w, h) {
  const f = footprint(sprite);
  for (let ty = y; ty < y + h; ty += f.h) for (let tx = x; tx < x + w; tx += f.w) drawSprite(ctx, sprite, tx, ty);
}

/**
 * Nine-slice: sprite is split into a 3x3 grid using `border` px corners.
 * Draws a frame of any size w x h (in sprite pixels).
 */
export function drawNineSlice(ctx, sprite, x, y, w, h, border) {
  if (sprite.base && typeof document !== 'undefined') {
    // remastered frame (#116): slice at full resolution, then fit into the w x h footprint
    const k = sprite.scale;
    const off = document.createElement('canvas');
    off.width = w * k; off.height = h * k;
    drawNineSlice(off.getContext('2d'), { ...sprite, base: null }, 0, 0, w * k, h * k, border * k);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, Math.round(x), Math.round(y), w, h);
    return;
  }
  const cv = spriteCanvas(sprite);
  const b = border;
  const mw = sprite.w - 2 * b;
  const mh = sprite.h - 2 * b;
  ctx.imageSmoothingEnabled = false;
  const part = (sx, sy, sw, sh, dx, dy, dw, dh) => {
    if (dw <= 0 || dh <= 0) return;
    // tile (not stretch) the middle parts so dithering stays crisp
    for (let ty = 0; ty < dh; ty += sh) for (let tx = 0; tx < dw; tx += sw) {
      const cw = Math.min(sw, dw - tx);
      const ch = Math.min(sh, dh - ty);
      ctx.drawImage(cv, sx, sy, cw, ch, dx + tx, dy + ty, cw, ch);
    }
  };
  part(0, 0, b, b, x, y, b, b);
  part(b, 0, mw, b, x + b, y, w - 2 * b, b);
  part(b + mw, 0, b, b, x + w - b, y, b, b);
  part(0, b, b, mh, x, y + b, b, h - 2 * b);
  part(b, b, mw, mh, x + b, y + b, w - 2 * b, h - 2 * b);
  part(b + mw, b, b, mh, x + w - b, y + b, b, h - 2 * b);
  part(0, b + mh, b, b, x, y + h - b, b, b);
  part(b, b + mh, mw, b, x + b, y + h - b, w - 2 * b, b);
  part(b + mw, b + mh, b, b, x + w - b, y + h - b, b, b);
}

/**
 * Pixel-perfect canvas fitting: sets the canvas CSS size to the largest integer
 * multiple of its native size that fits the available width/height.
 */
export function fitIntegerScale(canvas, maxW, maxH = Infinity) {
  const scale = Math.max(1, Math.floor(Math.min(maxW / canvas.width, maxH / canvas.height)));
  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;
  canvas.style.imageRendering = 'pixelated';
  return scale;
}
