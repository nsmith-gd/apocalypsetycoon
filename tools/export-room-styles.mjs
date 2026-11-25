#!/usr/bin/env node
// Exports the six design-style variants of every 64 px room tile (#120), headless.
//
//   node tools/export-room-styles.mjs                       # assets/art/room-styles.png + .json (every room x 6 styles)
//   node tools/export-room-styles.mjs --pick <dir> id,id    # one comparison strip per room (room in all six styles, x2)
import { writeFileSync, mkdirSync } from 'node:fs';
import { renderRoomTile, ROOM_TILE_IDS, DESIGN_STYLES } from '../src/art/hd/room-tiles.js';
import { encodePng, sheet } from './export-room-tiles.mjs';

const args = process.argv.slice(2);
if (args.includes('--pick')) {
  const dir = args[args.indexOf('--pick') + 1];
  const ids = (args[args.indexOf('--pick') + 2] ?? '').split(',').filter(Boolean);
  mkdirSync(dir, { recursive: true });
  for (const id of ids) {
    const items = [{ id: 'base', r: renderRoomTile(id) }, ...DESIGN_STYLES.map((d) => ({ id: d, r: renderRoomTile(id, { design: d }) }))];
    const s = sheet(items, items[0].r.w * 4 + 12, 4);
    writeFileSync(`${dir}/styles-${id}.png`, encodePng(s.w, s.h, s.rgba, 2));
  }
  console.log(`wrote ${ids.length} strips to ${dir}`);
} else {
  const items = ROOM_TILE_IDS.flatMap((id) => DESIGN_STYLES.map((d) => ({ id: `${id}/${d}`, r: renderRoomTile(id, { design: d }) })));
  const s = sheet(items, 4096);
  mkdirSync(new URL('../assets/art/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../assets/art/room-styles.png', import.meta.url), encodePng(s.w, s.h, s.rgba));
  writeFileSync(new URL('../assets/art/room-styles.json', import.meta.url), JSON.stringify(s.atlas, null, 1));
  console.log(`room-styles.png ${s.w}x${s.h}, ${items.length} tiles`);
}
