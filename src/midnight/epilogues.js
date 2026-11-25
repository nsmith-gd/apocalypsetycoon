// Epilogue cards and The Ledger (#32; GDD Midnight and endings > Epilogue cards, The Ledger). Pure rules, no DOM.
//
// One line per client, from who they are (a hero client's own story, or a generated client's type) and what
// happened to their shelter under seal (survived / rationing / lost, the weakest supply, a late or lost pickup).
// Gerald's wine is always the last line: his own card goes last, and if he never bought, a closing card says so.
//
//   epilogues({ result, sold, endingId })  -> [{ client, line, outcome, hero }]
//   buildLedger({ result, endingId, ledger, tree, pushback, crisis, doom, company }) -> the final screen's numbers

import { HERO_CLIENTS } from '../world/tracks.js';
import { endingCard, DEFAULT_CLOSING } from './endings.js';

const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
const seedOf = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

// Hero clients: the GDD's samples (survived), plus how the same person fares when it goes worse.
const HERO_LINES = {
  gerald: { survived: 'Survived. The wine ran out in month four, and he is still talking about it.', rationing: 'Survived, thinner. The wine ran out in month two; he rationed the water instead of the Bordeaux, and will never forgive himself.', lost: 'Did not survive. He was found in the cellar, holding the last bottle, unopened. He was saving it for a special occasion.' },
  ashcombe: { survived: 'Survived with all three generations. Has not spoken to the Whitlocks upstairs in 700 days.', rationing: 'Two of three generations made it. The family is now arguing about which one counts.', lost: 'The Ashcombe line ends in a beautifully appointed drawing room. The portraits held up better than the people.' },
  skyler: { survived: 'Revived from cryo on schedule by an AI that has opinions now.', rationing: 'Revived from cryo a year late by an AI that wanted to finish its novel first.', lost: 'The cryo pod kept him perfectly. The power did not. The AI writes him letters.' },
  calloway: { survived: 'His private army took the override codes in week six. He is now a guest in his own bunker.', rationing: 'His private army rationed him first. He calls it a leadership lesson.', lost: 'His private army survived. He did not. They have renamed the bunker after him, which is something.' },
  lexi: { survived: 'Livestreamed the apocalypse to 11 followers.', rationing: 'Livestreamed the rationing to 4 followers. One of them was her mother, asking her to eat something.', lost: 'Her last stream is still pinned. 3 views.' },
  fairweathers: { survived: 'All three dogs made it. So did the Fairweathers, mostly thanks to the dogs.', rationing: 'All three dogs made it. The Fairweathers gave them the last of the food, and regret nothing.', lost: 'The dogs were found sitting by the door, waiting. Someone outside adopted all three.' },
  drummonds: { survived: 'Divided the shelter down the middle with tape. Both halves survived, out of spite.', rationing: 'Divided the shelter down the middle with tape. Both halves failed separately.', lost: 'Divided the shelter down the middle with tape. Neither half would share the scrubber.' },
  lamarr: { survived: 'Never paid the retainer. Survived anyway.', rationing: 'Never paid the retainer. Survived, mostly, and is suing you for the other part.', lost: 'Never paid the retainer. Her estate still owes you $4M and a thank-you note.' },
  marla: { survived: 'Prepared for every apocalypse at once, and was disappointed it was only one.', rationing: 'Had a contingency for everything except the people she shared the bunker with.', lost: 'Her binder of contingencies was found open at the right page. Nobody read it to her in time.' },
  ravi: { survived: 'Pivoted his shelter into a startup. Valuation: four cans of beans.', rationing: 'Disrupted the rationing schedule. The schedule disrupted him back.', lost: 'Moved fast and broke the air seal.' },
  juno: { survived: 'Grew tomatoes under the grow lights and named every one. The tomatoes did not survive the naming.', rationing: 'Kept the hydroponics alive and herself just about.', lost: 'The garden outlived her. It is, by all accounts, thriving.' },
  strelitz: { survived: 'Held a ball every Saturday for 12 people. Formal dress, rationed caviar, no exceptions.', rationing: 'Cancelled the ball in year two. It was, he says, the true apocalypse.', lost: 'The ballroom lights stayed on long after the music stopped.' },
  whitlocks: { survived: 'Survived. Have not spoken to Lady Ashcombe downstairs in 700 days, and consider it a victory.', rationing: 'Survived on half rations and a whole grudge against the Ashcombes.', lost: 'The Whitlocks went quietly. Lady Ashcombe insists she heard nothing.' },
  sorrentino: { survived: 'Ran the shelter like a board meeting. Quarterly results: everyone alive.', rationing: 'Ran the shelter like a board meeting. Layoffs began in month nine.', lost: 'Her final memo, unread, recommends more air.' },
  admiral: { survived: 'Secured the armoury in day one and saluted it every morning. Nobody else was allowed near the soup.', rationing: 'Commanded the ration line with great discipline and very little food.', lost: 'Went down with the shelter, as a captain should, though it was very much not a ship.' },
  philanthropist: { survived: 'Donated the spare bunks to the staff left outside. It made the news, of which there is none.', rationing: 'Gave away half the food to the staff. Survived on the goodwill, briefly.', lost: 'Left everything to charity. The charities are, sadly, outside.' },
};
const HERO_BY_NAME = Object.fromEntries(HERO_CLIENTS.map((h) => [h.name.toLowerCase(), h.id]));

