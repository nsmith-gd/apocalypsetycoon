// Press, reputation, the Inspector and Pitchforks sieges (GDD: Pushback systems >
// Journalist stories / Reputation, the Inspector and sieges). Extends the #5 Pushback module.
//
// JOURNALISTS  Iris Kemp (slow, accurate, trust track 0-5) and Gil Marsh (fast, sloppy; his
//              stories also shove a random threat track +5). Each works one story at a time.
//              Weekly growth = (2% + 1% per 10 heat) x the journalist's speed.
//              At 100% the story RUNS: heat +25, reputation -15, every client +10 leverage.
// COUNTERS     Bury, Discredit, Distraction, Kompromat and The Interview (see PRESS.counters).
// REPUTATION   0-100, starts at 40.
// INSPECTOR    hire a walkthrough of one site for $0.2M: certifies it (reputation) or lists the fixes.
// SIEGES       once The Pitchforks opens, every week the most visible site risks a siege.
//              strength = tension / 20 + visible surface features, against the site's security rating.
//              Strength above security = the site is OCCUPIED until a Security retake. A Decoy Entrance
//              adds to a site's defence.
//
// Pure rules, no DOM. Time: call press.tickWeek() once per in-game week (13 a quarter).
// Hooks: a Pushback (heat, tension, clients, ledger), optional crisis system with
// addTension(trackId, n) for Gil's random track shove and Distraction.

import { mulberry32 } from './pushback.js';

// Numbers the ticket states are marked (ticket). The rest are provisional until the GDD text
// is readable from agent sessions; all of them live here.
export const PRESS = Object.freeze({
  story: {
    basePerWeek: 2, // % a week (ticket)
    perTenHeat: 1, // +1% a week per 10 heat (ticket)
    airAt: 100, // (ticket)
    onAir: { heat: 25, reputation: -15, leverage: 10 }, // (ticket)
  },
  journalists: {
    iris: {
      name: 'Iris Kemp', outlet: 'The Ledger Review', speed: 1, accurate: true, trackShove: 0,
      startHeat: 25, cooldownWeeks: 4, // starts digging once heat reaches 25, rests 4 weeks after a story
      trustMax: 5, trustGrowthCut: 0.1, // each trust point slows her stories 10%
      trustSoftens: 2, // and takes 2 off the reputation hit when her story runs
      blurb: 'Slow, careful, always right. Earn her trust and she tells your side too.',
    },
    gil: {
      name: 'Gil Marsh', outlet: 'DoomWatch Live', speed: 2.5, accurate: false, trackShove: 5, // trackShove: ticket
      startHeat: 10, cooldownWeeks: 2,
      blurb: 'Fast and loose. His scoops are half wrong, and they still scare the world.',
    },
  },
  counters: {
    bury: { label: 'Bury', cost: 120_000, story: -25, repeatMarkup: 0.5, blurb: 'Lawyers and ad money. Story -25%. Each repeat on the same story costs 50% more.' },
    discredit: {
      label: 'Discredit', cost: 80_000,
      sloppy: { story: -60 }, // works on Gil: his facts are shaky
      accurate: { story: -10, heat: 10, trust: -2 }, // backfires on Iris: she has the receipts
      blurb: 'Smear the reporter. Crushes a sloppy story; backfires on an accurate one.',
    },
    distraction: { label: 'Distraction', cost: 50_000, story: -20, trackShove: 8, blurb: 'Give the news a bigger fire. Story -20%, a random threat track +8.' },
    kompromat: {
      label: 'Kompromat', cost: 400_000, intelCost: 1, quietWeeks: 8, leakChance: 0.25, leak: { heat: 15, reputation: -10 },
      blurb: 'Their own secrets. Kills the story and silences them for 8 weeks. Spends 1 intel if you have it, else $400K. 25% chance it leaks.',
    },
    interview: {
      label: 'The Interview', cost: 0, perWeek: 1, badHeat: 70,
      good: { story: -15, trust: 1, reputation: 3 }, // Iris, heat under 70
      bad: { story: 15 }, // Iris when you're too hot, or any sit-down with Gil
      blurb: 'Sit down on the record. With Iris and a cool head: trust +1, story -15%. Too hot, or with Gil: it feeds the story.',
    },
  },
  reputation: { start: 40, min: 0, max: 100 },
  inspector: { cost: 200_000, passSecurity: 3, maxVisible: 2, pass: { reputation: 6 }, onceEveryWeeks: 13 },
  pitchforks: {
    openAtTension: 60, // The Pitchforks opens when world tension first reaches 60 (or openPitchforks())
    tensionPerPoint: 20, // strength = tension / 20 + visible features (ticket)
    siegeChancePerTension: 0.01, // weekly chance a siege happens = tension%
    occupied: { reputation: -5, leverage: 10, weeklyReputation: -1 },
    repelled: { reputation: 1 },
    retake: { cost: 300_000, heat: 5 },
    decoy: { cost: 150_000, defence: 2 },
  },
});

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** Weekly story growth in % (ticket formula), before the journalist's speed and trust. */
export function storyGrowth(heat) {
  const S = PRESS.story;
  return S.basePerWeek + S.perTenHeat * Math.floor(Math.max(0, heat) / 10);
}

