#!/usr/bin/env node
// Asset minimum check (#115, art note D4: "all assets need to be 64bit now minimum").
// Fails if any asset is smaller than the minimum on its shortest side, at native resolution.
//
//   node tools/check-asset-minimum.mjs                    # every asset in the game (tools/asset-inventory.mjs)
//   node tools/check-asset-minimum.mjs --baseline         # CI mode: only NEW offenders fail; known ones are listed
//   node tools/check-asset-minimum.mjs --files a.png dir/ # just these PNG files (or every PNG under a dir)
//   node tools/check-asset-minimum.mjs --min 48           # override the minimum
//   node tools/check-asset-minimum.mjs --write-baseline   # record today's offenders as known (after an audit)
//
// The minimum comes from the style guide: a line like "Minimum asset size: 64 px" in docs/art/style-guide.md
// (#113 pins the definition there). Until that line exists it is 64.
// Exit code: 0 pass, 1 offenders, 2 usage error. Offenders are printed one per line, by path.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { inventory } from './asset-inventory.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
export const BASELINE_FILE = join(ROOT, 'docs/art/asset-minimum-baseline.json');
export const DEFAULT_MIN = 64;
// Not art: reference swatches and the like.
export const EXEMPT = new Set(['assets/art/palette.png']);

export function minimumFromStyleGuide(file = join(ROOT, 'docs/art/style-guide.md')) {
  try {
    const m = readFileSync(file, 'utf8').match(/minimum asset size[^0-9\n]*(\d+)/i);
    return m ? Number(m[1]) : DEFAULT_MIN;
  } catch { return DEFAULT_MIN; }
}

export function pngSize(file) {
  const b = readFileSync(file);
  if (b.length < 24 || b.toString('ascii', 1, 4) !== 'PNG') return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => walk(join(p, f))) : [p]);

/** Records { path, asset, w, h } for a list of PNG files or directories. */
export function filesToRecords(paths) {
  return paths.flatMap((p) => walk(resolve(p))).filter((f) => f.endsWith('.png')).map((f) => {
    const s = pngSize(f);
    const rel = relative(ROOT, f);
    return { path: rel, asset: rel, w: s?.w ?? 0, h: s?.h ?? 0, invalid: !s };
  });
}

/** Which records fall short. Each offender keeps its path (source file) and asset id. */
export function check(records, min) {
  return records.filter((r) => !EXEMPT.has(r.asset) && (r.invalid || Math.min(r.w, r.h) < min));
}

export const keyOf = (r) => `${r.path ?? r.source}::${r.asset}`;

export async function run(argv) {
  const has = (f) => argv.includes(f);
  const i = argv.indexOf('--min');
  const min = i >= 0 ? Number(argv[i + 1]) : minimumFromStyleGuide();
  if (!(min > 0)) return { code: 2, lines: ['--min needs a number'] };
  let records;
  const fi = argv.indexOf('--files');
  if (fi >= 0) {
    const rest = argv.slice(fi + 1);
    const stop = rest.findIndex((a) => a.startsWith('--'));
    const paths = stop < 0 ? rest : rest.slice(0, stop);
    if (!paths.length) return { code: 2, lines: ['--files needs at least one path'] };
    records = filesToRecords(paths);
  } else {
    records = (await inventory()).map((r) => ({ ...r, path: r.source }));
  }
  const offenders = check(records, min);
  const lines = [];
  if (has('--write-baseline')) {
    writeFileSync(BASELINE_FILE, `${JSON.stringify({ min, note: 'Known offenders from the #114 audit. Redo work removes entries; nothing new may be added.', offenders: offenders.map(keyOf).sort() }, null, 1)}\n`);
    return { code: 0, lines: [`Baseline written: ${offenders.length} known offenders at ${min}px.`] };
  }
  let failing = offenders;
  let known = [];
  if (has('--baseline') && existsSync(BASELINE_FILE)) {
    const base = new Set(JSON.parse(readFileSync(BASELINE_FILE, 'utf8')).offenders);
    known = offenders.filter((r) => base.has(keyOf(r)));
    failing = offenders.filter((r) => !base.has(keyOf(r)));
  }
  const fmt = (r) => `${r.path}  ${r.asset !== r.path ? `${r.asset}  ` : ''}${r.invalid ? 'not a readable PNG' : `${r.w}x${r.h} < ${min}px`}`;
  for (const r of failing) lines.push(`FAIL ${fmt(r)}`);
  if (known.length) lines.push(`(${known.length} known offenders from the audit, listed in docs/art/asset-audit-64.md, are waiting on their redo tickets)`);
  lines.push(failing.length ? `${failing.length} asset(s) below the ${min}px minimum.` : `PASS: ${records.length - offenders.length} asset(s) checked at ${min}px minimum${known.length ? `, ${known.length} known` : ''}.`);
  return { code: failing.length ? 1 : 0, lines, failing, known, min };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await run(process.argv.slice(2));
  for (const l of r.lines) console.log(l);
  process.exit(r.code);
}
