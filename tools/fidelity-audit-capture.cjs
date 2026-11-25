// Visual fidelity audit captures (#125). Serve the repo first: python3 -m http.server 8123
// then: node tools/fidelity-audit-capture.cjs [outDir]
const { chromium } = require('playwright');
const out = process.argv[2] || '.ballast/media/t125';
const shots = [];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shot = async (name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${name}.png` }); shots.push(name); };
  const fresh = async (q = '') => { await p.goto(`http://localhost:8123/index.html${q}`); await p.evaluate(() => { try { localStorage.clear(); } catch {} }); await p.reload(); await p.waitForTimeout(500); };
  const tryClick = async (sel) => { const l = p.locator(sel).first(); if (await l.count()) { await l.click().catch(() => {}); return true; } return false; };
  await fresh();
  await shot('01-title');
  await p.click('text=NEW CAMPAIGN'); await p.waitForTimeout(1200);
  await p.evaluate(() => __game.clock.setSpeed(0));
  await shot('02-shelter-grid');
  await p.keyboard.press('2'); await shot('03-world-map');
  await p.evaluate(() => { const g = __game; for (const id of g.world.roster) { if (!g.world.opened.includes(id)) g.world.opened.push(id); g.crisis.openTrack(id, { tension: 50 }); } g.crisis.setTension('atomic', g.crisis.tippingPoint('atomic') - 3); g.mapScreen.select('mea'); });
  await shot('04-world-map-crises-schemes');
  await p.evaluate(() => document.querySelector('.wm-panel')?.scrollTo(0, 400)); await shot('05-scheme-panel-scrolled');
  await p.keyboard.press('t'); await shot('06-threats-panel'); await p.keyboard.press('t'); await p.keyboard.press('Escape');
  await p.keyboard.press('r'); await shot('07-research'); await p.keyboard.press('r'); await p.keyboard.press('Escape');
  await p.keyboard.press('l'); await shot('08-ledger'); await p.keyboard.press('l'); await p.keyboard.press('Escape');
  await p.keyboard.press('o'); await shot('09-settings'); await p.keyboard.press('o'); await p.keyboard.press('Escape');
  if (await tryClick('text=EVENTS')) { await shot('10-events'); if (await tryClick('.ev-attend, button:has-text("ATTEND")')) { await shot('11-event-guests'); if (await tryClick('button:has-text("TALK")')) { await shot('12-dialogue'); } } }
  await p.keyboard.press('Escape');
  await fresh('?qs=30');
  await p.click('text=NEW CAMPAIGN'); await p.waitForTimeout(800);
  await p.evaluate(() => __game.clock.setSpeed(4));
  for (let i = 0; i < 40; i++) { if (await p.locator('.wk-overlay').count()) break; await p.waitForTimeout(300); }
  if (await p.locator('.wk-overlay').count()) await shot('13-weekly-card');
  for (let i = 0; i < 80; i++) { if (await p.locator('.report-overlay:not([hidden]):not(.wk-overlay)').count()) break; const w = p.locator('.wk-overlay button'); if (await w.count()) await w.first().click({ timeout: 800 }).catch(() => {}); await p.waitForTimeout(300); }
  if (await p.locator('.report-overlay:not([hidden]):not(.wk-overlay)').count()) await shot('14-quarter-report');
  await fresh('?preset=breach');
  await p.click('text=NEW CAMPAIGN'); await p.waitForTimeout(2500); await shot('15-breach-card');
  await fresh('?preset=clockzero');
  await p.click('text=NEW CAMPAIGN');
  await p.waitForTimeout(5500); await shot('16-midnight-strike');
  for (let i = 0; i < 40 && !(await p.locator('.em-go').count()); i++) await p.waitForTimeout(400);
  if (await p.locator('.em-go').count()) { await shot('17-seal-order'); await p.click('.em-go'); }
  await p.waitForSelector('.mn-screen', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500); await shot('18-midnight-ending');
  console.log(JSON.stringify({ shots, errs }));
  await b.close();
})();
