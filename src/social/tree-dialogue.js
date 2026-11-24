// Adapter: plays the authored archetype trees (#56, src/dialogue/trees.js `Conversation`) through the
// session interface the social view-model expects (see dialogue-stub.js). When #54's engine lands it
// can replace this adapter the same way.

import { Conversation, treeFor, ARCHETYPES } from '../dialogue/trees.js';
import { createStubDialogue } from './dialogue-stub.js';

export function createTreeDialogue(guest, { rng = Math.random, world = null } = {}) {
  const tree = treeFor(guest);
  if (!tree) return createStubDialogue(guest); // no tree for this guest: fall back to the placeholder
  const conv = new Conversation({ guest, tree, rng, world });
  const session = {
    tree: tree.id,
    archetype: ARCHETYPES[conv.archetype]?.label ?? conv.archetype,
    guest: conv.guest, // carries the archetype's traits, so trait plays score correctly
    effects: conv.effects,
    world: conv.world, // the live crisis snapshot this conversation is reading (#57)
    transcript: [],
    get done() { return conv.done; },
    get ending() { return conv.done ? conv.node.ending : null; },
    node() {
      if (conv.done) return null;
      return {
        id: conv.nodeId,
        speaker: conv.speaker,
        text: conv.text,
        choices: conv.choices.map(({ index: i, live }) => {
          const c = conv.node.choices[i];
          const e = { ...(c.effects ?? {}) };
          if (e.fear === '$guest') e.fear = conv.fear;
          else if (e.fear === '$other') e.fear = conv.otherFear;
          return { id: String(i), text: conv.fill(c.text), effects: e, live };
        }),
      };
    },
    choose(choiceId) {
      const line = { speaker: conv.speaker, text: conv.text };
      const c = conv.node.choices[Number(choiceId)];
      if (!c) throw new Error(`No choice "${choiceId}" here.`);
      session.transcript.push(line, { speaker: 'you', text: conv.fill(c.text) });
      conv.choose(Number(choiceId));
      if (conv.done) session.transcript.push({ speaker: conv.speaker, text: conv.text });
      return session;
    },
  };
  return session;
}
