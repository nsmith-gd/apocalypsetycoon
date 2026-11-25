// Lighting and atmosphere (#130; gameplay note D5: "the whole game just looks so ugly and low fidelity").
//
// One mood for the whole game, read from the world's tension and the Doom Clock: calm luxury (warm, bright, soft
// shadows), the edge (amber, the corners closing in, colour draining) and runaway dread (red, dark, flickering
// power). The shelter gets a 2D lighting layer on top: lamps, gold taps, cryo pods, aquariums and screens throw
// coloured light, furniture sits in soft contact shadows; then the mood's grade (tint, darkening, vignette,
// desaturation, flicker). The world map gets the same grade over its terrain and heat (labels stay crisp).
// Settings > Reduced lighting turns it down: no flicker or vignette, half the grade, soft glows only.
//
//   const mood = moodOf({ tension, minutes, startMinutes })   -> { name, dread 0..1, grade }
//   drawGrade(ctx, w, h, mood.grade, { time, reduced })        (any canvas; composites onto what is there)
//   drawShelterLight(ctx, lights, shadows, mood.grade, { time, reduced })

export const MOODS = Object.freeze(['calm', 'edge', 'runaway']);

// The three presets; anything between is a blend (dread 0 = calm, 0.5 = edge, 1 = runaway).
export const PRESETS = Object.freeze({
  calm: { tint: [255, 214, 150], tintA: 0.07, dark: 0.0, vignette: 0.22, desat: 0.0, flicker: 0, glow: 1.0, shadow: 0.35 },
  edge: { tint: [255, 150, 40], tintA: 0.12, dark: 0.12, vignette: 0.42, desat: 0.18, flicker: 0, glow: 0.85, shadow: 0.45 },
  runaway: { tint: [255, 40, 30], tintA: 0.16, dark: 0.36, vignette: 0.62, desat: 0.38, flicker: 0.5, glow: 0.65, shadow: 0.55 },
});

const lerp = (a, b, t) => a + (b - a) * t;
/** The grade at a level of dread (0 calm .. 0.5 edge .. 1 runaway). */
export function gradeAt(dread) {
  const d = Math.max(0, Math.min(1, dread));
  const [A, B, t] = d <= 0.5 ? [PRESETS.calm, PRESETS.edge, d / 0.5] : [PRESETS.edge, PRESETS.runaway, (d - 0.5) / 0.5];
  const out = {};
  for (const k of Object.keys(A)) out[k] = Array.isArray(A[k]) ? A[k].map((v, i) => Math.round(lerp(v, B[k][i], t))) : lerp(A[k], B[k], t);
  return out;
}

/**
 * The mood from the world. Tension (0..100, the hottest crisis track) sets most of it; the Doom Clock adds dread as
 * the minutes to Midnight run out. `force` ('calm' | 'edge' | 'runaway') pins a preset (comparisons, demos).
 */
export function moodOf({ tension = 0, minutes = null, startMinutes = 15, force = null } = {}) {
  let dread;
  if (MOODS.includes(force)) dread = { calm: 0, edge: 0.5, runaway: 1 }[force];
  else {
    const fromTension = tension < 40 ? (tension / 40) * 0.25 : tension < 70 ? 0.25 + ((tension - 40) / 30) * 0.35 : 0.6 + Math.min(1, (tension - 70) / 25) * 0.4;
    const fromClock = minutes == null ? 0 : Math.max(0, 1 - minutes / Math.max(1, startMinutes)) * 0.85; // Midnight looms
    dread = Math.min(1, Math.max(fromTension, fromClock));
  }
  const name = dread < 0.34 ? 'calm' : dread < 0.75 ? 'edge' : 'runaway';
  return { name, dread, grade: gradeAt(dread) };
}

/** Power flicker for runaway: mostly steady, with short dips (deterministic in time). */
function flickerAt(time, amount) {
  if (!amount) return 0;
  const k = Math.floor(time / 90);
  const h = ((k * 2654435761) >>> 0) / 4294967296;
  return h > 0.93 ? amount * (0.5 + (h - 0.93) * 7) : h > 0.86 ? amount * 0.25 : 0;
}

