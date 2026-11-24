// Conversation panel: plays one dialogue tree with a guest, then shows what it was worth (#56).
// Plain DOM, styled by dialogue.css with the --at-* tokens from src/ui/ui.css.
//
//   createConversationPanel({ root, conversation, context, onDone(result) })
//   `conversation` is a Conversation from trees.js; `context.journalistPresent` comes from the event visit.

import { ARCHETYPES } from './trees.js';
import { TRACK_BY_ID } from '../world/tracks.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export function createConversationPanel({ root, conversation, context = {}, onDone }) {
  const panel = el('section', 'dlg');
  const g = conversation.guest;
  const head = el('header', 'dlg-head');
  head.append(
    el('div', 'dlg-name', g.name),
    el('div', 'dlg-sub', `${ARCHETYPES[conversation.archetype].label} · ${g.wealthClass ?? ''} · fears ${(g.fears ?? []).map((f) => TRACK_BY_ID[f]?.name ?? f).join(', ') || 'nothing yet'}`),
  );
  const log = el('div', 'dlg-log');
  const choices = el('div', 'dlg-choices');
  panel.append(head, log, choices);
  root.replaceChildren(panel);

  const say = (who, text) => {
    const line = el('p', `dlg-line dlg-${who}`);
    line.append(el('b', null, who === 'you' ? 'YOU' : who === 'guest' ? g.name.split(' ')[0].toUpperCase() : ''), document.createTextNode(` ${text}`));
    log.append(line);
    log.scrollTop = log.scrollHeight;
  };

  function step() {
    choices.replaceChildren();
    say(conversation.done ? 'narrator' : conversation.speaker, conversation.text);
    if (conversation.done) return finish();
    for (const c of conversation.choices) {
      const b = el('button', 'dlg-choice', c.text);
      b.type = 'button';
      b.onclick = () => { say('you', c.text); conversation.choose(c.index); step(); };
      choices.append(b);
    }
  }

  function finish() {
    const result = conversation.finish({ context });
    const card = el('div', `dlg-result ${result.win ? 'dlg-win' : 'dlg-lose'}`);
    card.append(el('div', 'dlg-ending', result.label.toUpperCase()));
    for (const l of result.lines) card.append(el('div', 'dlg-out', l));
    const done = el('button', 'dlg-done', 'BACK TO THE ROOM');
    done.type = 'button';
    done.onclick = () => onDone?.(result, conversation);
    card.append(done);
    choices.append(card);
  }

  step();
  return { panel };
}
