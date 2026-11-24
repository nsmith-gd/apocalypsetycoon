// Social layer view-model (#60, director note D2): one object the UI reads to draw the event list,
// the guest list, the dialogue node with its choices, and the results summary. The UI never touches
// the event circuit, dialogue engine, outcome rules or lead pipeline directly, so the final screens
// (#19 and the art tasks) can replace the placeholder text screens without changing any rules.
//
//   const social = new SocialSession({ circuit, leads, getQuarter, addHeat, addReputation });
//   social.screen                 -> 'events' | 'guests' | 'dialogue' | 'result' | 'summary'
//   social.eventsView()           -> { quarter, daysLeft, cash?, events: [{ id, name, region, cost, days, kind, blurb, canAttend, reason }] }
//   social.attend(venueId)        -> enters the event (pays, holds the clock), screen = 'guests'
//   social.guestsView()           -> { venue, press, guests: [{ id, name, wealthClass, region, fears, status, result? }], leadsGained }
//   social.talk(guestId)          -> starts a conversation, screen = 'dialogue'
//   social.dialogueView()         -> { guest, line: { speaker, text }, transcript, choices: [{ id, text, tags }] }
//   social.choose(choiceId)       -> advances; on an ending resolves + applies the outcome, screen = 'result'
//   social.resultView()           -> { guest, ending, label, win, blurb, lead?, lines, heat, reputation, leverage, slips }
//   social.backToGuests()         -> screen = 'guests'
//   social.leave()                -> screen = 'summary', returns summaryView()
//   social.summaryView()          -> { venue, talked, leads: [...], heat, reputation, cost }
//   social.close()                -> screen = 'events' (after the summary)
//   social.onChange(fn)
//
// `dialogueFactory(guest, context)` returns a dialogue session (see dialogue-stub.js for the interface);
// it defaults to the stand-in runner until the real engine (#54) and trees (#56) land.

import { resolveOutcome, applyOutcome, ENDINGS } from '../dialogue/outcomes.js';
import { createTreeDialogue } from './tree-dialogue.js';
import { GDD_REGIONS, TRACKS } from '../world/tracks.js';

const regionName = (id) => GDD_REGIONS.find((r) => r.id === id)?.name ?? id;
const trackName = (id) => TRACKS.find((t) => t.id === id)?.name ?? id;

/** Short tags so the player can see a line's risk before picking it (#55's open question). */
export function choiceTags(effects = {}) {
  const tags = [];
  if (effects.fear) tags.push('FEAR');
  if (effects.trait) tags.push('FLATTER');
  if (effects.promise) tags.push('PROMISE');
  if (effects.aggressive) tags.push('PUSHY');
  if (effects.slip) tags.push('RISKY');
  return tags;
}

export class SocialSession {
  constructor({ circuit, leads = null, getQuarter = () => 1, getCash = null, addHeat = null, addReputation = null,
    pushback = null, press = null, dialogueFactory = null, rng = Math.random } = {}) {
    if (!circuit) throw new Error('SocialSession needs an EventCircuit');
    this.circuit = circuit;
    this.leads = leads;
    this.getQuarter = getQuarter;
    this.getCash = getCash;
    this.addHeat = addHeat;
    this.addReputation = addReputation;
    this.pushback = pushback;
    this.press = press;
    this.dialogueFactory = dialogueFactory ?? ((guest) => createTreeDialogue(guest, { rng }));
    this.rng = rng;
    this.screen = 'events';
    this.results = new Map(); // guestId -> resolved outcome (this visit)
    this.talking = null; // { guest, session }
    this.lastResult = null;
    this.lastSummary = null;
    this.visitTotals = null;
    this._listeners = new Set();
  }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit() { for (const fn of this._listeners) fn(this); }

  get visit() { return this.circuit.current; }

  // ---------- events ----------
  eventsView() {
    const quarter = this.getQuarter();
    return {
      quarter,
      daysLeft: this.circuit.daysLeft(quarter),
      daysPerQuarter: this.circuit.daysPerQuarter,
      cash: this.getCash?.() ?? this.circuit.ledger?.cash ?? null,
      events: this.circuit.options(quarter).map(({ venue: v, canAttend, reason }) => ({
        id: v.id, name: v.name, kind: v.kind, region: regionName(v.region), cost: v.cost.cash, days: v.cost.days,
        guests: `${v.guestList.min}-${v.guestList.max}`, press: v.exposure.press, heat: v.exposure.heat,
        reputation: v.exposure.reputation, blurb: v.blurb, canAttend, reason,
      })),
    };
  }

  attend(venueId) {
    this.circuit.attend(venueId, { quarter: this.getQuarter(), from: 'social' });
    this.results.clear();
    const v = this.circuit.current;
    this.visitTotals = { heat: v.exposure.heat ?? 0, reputation: v.exposure.reputation ?? 0 };
    this.screen = 'guests';
    this._emit();
    return v;
  }

