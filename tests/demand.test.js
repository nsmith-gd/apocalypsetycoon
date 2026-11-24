import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextFear, regionLeads, panicPremium, LeadMarket, REGIONS, EXPOSURE, DEMAND, attachCrisis } from '../src/demand/demand.js';
import { CrisisSystem } from '../src/crisis/breach.js';
import { TRACKS as GDD_TRACKS } from '../src/world/tracks.js';

const region = (exposure) => ({ id: 'x', name: 'X', exposure, pool: { prepper: 1 }, wealth: 'rich' });

test("Fear: last week's Fear decays 15%, then +2 per tension point gained and +10 on a breach week", () => {
  assert.equal(nextFear(0, 10, false), 20); // 0 * 0.85 + 2 * 10
  assert.equal(nextFear(20, 0, false), 17); // decay only
  assert.equal(nextFear(20, 5, true), 37); // 17 + 10 + 10
  assert.equal(nextFear(10, -5, false), 8.5); // falling tension never adds Fear
  assert.equal(nextFear(90, 30, true), 100); // capped
});

test('leads = 0.5 with a site + sum(Fear x exposure)/50 + referrals', () => {
  const r = region({ pandemic: 'high', climate: 'medium', war: 'low' });
  const fear = { pandemic: 50, climate: 40, war: 80 };
  // (50*1 + 40*0.5 + 80*0.25) / 50 = (50 + 20 + 20) / 50 = 1.8
  assert.equal(regionLeads(r, fear), 1.8);
  assert.equal(regionLeads(r, fear, { siteOwned: true }), 2.3);
  assert.equal(regionLeads(r, fear, { siteOwned: true, referrals: 0.75 }), 3.05);
  assert.equal(regionLeads(r, { pandemic: 0 }), 0); // no site, no fear: no leads
});

test('exposure weights are 1 / 0.5 / 0.25 and every one of the 8 regions has a full table', () => {
  assert.deepEqual(EXPOSURE, { high: 1, medium: 0.5, low: 0.25 });
  assert.equal(REGIONS.length, 8);
  for (const r of REGIONS) {
    for (const k of ['climate', 'markets', 'pandemic', 'unrest', 'war', ...GDD_TRACKS.map((t) => t.id)]) assert.ok(EXPOSURE[r.exposure[k]], `${r.id} ${k}`);
    assert.ok(r.siteCost > 0);
    assert.ok(Object.keys(r.pool).length >= 3);
  }
});

test('panic premium scales by exposure: full, half, quarter', () => {
  const t = { pandemic: 100 };
  assert.equal(panicPremium(region({ pandemic: 'high' }), t), 1 + DEMAND.maxPanicPremium);
  assert.equal(panicPremium(region({ pandemic: 'medium' }), t), 1 + DEMAND.maxPanicPremium / 2);
  assert.equal(panicPremium(region({ pandemic: 'low' }), t), 1 + DEMAND.maxPanicPremium / 4);
  assert.equal(panicPremium(region({ pandemic: 'high' }), t, { breachMultiplier: 2 }), 1 + DEMAND.maxPanicPremium * 2);
});

test('fractional leads carry over; unworked leads go to a rival after 4 weeks', () => {
  const m = new LeadMarket({ regions: [region({ pandemic: 'high' })] });
  m.ownSite('x');
  for (let i = 0; i < 4; i++) m.week({ tensions: { pandemic: 0 } }); // 0.5/week -> 2 leads by week 4
  assert.equal(m.leads.length + m.lost.length, 2);
  assert.equal(m.lost.length, 0);
  m.week({ tensions: { pandemic: 0 } }); // week 5: the week-2 lead is 3 weeks old... week-2 lead expires at week 6
  m.week({ tensions: { pandemic: 0 } });
  assert.equal(m.lost.length, 1);
  const kept = m.leads[0];
  m.work(kept.id);
  assert.equal(m.worked.length, 1);
});

test('lead quality moves up a wealth class with Showroom prestige and reputation above 40', () => {
  let rep = 41;
  const m = new LeadMarket({ regions: [region({ pandemic: 'high' })], reputation: () => rep });
  m.ownSite('x', { prestige: 0 });
  m.week({ tensions: {} }); m.week({ tensions: {} });
  assert.equal(m.leads[0].wealth, 'rich'); // no Showroom yet
  m.setShowroom('x', 2);
  m.week({ tensions: {} }); m.week({ tensions: {} });
  assert.equal(m.leads.at(-1).wealth, 'ultra');
  rep = 40;
  m.week({ tensions: {} }); m.week({ tensions: {} });
  assert.equal(m.leads.at(-1).wealth, 'rich'); // reputation must be ABOVE 40
});

test('holding a track flat at the Brink drains leads over about a quarter', () => {
  const m = new LeadMarket({ regions: REGIONS });
  // ramp pandemic up to the Brink over four weeks, then hold it flat for 13 weeks
  let t = 40;
  for (let i = 0; i < 4; i++) { t += 10; m.week({ tensions: { pandemic: t } }); }
  const peak = m.history.at(-1).total;
  for (let i = 0; i < 13; i++) m.week({ tensions: { pandemic: t } });
  const after = m.history.at(-1).total;
  assert.ok(peak > 3, `peak ${peak}`);
  assert.ok(after < peak * 0.15, `after ${after} vs peak ${peak}`); // 0.85^13 = 0.12
});

test('breach weeks add Fear through the crisis system', () => {
  const crisis = new CrisisSystem({ tips: { pandemic: 90, climate: 90, unrest: 90, markets: 90, war: 90 } });
  const m = new LeadMarket();
  attachCrisis(m, crisis);
  crisis.setTension('pandemic', 50);
  crisis.advanceWeek(); // first observation: no gain yet
  crisis.setTension('pandemic', 95); // breach
  crisis.advanceWeek();
  assert.equal(m.fear.pandemic, nextFear(0, 45, true));
});
