// Renders every sprite exported by a sprite module into one PNG contact sheet,
// and prints validation errors. Used to check pixel art while drawing it.
//
//   node tools/preview-sprites.cjs src/art/sprites-shelter.js out.png [scale=6]
//
// Each exported value that looks like a sprite ({w,h,rows}) or a map of sprites is drawn.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const [, , modPath, outPath, scaleArg] = process.argv;
if (!modPath || !outPath) { console.error('usage: node tools/preview-sprites.cjs <module> <out.png> [scale]'); process.exit(1); }
const scale = Number(scaleArg) || 6;

const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  fs.createReadStream(file).pipe(res);
});

server.listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`http://localhost:${port}/demo/hud-demo.html`);
  await page.setContent('<body style="margin:0;background:#14110f"></body>');
  const result = await page.evaluate(async ({ port, modPath, scale }) => {
    const mod = await import(`http://localhost:${port}/${modPath}`);
    const { drawSprite, validateSprite } = await import(`http://localhost:${port}/src/art/render.js`);
    const isSprite = (v) => v && typeof v === 'object' && Number.isInteger(v.w) && Number.isInteger(v.h) && (Array.isArray(v.rows) || Array.isArray(v.frames));
    const list = [];
    for (const [k, v] of Object.entries(mod)) {
      if (isSprite(v)) list.push([k, v]);
      else if (v && typeof v === 'object') for (const [k2, v2] of Object.entries(v)) if (isSprite(v2)) list.push([`${k}.${k2}`, v2]);
    }
    const problems = [];
    for (const [name, s] of list) { if (!s.rows && s.frames) s.rows = s.frames[0]; problems.push(...validateSprite(name, s)); }
    const pad = 12;
    const cellW = Math.max(...list.map(([, s]) => s.w * scale), 100) + pad;
    const frameCount = (s) => (s.frames ? s.frames.length : 1);
    const cols = Math.max(1, Math.floor(1400 / cellW));
    const rowsH = [];
    for (let i = 0; i < list.length; i += cols) rowsH.push(Math.max(...list.slice(i, i + cols).map(([, s]) => s.h * scale)) + 28);
    const cv = document.createElement('canvas');
    cv.width = cols * cellW + pad;
    cv.height = rowsH.reduce((a, b) => a + b, 0) + pad;
    document.body.append(cv);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#14110f'; ctx.fillRect(0, 0, cv.width, cv.height);
    let y = pad;
    list.forEach(([name, s], i) => {
      const col = i % cols;
      if (col === 0 && i > 0) y += rowsH[Math.floor(i / cols) - 1];
      const x = pad + col * cellW;
      // checker to show transparency
      for (let cy = 0; cy < s.h; cy++) for (let cx = 0; cx < s.w; cx++) {
        ctx.fillStyle = (cx + cy) % 2 ? '#1e1a16' : '#26211c';
        ctx.fillRect(x + cx * scale, y + cy * scale, scale, scale);
      }
      const tmp = document.createElement('canvas'); tmp.width = s.w; tmp.height = s.h;
      drawSprite(tmp.getContext('2d'), s, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, x, y, s.w * scale, s.h * scale);
      ctx.fillStyle = '#f2e6c9'; ctx.font = 'bold 11px monospace';
      ctx.fillText(`${name} ${s.w}x${s.h}${frameCount(s) > 1 ? ` (${frameCount(s)}f)` : ''}`, x, y + s.h * scale + 14);
    });
    return { problems, count: list.length, w: cv.width, h: cv.height };
  }, { port, modPath, scale });
  await page.setViewportSize({ width: result.w, height: result.h });
  await page.locator('canvas').screenshot({ path: outPath });
  console.log(`${result.count} sprites -> ${outPath}`);
  if (result.problems.length) console.log('PROBLEMS:\n' + result.problems.join('\n'));
  if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
  await browser.close();
  server.close();
});
