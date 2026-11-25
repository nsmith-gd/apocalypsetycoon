#!/usr/bin/env node
// Asset inventory (#114): every art asset in the game with its native size, frames and where it comes from.
// Used by the 64bit-minimum audit (#114) and its automated check (#115, tools/check-asset-minimum.mjs).
//
//   node tools/asset-inventory.mjs            # table
//   node tools/asset-inventory.mjs --json     # machine-readable
//
// Sources:
//   - pixel-map sprites in src/art/sprites-*.js, map-markers.js ({ w, h, rows }) and the bitmap font
//   - procedural art drawn in code at a fixed native size (bunker tiles, furniture and residents,
//     styled rooms, the map base layer and its overlays)
//   - exported PNG files under assets/art (read from the PNG header)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const art = (f) => import(new URL(`../src/art/${f}`, import.meta.url));

/** The ticket that created a file and the last ticket that changed it (from commit subjects). */
function owners(path) {
  try {
    const subjects = execFileSync('git', ['log', '--format=%s', '--', path], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    const id = (s) => (s.match(/^(#\d+|R\d+)/) ?? [null, '?'])[1];
    return { created: id(subjects.at(-1) ?? ''), last: id(subjects[0] ?? '') };
  } catch { return { created: '?', last: '?' }; }
}

function pngSize(file) {
  const b = readFileSync(file);
  if (b.toString('ascii', 1, 4) !== 'PNG') return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bitDepth: b[24], colorType: b[25] };
}

const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

export async function inventory() {
  const out = [];
  const add = (rec) => out.push(rec);
  const spriteGroup = (source, group, category, sprites) => {
    const own = owners(source);
    for (const [id, s] of Object.entries(sprites)) {
      const sp = s.sprite ?? s;
      if (!sp?.w) continue;
      add({ asset: `${group}/${id}`, category, source, kind: 'pixel sprite', w: sp.w, h: sp.h, frames: sp.frames?.length ?? 1, ...own });
    }
  };
  const shelter = await art('sprites-shelter.js');
  spriteGroup('src/art/sprites-shelter.js', 'shelter-tiles', 'rooms and grid tiles', shelter.TILES);
  spriteGroup('src/art/sprites-shelter.js', 'shelter-amenities', 'amenities and fixtures', shelter.AMENITIES);
  const map = await art('sprites-map.js');
  spriteGroup('src/art/sprites-map.js', 'map-tiles', 'map', map.MAP_TILES);
  spriteGroup('src/art/sprites-map.js', 'map-markers-old', 'map', map.MAP_MARKERS);
  spriteGroup('src/art/sprites-map.js', 'crisis-icons', 'icons', map.CRISIS_ICONS);
  spriteGroup('src/art/sprites-map.js', 'crisis-overlays', 'map', map.CRISIS_OVERLAYS);
  const ui = await art('sprites-ui.js');
  spriteGroup('src/art/sprites-ui.js', 'ui-frames', 'UI', ui.UI_FRAMES);
  spriteGroup('src/art/sprites-ui.js', 'ui-icons', 'icons', ui.UI_ICONS);
  spriteGroup('src/art/sprites-ui.js', 'ui', 'UI', { cursor: ui.UI_CURSOR, logo: ui.LOGO });
  const markers = await art('map-markers.js');
  spriteGroup('src/art/map-markers.js', 'map-markers', 'map', markers.MARKERS);

  // procedural art: fixed native sizes
  const proc = (asset, category, source, w, h, note) => add({ asset, category, source, kind: 'procedural', w, h, frames: 1, note, ...owners(source) });
  proc('font/glyph', 'UI', 'src/art/font.js', 3, 5, 'bitmap font, 3x5 per glyph');
  const tiles = await art('bunker-tiles.js');
  for (const id of Object.keys(tiles.STRATUM_ART)) proc(`bunker-tiles/strata-${id}`, 'rooms and grid tiles', 'src/art/bunker-tiles.js', 16, 16);
  for (const id of ['dig', 'shell']) proc(`bunker-tiles/stage-${id}`, 'rooms and grid tiles', 'src/art/bunker-tiles.js', 16, 16);
  proc('bunker-tiles/stage-fitout', 'rooms and grid tiles', 'src/art/bunker-tiles.js', 16, 16, 'scaffold drawn at the object size (16 px per metre)');
  const { OBJECTS } = await import(new URL('../src/shelter/bunker-catalog.js', import.meta.url));
  const fx = await art('fixtures64.js');
  const am = await art('hd/amenities64.js');
  for (const [id, o] of Object.entries(OBJECTS)) {
    if (am.hasAmenity(id)) { proc(`bunker-objects/${id}`, 'amenities and fixtures', 'src/art/hd/amenities64.js', o.w * am.AMENITY_PX, o.h * am.AMENITY_PX, `${o.w}x${o.h} m at ${am.AMENITY_PX} px per metre (native, #118); drawn reduced while the editor is 16 px per metre`); continue; }
    if (fx.hasFixture(id)) { proc(`bunker-objects/${id}`, 'amenities and fixtures', 'src/art/fixtures64.js', o.w * fx.FIXTURE_PX, o.h * fx.FIXTURE_PX, `${o.w}x${o.h} m at ${fx.FIXTURE_PX} px per metre (native); drawn reduced while the editor is 16 px per metre`); continue; }
    proc(`bunker-objects/${id}`, 'amenities and fixtures', 'src/shelter/bunker-sprites.js', o.w * 16, o.h * 16, `${o.w}x${o.h} m at 16 px per metre`);
  }
  proc('bunker-residents/resident', 'characters', 'src/shelter/bunker-sprites.js', 10, 16, 'per pose');
  const style = await art('styleArt.js');
  proc('styled-rooms/room', 'rooms and grid tiles', 'src/art/styleArt.js', style.ROOM_PX, style.ROOM_PX, 'one room template, every style');
  const rooms = await art('hd/room-tiles.js');
  for (const id of rooms.ROOM_TILE_IDS) { const { w, h } = rooms.roomTileSize(id); proc(`room-tiles/${id}`, 'rooms and grid tiles', 'src/art/hd/room-tiles.js', w * rooms.TILE_PX_PER_M, h * rooms.TILE_PX_PER_M, `${w}x${h} m at ${rooms.TILE_PX_PER_M} px per metre (#117), 2 frames`); }
  const base = await art('map-base.js');
  proc('map-base/world', 'map', 'src/art/map-base.js', base.BASE_W, base.BASE_H, 'painted per pixel; terrain detail on an 8 px cell layout');
  proc('map-regions/state-layer', 'map', 'src/art/map-regions.js', base.BASE_W, base.BASE_H, 'full-map overlay');
  proc('map-heat/heat-layer', 'map', 'src/art/map-heat.js', base.BASE_W, base.BASE_H, 'full-map overlay');

  // exported PNGs (sheets are listed whole; their frames are the sprites above)
  for (const f of walk(join(ROOT, 'assets/art')).filter((p) => p.endsWith('.png'))) {
    const s = pngSize(f);
    if (!s) continue;
    const rel = relative(ROOT, f);
    const json = f.replace(/\.png$/, '.json');
    const sheet = (() => { try { statSync(json); return true; } catch { return false; } })();
    add({ asset: rel, category: 'exported file', source: rel, kind: sheet ? 'PNG sheet' : 'PNG', w: s.w, h: s.h, frames: 1, bitsPerChannel: s.bitDepth, ...owners(rel), note: sheet ? 'sprite sheet; each frame is listed with its sprite' : '' });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = await inventory();
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
  else for (const r of rows) console.log(`${r.asset.padEnd(42)} ${`${r.w}x${r.h}`.padStart(9)}  ${r.kind.padEnd(12)} ${r.created}/${r.last}`);
}