/** The mood's colour grade over everything already on ctx (w x h). */
export function drawGrade(ctx, w, h, g, { time = 0, reduced = false } = {}) {
  const k = reduced ? 0.5 : 1;
  const op = ctx.globalCompositeOperation;
  ctx.save();
  if (g.desat > 0.01) { ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = g.desat * k; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h); }
  if (g.tintA > 0.005) { ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = Math.min(1, g.tintA * 2.4 * k); ctx.fillStyle = `rgb(${g.tint.join(',')})`; ctx.fillRect(0, 0, w, h); }
  const dark = g.dark * k + (reduced ? 0 : flickerAt(time, g.flicker));
  if (dark > 0.005) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = Math.min(0.9, dark); ctx.fillStyle = '#1a1020'; ctx.fillRect(0, 0, w, h); }
  if (g.vignette > 0.01 && !reduced) {
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const r = Math.hypot(w, h) / 2;
    const grad = ctx.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
    grad.addColorStop(0, 'rgba(10,8,7,0)');
    grad.addColorStop(1, `rgba(10,8,7,${g.vignette.toFixed(3)})`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
  ctx.globalCompositeOperation = op;
}

// What gives off light in the shelter, and in what colour (the object kinds of the bunker catalog).
export const LIGHT_SOURCES = Object.freeze({
  lamp: { c: [255, 200, 120], r: 2.6 }, sconce: { c: [255, 196, 120], r: 2.2 }, pendant: { c: [255, 210, 140], r: 2.4 },
  chandelier: { c: [255, 225, 150], r: 3.6 }, fireplace: { c: [255, 120, 40], r: 3.0, flick: 1 },
  gold_taps: { c: [255, 205, 70], r: 2.2 }, trophy: { c: [255, 205, 70], r: 1.6 }, // the gold catches the light
  cryo_pod: { c: [110, 220, 255], r: 3.0 }, aquarium: { c: [80, 170, 255], r: 2.6 }, led_sky: { c: [200, 230, 255], r: 3.4 },
  faux_window: { c: [220, 235, 255], r: 3.0 }, tv: { c: [120, 180, 255], r: 2.2, flick: 0.5 }, cinema_screen: { c: [150, 190, 255], r: 3.4, flick: 0.5 },
  neon_sign: { c: [255, 80, 200], r: 2.8 }, arcade: { c: [160, 90, 255], r: 2.0, flick: 0.5 }, grow_light: { c: [200, 120, 255], r: 2.2 },
  hydro: { c: [190, 120, 255], r: 2.4 }, reactor: { c: [120, 255, 160], r: 4.0 }, bar_counter: { c: [255, 190, 110], r: 2.2 },
});

/**
 * The shelter's lighting layer. lights: [{ kind, x, y, w, h }] in canvas px (the piece's box); shadows: the same
 * for every piece standing on a floor. Glows are additive ('screen'), shadows multiply under each piece.
 */
export function drawShelterLight(ctx, lights, shadows, g, { time = 0, reduced = false, T = 16 } = {}) {
  ctx.save();
  // soft contact shadows: a dark ellipse at each piece's feet
  ctx.globalCompositeOperation = 'multiply';
  for (const s of shadows) {
    const cx = s.x + s.w / 2, cy = s.y + s.h - 1, rx = s.w * 0.6, ry = Math.max(2, T * 0.22);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    grad.addColorStop(0, `rgba(20,14,18,${(g.shadow * (reduced ? 0.6 : 1)).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(20,14,18,0)');
    ctx.fillStyle = grad;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.translate(-cx, -cy);
    ctx.fillRect(cx - rx, cy - rx, rx * 2, rx * 2);
    ctx.restore();
  }
  // light pools
  ctx.globalCompositeOperation = 'screen';
  for (const l of lights) {
    const src = LIGHT_SOURCES[l.kind];
    if (!src) continue;
    const cx = l.x + l.w / 2, cy = l.y + l.h * 0.4, r = src.r * T * (reduced ? 0.8 : 1);
    const fl = src.flick && !reduced ? 0.85 + 0.15 * Math.sin(time / 70 + cx) : 1;
    const a = Math.min(0.9, 0.55 * g.glow * fl * (reduced ? 0.7 : 1));
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(${src.c.join(',')},${a.toFixed(3)})`);
    grad.addColorStop(0.45, `rgba(${src.c.join(',')},${(a * 0.35).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${src.c.join(',')},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
}
