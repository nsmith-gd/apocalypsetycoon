// #159 UI theme: the two vendored pixel fonts exist with their licences, and the theme only uses them at whole
// multiples of their own pixel grids (Jersey 10: 10 px, VT323: 8 px), in device-rounded units (#127).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const css = readFileSync(new URL('../src/ui/theme.css', import.meta.url), 'utf8');

test('the theme fonts are vendored with their open font licences', () => {
  for (const f of ['jersey-10-latin-400-normal.woff2', 'vt323-latin-400-normal.woff2', 'LICENSE-jersey-10.txt', 'LICENSE-vt323.txt']) {
    assert.ok(existsSync(new URL(`../assets/fonts/${f}`, import.meta.url)), f);
  }
  for (const f of ['LICENSE-jersey-10.txt', 'LICENSE-vt323.txt']) assert.match(readFileSync(new URL(`../assets/fonts/${f}`, import.meta.url), 'utf8'), /SIL Open Font License/);
  assert.match(css, /@font-face \{ font-family: 'Jersey 10'; src: url\('\.\.\/\.\.\/assets\/fonts\/jersey-10/);
  assert.match(css, /@font-face \{ font-family: 'VT323'; src: url\('\.\.\/\.\.\/assets\/fonts\/vt323/);
});

test('type sizes are whole multiples of each font grid, in device-rounded px', () => {
  const tok = Object.fromEntries([...css.matchAll(/--th-t(\d+):\s*calc\((\d+) \* var\(--px-(\d)/g)].map(([, n, a, k]) => [n, Number(a) * Number(k)]));
  assert.deepEqual(tok, { 16: 16, 20: 20, 30: 30, 40: 40 });
  // every font-size in the theme is a token (or the title's 10 x 8)
  for (const [, v] of css.matchAll(/font-size:\s*([^;]+);/g)) assert.ok(/^var\(--th-t\d+\)$/.test(v.trim()) || v.trim() === 'calc(10 * var(--px-8, 8px))', `font-size ${v}`);
  // VT323 only at 16, Jersey only at 20/30/40
  for (const rule of css.split('}')) {
    const fam = rule.match(/font-family:\s*var\(--th-(title|text)\)/)?.[1];
    const fs = rule.match(/font-size:\s*var\(--th-t(\d+)\)/)?.[1];
    if (!fam || !fs) continue;
    if (fam === 'text') assert.equal(fs, '16', rule.slice(0, 80));
    else assert.ok(['20', '30', '40'].includes(fs), rule.slice(0, 80));
  }
});
