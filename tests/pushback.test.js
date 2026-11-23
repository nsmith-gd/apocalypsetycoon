import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pushback } from '../src/pushback/pushback.js';

// Minimal ledger stand-in with the same surface as src/ledger/ledger.js.
function fakeLedger(cash = 250_000) {
  const entries = [];
  let quarter = 1;
  return {
    entries,
    get cash() { return cash + entries.reduce((s, e) => s + e.amount, 0); },
    setQuarter(q) { quarter = q; },
    record(category, label, amount) { entries.push({ quarter, category, label, amount }); },
    summary(q) { return { net: entries.filter((e) => e.quarter === q).reduce((s, e) => s + e.amount, 0) }; },
  };
}

test('schemes raise heat and tension', () => {
  const pb = new Pushback({ ledger: fakeLedger() });
  const h0 = pb.heat, t0 = pb.tension;
  pb.onScheme({ label: 'Leak memo', heat: 12, tension: 14 });
  assert.equal(pb.heat, h0 + 12);
  assert.equal(pb.tension, t0 + 14);
});

test('crossing the investigation line queues a choice; settling lowers heat and costs cash', () => {
  const ledger = fakeLedger();
  const pb = new Pushback({ ledger });
  const fired = pb.onScheme({ label: 'Riot funding', heat: 50 });
  assert.equal(fired.length, 1);
  assert.equal(fired[0].type, 'investigation');
  assert.equal(pb.pending.length, 1);
  const heat = pb.heat;
  const cash = ledger.cash;
  pb.resolve(fired[0].id, 'settle');
  assert.equal(pb.heat, heat - 25);
  assert.ok(ledger.cash < cash);
  assert.equal(ledger.entries.at(-1).category, 'fines');
  // only one investigation per quarter
  pb.onScheme({ label: 'Again', heat: 40 });
  assert.equal(pb.pending.filter((e) => e.type === 'investigation').length, 0);
});

test('maxing heat triggers a raid with a big fine', () => {
  const ledger = fakeLedger();
  const pb = new Pushback({ ledger });
  const fired = pb.onScheme({ label: 'Everything at once', heat: 100 });
  assert.ok(fired.some((e) => e.type === 'raid'));
  assert.equal(pb.heat, pb.cfg.heat.raidHeatAfter);
  assert.ok(ledger.entries.some((e) => e.label === 'Federal raid' && e.amount <= -150_000));
});

test('ending a quarter hot draws a regulator fine', () => {
  const ledger = fakeLedger();
  const pb = new Pushback({ ledger });
  pb.heat = 80;
  ledger.record('sales', 'Bunker', 500_000); // meet the board so only the fine shows
  const r = pb.endQuarter({ quarter: 1 });
  assert.ok(ledger.entries.some((e) => e.label === 'Regulator fine' && e.amount < 0));
  assert.ok(r.lines.some((l) => l.startsWith('Regulator fine')));
  assert.equal(pb.heat, 80 - pb.cfg.heat.decayPerQuarter);
});

test('tension at 100 is a runaway: damages, reset, doomsday shift', () => {
  const ledger = fakeLedger();
  const pb = new Pushback({ ledger });
  pb.onSale({ client: 'Mr. Vance', price: 200_000 });
  let runaway = null;
  pb.on('runaway', (e) => { runaway = e; });
  pb.onScheme({ label: 'Pandemic leak', tension: 90 });
  assert.ok(runaway);
  assert.equal(pb.tension, pb.cfg.tension.runawayResetTo);
  assert.equal(pb.doomsdayShift, 1);
  assert.ok(pb.clients[0].leverage > pb.cfg.leverage.perSale);
});

test('tension above momentum feeds itself at quarter end', () => {
  const pb = new Pushback({ ledger: fakeLedger() });
  pb.tension = 80;
  pb.endQuarter({ quarter: 1, profit: 1e9 });
  assert.equal(pb.tension, 80 + pb.cfg.tension.momentumGain);
  pb.tension = 50;
  pb.endQuarter({ quarter: 2, profit: 1e9 });
  assert.equal(pb.tension, 50 - pb.cfg.tension.decayPerQuarter);
});

test('high-leverage clients blackmail you', () => {
  const pb = new Pushback({ ledger: fakeLedger(), seed: 7 });
  const c = pb.onSale({ client: 'Duchess Okoro', price: 300_000 });
  c.leverage = 90;
  const r = pb.endQuarter({ quarter: 1, profit: 1e9 });
  const bm = r.events.find((e) => e.type === 'blackmail');
  assert.ok(bm, 'expected blackmail');
  pb.resolve(bm.id, 'pay');
  assert.ok(pb.clients[0].leverage < 90);
});

test('mid-leverage clients make demands; refusing adds heat', () => {
  const pb = new Pushback({ ledger: fakeLedger(), seed: 3 });
  const c = pb.onSale({ client: 'Chad', price: 150_000 });
  c.leverage = 45;
  pb.heat = 0;
  const r = pb.endQuarter({ quarter: 1, profit: 1e9 });
  const d = r.events.find((e) => e.type === 'demand');
  assert.ok(d, 'expected demand');
  pb.resolve(d.id, 'refuse');
  assert.equal(pb.heat, 10);
});

