// Build feedback for the shelter builder (#128; gameplay note D5: "the whole game just looks so ugly and low
// fidelity"). Short pixel effects drawn on the builder canvas, in canvas pixels (T px per metre):
//   place      an order lands: corner brackets snap in onto the footprint, a blueprint flash, a puff of dust
//   complete   a piece is installed: a gold ring pulses out, sparkles rise, the outline flashes
//   room       a room comes together: its tier colour traces the walls, the floor flashes, its name floats up
//   upgrade    a style or finish goes on: a gold shimmer sweeps across the room, sparkles follow it
//   demolish   something is torn out: a red flash, a dust cloud, debris that falls and bounces
//   dug        a tile is dug out: a small burst of dirt in the stratum's colour
// plus the crews' tool animation (shovel, hammer, wrench) and the snapped placement preview.
//
//   const fx = createBuildFx({ T });  fx.add('place', { x, y, w, h }); ... fx.draw(ctx, now, PX, PY)
//   drawCrew(ctx, crew, px, py, frame, fx)   drawSnap(ctx, rect, ok, now)

const GOLD = ['#8a5a1a', '#c79430', '#f5c542', '#fff1a8'];
const DUST = ['#6a6058', '#8b8179', '#ab9f92', '#cfc4b4'];
const TIER = { survive: '#f5c542', comfort: '#c98a52', status: '#3aa866', delusion: '#a070e0' };
const DUR = { place: 650, complete: 1100, room: 1800, upgrade: 1300, demolish: 1200, dug: 500 };

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function createBuildFx({ T = 16 } = {}) {
  const list = [];
  let seed = 1;
  return {
    get active() { return list.length; },
    /** Start an effect. Rects are in tiles: x, y = left / TOP tile; w, h in tiles. */
    add(type, data = {}) {
      const r = rng(seed++ * 7919);
      const fx = { type, t0: data.now ?? performance.now(), ...data, parts: [] };
      const cx = (data.x + (data.w ?? 1) / 2) * T, cy = (data.y + (data.h ?? 1) / 2) * T;
      if (type === 'complete') for (let i = 0; i < 10; i++) fx.parts.push({ x: cx + (r() - 0.5) * (data.w ?? 1) * T, y: cy + (r() - 0.2) * (data.h ?? 1) * T * 0.5, vy: -18 - r() * 26, c: GOLD[2 + (i % 2)], d: r() * 200 });
      if (type === 'upgrade') for (let i = 0; i < 26; i++) fx.parts.push({ x: data.x * T + r() * (data.w ?? 1) * T, y: data.y * T + r() * (data.h ?? 1) * T, d: 150 + r() * 900, c: GOLD[2 + (i % 2)] });
      if (type === 'demolish') {
        for (let i = 0; i < 22; i++) fx.parts.push({ kind: 'puff', x: cx + (r() - 0.5) * (data.w ?? 1) * T, y: cy + (r() - 0.3) * (data.h ?? 1) * T, vx: (r() - 0.5) * 36, vy: -6 - r() * 16, s: 3 + Math.floor(r() * 4), c: DUST[Math.floor(r() * 4)] });
        for (let i = 0; i < 9; i++) fx.parts.push({ kind: 'chunk', x: cx + (r() - 0.5) * (data.w ?? 1) * T * 0.8, y: cy - (data.h ?? 1) * T * 0.3, vx: (r() - 0.5) * 70, vy: -40 - r() * 50, s: 1 + Math.floor(r() * 2), c: data.colour ?? DUST[Math.floor(r() * 4)] });
      }
      if (type === 'dug') for (let i = 0; i < 7; i++) fx.parts.push({ x: cx, y: cy, vx: (r() - 0.5) * 60, vy: -30 - r() * 40, c: data.colour ?? DUST[1 + (i % 2)] });
      if (type === 'place') for (let i = 0; i < 6; i++) fx.parts.push({ x: data.x * T + r() * (data.w ?? 1) * T, y: (data.y + (data.h ?? 1)) * T - 1, vx: (r() - 0.5) * 24, vy: -6 - r() * 8, c: DUST[2] });
      list.push(fx);
      return fx;
    },
    /** Draw and age every live effect. now = performance.now(); PX, PY map tiles to canvas px. */
    draw(ctx, now, PX, PY) {
      for (let i = list.length - 1; i >= 0; i--) {
        const fx = list[i], age = now - fx.t0, dur = DUR[fx.type] ?? 600;
        if (age > dur) { list.splice(i, 1); continue; }
        if (age < 0) continue;
        DRAW[fx.type]?.(ctx, fx, age / dur, age / 1000, PX, PY, T);
      }
      ctx.globalAlpha = 1;
    },
  };
}

