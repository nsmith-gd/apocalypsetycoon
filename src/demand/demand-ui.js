// Demand visuals: a pixel gauge per crisis track with two needles (tension and Fear), and a
// world map with a scrolling demand ticker (leads per week and panic premium per region).
//
//   drawTrackGauge(ctx, { tension, fear, tipRange, state })   // 48x30 canvas
//   const map = createDemandMap({ canvas, market, getTensions, getBreachMultiplier })

import { drawWorldMap, MAP_W, MAP_H } from '../art/worldmap.js';
import { drawText, textWidth } from '../art/font.js';

const INK = '#2a2118';
const FEAR = '#ff5a4f';

/** Semicircle gauge, 0 on the left, 100 on the right. Ink needle = tension, red needle = Fear. */
export function drawTrackGauge(ctx, { tension = 0, fear = 0, tipRange = null, state = 'calm' } = {}) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const cx = W / 2;
  const cy = H - 3;
  const R = Math.min(cx - 2, H - 5);
  ctx.clearRect(0, 0, W, H);
  const angle = (v) => Math.PI + (Math.max(0, Math.min(100, v)) / 100) * Math.PI;
  const ring = (from, to, r0, r1, color) => {
    ctx.fillStyle = color;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d < r0 || d > r1 || dy > 0) continue;
      const v = ((Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2) - Math.PI) / Math.PI * 100;
      if (v >= from && v <= to) ctx.fillRect(x, y, 1, 1);
    }
  };
  ring(0, 100, R - 1.5, R + 0.5, '#0a0807');
  ring(0, 100, 0, R - 1.5, state === 'collapsed' ? '#5a2a30' : '#efe4c6');
  ring(40, 70, R - 5, R - 1.5, '#f5c542');
  ring(70, 100, R - 5, R - 1.5, '#ff9f1c');
  if (tipRange) ring(tipRange[0], tipRange[1], R - 5, R - 1.5, '#ff5a4f');
  const needle = (v, len, color, width = 1) => {
    ctx.fillStyle = color;
    const a = angle(v);
    for (let r = 1; r <= len; r += 0.5) for (let w = 0; w < width; w++) {
      ctx.fillRect(Math.round(cx + Math.cos(a) * r - 0.5 + (w ? Math.sin(a) : 0)), Math.round(cy + Math.sin(a) * r - 0.5 - (w ? Math.cos(a) : 0)), 1, 1);
    }
  };
  needle(fear, R - 3, FEAR, 1);
  needle(tension, R - 2, INK, 2);
  ctx.fillStyle = '#0a0807';
  ctx.fillRect(cx - 2, cy - 2, 4, 3);
}

/** World map + demand ticker. Region crisis tint = leads/week, so hot demand shows on the map. */
export function createDemandMap({ canvas, market, getTensions = () => market.lastTension ?? {}, getBreachMultiplier = () => 1 }) {
  canvas.width = MAP_W;
  canvas.height = MAP_H + 12;
  const ctx = canvas.getContext('2d');
  let frame = 0;
  let offset = 0;
  let tickerText = '';

  function tickerString() {
    const rows = market.regionDemand({ tensions: getTensions(), breachMultiplier: getBreachMultiplier() });
    // Only characters the 3x5 pixel font has (letters, digits, . - $ % ! /).
    return rows.map((r) => `${r.name.toUpperCase()} ${r.leadsPerWeek.toFixed(1)}/WK${r.panicPremium > 1 ? ` PRICES X${r.panicPremium.toFixed(2)}` : ''}${r.siteOwned ? ' SITE' : ''}`).join('  -  ') + '  -  ';
  }

  function draw() {
    const rows = market.regionDemand({ tensions: getTensions(), breachMultiplier: getBreachMultiplier() });
    // tint each art region by its hottest demand (leads/week scaled onto the 0-100 overlay range)
    const crisis = {};
    for (const r of rows) crisis[r.art] = Math.max(crisis[r.art] ?? 0, Math.min(100, r.leadsPerWeek * 30));
    ctx.fillStyle = '#0a0807';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawWorldMap(ctx, { crisis, frame: Math.floor(frame / 20) % 2, labels: true });
    // ticker strip
    ctx.fillStyle = '#0a0807';
    ctx.fillRect(0, MAP_H, MAP_W, 12);
    ctx.fillStyle = '#f5c542';
    ctx.fillRect(0, MAP_H, MAP_W, 1);
    const w = textWidth(tickerText);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, MAP_H + 1, MAP_W, 11);
    ctx.clip();
    for (let x = -Math.floor(offset); x < MAP_W; x += w + 4) drawText(ctx, tickerText, x, MAP_H + 3, '#f2e6c9'); // whole pixels only
    ctx.restore();
  }

  let raf = 0;
  const loop = () => {
    frame += 1;
    offset = (offset + 0.5) % Math.max(1, textWidth(tickerText) + 4);
    draw();
    raf = requestAnimationFrame(loop);
  };
  const refresh = () => { tickerText = tickerString(); };
  const off = market.on('week', refresh);
  refresh();
  raf = requestAnimationFrame(loop);
  return { refresh, draw, destroy() { cancelAnimationFrame(raf); off(); } };
}
