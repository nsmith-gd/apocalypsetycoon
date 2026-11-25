import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIERS, Company } from '../src/company/company.js';
import { PACING } from '../src/debug/pacing.js';
import { QUARTER_SECONDS, CampaignClock } from '../src/campaign/clock.js';
import { TUNING } from '../src/config/tuning.js';
import { LeadMarket } from '../src/demand/demand.js';
import { WEEK_MINUTES } from '../src/debug/breach-sim.js';
import { WEEKLY_CARDS } from '../src/events/weekly.js';
import { TRACKS } from '../src/world/tracks.js';

// #106: pins the four settled contradictions in docs/gdd-decisions.md (#96). If one of these fails, either the code
// drifted from a decision, or the decision changed: then update docs/gdd-decisions.md and this test together.

test('decision 1: the Startup tier has 2 shovel crews', () => {
  const startup = TIERS.find((t) => t.id === 'startup');
  assert.equal(startup.crews, 2);
  assert.equal(new Company().crewCap, 2, 'a new company starts at Startup with 2 crews');
});

test('decision 2: a quarter is 27 minutes of game clock (1620 s), a week a thirteenth of it (about 125 s)', () => {
  assert.equal(PACING.quarterMinutes, 27);
  assert.equal(QUARTER_SECONDS, 1620);
  assert.equal(new CampaignClock().quarterSeconds, 1620);
  const week = QUARTER_SECONDS / 13;
  assert.ok(Math.abs(week - 125) < 1, `${week} s`);
  assert.ok(Math.abs(WEEK_MINUTES * 60 - week) < 1e-9, 'the breach sim runs the same week');
  // the campaign derives its crisis week from the clock, so it follows the quarter length
  const main = readFileSync(new URL('../src/campaign/main.js', import.meta.url), 'utf8');
  assert.match(main, /WEEK_SECONDS = clock\.quarterSeconds \/ 13/);
});

test('decision 4: reputation starts at 40 in the tuning table and in the lead market default', () => {
  assert.equal(TUNING.reputation.start, 40);
  assert.equal(new LeadMarket({ seed: 1 }).getReputation(), 40);
});

// Decision 3: 220 cards per campaign (6 tracks x 30 + 40 general), 340 with the four alternate tracks (+120).
// The weekly deck is still a sample (a handful of cards); this check switches on once the full deck data lands.
const deckLanded = WEEKLY_CARDS.length >= 220;
test('decision 3: the event deck is 220 cards per campaign, 340 with the alternates', { skip: deckLanded ? false : `deck data not landed yet (${WEEKLY_CARDS.length} sample cards)` }, () => {
  const byTrack = (id) => WEEKLY_CARDS.filter((c) => c.track === id).length;
  const general = WEEKLY_CARDS.filter((c) => !c.track).length;
  const classic = TRACKS.filter((t) => t.classic).map((t) => t.id);
  const alternates = TRACKS.filter((t) => !t.classic).map((t) => t.id);
  assert.equal(general, 40);
  for (const id of [...classic, ...alternates]) assert.equal(byTrack(id), 30, id);
  assert.equal(classic.reduce((s, id) => s + byTrack(id), 0) + general, 220);
  assert.equal(WEEKLY_CARDS.length, 340);
});