const px = (ctx, x, y, c, s = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), s, s); };
const ease = (t) => 1 - (1 - t) * (1 - t);

/** Bright corner brackets around a canvas rect, `inset` px in from it. */
function brackets(ctx, x, y, w, h, c, len = 4, inset = 0, thick = 2) {
  for (let k = 0; k < thick; k++) bracket1(ctx, x + k, y + k, w - 2 * k, h - 2 * k, c, len - k, inset);
}
function bracket1(ctx, x, y, w, h, c, len, inset) {
  ctx.fillStyle = c;
  const L = Math.max(2, Math.min(len, Math.floor(w / 2), Math.floor(h / 2)));
  x = Math.round(x + inset); y = Math.round(y + inset); w = Math.round(w - 2 * inset); h = Math.round(h - 2 * inset);
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]) {
    ctx.fillRect(dx > 0 ? cx : cx - L + 1, cy, L, 1);
    ctx.fillRect(cx, dy > 0 ? cy : cy - L + 1, 1, L);
  }
}

const DRAW = {
  place(ctx, fx, t, s, PX, PY, T) {
    const x = PX(fx.x), y = PY(fx.y), w = fx.w * T, h = fx.h * T;
    const k = 1 - ease(Math.min(1, t * 1.6)); // brackets fly in from outside the footprint
    ctx.globalAlpha = 1 - t;
    brackets(ctx, x - k * 10, y - k * 10, w + k * 20, h + k * 20, '#f2e6c9', 5);
    ctx.globalAlpha = 0.28 * (1 - t);
    ctx.fillStyle = '#3f8fc8'; ctx.fillRect(x, y, w, h); // blueprint flash
    ctx.globalAlpha = 1 - t;
    for (const p of fx.parts) px(ctx, p.x + p.vx * s, p.y + p.vy * s + 30 * s * s, p.c);
  },
  complete(ctx, fx, t, s, PX, PY, T) {
    const x = PX(fx.x), y = PY(fx.y), w = fx.w * T, h = fx.h * T, cx = x + w / 2, cy = y + h / 2;
    const r = 4 + ease(t) * Math.max(w, h) * 0.9;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = GOLD[2];
    for (let a = 0; a < Math.PI * 2; a += 0.08) ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.7), 2, 2);
    if (t < 0.35) { ctx.globalAlpha = 1 - t / 0.35; ctx.strokeStyle = GOLD[3]; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
    ctx.globalAlpha = 1;
    for (const p of fx.parts) { const a = s * 1000 - p.d; if (a < 0) continue; const q = a / 600; if (q > 1) continue; ctx.globalAlpha = 1 - q; px(ctx, p.x, p.y + p.vy * (a / 1000), q < 0.5 ? GOLD[3] : p.c); if (q < 0.4) { px(ctx, p.x - 1, p.y + p.vy * (a / 1000), p.c); px(ctx, p.x + 1, p.y + p.vy * (a / 1000), p.c); } }
  },
  room(ctx, fx, t, s, PX, PY, T) {
    const c = TIER[fx.tier] ?? GOLD[2];
    // trace the walls: the lit part of the outline grows clockwise, then the whole room flashes and settles
    const x = PX(fx.x), y = PY(fx.y), w = fx.w * T, h = fx.h * T, per = 2 * (w + h);
    const lit = Math.min(1, t * 2.2) * per;
    ctx.globalAlpha = t < 0.75 ? 1 : (1 - t) * 4;
    ctx.fillStyle = c;
    for (let d = 0; d < lit; d += 1) {
      const [ox, oy] = d < w ? [d, 0] : d < w + h ? [w - 1, d - w] : d < 2 * w + h ? [w - 1 - (d - w - h), h - 1] : [0, h - 1 - (d - 2 * w - h)];
      ctx.fillRect(x + ox, y + oy, 1, 1); ctx.fillRect(x + ox + (ox === 0 ? 1 : ox === w - 1 ? -1 : 0), y + oy + (oy === 0 ? 1 : oy === h - 1 ? -1 : 0), 1, 1);
    }
    if (t > 0.42 && t < 0.75) { ctx.globalAlpha = 0.25 * (1 - (t - 0.42) / 0.33); ctx.fillRect(x, y, w, h); }
    if (fx.label && t > 0.3) { // the room's name floats up out of it
      ctx.globalAlpha = t < 0.85 ? 1 : (1 - t) / 0.15;
      const ty = Math.round(y - 4 - (t - 0.3) * 18);
      ctx.fillStyle = '#0a0807'; ctx.fillRect(x + 1, ty - 1, fx.label.length * 4 + 3, 7);
      fx.drawText?.(ctx, fx.label, x + 3, ty, c);
    }
  },
  upgrade(ctx, fx, t, s, PX, PY, T) {
    const x = PX(fx.x), y = PY(fx.y), w = fx.w * T, h = fx.h * T;
    const band = x - h + (w + 2 * h) * ease(t); // a diagonal shine sweeping left to right
    ctx.globalAlpha = 0.55 * (1 - t * 0.6);
    for (let j = 0; j < h; j++) for (let k = 0; k < 12; k++) { const bx = Math.round(band + j * 0.6 + k); if (bx >= x && bx < x + w) px(ctx, bx, y + j, k < 3 || k > 8 ? GOLD[2] : GOLD[3]); }
    ctx.globalAlpha = 0.18 * (1 - t); ctx.fillStyle = GOLD[2]; ctx.fillRect(x, y, Math.max(0, Math.min(w, band - x)), h); // the room left warmer behind the sweep
    ctx.globalAlpha = 1;
    for (const p of fx.parts) { const a = s * 1000 - p.d; if (a < 0 || a > 380) continue; const q = a / 380; ctx.globalAlpha = 1 - q; const r = q < 0.5 ? 2 : 1; for (let i = -r; i <= r; i++) { px(ctx, p.x + i, p.y, GOLD[3]); px(ctx, p.x, p.y + i, GOLD[3]); } }
  },
  demolish(ctx, fx, t, s, PX, PY, T) {
    const x = PX(fx.x), y = PY(fx.y), w = fx.w * T, h = fx.h * T;
    if (t < 0.25) { ctx.globalAlpha = 0.6 * (1 - t / 0.25); ctx.fillStyle = '#ff5a4f'; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1 - t / 0.25; for (let i = 0; i < Math.min(w, h); i++) { px(ctx, x + i * (w / Math.min(w, h)), y + i * (h / Math.min(w, h)), '#ff5a4f'); px(ctx, x + w - 1 - i * (w / Math.min(w, h)), y + i * (h / Math.min(w, h)), '#ff5a4f'); } }
    for (const p of fx.parts) {
      if (p.kind === 'puff') { ctx.globalAlpha = 0.85 * (1 - t); const g = Math.round(p.s + t * 9); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x + p.vx * s - g / 2), Math.round(p.y + p.vy * s - g / 2), g, g); }
      else { ctx.globalAlpha = 1 - Math.max(0, t - 0.6) / 0.4; let yy = p.y + p.vy * s + 160 * s * s; const floor = p.y + (fx.h ?? 1) * T * 0.6; if (yy > floor) yy = floor; px(ctx, p.x + p.vx * s, yy, p.c, p.s); }
    }
  },
  dug(ctx, fx, t, s) {
    ctx.globalAlpha = 1 - t;
    for (const p of fx.parts) px(ctx, p.x + p.vx * s, p.y + p.vy * s + 140 * s * s, p.c);
  },
};