test('board: target grows; a miss is a strike with a clawback; three strikes ousts', () => {
  const ledger = fakeLedger();
  const pb = new Pushback({ ledger });
  const t1 = pb.board.target;
  let r = pb.endQuarter({ quarter: 1, profit: t1 + 10_000 });
  assert.equal(r.board.met, true);
  assert.ok(pb.board.target > t1);

  r = pb.endQuarter({ quarter: 2, profit: 0 });
  assert.equal(r.board.met, false);
  assert.equal(pb.board.strikes, 1);
  assert.ok(ledger.entries.some((e) => /Board penalty/.test(e.label)));
  assert.ok(r.events.some((e) => e.type === 'board'));

  r = pb.endQuarter({ quarter: 3, profit: 0 });
  assert.equal(pb.board.strikes, 2);
  assert.equal(pb.buildCostMultiplier ?? pb.board.buildCostMultiplier, 1.25);

  let ousted = false;
  pb.on('ousted', () => { ousted = true; });
  pb.endQuarter({ quarter: 4, profit: 0 });
  assert.equal(pb.board.ousted, true);
  assert.ok(ousted);
});

test('board uses ledger net profit when profit is not passed', () => {
  const ledger = fakeLedger();
  const pb = new Pushback({ ledger });
  ledger.record('sales', 'Bunker', 400_000);
  const r = pb.endQuarter({ quarter: 1 });
  assert.equal(r.board.profit, 400_000);
  assert.equal(r.board.met, true);
});

test('after a miss the board recalibrates toward what you made instead of compounding', () => {
  const pb = new Pushback({ ledger: fakeLedger() });
  pb.board.target = 1_000_000;
  pb.endQuarter({ quarter: 1, profit: 200_000 });
  assert.equal(pb.board.target, 600_000);
});

test('only one runaway per quarter', () => {
  const pb = new Pushback({ ledger: fakeLedger() });
  let n = 0;
  pb.on('runaway', () => n++);
  pb.onScheme({ label: 'a', tension: 100 });
  pb.onScheme({ label: 'b', tension: 100 });
  assert.equal(n, 1);
  pb.endQuarter({ quarter: 1, profit: 1e9 });
  pb.onScheme({ label: 'c', tension: 100 });
  assert.equal(n, 2);
});

// ---------- #14: one data model, relief valves, save/load ----------

test('pressures() exposes all four sources with value, zone and next consequence', () => {
  const pb = new Pushback({ ledger: fakeLedger() });
  pb.onSale({ client: 'Vance', price: 200_000 });
  pb.onScheme({ label: 'x', heat: 30, tension: 40 });
  const p = pb.pressures({ quarterProfit: 10_000 });
  assert.equal(p.heat.value, pb.heat);
  assert.deepEqual(p.heat.next, { at: 50, what: 'Federal investigation opens' });
  assert.equal(p.tension.value, pb.tension);
  assert.equal(p.tension.next.at, 75);
  assert.equal(p.leverage.highest.name, 'Vance');
  assert.equal(p.leverage.highest.next.at, 30);
  assert.equal(p.board.target, pb.board.target);
  assert.equal(p.board.onTrack, false);
  assert.equal(p.board.zone, 'content');
});

test('pressures() reports self-feeding tension and a board on its last chance', () => {
  const pb = new Pushback({ ledger: fakeLedger() });
  pb.tension = 80;
  pb.board.strikes = 2;
  const p = pb.pressures();
  assert.equal(p.tension.selfFeeding, true);
  assert.equal(p.tension.perQuarter, 6);
  assert.equal(p.board.zone, 'last-chance');
});

test('Lay low sheds heat for cash, and costs more each time in a quarter', () => {
  const ledger = fakeLedger();
  const pb = new Pushback({ ledger });
  pb.heat = 60;
  const cash = ledger.cash;
  const r1 = pb.layLow();
  assert.equal(pb.heat, 45);
  assert.equal(ledger.cash, cash - 40_000);
  assert.equal(r1.nextCost, 60_000);
  pb.layLow();
  assert.equal(ledger.cash, cash - 100_000);
  pb.endQuarter({ quarter: 1, profit: 1e9 });
  assert.equal(pb.reliefCost('layLow'), 40_000); // resets each quarter
});

test('Fund relief lowers tension (stopping the runaway spiral) but draws a little heat', () => {
  const pb = new Pushback({ ledger: fakeLedger() });
  pb.tension = 80;
  pb.heat = 10;
  pb.fundRelief();
  assert.equal(pb.tension, 66);
  assert.equal(pb.heat, 13);
  pb.endQuarter({ quarter: 1, profit: 1e9 });
  assert.equal(pb.tension, 63); // below the momentum line it now eases instead of feeding itself
});

test('save and load round-trips every pressure', () => {
  const ledger = fakeLedger();
  const pb = new Pushback({ ledger, seed: 5 });
  pb.onSale({ client: 'Okoro', price: 300_000 });
  pb.onScheme({ label: 'riots', heat: 55, tension: 30 });
  pb.endQuarter({ quarter: 1, profit: 0 });
  pb.fundRelief();
  const saved = JSON.parse(JSON.stringify(pb));
  const back = Pushback.fromJSON(saved, { ledger, seed: 5 });
  assert.deepEqual(back.pressures({ quarterProfit: 1 }), pb.pressures({ quarterProfit: 1 }));
  assert.equal(back.board.strikes, pb.board.strikes);
  assert.equal(back.pending.length, pb.pending.length);
  assert.equal(back.reliefCost('fundRelief'), pb.reliefCost('fundRelief'));
});
