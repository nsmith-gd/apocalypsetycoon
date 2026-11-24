// STAND-IN dialogue runner + one placeholder conversation, so the social layer is playable end to end
// before the real engine (#54) and authored trees (#56) land. Replace via SocialSession's
// `dialogueFactory`; nothing else depends on this file.
//
// The session interface the view-model expects (the real engine should expose the same):
//   session.node()          -> { id, speaker: 'guest'|'you'|'narrator', text, choices: [{ id, text, effects? }] }
//   session.choose(choiceId)   advance; records the choice's effects (#55 vocabulary)
//   session.done            -> true once an ending is reached
//   session.ending          -> ending id from src/dialogue/outcomes.js ENDINGS (sold_fear, polite_exit, ...)
//   session.effects         -> effects of every choice taken, in order
//   session.transcript      -> [{ speaker, text }] lines so far (guest lines and the player's picks)
//
// Tree format used here: { start, nodes: { id: { speaker, text, choices: [{ text, effects, next | end }] } } }
// Text may use {name}, {fear} (the guest's fear, by name) and {otherFear} (one they don't have).

import { TRACKS } from '../world/tracks.js';

export const PLACEHOLDER_TREE = Object.freeze({
  id: 'placeholder_small_talk',
  start: 'open',
  nodes: {
    open: {
      speaker: 'narrator',
      text: '{name} sizes you up over a glass of champagne. "And what is it you do?"',
      choices: [
        { text: 'I build shelters. The kind you\'d want if {fear} goes the way the papers say.', effects: { fear: '$fear' }, next: 'fear' },
        { text: 'Very private, very beautiful homes. Underground. Gold taps, naturally.', effects: { trait: 'vain', promise: 'gold_taps' }, next: 'dream' },
        { text: 'Between us? I\'d be underground by spring.', effects: { aggressive: true, slip: true }, next: 'insider' },
        { text: 'Just here for the canapés.', end: 'polite_exit' },
      ],
    },
    fear: {
      speaker: 'guest',
      text: '"{fear}... I haven\'t slept properly since it started."',
      choices: [
        { text: 'Two years sealed. Air, water and food: engineered, not promised.', effects: { fear: '$fear', trust: 5, learn: 'paranoid' }, end: 'sold_fear' },
        { text: 'Sign tonight and I\'ll hold you the last slot.', effects: { aggressive: true }, end: 'hard_close' },
        { text: 'Everyone here is worried about {otherFear}, too.', effects: { fear: '$otherFear' }, next: 'doubt' },
      ],
    },
    dream: {
      speaker: 'guest',
      text: '"Underground? Does it have a wine cellar?"',
      choices: [
        { text: 'A cellar, a cinema, and a view of a sunset that no longer exists.', effects: { trait: 'vain', promise: 'wine_cellar', learn: 'vain' }, end: 'sold_dream' },
        { text: 'It has what keeps you alive. The rest is negotiable.', effects: { trust: 4 }, next: 'fear' },
      ],
    },
    insider: {
      speaker: 'guest',
      text: '"You... know something?" They lower their glass.',
      choices: [
        { text: 'I know where I\'ll be. There\'s room for one more family.', effects: { slip: true }, end: 'insider_tip' },
        { text: 'Only what\'s in the papers.', effects: { trust: -5 }, end: 'polite_exit' },
      ],
    },
    doubt: {
      speaker: 'guest',
      text: '"That\'s not what keeps me up at night." They glance toward the door.',
      choices: [
        { text: 'Then let me tell you what will. Trust me, I\'d know.', effects: { aggressive: true, slip: true }, end: 'backfire' },
        { text: 'Forgive me. Here\'s my card.', end: 'rebuffed' },
      ],
    },
  },
});

const trackName = (id) => TRACKS.find((t) => t.id === id)?.name ?? id ?? 'the end of the world';

/** Build a session over a tree for one guest. */
export function createStubDialogue(guest, { tree = PLACEHOLDER_TREE } = {}) {
  const fear = guest.fears?.[0] ?? TRACKS[0].id;
  const otherFear = TRACKS.find((t) => !(guest.fears ?? []).includes(t.id))?.id ?? fear;
  const vars = { name: guest.name, fear: trackName(fear), otherFear: trackName(otherFear) };
  const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
  const bind = (e = {}) => {
    const out = { ...e };
    if (out.fear === '$fear') out.fear = fear;
    if (out.fear === '$otherFear') out.fear = otherFear;
    return out;
  };

  let at = tree.start;
  const session = {
    tree: tree.id,
    done: false,
    ending: null,
    effects: [],
    transcript: [],
    node() {
      if (session.done) return null;
      const n = tree.nodes[at];
      return {
        id: at,
        speaker: n.speaker,
        text: fill(n.text),
        choices: n.choices.map((c, i) => ({ id: String(i), text: fill(c.text), effects: bind(c.effects) })),
      };
    },
    choose(choiceId) {
      if (session.done) throw new Error('The conversation is over.');
      const n = tree.nodes[at];
      const c = n.choices[Number(choiceId)];
      if (!c) throw new Error(`No choice "${choiceId}" here.`);
      if (!session.transcript.length || session.transcript.at(-1).nodeId !== at) session.transcript.push({ speaker: n.speaker, text: fill(n.text), nodeId: at });
      session.transcript.push({ speaker: 'you', text: fill(c.text) });
      session.effects.push(bind(c.effects));
      if (c.end) { session.done = true; session.ending = c.end; } else at = c.next;
      return session;
    },
  };
  return session;
}