// Generated clients: by their type, then by what failed.
const TYPE_WORD = { tech_founder: 'tech founder', celebrity: 'celebrity', oil_heir: 'oil heir', politician: 'politician', prepper: 'prepper' };
const GEN = {
  survived: {
    tech_founder: ['Wrote a 40,000-word thread about surviving the end of the world. The bunker has no internet.', 'Survived, and has started calling the apocalypse "a learning experience".'],
    celebrity: ['Survived, and released a memoir to an audience of six.', 'Survived. Practised the comeback interview every day for two years.'],
    oil_heir: ['Survived in comfort, and complains about the comfort.', 'Survived. The gold taps still work; nobody is quite sure why.'],
    politician: ['Survived, and has already announced a run for mayor of the bunker.', 'Survived, and denies everything.'],
    prepper: ['Survived, smug, exactly as planned.', 'Survived, and spent two years saying "I told you so" to a wall.'],
  },
  rationing: { air: 'The air got thin in year two. Some of the household made it.', water: 'The water ran short. Not everyone took turns.', food: 'The food ran out before the apocalypse did. Some of them made it to the end.' },
  lost: { air: 'The scrubbers failed under seal. The gold taps were still shining when they opened the door.', water: 'The tanks ran dry. The wine cellar, untouched, outlasted them.', food: 'The pantry emptied in the first winter. The cinema kept playing.' },
  late: 'Arrived late to the Seal Order. Spent the apocalypse in the airlock, a little colder than the rest.',
  pickupLost: 'Never made it to the Seal Order. The shelter waited for them, fully stocked, for years.',
};

function lineFor(client, g) {
  const heroId = HERO_BY_NAME[String(client.owner ?? client.name ?? '').toLowerCase()];
  const outcome = g?.outcome ?? 'survived';
  if (heroId && HERO_LINES[heroId]) return { line: HERO_LINES[heroId][outcome] ?? HERO_LINES[heroId].survived, hero: heroId };
  const s = seedOf(client.owner ?? client.id);
  if (g?.pickup === 'lost') return { line: GEN.pickupLost };
  if (g?.pickup === 'late' && outcome === 'survived') return { line: GEN.late };
  if (outcome === 'survived') { const who = TYPE_WORD[client.clientType] ? client.clientType : 'prepper'; return { line: pick(GEN.survived[who], s) }; }
  const weakest = g?.weakest ?? 'air';
  const base = outcome === 'lost' ? GEN.lost[weakest] : GEN.rationing[weakest];
  return { line: base };
}