/** Weekly growth for one journalist: speed x formula, Iris slowed by trust. */
export function journalistGrowth(heat, id, trust = 0) {
  const j = PRESS.journalists[id];
  const trustCut = j.trustGrowthCut ? 1 - j.trustGrowthCut * trust : 1;
  return Math.round(storyGrowth(heat) * j.speed * trustCut * 100) / 100;
}

/** Siege strength (ticket formula): tension / 20 + visible surface features. */
export function siegeStrength(tension, visibleFeatures) {
  return Math.round((Math.max(0, tension) / PRESS.pitchforks.tensionPerPoint + Math.max(0, visibleFeatures)) * 100) / 100;
}

/** Site defence: its security rating plus any Decoy Entrance. */
export function siteDefence(site) {
  return (site.security ?? 0) + (site.decoy ? PRESS.pitchforks.decoy.defence : 0);
}

export function reputationZone(r) {
  if (r < 20) return { id: 'pariah', word: 'PARIAH' };
  if (r < 40) return { id: 'shady', word: 'SHADY' };
  if (r < 70) return { id: 'respectable', word: 'RESPECTABLE' };
  return { id: 'trusted', word: 'TRUSTED' };
}

const ANGLES = {
  iris: [
    'Who funded the doom podcast?',
    'The shell companies behind the riots',
    'Inside the bunker safety reports',
    'Follow the shelter money',
  ],
  gil: [
    'BILLIONAIRE BUNKERS: LIZARD PEOPLE?',
    'SHELTER CEO STARTED THE PANDEMIC?!',
    'THEY KNOW SOMETHING WE DON\'T',
    'THE END IS NEAR AND SOMEONE IS CASHING IN',
  ],
};

export class Press {
  constructor({ pushback, crisis = null, seed = 7, sites = [] } = {}) {
    this.pb = pushback;
    this.crisis = crisis; // optional: { addTension(trackId, n) } + tracks
    this.rng = mulberry32(seed);
    this.week = 0;
    this.reputation = PRESS.reputation.start;
    this.journalists = {};
    for (const [id, j] of Object.entries(PRESS.journalists)) {
      this.journalists[id] = { id, name: j.name, trust: 0, story: null, restWeeks: 0, aired: 0 };
    }
    this.pitchforksOpen = false;
    this.sites = sites.map((s) => this._site(s)); // { id, name, security, visible, decoy, occupied, clientId, inspectedWeek }
    this.intel = 0; // fed by intel schemes when they exist; Kompromat spends it
    this.log = [];
    this._listeners = new Map();
    this._ids = 0;
    this._interviewWeek = -1;
  }

