// First-hour tutorial (#162; GDD Pacing > Moment-to-moment targets). A light, skippable chain of prompts for Q1 that
// follows the campaign's real loop: dig, seal it with an Airlock, make a Bunk Room, sign Marla Quist (a Solo Pod
// buyer), build to the Survive tier until Days Sealed reads 30, watch the build, pass Marla's Survive-tier
// inspection and hand over, sell to her, then a pointer to the first scheme.
//
// Pure logic: each step has a check over a small context the campaign builds every half second (see
// tutorialContext in tutorial-ui.js). Milestones (first room, first contract, first handover, first scheme) are
// timed from the start of the campaign whether the prompts are showing or were skipped, and logged with their GDD
// targets, so telemetry shows how a first hour actually paces.
//
//   const tut = new Tutorial({ telemetry, enabled: isNewCampaign });
//   tut.update(ctx)   // -> the current step (or null when finished / skipped); fires milestones
//   tut.skip(); tut.sign(); tut.toJSON(); tut.load(d)

export const PACING_TARGETS = Object.freeze({ // seconds from the campaign start (GDD Pacing)
  firstRoom: 60,
  firstContract: 180,
  firstHandover: 12 * 60,
  firstScheme: 25 * 60,
});

const has = (ctx, kind) => ctx.kinds.has(kind);
const any = (ctx, kinds) => kinds.some((k) => ctx.kinds.has(k));
// the Survive tier: something for each of air, water and food (built or ordered)
// (and the power to run it: a generator with fuel, or any continuous supply)
const SURVIVE = { air: ['crank_scrubber', 'hepa', 'o2_rack'], water: ['tank', 'recycler', 'aquifer'], food: ['shelf', 'fridge', 'hydro', 'vat'], power: ['diesel', 'solar', 'geothermal', 'reactor', 'battery'] };
const surviveReady = (c) => Object.values(SURVIVE).every((ks) => any(c, ks)) || (c.occupants > 0 && c.daysSealed >= 30);
const hookedUp = (c) => ['air', 'water', 'power'].every((n) => c.nets?.has(n)) || (c.occupants > 0 && c.daysSealed >= 30);

/** The prompts, in order. `text` stays to one or two short lines: show, don't lecture. */
export const STEPS = Object.freeze([
  { id: 'dig', title: 'Dig in', text: 'Pick DIG and drag across the dirt below the surface. Your crew digs it out.', target: '.bk-tool[data-tool="dig"]', done: (c) => c.dug > 0 },
  { id: 'airlock', title: 'Seal the way in', text: 'Place an Airlock door in your shaft. A bunker is only as good as its seal.', target: '.bk-obj[data-kind="airlock"]', done: (c) => has(c, 'airlock') },
  { id: 'bunk', title: 'Your first room', text: 'Place a Bunk bed. Walls make a space; what you put in it makes the room.', target: '.bk-obj[data-kind="bunk"]', done: (c) => has(c, 'bunk'), milestone: 'firstRoom' },
  { id: 'sign', title: 'A buyer: Marla Quist', text: 'A Heartland prepper wants a Solo Pod, and she reads the spec sheet. Sign her up.', action: 'SIGN MARLA', done: (c) => c.signed, milestone: 'firstContract' },
  { id: 'survive', title: 'Survive first', text: 'Marla grades air, water and food, not gold taps. Place a Water tank, Pantry shelving, a Hand-crank scrubber and a Diesel generator.', target: '.bk-obj[data-kind="tank"]', done: surviveReady },
  { id: 'hookup', title: 'Hook it up', text: 'Lay an AIR DUCT, a WATER PIPE and a POWER CABLE through the room. DAYS SEALED counts how long it holds.', target: '.bk-tool[data-tool="air"]', done: hookedUp },
  { id: 'build', title: 'Watch it go up', text: 'The crew works through the queue. Speed time up with x2 or x4.', target: '.cb-group', done: (c) => c.jobs === 0 && c.objects > 0 },
  { id: 'handover', title: "Marla's inspection", text: 'She checks DAYS SEALED: 30 or more, or no sale. Run the 30-DAY PRESSURE TEST, then HAND OVER.', target: '.bk-days', done: (c) => c.handedOver > c.handedOverAtStart, milestone: 'firstHandover' },
  { id: 'sell', title: 'Close the sale', text: 'Open the WORLD MAP. Marla is waiting in North America under YOUR LEADS: sell her the shelter.', target: ['.wm-sell-lead:not([disabled])', '.view-btn[data-view="map"]'], done: (c) => c.marlaSold || c.sales > 0 },
  { id: 'scheme', title: "Calm worlds don't buy bunkers", text: 'When you are ready, fund a scheme in a region. Everything after this is how far you push it.', target: '.wm-schemes', done: (c) => c.schemes > 0 },
]);

