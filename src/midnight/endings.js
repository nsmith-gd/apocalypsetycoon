// The twelve endings (#32; GDD Midnight and endings > Endings). Pure rules, no DOM.
//
// Two endings come from how Midnight arrives (Lights Out, Off the Rails). Overtime is a choice at the end of Q12.
// The other nine are triggers the campaign checks every week through `EndingWatch`, which keeps the running counts
// they need (heat at 95+ for 4 weeks, 13 stable weeks in chapter 5, which track collapsed first...).
//
// Inputs that no system produces yet are STAND-INS, marked as such: department-head loyalty (Ruth, Theo), Mr. Gray's
// Favours and the Ark, clients' Cut-in board seats, sites lost to sieges, the leaked dossier and Collective
// Bargaining. They default to values that never trigger, and the debug panel (demo/endings-demo.html, or
// `session.endings.force(id)` in a campaign) sets them, so every card can be checked now and the real systems only
// have to call `watch.note(...)` later.
//
//   const watch = new EndingWatch();
//   each in-game week: const id = watch.week(snapshot)   // an ending id when a mid-campaign trigger fires
//   at Midnight:       watch.atMidnight({ road })        // 'lights_out' | 'off_the_rails' | 'seat_at_table' | ...
//   endingCard(id, { result, quartersSurvived })         // title, what happens, grade, closing line

export const ENDINGS = Object.freeze({
  lights_out: { title: 'LIGHTS OUT', trigger: 'Engineered Midnight', happens: 'You sold the end of the world on schedule, and it is graded.', grade: 'grade' },
  off_the_rails: { title: 'OFF THE RAILS', trigger: 'Uncontrolled Midnight', happens: 'The apocalypse you didn’t plan, graded one step down.', grade: 'grade-1' },
  ousted: { title: 'OUSTED', trigger: 'Board confidence reaches 0', happens: 'Bryce’s protégé replaces you. Within a year, he triggers Midnight himself, badly.', grade: 'none' },
  indicted: { title: 'INDICTED', trigger: 'Heat stays at 95 or more for 4 weeks', happens: 'A perp walk on every channel. Your shelters become evidence lockers.', grade: 'none', closing: 'Assets: frozen. Shelters: exhibits A through Z.' },
  last_resort: { title: 'THE LAST RESORT', secret: true, trigger: 'Iris Kemp trust 3+, Ruth Abernathy loyalty 70+, and you leak the full dossier while a track is at the Brink', happens: 'The company falls, the Doom Clock rolls back 5 minutes, and every shelter you built opens to the public. The clients are furious.', grade: 'none', closing: 'Company value: $0. People sheltered: 41,000.' },
  overtime: { title: 'OVERTIME', trigger: 'Quarter 12 ends without Midnight', happens: 'Endless quarters, the quota up 30% each, until Midnight or the board finally loses patience. Scored by quarters survived.', grade: 'quarters', closing: 'Quota: still rising. Midnight: still coming.' },
  regrettably_stable: { title: 'REGRETTABLY STABLE', trigger: 'In chapter 5, every open track stays below 20 for 13 straight weeks while you still hit the quota', happens: 'The board calls it a failure of imagination. You become a mid-sized firm that maintains very nice basements, and Iris Kemp’s next story is about potholes.', grade: 'none', closing: 'Humanity: intact. Shareholder value: disappointing.' },
  under_new_management: { title: 'UNDER NEW MANAGEMENT', trigger: 'The Pitchforks is the first track to collapse, and sieges take half your sites', happens: 'The public moves into the shelters you built while your clients queue outside. Gerald runs the soup kitchen and is, for the first time, beloved.', grade: 'grade', closing: 'Clients: outside. Public: inside. Gerald: beloved.' },
  seat_at_table: { title: 'A SEAT AT THE TABLE', trigger: 'The Ark is finished, you hold 3 Favours with Mr. Gray, and you accept his offer at Midnight', happens: 'You abandon the company for a berth in the Ark. It is in the staff quarters: The Table needed someone who knows how the scrubbers work.', grade: 'ark' },
  locked_out: { title: 'LOCKED OUT', trigger: 'Three or more clients reach Cut-in and you accept their board seats', happens: 'Your clients take over the board, engineer Midnight on a date of their choosing, and leave you off the door codes.', grade: 'grade' },
  somebody_else: { title: 'SOMEBODY ELSE’S APOCALYPSE', trigger: 'In chapter 5, Theo Lisk’s loyalty falls below 30 before you set a Midnight date', happens: 'Theo breaches a track you weren’t watching. There is no Last Call, and your shelters are graded as they stand, two grades down.', grade: 'grade-2' },
  clouds_won: { title: 'THE CLOUDS WON', trigger: 'Cloud Strike worlds only: contain The Cloud Strike three times with Collective Bargaining', happens: 'The clouds’ union expands to every kind of weather, and the Doom Clock freezes while the sky negotiates. You sign the first labour agreement with the atmosphere. Rain resumes on Tuesdays.', grade: 'none', closing: 'Weather: unionised. Apocalypse: postponed indefinitely.' },
});
export const ENDING_IDS = Object.freeze(Object.keys(ENDINGS));
export const DEFAULT_CLOSING = 'Humanity: down 99.7%. Shareholder value: record high.';

