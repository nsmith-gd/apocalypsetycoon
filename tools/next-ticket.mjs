#!/usr/bin/env node
// What should I work on? (#87, COORDINATOR.md). Lists unclaimed tickets from .ballast/proposed-tickets.json in
// pickup order: lowest level first, then core sections, then gameplay before art. A ticket is CLAIMED when any
// remote branch is named for it (ballast/<id>-<agent>, e.g. ballast/R13-nathaniel3-2 or ballast/t65-...).
//
//   node tools/next-ticket.mjs              # top 5 unclaimed
//   node tools/next-ticket.mjs --all        # every ticket with its claim
//   node tools/next-ticket.mjs --kind art   # art tickets only
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

export const SECTION_ORDER = [
  'Campaign loop, time scales and session controls',
  'Shelter grid, digging and construction flow',
  'World map, regions, sites, Fear and lead demand',
  'Threat tracks: bands, momentum, tipping points and sieges',
  'Schemes: escalate, calm, influence and intel',
  'Heat, journalists, reputation and client leverage',
  'HUD, rails, canvas switch and quarter report',
  'Clients, needs ladder and contract lifecycle',
  'Doom Clock, floor, fragility and Final Countdown',
  'Weekly event deck and rival companies',
  'Design layer: styles, Blueprints, Showroom, Client Gaze and photo mode',
  'Company and board',
  'Crises and tipping points',
  'Economy and tuning',
];

const args = process.argv.slice(2);
const all = args.includes('--all');
const kind = args.includes('--kind') ? args[args.indexOf('--kind') + 1] : null;
const tickets = JSON.parse(readFileSync(new URL('../.ballast/proposed-tickets.json', import.meta.url), 'utf8'));

let branches = [];
try {
  branches = execSync('git ls-remote --heads origin', { encoding: 'utf8' }).split('\n').map((l) => l.split('refs/heads/')[1]).filter(Boolean);
} catch {
  console.error('Could not list remote branches (offline?): claims unknown. Run `git fetch` and retry.');
}
const claimOf = (id) => branches.find((b) => new RegExp(`^ballast/${id}-`, 'i').test(b)) ?? null;
const done = new Set(tickets.filter((t) => claimOf(t.id)).map((t) => t.id));
const rank = (t) => [Number(t.level.slice(1)), SECTION_ORDER.indexOf(t.section) < 0 ? 99 : SECTION_ORDER.indexOf(t.section), t.kind === 'art' ? 1 : 0];
const cmp = (a, b) => { const x = rank(a), y = rank(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

const rows = tickets
  .filter((t) => !kind || t.kind === kind)
  .filter((t) => all || (!done.has(t.id) && (!t.after || done.has(t.after))))
  .sort(cmp);
for (const t of all ? rows : rows.slice(0, 5)) {
  const claim = claimOf(t.id);
  console.log(`${t.id.padEnd(4)} ${t.level} ${t.kind.padEnd(8)} ${t.title}`);
  console.log(`     section: ${t.section}${claim ? `\n     CLAIMED by branch ${claim}` : ''}${t.after ? `\n     after: ${t.after}` : ''}`);
  if (!all) console.log(`     done when: ${t.done}\n     start in: ${t.start_here}`);
}
if (!rows.length) console.log('Nothing unclaimed in .ballast/proposed-tickets.json: follow the fallback rules in COORDINATOR.md.');
