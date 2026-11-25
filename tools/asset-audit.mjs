// Asset size audit against the "64 minimum" rule (#113; style guide > Minimum asset size).
//
//   node tools/asset-audit.mjs                 -> summary + every failing asset, exit 1 if any fail
//   node tools/asset-audit.mjs --md <file>     -> also writes the full table as Markdown
//
// What it measures (native pixels, before any on-screen scaling):
//   - exported sprite sheets: every frame in assets/art/*.json
//   - exported images: every PNG in assets/art/ and its subfolders (IHDR width x height)
//   - sprites drawn from code: every { w, h } sprite in src/art/sprites-*.js and the map markers
//   - grid units the game draws with: the shelter tile, the world-map cell, the pixel font glyph
// Rule (proposed, pending the director): every sprite, tile and icon frame is at least 64 x 64; a glyph of
// in-world text is at least 8 px tall. Exempt by class: whole-canvas paintings and overlays (the world map
// and its region/heat layers), the palette swatch sheet, and the region click grid (not art).
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const MIN = 64;
export const MIN_GLYPH = 8;
const root = new URL('..', import.meta.url).pathname;
const rows = []; // { asset, kind, w, h, rule, pass, note }

const add = (asset, kind, w, h, { rule = 'sprite', note = '' } = {}) => {
  let pass;
  if (rule === 'exempt') pass = true;
  else if (rule === 'glyph') pass = h >= MIN_GLYPH;
  else pass = Math.min(w, h) >= MIN;
  rows.push({ asset, kind, w, h, rule, pass, note });
};

// 1. exported sheets
const ART = join(root, 'assets/art');
for (const f of readdirSync(ART).filter((n) => n.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(join(ART, f), 'utf8'));
  for (const [name, v] of Object.entries(data)) {
    const fr = Array.isArray(v) ? v[0] : v;
    if (fr && typeof fr.w === 'number') add(`${f.replace('.json', '')}/${name}`, 'sheet frame', fr.w, fr.h);
  }
}
// 2. exported images
const pngSize = (p) => { const b = readFileSync(p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const WHOLE_MAP = /^(map-base\.png|map-heat\/|map-regions\/)/;
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const p of walk(ART).filter((n) => n.endsWith('.png'))) {
  const rel = relative(ART, p);
  if (readdirSync(ART).includes(rel.replace('.png', '.json'))) continue; // a sheet: its frames are counted above
  const [w, h] = pngSize(p);
  const exempt = WHOLE_MAP.test(rel) || rel === 'palette.png';
  add(rel, 'image', w, h, exempt ? { rule: 'exempt', note: rel === 'palette.png' ? 'palette swatches' : 'whole-map painting/overlay' } : {});
}
// 3. sprites drawn from code
for (const file of ['sprites-map.js', 'sprites-shelter.js', 'sprites-ui.js', 'map-markers.js']) {
  const mod = await import(join(root, 'src/art', file));
  for (const [group, val] of Object.entries(mod)) {
    if (!val || typeof val !== 'object') continue;
    const entries = typeof val.w === 'number' ? [[group, val]] : Object.entries(val);
    for (const [name, s] of entries) if (s && typeof s.w === 'number' && typeof s.h === 'number') add(`${file.replace('.js', '')}/${group}.${name}`, 'code sprite', s.w, s.h);
  }
}
// 4. grid units
const { TILE } = await import(join(root, 'src/art/shelterView.js'));
const { CELL } = await import(join(root, 'src/art/worldmap.js'));
add('shelter tile (1 m x 1 m)', 'grid unit', TILE, TILE);
add('world-map region cell', 'grid unit', CELL, CELL, { rule: 'exempt', note: 'click grid only; the map is painted per pixel' });
add('pixel font glyph (in-world text)', 'glyph', 3, 5, { rule: 'glyph' });

// dedupe (a code sprite and its exported sheet frame are the same art)
const seen = new Map();
for (const r of rows) seen.set(`${r.kind}|${r.asset}`, r);
const all = [...seen.values()];
const fail = all.filter((r) => !r.pass);
const sizes = {};
for (const r of fail) sizes[`${r.w}x${r.h}`] = (sizes[`${r.w}x${r.h}`] ?? 0) + 1;

console.log(`Minimum asset size ${MIN}x${MIN} (glyphs ${MIN_GLYPH}px tall): ${all.length - fail.length} of ${all.length} pass, ${fail.length} below.`);
console.log(`Below the minimum, by size: ${Object.entries(sizes).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} x${n}`).join(', ')}`);
const md = process.argv.indexOf('--md');
if (md > 0) {
  const lines = [
    `# Asset size audit (#113): ${all.length - fail.length} of ${all.length} meet the minimum`, '',
    `Rule: every sprite, tile and icon frame is at least ${MIN}x${MIN} native pixels; in-world text glyphs at least ${MIN_GLYPH}px tall. Exempt: whole-map paintings and overlays, the palette sheet, the map click grid.`, '',
    '| Asset | Kind | Size | Result | Note |', '|---|---|---|---|---|',
    ...all.sort((a, b) => Number(a.pass) - Number(b.pass) || a.asset.localeCompare(b.asset)).map((r) => `| ${r.asset} | ${r.kind} | ${r.w}x${r.h} | ${r.rule === 'exempt' ? 'exempt' : r.pass ? 'pass' : 'BELOW'} | ${r.note} |`),
  ];
  writeFileSync(process.argv[md + 1], lines.join('\n') + '\n');
}
process.exitCode = fail.length ? 1 : 0;
