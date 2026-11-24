// World-map markers, region label plates and city / site icons (#102, art note D3).
// Pixel maps use the "Last Resort 28" palette keys ('.' = transparent); every icon has a 1px K outline
// and a soft drop shadow so it reads on any terrain. Drawn over the base layer at native 1x.
//
//   drawLabelPlate(ctx, 'EUROPE', x, y, { num: 72, numColor: HEX.O, selected })
//   drawMarker(ctx, 'client' | 'bunker' | 'site' | 'hq' | 'city', x, y, { frame })

import { drawSprite } from './render.js';
import { drawText, textWidth } from './font.js';
import { HEX } from './palette.js';

export const MARKERS = {
  // a skyline: three towers, lit windows, a mast
  city: {
    w: 9, h: 10, rows: [
      '....K....',
      '...KwK...',
      '...KmK...',
      '..KKmKKK.',
      '.KMKmKMmK',
      'KmMKYKMmK',
      'KMYKmKYmK',
      'KmMKYKMmK',
      'KMmKmKmMK',
      'KKKKKKKKK',
    ],
  },
  // a waiting buyer: bone face, dark suit, gold tie
  client: {
    w: 8, h: 9, rows: [
      '..KKKK..',
      '.KWWWSK.',
      '.KWKWSK.',
      '.KWWWSK.',
      '..KSSK..',
      '.KkkYkK.',
      'KkkYYkkK',
      'KkkkYkkK',
      '.KKKKKK.',
    ],
  },
  // a sold shelter: a blast hatch in a gold ring, with a pin point
  bunker: {
    w: 10, h: 11, rows: [
      '...KKKK...',
      '..KYLLYK..',
      '.KYyKKyYK.',
      'KYyKmmKyYK',
      'KYKmwMmKYK',
      'KYKmMMkKYK',
      'KYyKkkKyYK',
      '.KYyKKyYK.',
      '..KYyyYK..',
      '...KYYK...',
      '....KK....',
    ],
  },
  // a site you own: the company flag on a steel pole
  site: {
    w: 9, h: 11, rows: [
      '.K.......',
      'KwKKKKK..',
      'KmKYLYYK.',
      'KmKYKKyK.',
      'KmKYyyyK.',
      'KmKKKKKK.',
      'KmK......',
      'KmK......',
      'KMK......',
      'KkKKK....',
      'KKKKKK...',
    ],
  },
  // company HQ: a steel tower with the gold crest
  hq: {
    w: 12, h: 12, rows: [
      '.....KK.....',
      '....KLYK....',
      '...KKKKKK...',
      '..KwmmmMMK..',
      '.KwmmmMMMkK.',
      '.KmmmMMMkkK.',
      'KYLYYYYYYyyK',
      'KmMMKKKKMMkK',
      'KmMMKYkKMMkK',
      'KmMMKkkKMMkK',
      'KyyyyyyyyyyK',
      'KKKKKKKKKKKK',
    ],
  },
};

/** A sprite with a 1px soft shadow down-right, so it lifts off busy terrain. */
export function drawMarker(ctx, id, x, y, { frame = 0 } = {}) {
  const s = MARKERS[id];
  if (!s) return;
  ctx.globalAlpha = 0.45;
  drawSilhouette(ctx, s, x + 1, y + 1, HEX.K);
  ctx.globalAlpha = 1;
  drawSprite(ctx, s, x, y, { frame });
}

function drawSilhouette(ctx, s, x, y, color) {
  ctx.fillStyle = color;
  s.rows.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] !== '.' && row[c] !== ' ') ctx.fillRect(x + c, y + r, 1, 1); });
}

/**
 * A region name on a dark plate (bone text, no outline needed), with an optional number box in its zone
 * colour. Returns the plate's width. Height is 9px: text sits 2px in.
 */
export function drawLabelPlate(ctx, text, x, y, { num = null, numColor = HEX.W, selected = false } = {}) {
  const tw = textWidth(text);
  const nw = num == null ? 0 : textWidth(String(num)) + 5;
  const w = tw + 5 + nw;
  // shadow, frame, fill, top highlight
  ctx.globalAlpha = 0.45; ctx.fillStyle = HEX.K; ctx.fillRect(x + 1, y + 1, w, 9); ctx.globalAlpha = 1;
  ctx.fillStyle = selected ? HEX.Y : HEX.K; ctx.fillRect(x, y, w, 9);
  ctx.fillStyle = HEX.D; ctx.fillRect(x + 1, y + 1, w - 2, 7);
  ctx.fillStyle = HEX.d; ctx.fillRect(x + 1, y + 1, w - 2, 1);
  drawText(ctx, text, x + 3, y + 2, selected ? HEX.L : HEX.W, null);
  if (num != null) {
    const bx = x + tw + 5;
    ctx.fillStyle = HEX.K; ctx.fillRect(bx - 1, y + 1, nw, 7);
    drawText(ctx, String(num), bx + 1, y + 2, numColor, null);
  }
  return w;
}

/** A small count tag next to an icon (buyers waiting, shelters sold). */
export function drawCountTag(ctx, n, x, y, color) {
  const s = String(n);
  const w = textWidth(s) + 3;
  ctx.fillStyle = HEX.K; ctx.fillRect(x, y, w, 7);
  drawText(ctx, s, x + 2, y + 1, color, null);
  return w;
}