export const ENDING_RULES = Object.freeze({
  indictedHeat: 95, indictedWeeks: 4,
  stableBelow: 20, stableWeeks: 13, stableChapter: 5,
  lastResortTrust: 3, lastResortLoyalty: 70,
  theoBelow: 30, theoChapter: 5,
  cutInSeats: 3, grayFavours: 3, cloudContainments: 3, siegeShare: 0.5,
  doomRollbackMinutes: 5,
});

// Stand-ins for systems that don't exist yet (see the header). Values that never trigger an ending.
export const STAND_INS = Object.freeze({ ruthLoyalty: 50, theoLoyalty: 50, grayFavours: 0, arkFinished: false, cutInSeatsAccepted: 0, sitesLostToSieges: 0, dossierLeaked: false, cloudBargains: 0, grayOfferAccepted: false });

const GRADES = ['Platinum', 'Gold', 'Silver', 'Bronze', 'The Gerald'];
const down = (grade, n) => GRADES[Math.min(GRADES.length - 1, GRADES.indexOf(grade) + n)] ?? grade;

/**
 * Keeps the running counts the ending triggers need. Register it on the save slot (toJSON / load).
 * `week(s)` takes one snapshot a week:
 *   { chapter, heat, boardConfidence, boardOusted, quotaOnTrack, tracks: [{ id, tension, state, open }],
 *     collapses: [{ track }], irisTrust, roster: [trackIds], midnightDateSet }
 * and returns the id of an ending that fires now, or null.
 */
export class EndingWatch {
  constructor({ rules = ENDING_RULES } = {}) {
    this.rules = rules;
    this.heatWeeks = 0;
    this.stableWeeks = 0;
    this.firstCollapse = null;
    this.flags = { ...STAND_INS };
    this.fired = null;
  }
  /** A system (or the debug panel) reports a value: note('ruthLoyalty', 72), note('dossierLeaked', true)... */
  note(key, value) { this.flags[key] = value; return this; }

  week(s = {}) {
    if (this.fired) return null;
    const R = this.rules;
    const tracks = (s.tracks ?? []).filter((t) => t.open !== false && t.state !== 'locked');
    this.heatWeeks = (s.heat ?? 0) >= R.indictedHeat ? this.heatWeeks + 1 : 0;
    const allCalm = tracks.length > 0 && tracks.every((t) => (t.tension ?? 0) < R.stableBelow);
    this.stableWeeks = (s.chapter ?? 0) >= R.stableChapter && allCalm && s.quotaOnTrack !== false ? this.stableWeeks + 1 : 0;
    if (!this.firstCollapse && s.collapses?.length) this.firstCollapse = s.collapses[0].track;
    const id = this.check(s);
    if (id) this.fired = id;
    return id;
  }

  /** Which mid-campaign ending the current state meets (priority: the board and the law first, then the rest). */
  check(s = {}) {
    const R = this.rules, f = this.flags;
    const brink = (s.tracks ?? []).some((t) => t.state === 'brink');
    if (s.boardOusted || (s.boardConfidence != null && s.boardConfidence <= 0)) return 'ousted';
    if (this.heatWeeks >= R.indictedWeeks) return 'indicted';
    if (f.dossierLeaked && (s.irisTrust ?? 0) >= R.lastResortTrust && f.ruthLoyalty >= R.lastResortLoyalty && brink) return 'last_resort';
    if (f.cutInSeatsAccepted >= R.cutInSeats) return 'locked_out';
    if (this.firstCollapse === 'pitchforks' && f.sitesLostToSieges >= R.siegeShare) return 'under_new_management';
    if ((s.roster ?? []).includes('cloudstrike') && f.cloudBargains >= R.cloudContainments) return 'clouds_won';
    if ((s.chapter ?? 0) >= R.theoChapter && f.theoLoyalty < R.theoBelow && !s.midnightDateSet) return 'somebody_else';
    if (this.stableWeeks >= R.stableWeeks) return 'regrettably_stable';
    return null;
  }

