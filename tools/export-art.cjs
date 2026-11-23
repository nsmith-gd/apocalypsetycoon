// Exports the sprite data as 1x transparent PNG sprite sheets (plus a JSON atlas of
// frame rectangles) into assets/art/, for engines/tools that want image files.
//
//   node tools/export-art.cjs

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'assets/art');
fs.mkdirSync(outDir, { recursive: true });

const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html' });
  fs.createReadStream(file).pipe(res);
});

server.listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/demo/art-gallery.html`);
  const sheets = await page.evaluate(async (base) => {
    const { drawSprite } = await import(`${base}/src/art/render.js`);
    const { PALETTE } = await import(`${base}/src/art/palette.js`);
    const shelter = await import(`${base}/src/art/sprites-shelter.js`);
    const map = await import(`${base}/src/art/sprites-map.js`);
    const ui = await import(`${base}/src/art/sprites-ui.js`);
    const groups = {
      'shelter-tiles': shelter.TILES,
      'shelter-amenities': shelter.AMENITIES,
      'map-tiles': map.MAP_TILES,
      'map-markers': map.MAP_MARKERS,
      'crisis-icons': map.CRISIS_ICONS,
      'crisis-overlays': map.CRISIS_OVERLAYS,
      'ui-frames': Object.fromEntries(Object.entries(ui.UI_FRAMES).map(([k, v]) => [k, v.sprite])),
      'ui-icons': { ...ui.UI_ICONS, ...ui.UI_CURSOR, logo: ui.LOGO },
    };
    const out = {};
    for (const [name, group] of Object.entries(groups)) {
      // one row per sprite name, one column per animation frame, 1px gap
      const entries = Object.entries(group);
      const maxFrames = Math.max(...entries.map(([, s]) => (s.frames ? s.frames.length : 1)));
      const cw = Math.max(...entries.map(([, s]) => s.w));
      const ch = Math.max(...entries.map(([, s]) => s.h));
      const cv = document.createElement('canvas');
      cv.width = maxFrames * (cw + 1) - 1;
      cv.height = entries.length * (ch + 1) - 1;
      const ctx = cv.getContext('2d');
      const atlas = {};
      entries.forEach(([key, s], row) => {
        const n = s.frames ? s.frames.length : 1;
        atlas[key] = [];
        for (let f = 0; f < n; f++) {
          const x = f * (cw + 1);
          const y = row * (ch + 1);
          drawSprite(ctx, s, x, y, { frame: f });
          atlas[key].push({ x, y, w: s.w, h: s.h });
        }
      });
      if (name === 'ui-frames') for (const [k, v] of Object.entries(ui.UI_FRAMES)) atlas[k].forEach((r) => (r.nineSliceBorder = v.border));
      out[name] = { png: cv.toDataURL('image/png'), atlas };
    }
    // palette strip: 8x8 swatches
    const keys = Object.keys(PALETTE);
    const pv = document.createElement('canvas');
    pv.width = keys.length * 8; pv.height = 8;
    const pctx = pv.getContext('2d');
    keys.forEach((k, i) => { pctx.fillStyle = PALETTE[k].hex; pctx.fillRect(i * 8, 0, 8, 8); });
    out.palette = { png: pv.toDataURL('image/png'), atlas: Object.fromEntries(keys.map((k, i) => [k, { x: i * 8, hex: PALETTE[k].hex, name: PALETTE[k].name }])) };
    return out;
  }, `http://localhost:${port}`);
  for (const [name, { png, atlas }] of Object.entries(sheets)) {
    fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(png.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(atlas, null, 1) + '\n');
    console.log(`assets/art/${name}.png`);
  }
  await browser.close();
  server.close();
});
