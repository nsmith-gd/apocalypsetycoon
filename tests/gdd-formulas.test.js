import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// #95: the docx-to-markdown conversion dropped every equation; they are restored as code blocks.
const md = readFileSync(new URL('../gdd/current/gdd-full.md', import.meta.url), 'utf8');
const FORMULAS = [
  'Leads_r = 0.5 + (Σ_i F_i · e_{i,r}) / 50 + R_r',
  'M = min(F, 15 − (Σ_i T_i) / 40)',
  'Satisfaction = s · Σ_k w_k · met_k',
  'Days Sealed = min_j [ stock_j / (use_j − production_j) ]',
  'P(survive) = min(1, Days Sealed / Required days) · f_seal · f_blast · f_security · f_morale',
  'ΔT = d_band + 0.25·M + S',
  'M_{t+1} = 0.75·M_t + I_t',
  'Q_n = 6 × 1.3^(n−1)',
  'Price = Base × (1 + p) × c',
];

test('every GDD equation is in gdd-full.md, inside a code block', () => {
  const blocks = [...md.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n');
  for (const f of FORMULAS) assert.ok(blocks.includes(f), f);
});