/** One card per client sold a shelter, Gerald's wine last. */
export function epilogues({ result = null, sold = [], endingId = null } = {}) {
  const graded = new Map((result?.shelters ?? []).map((g) => [g.id, g]));
  const cards = sold.map((c) => {
    const g = graded.get(c.id) ?? null;
    const { line, hero = null } = endingId === 'last_resort' ? { line: `${pick(['Opened the door to find the public already inside. Is furious.', 'Shares the bunker with 400 strangers and a petition to keep the gold taps.'], seedOf(c.owner))}` } : lineFor(c, g);
    return { client: c.owner ?? c.name ?? 'A client', type: TYPE_WORD[c.clientType] ?? null, outcome: g?.outcome ?? 'survived', line, hero };
  });
  const gi = cards.findIndex((c) => c.hero === 'gerald');
  if (gi >= 0) cards.push(cards.splice(gi, 1)[0]);
  else cards.push({ client: 'Gerald Pemberton-Wick', type: null, outcome: 'elsewhere', hero: 'gerald', line: 'Was never your client. Somewhere, his wine ran out in month four, and he is still talking about it.' });
  return cards;
}

// The world's population at Midnight, by how bad each apocalypse is (share of humanity lost). GDD default line:
// "Humanity: down 99.7%".
const WORLD_POPULATION = 8_100_000_000;
const LOSS = { atomic: 0.997, bloom: 0.99, superstorm: 0.95, optimizer: 0.9, hush: 0.98, pitchforks: 0.8, goo: 0.999, long_shade: 0.97, kessler: 0.85, cloud: 0.96 };
const NO_APOCALYPSE = new Set(['ousted', 'indicted', 'regrettably_stable', 'clouds_won', 'overtime', 'last_resort']);

/**
 * The final screen: clients saved, staff saved and left outside, revenue, RP, scars, final heat, the world's
 * remaining population and the closing line. Staff is a STAND-IN until the staff model exists: 4 operating
 * staff per crew, and they get bunks in the same share as the clients survived.
 */
export function buildLedger({ result = null, endingId = 'lights_out', ledger = null, tree = null, pushback = null, crisis = null, doom = null, company = null, quartersSurvived = 0 } = {}) {
  const card = endingCard(endingId, { result, quartersSurvived });
  const clients = result?.totals?.occupants ?? 0;
  const saved = endingId === 'last_resort' ? 41_000 : result?.totals?.survivors ?? 0;
  const staff = Math.max(0, (company?.crewCap ?? 2) * 4);
  const share = clients ? saved / clients : 0;
  const staffSaved = NO_APOCALYPSE.has(endingId) ? staff : Math.round(staff * Math.min(1, share) * 0.5); // staff are seated last
  const revenue = (ledger?.entries ?? []).filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const tracks = Object.values(crisis?.tracks ?? {});
  const scars = [
    ...(doom?.collapses ?? []).map((c) => `${String(c.track).toUpperCase()} COLLAPSED`),
    ...tracks.filter((t) => (t.breaches ?? 0) > 0).map((t) => `${(t.name ?? t.id).toUpperCase()}: ${t.breaches} BREACH${t.breaches > 1 ? 'ES' : ''}`),
  ];
  const apo = result?.apocalypse;
  const loss = NO_APOCALYPSE.has(endingId) ? 0 : LOSS[apo?.id] ?? 0.997;
  return {
    ending: card,
    clientsSaved: saved, clientsTotal: clients,
    staffSaved, staffOutside: staff - staffSaved, staffStandIn: true,
    revenue, rp: Math.round(tree?.totalEarned ?? 0),
    scars,
    heat: Math.round(pushback?.heat ?? result?.world?.heat ?? 0),
    population: Math.round(WORLD_POPULATION * (1 - loss)),
    humanityDown: loss,
    closing: card.closing === DEFAULT_CLOSING && loss ? `Humanity: down ${Math.round(loss * 1000) / 10}%. Shareholder value: record high.` : card.closing,
  };
}
