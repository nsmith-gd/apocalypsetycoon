// First-breach nudge (#68). GDD Pacing, 2:10-2:30: "The first breach. If the player hasn't breached by
// 2:30, a wildcard nudges a Brink track over." It teaches containment while the stakes are low (the first
// breach gets the 6-week window).
//
//   const nudge = new FirstBreachNudge({ crisis, minutes: () => campaignMinutes() });
//   const card = nudge.check();   // every tick/week: null, or a wildcard card (once per campaign)
//   // play the card through the weekly-card UI; its only choice pushes the track to its tipping point.
//
// Which track: the hottest open track at the Brink (crisis state 'brink', or tension in the Brink band,
// 70+). If none is at the Brink, the hottest open track that can still breach (assumption: a cautious
// player sitting at Simmer still gets the lesson, just from further away).

export const FIRST_BREACH = Object.freeze({ atMinutes: 150, brinkFrom: 70 });

const breachable = (t) => t.open && (t.state === 'calm' || t.state === 'brink');

/** The track the wildcard pushes over, or null if nothing can breach. */
export function firstBreachTarget(crisis, cfg = FIRST_BREACH) {
  const open = Object.values(crisis.tracks).filter(breachable).sort((a, b) => b.tension - a.tension);
  return open.find((t) => t.state === 'brink' || t.tension >= cfg.brinkFrom) ?? open[0] ?? null;
}

export class FirstBreachNudge {
  constructor({ crisis, minutes = () => 0, cfg = {} } = {}) {
    this.crisis = crisis;
    this.minutes = minutes;
    this.cfg = { ...FIRST_BREACH, ...cfg };
    this.fired = null; // { minute, track, from, to } once the wildcard has been dealt
    this.natural = null; // minute of a breach the player caused before the deadline
  }

  /** True once any track has breached this campaign. */
  get anyBreach() { return this.crisis.breachCount > 0; }

  /** Call often. Returns the wildcard card the moment it is due (once), otherwise null. */
  check() {
    if (this.fired || this.natural != null) return null;
    const m = this.minutes();
    if (this.anyBreach) { this.natural = Math.round(m); return null; }
    if (m < this.cfg.atMinutes || this.crisis.paused) return null;
    const t = firstBreachTarget(this.crisis, this.cfg);
    if (!t) return null;
    const tip = this.crisis.tippingPoint(t.id);
    const push = Math.max(1, Math.ceil(tip - t.tension));
    this.fired = { minute: Math.round(m), track: t.id, from: t.tension, to: tip };
    return {
      id: 'first_breach_wildcard', title: `${t.name}: Out of Nowhere`, type: 'wildcard', track: t.id, band: 'Brink',
      blurb: `Nobody planned this one, not even you. A rumour, a misfire, a bad night on the markets, and ${t.name} slips past the point of no return.`,
      choices: [{ id: 'brace', label: 'Brace for the breach', effects: { tension: { track: t.id, n: push } } }],
    };
  }

  /** Apply the wildcard straight to the crisis (harness and tests; the campaign plays the card instead). */
  apply(card) {
    const e = card.choices[0].effects.tension;
    this.crisis.addTension(e.track, e.n, 'Wildcard');
    return this.crisis.tracks[e.track].state === 'breach';
  }

  toJSON() { return { fired: this.fired, natural: this.natural }; }
  load(d = {}) { this.fired = d.fired ?? null; this.natural = d.natural ?? null; }
}