  // ---------- guests ----------
  guestsView() {
    const v = this.visit;
    if (!v) return null;
    return {
      venue: { id: v.venueId, name: v.venueName, quarter: v.quarter },
      press: v.press,
      guests: v.guests.map((g) => {
        const r = this.results.get(g.id);
        return {
          id: g.id, name: g.name, wealthClass: g.wealthClass, region: g.regionName ?? regionName(g.region),
          fears: (g.fears ?? []).map(trackName), traits: g.traits ?? [],
          status: r ? (r.win ? 'won' : 'lost') : v.met.includes(g.id) ? 'met' : 'new',
          result: r ? { label: r.label, lead: r.leadId ? { tier: r.leadTier, quality: r.leadQuality } : null } : null,
        };
      }),
      leadsGained: [...this.results.values()].filter((r) => r.leadId).length,
    };
  }

  talk(guestId) {
    const v = this.visit;
    if (!v) throw new Error('Not at an event.');
    const guest = v.guests.find((g) => g.id === guestId);
    if (!guest) throw new Error('That guest is not here.');
    if (this.results.has(guestId) || v.met.includes(guestId)) throw new Error(`You have already spoken to ${guest.name}.`);
    this.talking = { guest, session: this.dialogueFactory(guest, { venueId: v.venueId, journalistPresent: v.press, quarter: v.quarter }) };
    this.screen = 'dialogue';
    this._emit();
    return this.dialogueView();
  }

  // ---------- dialogue ----------
  dialogueView() {
    if (!this.talking) return null;
    const { guest, session } = this.talking;
    const n = session.node();
    return {
      guest: { id: guest.id, name: guest.name, wealthClass: guest.wealthClass, fears: (guest.fears ?? []).map(trackName), archetype: session.archetype ?? null },
      line: n ? { speaker: n.speaker, text: n.text } : null,
      transcript: session.transcript.map(({ speaker, text }) => ({ speaker, text })),
      choices: n ? n.choices.map((c) => ({ id: c.id, text: c.text, tags: choiceTags(c.effects) })) : [],
    };
  }

  choose(choiceId) {
    if (!this.talking) throw new Error('Not in a conversation.');
    const { guest, session } = this.talking;
    session.choose(choiceId);
    if (session.done) this._finish(guest, session);
    this._emit();
  }

  _finish(guest, session) {
    const v = this.visit;
    const result = resolveOutcome({ ending: session.ending, guest: session.guest ?? guest, effects: session.effects, context: { journalistPresent: v.press }, rng: this.rng });
    const { lead, tipOffs } = applyOutcome(result, {
      leads: this.leads, pushback: this.pushback, press: this.press, addHeat: this.addHeat, addReputation: this.addReputation,
      guest, venueId: v.venueId, quarter: v.quarter,
    });
    if (lead) lead.source.venueName = v.venueName; // shown wherever the lead is listed
    this.circuit.meet(guest.id);
    const record = {
      ...result, blurb: ENDINGS[result.ending]?.blurb ?? '', transcript: [...session.transcript],
      leadId: lead?.id ?? null, leadTier: lead?.tier ?? null, leadQuality: lead?.quality ?? null, leadExpires: lead?.expiresQuarter ?? null,
      tipOffs: tipOffs.length,
    };
    this.results.set(guest.id, record);
    this.visitTotals.heat += result.heat;
    this.visitTotals.reputation += result.reputation;
    this.lastResult = record;
    this.talking = null;
    this.screen = 'result';
  }

  // ---------- results ----------
  resultView() {
    const r = this.lastResult;
    if (!r) return null;
    return {
      guest: r.guest, ending: r.ending, label: r.label, win: r.win, blurb: r.blurb,
      lead: r.leadId ? { id: r.leadId, tier: r.leadTier, quality: r.leadQuality, expiresQuarter: r.leadExpires } : null,
      lines: [...r.lines], heat: r.heat, reputation: r.reputation, leverage: r.leverage, slips: r.slips.length,
      transcript: r.transcript.map(({ speaker, text }) => ({ speaker, text })),
    };
  }

  backToGuests() {
    if (!this.visit) return;
    this.screen = 'guests';
    this._emit();
  }

  leave() {
    const before = this.visit;
    if (!before) return null;
    const results = [...this.results.values()];
    this.circuit.leave();
    this.lastSummary = {
      venue: { id: before.venueId, name: before.venueName },
      cost: before.cost,
      talked: results.length,
      guests: before.guests.length,
      leads: results.filter((r) => r.leadId).map((r) => ({ name: r.guest.name, tier: r.leadTier, quality: r.leadQuality, expiresQuarter: r.leadExpires })),
      heat: this.visitTotals.heat,
      reputation: this.visitTotals.reputation,
      press: before.press,
    };
    this.talking = null;
    this.screen = 'summary';
    this._emit();
    return this.lastSummary;
  }

  summaryView() { return this.lastSummary; }

  close() {
    this.screen = 'events';
    this._emit();
  }
}
