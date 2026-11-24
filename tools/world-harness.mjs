#!/usr/bin/env node
// World harness (#75): a full 12-quarter crisis campaign over a roster, headless.
//   node tools/world-harness.mjs                 # Classic
//   node tools/world-harness.mjs --greygoo       # The Grey Goo in slot 2 (same debug flag as the game)
//   node tools/world-harness.mjs --slot3 longshade --seed 4
// Exit code 1 if the run does not complete or the roster's slot-2 track never opens.
import { simulateWorld } from '../src/debug/world-sim.js';
import { CLASSIC_ROSTER, TRACK_BY_ID, slotOf, rosterPicksFromParams, trackInSlot } from '../src/world/tracks.js';

const args = process.argv.slice(2);
const params = new URLSearchParams();
for (let i = 0; i < args.length; i++) {
  const a = args[i].replace(/^--/, '');
  if (args[i + 1] && !args[i + 1].startsWith('--')) { params.set(a, args[++i]); } else params.set(a, '');
}
const picks = rosterPicksFromParams(params);
const roster = CLASSIC_ROSTER.map((id) => picks[slotOf(id)] ?? id);
const r = simulateWorld({ roster, seed: Number(params.get('seed') || 1) });
const name = (id) => TRACK_BY_ID[id]?.name ?? id;
console.log(`Roster: ${roster.map((id, i) => `${i + 1}:${name(id)}`).join('  ')}`);
console.log(`Weeks run: ${r.weeks}  completed: ${r.completed}`);
console.log(`Opened: ${r.opened.map((o) => `${name(o.track)} (wk ${o.week})`).join(', ')}`);
console.log(`Breaches: ${r.breaches.length}  collapses: ${r.collapses.map((c) => name(c.track)).join(', ') || 'none'}`);
const slot2 = trackInSlot(roster, 2);
const s2 = r.dominoes.filter((d) => d.from === slot2 || d.to === slot2);
console.log(`Dominoes: ${r.dominoes.length} (${s2.length} through slot 2, ${name(slot2)}): ${s2.slice(0, 4).map((d) => `${name(d.from)} -> ${name(d.to)} (${d.strength})`).join('; ')}`);
console.log(`Arriving apocalypse at Midnight: ${r.apocalypse}`);
console.log(`Hero fears: ${Object.entries(r.heroFears).map(([k, v]) => `${k}: ${v.join(' + ')}`).join(' | ')}`);
console.log(`Rival favourites: Halcyon ${r.rivals.halcyon.map(name).join(' + ')}; Bunkr ${r.rivals.bunkr.map(name).join(' + ')}`);
const ok = r.completed && r.opened.some((o) => o.track === slot2);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
