// World-vs-interface audit (#160). For each main screen at 1440x900, measures how much of the screen is game world
// (the shelter cutaway, the world map, the Midnight scene: pixel-art canvases) versus interface panels and text, then
// takes a screenshot; and makes "world-first" mock captures that hide or shrink the panels to show what the same
// screen looks like when the world is the hero. Serve the repo first:  python3 -m http.server 8123
//   node tools/world-share-capture.cjs [outDir=.ballast/media/t160]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = process.argv[2] ?? '.ballast/media/t160';
const base = 'http://localhost:8123/index.html';
const WORLD = () => {
  // union area of visible world canvases (ignoring tiny icons) over the viewport
  const W = innerWidth, H = innerHeight, mask = new Uint8Array(W * H);
  let n = 0;
  for (const c of document.querySelectorAll('canvas')) {
    const r = c.getBoundingClientRect(), st = getComputedStyle(c);
    if (r.width < 120 || r.height < 120 || st.visibility === 'hidden' || st.display === 'none') continue;
    if (c.closest('.hud, .bk-side, .dc-hud')) continue; // emblems and the clock face are interface
    for (let y = Math.max(0, Math.floor(r.top)); y < Math.min(H, Math.ceil(r.bottom)); y++) for (let x = Math.max(0, Math.floor(r.left)); x < Math.min(W, Math.ceil(r.right)); x++) if (!mask[y * W + x]) { mask[y * W + x] = 1; n++; }
  }
  // interface drawn ON the world (floating rails over a canvas) is subtracted
  let over = 0;
  for (const e of document.querySelectorAll('.pg-panel, .pb-panel, .wk-overlay, .report-overlay, .tw-overlay')) {
    const r = e.getBoundingClientRect(); if (!r.width || getComputedStyle(e).display === 'none') continue;
    for (let y = Math.max(0, Math.floor(r.top)); y < Math.min(H, Math.ceil(r.bottom)); y++) for (let x = Math.max(0, Math.floor(r.left)); x < Math.min(W, Math.ceil(r.right)); x++) if (mask[y * W + x]) { mask[y * W + x] = 0; over++; }
  }
  const textChars = [...document.querySelectorAll('body *')].filter((e) => e.offsetParent && [...e.childNodes].some((t) => t.nodeType === 3 && t.textContent.trim())).reduce((s, e) => s + [...e.childNodes].filter((t) => t.nodeType === 3).map((t) => t.textContent.trim()).join('').length, 0);
  const buttons = [...document.querySelectorAll('button')].filter((b) => b.offsetParent).length;
  return { worldPct: Math.round(((n - over) / (W * H)) * 1000) / 10, textChars, buttons };
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.setDefaultTimeout(5000);
  const rows = [];
  const shot = async (name, note = '') => { await p.waitForTimeout(600); const m = await p.evaluate(WORLD); rows.push({ name, ...m, note }); await p.screenshot({ path: path.join(out, `${name}.png`) }); console.log(name.padEnd(28), `${m.worldPct}% world`, `${m.textChars} chars of text`, `${m.buttons} buttons`, note); };
  await p.goto(base); await p.evaluate(() => { try { localStorage.clear(); } catch {} }); await p.reload(); await p.waitForTimeout(800);
  await shot('01-title');
  await p.click('text=NEW CAMPAIGN'); await p.waitForTimeout(1200);
  await p.evaluate(() => __game.clock.setSpeed(0));
  await shot('02-shelter');
  await p.keyboard.press('2'); await p.waitForTimeout(800);
  await p.evaluate(() => { const g = __game; for (const id of g.world.roster) { if (!g.world.opened.includes(id)) g.world.opened.push(id); g.crisis.openTrack(id, { tension: 50 }); } g.crisis.setTension('atomic', g.crisis.tippingPoint('atomic') - 3); g.mapScreen.select('mea'); });
  await shot('03-map');
  // world-first mocks: same game state, panels collapsed and the world scaled up to fill the screen
  await p.evaluate(() => {
    const st = document.createElement('style'); st.id = 'mock';
    st.textContent = `.gs[data-view='map'] .wm-panel { position: fixed; right: 12px; top: 120px; width: 260px; max-height: 300px; opacity: .92; z-index: 30 }
      .gs[data-view='map'] .stage-map.wm { display: block; padding: 0 !important; }
      .hud > .hud-stat:not(.hud-cash):not(.dc-hud), .hud > .research-chip, .hud > .ledger-chip, .hud > .co-tier { display: none !important; }`;
    document.head.append(st); dispatchEvent(new Event('resize'));
  });
  await p.waitForTimeout(1200);
  await shot('03b-map-world-first-mock', 'mock: panel floats small, HUD keeps cash + clock, map fills the width');
  await p.evaluate(() => document.getElementById('mock')?.remove());
  await p.keyboard.press('1'); await p.waitForTimeout(800);
  await p.evaluate(() => {
    const st = document.createElement('style'); st.id = 'mock';
    st.textContent = `.pg-panel, .pb-panel, .bk-pal, .bk-side { display: none !important; }
      .gs .bk { margin: 0 !important; grid-template-columns: 1fr !important; justify-items: center; }
      .hud > .hud-stat:not(.hud-cash):not(.dc-hud), .hud > .research-chip, .hud > .ledger-chip, .hud > .co-tier { display: none !important; }
      .bk-scroll { max-height: none !important; border: 0 !important; }`;
    document.head.append(st);
    const c = document.querySelector('.bk-canvas'); const k = Math.max(1, Math.floor((innerHeight - 220) / c.height * 2) / 2);
    c.style.width = `${c.width * 2}px`; c.style.height = `${c.height * 2}px`;
  });
  await p.waitForTimeout(800);
  await shot('02b-shelter-world-first-mock', 'mock: build list and stats hidden, the cutaway at 2x');
  await p.evaluate(() => document.getElementById('mock')?.remove());
  // the moments
  await p.goto(`${base}?preset=breach`); await p.evaluate(() => { try { localStorage.clear(); } catch {} }); await p.reload(); await p.click('text=NEW CAMPAIGN'); await p.waitForTimeout(2500);
  await shot('04-breach');
  await p.goto(`${base}?preset=clockzero`); await p.evaluate(() => { try { localStorage.clear(); } catch {} }); await p.reload(); await p.click('text=NEW CAMPAIGN');
  for (let i = 0; i < 50 && !(await p.locator('.em-go').count()); i++) await p.waitForTimeout(400);
  if (await p.locator('.em-go').count()) { await shot('05-seal-order'); await p.click('.em-go'); }
  await p.waitForSelector('.mn-screen', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  await shot('06-midnight');
  fs.writeFileSync(path.join(out, 'world-share.json'), JSON.stringify(rows, null, 1));
  await b.close();
})();
