// UI theme before/after captures (#126). Serve the repo first: python3 -m http.server 8123
// then: node tools/theme-capture.cjs [outDir]   -> before-*.png (?theme=off) and after-*.png
const { chromium } = require('playwright');
const out = process.argv[2] || '.ballast/media/t126';
(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const [tag, q] of [['before', '?theme=off'], ['after', '']]) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.setDefaultTimeout(4000);
    p.on('pageerror', (e) => errs.push(`${tag}: ${e.message}`));
    await p.goto(`http://localhost:8123/index.html${q}`); await p.evaluate(() => { try { localStorage.clear(); } catch {} }); await p.reload();
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${out}/${tag}-1-title.png` });
    await p.click('text=NEW CAMPAIGN'); await p.waitForTimeout(1200);
    await p.evaluate(() => __game.clock.setSpeed(0));
    await p.screenshot({ path: `${out}/${tag}-2-hud-build-menu.png` });
    await p.keyboard.press('2'); await p.waitForTimeout(400);
    await p.evaluate(() => { const g = __game; for (const id of g.world.roster) { if (!g.world.opened.includes(id)) g.world.opened.push(id); g.crisis.openTrack(id, { tension: 50 }); } g.crisis.setTension('atomic', g.crisis.tippingPoint('atomic') - 3); g.mapScreen.select('mea'); });
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}/${tag}-3-map-panel.png` });
    await p.evaluate(() => document.querySelector('.wm-panel')?.scrollTo(0, 420)); await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/${tag}-4-scheme-panel.png` });
    await p.keyboard.press('t'); await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}/${tag}-5-threats-schemes.png` });
    await p.close();
  }
  console.log(JSON.stringify({ errs }));
  await b.close();
})();
