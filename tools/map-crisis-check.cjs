// Runs demo/map-crisis-check.html in Chromium and writes the results and contact sheets (#104).
//   python3 -m http.server 8123 &   (from the repo root)
//   node tools/map-crisis-check.cjs [outDir=.ballast/media/t104] [baseUrl=http://localhost:8123]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = process.argv[2] ?? '.ballast/media/t104';
const base = process.argv[3] ?? 'http://localhost:8123';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${base}/demo/map-crisis-check.html`);
  await p.waitForFunction(() => window.__check, null, { timeout: 60000 });
  const check = await p.evaluate(() => window.__check);
  // contact sheets: the whole map with every region in one state (the terrain-resolution composite at 1x since #139)
  for (const [id, url] of Object.entries(check.sheets)) {
    const png = await p.evaluate(async (src) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement('canvas'); const k = img.width >= 640 ? 1 : 4; c.width = img.width * k; c.height = img.height * k;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    }, url);
    fs.writeFileSync(path.join(out, `state-${id}.png`), Buffer.from(png.split(',')[1], 'base64'));
  }
  await p.locator('#out').screenshot({ path: path.join(out, 'check-table.png') });
  const { sheets, ...rest } = check;
  fs.writeFileSync(path.join(out, 'check-results.json'), JSON.stringify({ ...rest, errs }, null, 1));
  console.log(`${check.passed}/${check.total} pass`, errs.length ? errs : '');
  for (const r of check.results.filter((x) => !x.pass)) console.log('FAIL', r.name, r.state, r.fails.join('; '));
  await b.close();
})();