/** A crew at work: hard hat, the tool for its job swinging on a two-frame cycle, and chips flying from it. */
export function drawCrew(ctx, crew, x, y, frame, fx = null) {
  const swing = Math.floor(frame / 6) % 2; // ~5 swings a second at 60 fps
  const bob = swing;
  y += 3 - bob;
  x += 4;
  px(ctx, x + 1, y, '#f5c542'); ctx.fillRect(x + 1, y, 6, 3); // hard hat
  ctx.fillStyle = '#c79430'; ctx.fillRect(x + 1, y + 2, 6, 1);
  ctx.fillStyle = '#e0b090'; ctx.fillRect(x + 2, y + 3, 4, 3); // face
  ctx.fillStyle = '#ff9f1c'; ctx.fillRect(x + 1, y + 6, 6, 4); // hi-vis vest
  ctx.fillStyle = '#f2e6c9'; ctx.fillRect(x + 1, y + 8, 6, 1);
  ctx.fillStyle = '#3a3a5a'; ctx.fillRect(x + 1, y + 10, 2, 3); ctx.fillRect(x + 5, y + 10, 2, 3);
  const type = crew.type;
  ctx.fillStyle = '#8b8179';
  if (type === 'dig') { // shovel: raised, then driven down into the face
    if (swing) { ctx.fillStyle = '#6e4428'; ctx.fillRect(x + 7, y + 1, 1, 7); ctx.fillStyle = '#9aa3ad'; ctx.fillRect(x + 7, y - 1, 2, 3); }
    else { ctx.fillStyle = '#6e4428'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 7 + i, y + 6 + (i >> 1), 1, 1); ctx.fillStyle = '#9aa3ad'; ctx.fillRect(x + 12, y + 8, 3, 3); }
    if (fx && frame % 12 === 0) fx.add('dug', { x: crew.x, y: crew.y, w: 1, h: 1, colour: '#8a4422' }).parts.splice(3);
  } else if (type === 'build' || type === 'conduit') { // hammer, with a spark on the strike
    if (swing) { ctx.fillStyle = '#6e4428'; ctx.fillRect(x + 7, y + 2, 1, 5); ctx.fillStyle = '#525862'; ctx.fillRect(x + 6, y + 1, 3, 2); }
    else { ctx.fillStyle = '#6e4428'; ctx.fillRect(x + 7, y + 6, 4, 1); ctx.fillStyle = '#525862'; ctx.fillRect(x + 10, y + 5, 2, 3); ctx.fillStyle = '#fff1a8'; ctx.fillRect(x + 12, y + 4, 1, 1); ctx.fillRect(x + 13, y + 6, 1, 1); ctx.fillRect(x + 12, y + 8, 1, 1); }
  } else { // fitting out: a wrench turning
    ctx.fillStyle = '#9aa3ad';
    if (swing) { ctx.fillRect(x + 7, y + 4, 4, 1); ctx.fillRect(x + 10, y + 3, 1, 3); } else { ctx.fillRect(x + 7, y + 6, 4, 1); ctx.fillRect(x + 10, y + 5, 1, 3); }
  }
}

/** The placement preview: animated corner brackets snapped to the footprint, green when it fits, red (hatched) when not. */
export function drawSnap(ctx, x, y, w, h, ok, now) {
  const pulse = Math.floor(now / 160) % 2;
  ctx.globalAlpha = 1;
  brackets(ctx, x - 2 - pulse, y - 2 - pulse, w + 4 + 2 * pulse, h + 4 + 2 * pulse, ok ? '#7ed957' : '#ff5a4f', 5);
  if (!ok) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff5a4f'; for (let i = 0; i < w + h; i += 4) for (let j = 0; j < 2; j++) { const xx = x + i - j; for (let k = 0; k < h; k++) if (xx - k >= x && xx - k < x + w) ctx.fillRect(xx - k, y + k, 1, 1); } ctx.globalAlpha = 1; }
  else { ctx.globalAlpha = 0.12 + 0.06 * pulse; ctx.fillStyle = '#7ed957'; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
}
