// Pixel-perfect rendering check (#127). For each screen size and pixel ratio, opens the game, visits the title,
// shelter, world map and Midnight screens, and checks every visible pixel-art canvas:
//   - scale: device pixels per art pixel is a whole number on both axes, and the same on both (no uneven pixels)
//   - snap:  the canvas's top-left sits on a device pixel (a half-pixel offset doubles every other column)
//   - filter: image-rendering is pixelated (no blur)
// and the pixel font is drawn at a whole number of device pixels per font pixel.
// Serve the repo first:  python3 -m http.server 8123
//   node tools/pixel-perfect-check.cjs [outDir=.ballast/media/t127] [label=after]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = process.argv[2] ?? '.ballast/media/t127';
const label = process.argv[3] ?? 'after';
const base = 'http://localhost:8123/index.html';

const SIZES = [
  { name: '1080p', w: 1920, h: 1080, dpr: 1 },
  { name: '1440p', w: 2560, h: 1440, dpr: 1 },
  { name: '4k-200pct', w: 1920, h: 1080, dpr: 2 }, // a 3840x2160 screen at the usual 200% scaling
  { name: '4k-100pct', w: 3840, h: 2160, dpr: 1 },
  { name: 'ultrawide', w: 3440, h: 1440, dpr: 1 },
  { name: 'laptop-125pct', w: 1536, h: 864, dpr: 1.25 }, // a 1920x1080 laptop at Windows' default 125%
  { name: 'laptop-150pct', w: 1280, h: 720, dpr: 1.5 },
  { name: 'windowed', w: 1280, h: 720, dpr: 1 },
  { name: 'windowed-odd', w: 1366, h: 768, dpr: 1 },
];

// runs in the page: every visible canvas that draws pixel art
const AUDIT = () => {
  const dpr = devicePixelRatio;
  const res = [];
  const near = (v) => Math.abs(v - Math.round(v)) < 0.02;
  for (const c of document.querySelectorAll('canvas')) {
    const bb = c.getBoundingClientRect();
    if (bb.width < 8 || bb.height < 8 || !c.width || !c.height) continue;
    const st = getComputedStyle(c);
    // the content box: stage canvases have a CSS border around the art
    const bl = parseFloat(st.borderLeftWidth) + parseFloat(st.paddingLeft), bt = parseFloat(st.borderTopWidth) + parseFloat(st.paddingTop);
    const br = parseFloat(st.borderRightWidth) + parseFloat(st.paddingRight), bbm = parseFloat(st.borderBottomWidth) + parseFloat(st.paddingBottom);
    const r = { left: bb.left + bl, top: bb.top + bt, width: bb.width - bl - br, height: bb.height - bt - bbm };
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) continue;
    const kx = (r.width * dpr) / c.width, ky = (r.height * dpr) / c.height;
    const id = c.className || c.parentElement?.className || 'canvas';
    const problems = [];
    if (!(near(kx) && near(ky) && Math.abs(kx - ky) < 0.02) || kx < 0.98) problems.push(`scale ${kx.toFixed(3)} x ${ky.toFixed(3)} device px per art px`);
    if (!near(r.left * dpr) || !near(r.top * dpr)) problems.push(`offset ${(r.left * dpr).toFixed(2)},${(r.top * dpr).toFixed(2)} device px`);
    if (kx > 1.02 && st.imageRendering !== 'pixelated' && st.imageRendering !== 'crisp-edges') problems.push(`filter ${st.imageRendering}`);
    res.push({ id: String(id).slice(0, 40), art: `${c.width}x${c.height}`, k: Math.round(kx * 100) / 100, ok: !problems.length, problems });
  }
  // the pixel font: one font pixel = font-size / 6 CSS px
  const fonts = new Map();
  for (const e of document.querySelectorAll('body *')) {
    if (!e.firstChild || e.firstChild.nodeType !== 3 || !e.firstChild.textContent.trim()) continue;
    const st = getComputedStyle(e);
    if (!st.fontFamily.includes('AT Pixel') || e.getBoundingClientRect().width === 0) continue;
    const px = (parseFloat(st.fontSize) / 6) * dpr;
    if (!fonts.has(st.fontSize)) fonts.set(st.fontSize, [px, e.className || e.tagName]);
  }
  const fontBad = [...fonts].filter(([, [px]]) => !near(px)).map(([fs, [px, who]]) => `${fs} = ${px.toFixed(2)} device px per font px (${who})`);
  return { dpr, canvases: res, fonts: [...fonts].map(([fs, [px]]) => `${fs}:${Math.round(px * 100) / 100}`), fontBad };
};

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const report = [];
  let fails = 0;
  for (const s of SIZES) {
    const ctx = await b.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dpr });
    const p = await ctx.newPage(); p.setDefaultTimeout(5000);
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    const screens = {};
    const visit = async (name) => {
      await p.waitForTimeout(700);
      const a = await p.evaluate(AUDIT);
      screens[name] = a;
      if (name !== 'midnight' || s.name === '1080p' || s.name === 'laptop-125pct') await p.screenshot({ path: path.join(out, `${label}-${s.name}-${name}.png`) });
    };
    await p.goto(base); await p.evaluate(() => { try { localStorage.clear(); } catch {} }); await p.reload();
    await visit('title');
    await p.click('text=NEW CAMPAIGN'); await p.waitForTimeout(1200);
    await p.evaluate(() => __game.clock.setSpeed(0));
    await visit('shelter');
    await p.keyboard.press('2'); await p.waitForTimeout(600);
    await visit('map');
    await p.goto(`${base}?preset=clockzero`); await p.evaluate(() => { try { localStorage.clear(); } catch {} }); await p.reload();
    await p.click('text=NEW CAMPAIGN');
    for (let i = 0; i < 50 && !(await p.locator('.em-go').count()); i++) await p.waitForTimeout(400);
    if (await p.locator('.em-go').count()) await p.click('.em-go');
    await p.waitForSelector('.mn-screen', { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(1500);
    await visit('midnight');
    for (const [name, a] of Object.entries(screens)) {
      const bad = a.canvases.filter((c) => !c.ok);
      fails += bad.length + a.fontBad.length;
      report.push({ size: s.name, viewport: `${s.w}x${s.h}@${s.dpr}`, screen: name, canvases: a.canvases.length, bad, fontBad: a.fontBad, fonts: a.fonts, errs });
      console.log(`${s.name.padEnd(14)} ${name.padEnd(9)} ${a.canvases.length} canvases, ${bad.length} off-grid${a.fontBad.length ? `, font ${a.fontBad.join('; ')}` : ''}`);
      for (const c of bad) console.log(`    ${c.id} (${c.art}): ${c.problems.join('; ')}`);
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, `${label}-check.json`), JSON.stringify(report, null, 1));
  console.log(fails ? `FAIL: ${fails} problems` : 'PASS');
  await b.close();
})();
