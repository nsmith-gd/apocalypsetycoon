// Greybox weekly headline card (L0). A paper card over the game with the headline, its track and band,
// a line of flavour and one button per choice listing exactly what it does. Uses .report-overlay so
// the campaign clock holds while the card is open.
//
//   const pick = await showWeeklyCard({ root, card, week, trackName, canAfford });   // -> choice id

import { describeChoice } from './weekly.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const TYPE_LABEL = { headline: 'HEADLINE', opportunity: 'OPPORTUNITY', threat: 'THREAT', client: 'CLIENT', wildcard: 'WILDCARD' };

export function showWeeklyCard({ root, card, week, trackName = (id) => id, canAfford = () => true }) {
  return new Promise((resolve) => {
    const overlay = el('div', 'report-overlay wk-overlay');
    const paper = el('section', 'wk-card');
    paper.dataset.type = card.type;
    paper.setAttribute('role', 'dialog');
    paper.setAttribute('aria-label', card.title);
    const head = el('div', 'wk-head');
    head.append(el('span', 'wk-week', `WEEK ${week}`), el('span', 'wk-type', TYPE_LABEL[card.type] ?? card.type.toUpperCase()));
    const tag = el('div', 'wk-tag', card.track ? `${trackName(card.track)} · ${card.band}` : 'GENERAL DECK');
    paper.append(head, el('h2', 'wk-title', card.title), tag, el('p', 'wk-blurb', card.blurb));
    const choices = el('div', 'wk-choices');
    const buttons = card.choices.map((c, i) => {
      const b = el('button', 'wk-choice');
      b.type = 'button';
      b.dataset.choice = c.id;
      const fx = describeChoice(c, trackName);
      b.append(el('span', 'wk-c-key', String(i + 1)), el('span', 'wk-c-label', c.label), el('span', 'wk-c-fx', fx.length ? fx.join(' · ') : 'no immediate effect'));
      if (c.later) b.append(el('span', 'wk-c-later', `later: ${c.later}`));
      const afford = !c.cost || canAfford(c.cost);
      b.disabled = !afford;
      if (!afford) b.title = 'Not enough cash';
      b.addEventListener('click', () => close(c.id));
      choices.append(b);
      return b;
    });
    paper.append(choices);
    overlay.append(paper);
    root.append(overlay);
    (buttons.find((b) => !b.disabled) ?? buttons[0]).focus();
    const onKey = (e) => {
      const i = Number(e.key) - 1;
      if (buttons[i] && !buttons[i].disabled) { e.preventDefault(); e.stopPropagation(); close(card.choices[i].id); }
    };
    addEventListener('keydown', onKey, true);
    function close(id) {
      removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(id);
    }
  });
}
