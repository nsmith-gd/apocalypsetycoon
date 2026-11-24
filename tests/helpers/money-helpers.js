// Reads the campaign's opening cash without starting the browser game (main.js needs a DOM).
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../../src/campaign/main.js', import.meta.url), 'utf8');
export const STARTING_CASH_FOR_TESTS = /export const STARTING_CASH = MONEY\.startingCash/.test(src) ? (await import('../../src/config/tuning.js')).MONEY.startingCash : null;