  // ---------- events ----------
  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
    return () => this._listeners.get(type).delete(fn);
  }
  _emit(type, payload) { for (const fn of this._listeners.get(type) ?? []) fn(payload, this); }
  _note(kind, text, extra = {}) {
    const e = { week: this.week, kind, text, ...extra };
    this.log.push(e);
    this._emit('note', e);
    return e;
  }
  _changed() { this._emit('change', this.snapshot()); }

  _pay(label, amount) {
    if (!amount) return;
    if (this.pb?._pay) this.pb._pay('fines', label, amount);
  }

  addReputation(n, why = '') {
    const before = this.reputation;
    this.reputation = clamp(this.reputation + n, PRESS.reputation.min, PRESS.reputation.max);
    if (why && this.reputation !== before) this._note('reputation', `${why}: reputation ${n > 0 ? '+' : ''}${n}`);
    return this.reputation - before;
  }

  /**
   * A tip-off (#55: a slip at an event): the journalist starts a story with this angle if they have none
   * (even while resting), and the story grows by `progress` %. It can run at once if it reaches 100.
   */
  tipOff(id, progress, angle = 'A source says Last Resort is feeding the panic it sells') {
    const j = this.journalists[id];
    if (!j || !(progress > 0)) return null;
    if (!j.story) {
      j.story = { id: ++this._ids, angle, progress: 0, buries: 0 };
      j.restWeeks = 0;
      this._emit('storyStarted', { journalist: id, story: j.story });
    }
    j.story.progress = Math.min(100, j.story.progress + progress);
    this._note('story', `Tip-off to ${PRESS.journalists[id].name}: story +${progress}% ("${j.story.angle}")`, { journalist: id });
    const aired = j.story.progress >= PRESS.story.airAt ? this._air(id) : null;
    this._changed();
    return { journalist: id, progress: aired ? 100 : j.story.progress, aired };
  }

  _shoveRandomTrack(n, why) {
    const tracks = this.crisis?.tracks ? Object.keys(this.crisis.tracks) : null;
    if (tracks?.length && this.crisis.addTension) {
      const id = tracks[Math.floor(this.rng() * tracks.length)];
      this.crisis.addTension(id, n);
      this._note('track', `${why}: ${id} +${n}`);
      return id;
    }
    // No crisis system attached: the shove lands on world tension.
    this.pb?.addTension?.(n, why);
    this._note('track', `${why}: world tension +${n}`);
    return 'world';
  }

  // ---------- sites ----------
  _site(s) {
    return { id: s.id ?? `site${++this._ids}`, name: s.name ?? 'Shelter site', security: s.security ?? 2, visible: s.visible ?? 0, decoy: !!s.decoy, occupied: false, clientId: s.clientId ?? null, inspectedWeek: null };
  }
  /** Register a built shelter site. `security` 0-5 and `visible` (surface features) come from shelter/life.js simulate(). */
  addSite(s) {
    const site = this._site(s);
    this.sites.push(site);
    this._changed();
    return site;
  }
  updateSite(id, patch) {
    const s = this.sites.find((x) => x.id === id);
    if (s) Object.assign(s, patch);
    this._changed();
    return s;
  }

  // ---------- weekly tick ----------
  tickWeek() {
    this.week += 1;
    const heat = this.pb?.heat ?? 0;
    const out = { aired: [], started: [], siege: null };
    for (const [id, j] of Object.entries(this.journalists)) {
      const cfg = PRESS.journalists[id];
      if (j.restWeeks > 0) { j.restWeeks -= 1; continue; }
      if (!j.story) {
        if (heat >= cfg.startHeat) {
          const list = ANGLES[id];
          j.story = { id: ++this._ids, angle: list[Math.floor(this.rng() * list.length)], progress: 0, buries: 0 };
          out.started.push({ journalist: id, story: j.story });
          this._note('story', `${cfg.name} starts digging: "${j.story.angle}"`, { journalist: id });
          this._emit('storyStarted', { journalist: id, story: j.story });
        }
        continue;
      }
      j.story.progress = Math.min(100, j.story.progress + journalistGrowth(heat, id, j.trust));
      if (j.story.progress >= PRESS.story.airAt) out.aired.push(this._air(id));
    }
    if (!this.pitchforksOpen && (this.pb?.tension ?? 0) >= PRESS.pitchforks.openAtTension) this.openPitchforks();
    if (this.pitchforksOpen) out.siege = this._weeklySiege();
    for (const s of this.sites) if (s.occupied) this.addReputation(PRESS.pitchforks.occupied.weeklyReputation);
    this._changed();
    return out;
  }

  /** The story runs: heat +25, reputation -15, every client +10 leverage (ticket). */
  _air(id) {
    const j = this.journalists[id];
    const cfg = PRESS.journalists[id];
    const A = PRESS.story.onAir;
    const story = j.story;
    const fired = [];
    this.pb?.addHeat?.(A.heat, `${cfg.name}'s story`, fired);
    const repHit = A.reputation + (cfg.trustSoftens ? cfg.trustSoftens * j.trust : 0);
    this.addReputation(Math.min(0, repHit), `${cfg.name}'s story runs`);
    for (const c of this.pb?.clients ?? []) c.leverage += A.leverage;
    let track = null;
    if (cfg.trackShove) track = this._shoveRandomTrack(cfg.trackShove, `${cfg.name}'s scare story`);
    j.story = null;
    j.aired += 1;
    j.restWeeks = cfg.cooldownWeeks;
    const evt = {
      journalist: id, name: cfg.name, outlet: cfg.outlet, angle: story.angle,
      heat: A.heat, reputation: Math.min(0, repHit), leverage: A.leverage, track, fired,
    };
    this._note('aired', `STORY RUNS: ${cfg.outlet}, "${story.angle}"`, { journalist: id });
    this._emit('aired', evt);
    this.pb?._changed?.();
    return evt;
  }

  // ---------- counters ----------
  counterCost(id, kind) {
    const C = PRESS.counters[kind];
    if (kind === 'bury') return Math.round(C.cost * (1 + C.repeatMarkup) ** (this.journalists[id].story?.buries ?? 0));
    if (kind === 'kompromat') return this.intel >= C.intelCost ? 0 : C.cost;
    return C.cost;
  }

  /** Can the counter be used right now? Returns null if yes, else the reason. */
  counterBlocked(id, kind) {
    const j = this.journalists[id];
    if (!j?.story) return 'No story in progress';
    if (kind === 'interview' && this._interviewWeek === this.week) return 'One interview a week';
    return null;
  }

  counter(id, kind) {
    const blocked = this.counterBlocked(id, kind);
    if (blocked) return { ok: false, reason: blocked };
    const j = this.journalists[id];
    const cfg = PRESS.journalists[id];
    const C = PRESS.counters[kind];
    const cost = this.counterCost(id, kind);
    const before = j.story.progress;
    const res = { ok: true, journalist: id, kind, cost, notes: [] };
    const fired = [];
    const story = (d) => { j.story.progress = clamp(j.story.progress + d); };

    switch (kind) {
      case 'bury':
        story(C.story);
        j.story.buries += 1;
        break;
      case 'discredit': {
        const eff = cfg.accurate ? C.accurate : C.sloppy;
        story(eff.story);
        if (eff.heat) this.pb?.addHeat?.(eff.heat, `Smearing ${cfg.name}`, fired);
        if (eff.trust) j.trust = clamp(j.trust + eff.trust, 0, cfg.trustMax ?? 0);
        res.notes.push(cfg.accurate ? `${cfg.name} has the receipts. It backfires.` : `${cfg.name}'s scoop falls apart.`);
        break;
      }
      case 'distraction':
        story(C.story);
        res.track = this._shoveRandomTrack(C.trackShove, 'Distraction');
        break;
      case 'kompromat': {
        if (this.intel >= C.intelCost) { this.intel -= C.intelCost; res.usedIntel = true; }
        j.story = null;
        j.restWeeks = C.quietWeeks;
        if (this.rng() < C.leakChance) {
          this.pb?.addHeat?.(C.leak.heat, 'Kompromat leaked', fired);
          this.addReputation(C.leak.reputation, 'Kompromat leaked');
          res.leaked = true;
          res.notes.push('Word got out that you blackmailed a reporter.');
        }
        break;
      }
      case 'interview': {
        this._interviewWeek = this.week;
        const heat = this.pb?.heat ?? 0;
        const good = cfg.trustMax && heat < C.badHeat;
        if (good) {
          story(C.good.story);
          j.trust = clamp(j.trust + C.good.trust, 0, cfg.trustMax);
          this.addReputation(C.good.reputation, `Interview with ${cfg.name}`);
          res.notes.push(`${cfg.name} trusts you a little more (${j.trust}/${cfg.trustMax}).`);
        } else {
          story(C.bad.story);
          res.notes.push(cfg.trustMax ? 'You were too hot to sit down. She smelled it.' : 'Gil spun every word into a headline.');
        }
        res.good = good;
        break;
      }
      default:
        return { ok: false, reason: 'Unknown counter' };
    }
    if (cost) this._pay(`${C.label}: ${cfg.name}`, -cost);
    res.storyBefore = before;
    res.storyAfter = j.story ? j.story.progress : 0;
    res.fired = fired;
    if (j.story && j.story.progress >= PRESS.story.airAt) res.aired = this._air(id);
    this._note('counter', `${C.label} on ${cfg.name}: story ${Math.round(before)}% -> ${Math.round(res.storyAfter)}%`, { journalist: id, kind });
    this._changed();
    this.pb?._changed?.();
    return res;
  }

  // ---------- inspector ----------
  /** Hire the Inspector for one walkthrough of a site ($0.2M). */
  inspect(siteId) {
    const I = PRESS.inspector;
    const site = this.sites.find((s) => s.id === siteId);
    if (!site) return { ok: false, reason: 'No such site' };
    if (site.inspectedWeek != null && this.week - site.inspectedWeek < I.onceEveryWeeks) return { ok: false, reason: 'Inspected this quarter already' };
    this._pay(`Inspector walkthrough: ${site.name}`, -I.cost);
    site.inspectedWeek = this.week;
    const fixes = [];
    if (site.security < I.passSecurity) fixes.push(`Security ${site.security}/5: needs ${I.passSecurity}`);
    if (site.visible > I.maxVisible) fixes.push(`${site.visible} visible surface features: keep it to ${I.maxVisible}`);
    if (site.occupied) fixes.push('Site is occupied by protesters');
    const pass = !fixes.length;
    if (pass) this.addReputation(I.pass.reputation, `Inspector certifies ${site.name}`);
    const tension = this.pb?.tension ?? 0;
    const report = {
      ok: true, site: site.id, name: site.name, pass, fixes, cost: I.cost,
      siegeStrength: siegeStrength(tension, site.visible), defence: siteDefence(site),
    };
    this._note('inspector', `Inspector walkthrough at ${site.name}: ${pass ? 'CERTIFIED' : `${fixes.length} fix${fixes.length > 1 ? 'es' : ''}`}`);
    this._emit('inspected', report);
    this._changed();
    return report;
  }

  // ---------- sieges ----------
  openPitchforks() {
    if (this.pitchforksOpen) return;
    this.pitchforksOpen = true;
    this._note('pitchforks', 'THE PITCHFORKS: mobs now march on visible shelters every week.');
    this._emit('pitchforks', {});
  }

  /** Pick the week's target (most visible free site) and maybe besiege it. */
  _weeklySiege() {
    const tension = this.pb?.tension ?? 0;
    const free = this.sites.filter((s) => !s.occupied);
    if (!free.length) return null;
    if (this.rng() >= tension * PRESS.pitchforks.siegeChancePerTension) return null;
    const maxVis = Math.max(...free.map((s) => s.visible));
    const pool = free.filter((s) => s.visible === maxVis);
    const site = pool[Math.floor(this.rng() * pool.length)];
    return this.siege(site.id);
  }

  /** Resolve a siege on a site now (also callable by events). */
  siege(siteId) {
    const P = PRESS.pitchforks;
    const site = this.sites.find((s) => s.id === siteId);
    if (!site || site.occupied) return null;
    const tension = this.pb?.tension ?? 0;
    const strength = siegeStrength(tension, site.visible);
    const defence = siteDefence(site);
    const occupied = strength > defence;
    const res = { site: site.id, name: site.name, strength, defence, occupied, week: this.week };
    if (occupied) {
      site.occupied = true;
      this.addReputation(P.occupied.reputation, `${site.name} occupied`);
      const client = this.pb?.clients?.find((c) => c.id === site.clientId);
      if (client) client.leverage += P.occupied.leverage;
      this._note('siege', `SIEGE: ${site.name} OCCUPIED (strength ${strength} vs security ${defence})`, { site: site.id });
    } else {
      this.addReputation(P.repelled.reputation, `${site.name} held`);
      this._note('siege', `Siege repelled at ${site.name} (strength ${strength} vs security ${defence})`, { site: site.id });
    }
    this._emit('siege', res);
    this._changed();
    return res;
  }

  /** Security retake: pay to clear an occupied site. */
  retake(siteId) {
    const R = PRESS.pitchforks.retake;
    const site = this.sites.find((s) => s.id === siteId);
    if (!site?.occupied) return { ok: false, reason: 'Site is not occupied' };
    this._pay(`Security retake: ${site.name}`, -R.cost);
    site.occupied = false;
    const fired = [];
    this.pb?.addHeat?.(R.heat, `Security retake at ${site.name}`, fired);
    this._note('retake', `Security retook ${site.name}`);
    this._changed();
    this.pb?._changed?.();
    return { ok: true, cost: R.cost, heat: R.heat, fired };
  }

  /** Decoy Entrance: a one-time upgrade that adds to a site's defence. */
  buildDecoy(siteId) {
    const D = PRESS.pitchforks.decoy;
    const site = this.sites.find((s) => s.id === siteId);
    if (!site || site.decoy) return { ok: false, reason: site ? 'Already has a decoy' : 'No such site' };
    if (this.pb?.ledger) this.pb.ledger.record('builds', `Decoy entrance: ${site.name}`, -D.cost);
    site.decoy = true;
    this._note('decoy', `Decoy entrance built at ${site.name} (defence +${D.defence})`);
    this._changed();
    return { ok: true, cost: D.cost };
  }

  // ---------- read-out / save ----------
  snapshot() {
    const heat = this.pb?.heat ?? 0;
    const tension = this.pb?.tension ?? 0;
    return {
      week: this.week,
      reputation: this.reputation,
      reputationZone: reputationZone(this.reputation),
      intel: this.intel,
      pitchforksOpen: this.pitchforksOpen,
      journalists: Object.values(this.journalists).map((j) => {
        const cfg = PRESS.journalists[j.id];
        const growth = journalistGrowth(heat, j.id, j.trust);
        return {
          id: j.id, name: cfg.name, outlet: cfg.outlet, blurb: cfg.blurb, trust: j.trust, trustMax: cfg.trustMax ?? null,
          story: j.story ? { ...j.story } : null, restWeeks: j.restWeeks, aired: j.aired,
          growthPerWeek: growth,
          weeksToAir: j.story ? Math.ceil((PRESS.story.airAt - j.story.progress) / Math.max(0.01, growth)) : null,
        };
      }),
      sites: this.sites.map((s) => ({ ...s, strength: siegeStrength(tension, s.visible), defence: siteDefence(s) })),
    };
  }

  toJSON() {
    return {
      v: 1, week: this.week, reputation: this.reputation, intel: this.intel, pitchforksOpen: this.pitchforksOpen,
      journalists: JSON.parse(JSON.stringify(this.journalists)), sites: this.sites.map((s) => ({ ...s })),
      ids: this._ids, interviewWeek: this._interviewWeek,
    };
  }

  static fromJSON(d, { pushback, crisis = null, seed = 7 } = {}) {
    const p = new Press({ pushback, crisis, seed });
    Object.assign(p, {
      week: d.week, reputation: d.reputation, intel: d.intel, pitchforksOpen: d.pitchforksOpen,
      journalists: JSON.parse(JSON.stringify(d.journalists)), sites: d.sites.map((s) => ({ ...s })),
      _ids: d.ids, _interviewWeek: d.interviewWeek,
    });
    return p;
  }
}