  /** Midnight has come: which ending it is. road = 'engineered' | 'uncontrolled' (the Doom Clock or Final Countdown). */
  atMidnight({ road = 'engineered' } = {}) {
    if (this.fired) return this.fired;
    if (this.flags.arkFinished && this.flags.grayFavours >= this.rules.grayFavours && this.flags.grayOfferAccepted) return (this.fired = 'seat_at_table');
    return (this.fired = road === 'engineered' ? 'lights_out' : 'off_the_rails');
  }

  /** Debug: make an ending's trigger true, then return what check()/atMidnight() picks. */
  force(id, snapshot = {}) {
    const R = this.rules;
    const s = { chapter: 5, heat: 40, boardConfidence: 60, quotaOnTrack: true, tracks: [{ id: 'atomic', tension: 50, state: 'calm' }], collapses: [], irisTrust: 0, roster: ['atomic'], midnightDateSet: true, ...snapshot };
    this.fired = null;
    switch (id) {
      case 'ousted': s.boardConfidence = 0; break;
      case 'indicted': s.heat = 97; this.heatWeeks = R.indictedWeeks - 1; break;
      case 'last_resort': this.note('dossierLeaked', true).note('ruthLoyalty', 74); s.irisTrust = 3; s.tracks = [{ id: 'atomic', tension: 84, state: 'brink' }]; break;
      case 'locked_out': this.note('cutInSeatsAccepted', 3); break;
      case 'under_new_management': this.firstCollapse = 'pitchforks'; this.note('sitesLostToSieges', 0.5); break;
      case 'clouds_won': s.roster = ['atomic', 'cloudstrike']; this.note('cloudBargains', 3); break;
      case 'somebody_else': this.note('theoLoyalty', 24); s.midnightDateSet = false; break;
      case 'regrettably_stable': s.tracks = [{ id: 'atomic', tension: 12, state: 'calm' }]; this.stableWeeks = R.stableWeeks - 1; break;
      case 'seat_at_table': this.note('arkFinished', true).note('grayFavours', 3).note('grayOfferAccepted', true); return this.atMidnight({ road: 'engineered' });
      case 'lights_out': return this.atMidnight({ road: 'engineered' });
      case 'off_the_rails': return this.atMidnight({ road: 'uncontrolled' });
      case 'overtime': return (this.fired = 'overtime');
      default: return null;
    }
    return this.week(s);
  }

  toJSON() { return { heatWeeks: this.heatWeeks, stableWeeks: this.stableWeeks, firstCollapse: this.firstCollapse, flags: this.flags, fired: this.fired }; }
  load(d = {}) { Object.assign(this, { heatWeeks: d.heatWeeks ?? 0, stableWeeks: d.stableWeeks ?? 0, firstCollapse: d.firstCollapse ?? null, fired: d.fired ?? null }); this.flags = { ...STAND_INS, ...(d.flags ?? {}) }; }
}

/**
 * The ending card: title, what happens, the grade it carries and the closing line.
 * result = computeMidnight's result when there was a Midnight (its grade already counts an uncontrolled road).
 */
export function endingCard(id, { result = null, quartersSurvived = 0 } = {}) {
  const e = ENDINGS[id];
  if (!e) throw new Error(`unknown ending ${id}`);
  const base = result?.grade?.name ?? result?.grade ?? null;
  let grade = null;
  if (e.grade === 'grade' || e.grade === 'grade-1') grade = base; // Off the Rails: the uncontrolled road already took a step
  else if (e.grade === 'grade-2') grade = base ? down(base, result?.type === 'failed' ? 1 : 2) : null;
  else if (e.grade === 'ark') grade = base ? `${base} (the Ark alone)` : 'The Ark alone';
  else if (e.grade === 'quarters') grade = `${quartersSurvived} quarter${quartersSurvived === 1 ? '' : 's'} survived`;
  return { id, title: e.title, secret: !!e.secret, trigger: e.trigger, happens: e.happens, grade, closing: e.closing ?? DEFAULT_CLOSING };
}
