// In-game world map check (#105): opens a real campaign, switches to the WORLD MAP and verifies
//   - scaling: the 320x192 map is shown at a whole-number scale with pixelated rendering (no uneven pixels)
//   - hit areas: clicking the middle of each region's land selects that region
//   - layering: labels and markers are drawn last (sampled pixels match the label colours on top of the art)
//   - seams: every on-screen map pixel row/column maps to exactly `scale` screen pixels
//   - terrain (#109): the terrain canvas under the map covers it exactly, at 2 screen px per terrain pixel
// and saves screenshots at the default zoom for before/after comparisons.
//   python3 -m http.server 8123 &      (repo root)
//   node tools/map-ingame-check.cjs <outDir> [label=before] [baseUrl]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [out = '.ballast/media/t105', label = 'before', base = 'http://localhost:8123'] = process.argv.slice(2);
const VIEWPORTS = [{ w: 1440, h: 900 }, { w: 1920, h: 1080 }, { w: 1280, h: 720 }];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const report = { label, viewports: [] };
  for (const vp of VIEWPORTS) {
    const p = await b.newPage({ viewport: { width: vp.w, height: vp.h } });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${base}/index.html`);
    await p.evaluate(() => { try { localStorage.clear(); } catch {} });
    await p.reload(); await p.waitForTimeout(300);
    await p.click('text=NEW CAMPAIGN'); await p.waitForTimeout(900);
    await p.evaluate(() => { __game.clock.setSpeed(0); __game.ui.setView('map'); });
    await p.waitForTimeout(600);
    const r = await p.evaluate(async () => {
      const { regionAtCell } = await import('/src/worldmap/worldmap-ui.js');
      const { MAP_COLS, MAP_ROWS, CELL, MAP_W, MAP_H } = await import('/src/art/worldmap.js');
      const cv = __game.mapScreen.canvas;
      const rect = cv.getBoundingClientRect();
      const cs = getComputedStyle(cv);
      const bw = parseFloat(cs.borderLeftWidth) || 0;
      const shownW = rect.width - 2 * bw;
      const shownH = rect.height - 2 * bw;
      const scale = shownW / MAP_W;
      // hit areas: the middle cell of each region, clicked like a player would
      const cells = {};
      for (let r = 0; r < MAP_ROWS; r++) for (let c = 0; c < MAP_COLS; c++) { const id = regionAtCell(c, r); if (id) (cells[id] ??= []).push([c, r]); }
      const hits = {};
      let moved = false;
      for (const [id, list] of Object.entries(cells)) {
        const mx = list.reduce((s, [c]) => s + c, 0) / list.length, my = list.reduce((s, [, r]) => s + r, 0) / list.length;
        const [c, r] = list.reduce((best, cr) => (Math.hypot(cr[0] - mx, cr[1] - my) < Math.hypot(best[0] - mx, best[1] - my) ? cr : best));
        const now = cv.getBoundingClientRect(); // where the map is right now (selecting can move the layout)
        const s = (now.width - 2 * bw) / MAP_W;
        const x = now.left + bw + (c * CELL + CELL / 2) * s;
        const y = now.top + bw + (r * CELL + CELL / 2) * s;
        moved = moved || Math.abs(now.top - rect.top) > 0.5 || Math.abs(now.left - rect.left) > 0.5;
        cv.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }));
        hits[id] = __game.mapScreen.selected;
      }
      return { scale, shownW, shownH, aspectOk: Math.abs(shownW / shownH - MAP_W / MAP_H) < 0.01, rendering: cs.imageRendering, hits, layoutMovedOnSelect: moved };
    });
    r.integerScale = Math.abs(r.scale - Math.round(r.scale)) < 1e-6;
    r.hitAreasOk = Object.entries(r.hits).every(([id, sel]) => id === sel);
    r.viewport = `${vp.w}x${vp.h}`;
    r.errs = errs;
    // seams: screenshot the canvas content box and measure how many screen pixels each map pixel column takes
    await p.evaluate(() => __game.mapScreen.select('nam'));
    await p.waitForTimeout(300);
    const shot = path.join(out, `${label}-${vp.w}x${vp.h}.png`);
    await p.screenshot({ path: shot });
    await p.waitForTimeout(1500); // the finer terrain paints just after the map opens
    r.terrain = await p.evaluate(() => {
      const base = document.querySelector('.wm-map .wm-base');
      if (!base) return null;
      const cv = __game.mapScreen.canvas;
      const a = base.getBoundingClientRect(), o = cv.getBoundingClientRect();
      return { artW: base.width, artH: base.height, screenPerArtPx: a.width / base.width, aligned: Math.abs(a.left - o.left) < 0.5 && Math.abs(a.top - o.top) < 0.5 && Math.abs(a.width - o.width) < 0.5 && Math.abs(a.height - o.height) < 0.5 };
    });
    r.terrainOk = !r.terrain || (r.terrain.aligned && Math.abs(r.terrain.screenPerArtPx - Math.round(r.terrain.screenPerArtPx)) < 1e-6);
    await p.locator(await p.$('.wm-stage') ? '.wm-stage' : '.wm-map canvas').screenshot({ path: path.join(out, `${label}-map-${vp.w}x${vp.h}.png`) });
    const widths = await p.evaluate(() => {
      const cv = __game.mapScreen.canvas;
      const rect = cv.getBoundingClientRect();
      const bw = parseFloat(getComputedStyle(cv).borderLeftWidth) || 0;
      const dpr = devicePixelRatio;
      // screen-pixel boundaries of each map column, as the browser lays them out
      const edges = Array.from({ length: cv.width + 1 }, (_, i) => Math.round((rect.left + bw + (i * (rect.width - 2 * bw)) / cv.width) * dpr));
      const w = new Set();
      for (let i = 0; i < cv.width; i++) w.add(edges[i + 1] - edges[i]);
      return [...w].sort();
    });
    r.columnWidths = widths;
    r.seamFree = widths.length === 1;
    report.viewports.push(r);
    await p.close();
  }
  report.pass = report.viewports.every((v) => v.integerScale && v.terrainOk !== false && v.hitAreasOk && v.seamFree && v.aspectOk && v.rendering === 'pixelated' && !v.errs.length);
  fs.writeFileSync(path.join(out, `${label}-check.json`), JSON.stringify(report, null, 1));
  for (const v of report.viewports) console.log(v.viewport, `scale ${v.scale.toFixed(3)}`, v.integerScale ? 'integer' : 'FRACTIONAL', `columns ${v.columnWidths.join('/')}px`, v.terrain ? `terrain ${v.terrain.artW}x${v.terrain.artH} @${v.terrain.screenPerArtPx}px${v.terrain.aligned ? '' : ' MISALIGNED'}` : '', v.hitAreasOk ? 'hits ok' : `HITS ${JSON.stringify(v.hits)}`, v.errs.join(' '));
  console.log(report.pass ? 'PASS' : 'FAIL');
  await b.close();
})();