export class Tutorial {
  constructor({ telemetry = null, clock = () => (globalThis.performance?.now?.() ?? Date.now()) / 1000, enabled = true, handedOverAtStart = 0 } = {}) {
    this.telemetry = telemetry;
    this.clock = clock; // seconds, monotonic
    this.base = 0; // play seconds before this session (from the save)
    this.t0 = clock();
    this.handedOverAtStart = handedOverAtStart;
    this.step = 0;
    this.skipped = !enabled;
    this.signed = false;
    this.leadId = null;
    this.times = {}; // milestone -> seconds
    this.shownAt = {};
  }

  /** Real play seconds since the campaign started (carried across saves). */
  now() { return this.base + (this.clock() - this.t0); }

  get current() { return this.skipped || this.step >= STEPS.length ? null : STEPS[this.step]; }
  get finished() { return this.step >= STEPS.length; }

  /** Advance through every step the context already satisfies; log milestones. Returns the current step. */
  update(ctx) {
    this.milestones(ctx);
    if (this.skipped) return null;
    // a hand-over completes everything before it (the plot resets, so earlier checks can't be met any more)
    const handed = ctx.handedOver > ctx.handedOverAtStart;
    const before = STEPS.findIndex((st) => st.id === 'handover');
    while (this.step < STEPS.length && (STEPS[this.step].done({ ...ctx, signed: this.signed }) || (handed && this.step < before))) {
      this.telemetry?.event('tutorial_step', { step: STEPS[this.step].id, seconds: Math.round(this.now()) });
      this.step++;
    }
    const cur = this.current;
    if (cur && this.shownAt[cur.id] == null) this.shownAt[cur.id] = Math.round(this.now());
    if (!cur && this.step >= STEPS.length && !this.times.tutorialDone) { this.times.tutorialDone = Math.round(this.now()); this.telemetry?.event('tutorial_done', { seconds: this.times.tutorialDone }); }
    return cur;
  }

  /** Milestones are timed whether or not the prompts are showing. */
  milestones(ctx) {
    const hit = {
      firstRoom: has(ctx, 'bunk') || ctx.rooms > 0,
      firstContract: this.signed || ctx.sales > 0,
      firstHandover: ctx.handedOver > ctx.handedOverAtStart,
      firstScheme: ctx.schemes > 0,
    };
    for (const [k, ok] of Object.entries(hit)) {
      if (!ok || this.times[k] != null) continue;
      const s = Math.round(this.now());
      this.times[k] = s;
      this.telemetry?.event('milestone', { milestone: k, seconds: s, target: PACING_TARGETS[k], met: s <= PACING_TARGETS[k], tutorial: !this.skipped });
    }
  }

  sign() { this.signed = true; }
  skip() {
    if (this.skipped) return;
    this.skipped = true;
    this.telemetry?.event('tutorial_skipped', { step: STEPS[this.step]?.id ?? 'done', seconds: Math.round(this.now()) });
  }

  toJSON() { return { step: this.step, skipped: this.skipped, signed: this.signed, leadId: this.leadId, handedOverAtStart: this.handedOverAtStart, elapsed: Math.round(this.now()), times: { ...this.times }, shownAt: { ...this.shownAt } }; }
  load(d = {}) {
    this.step = d.step ?? 0; this.skipped = !!d.skipped; this.signed = !!d.signed; this.leadId = d.leadId ?? null;
    this.handedOverAtStart = d.handedOverAtStart ?? 0; this.base = d.elapsed ?? 0; this.t0 = this.clock();
    this.times = { ...(d.times ?? {}) }; this.shownAt = { ...(d.shownAt ?? {}) };
  }
}
