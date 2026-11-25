// DOM for the press, reputation, Inspector and sieges (rules in press.js).
//
//   const desk = createPressDesk({ press, pushback, onAction });   // element: journalists, counters, sites
//   host.append(desk.el);
//   const chip = createReputationChip({ press, onOpen });           // HUD chip
//   createFrontPage({ root, press });                               // full-screen front page when a story runs
//
// Everything re-renders on press 'change' and pushback 'change'.

import { PRESS } from './press.js';
import { fmt } from './pushback.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const btn = (cls, text, onClick, title = '') => {
  const b = el('button', cls, text);
  b.type = 'button';
  if (title) b.title = title;
  b.addEventListener('click', onClick);
  return b;
};

// Tiny pixel portraits (12x12) drawn with CSS boxes, one string per row.
const PORTRAITS = {
  iris: [
    '....KKKK....',
    '...KkkkkK...',
    '..KkkkkkkK..',
    '..KkSSSSkK..',
    '..KSwKSwKS..',
    '..KSSSSSSK..',
    '...SSrrSS...',
    '....SSSS....',
    '...GGGGGG...',
    '..GGGWWGGG..',
    '.GGGGWWGGGG.',
    '.GGGGGGGGGG.',
  ],
  gil: [
    '...YYYYYY...',
    '..YYYYYYYY..',
    '..YSSSSSSY..',
    '..SKKSSKKS..',
    '..SwKSSwKS..',
    '..SSSSSSSS..',
    '...SrrrrS...',
    '....SSSS....',
    '..RRRWWRRR..',
    '.RRRRWWRRRR.',
    '.RRRRRRRRRR.',
    '.RRRRRRRRRR.',
  ],
};
const PCOL = { K: '#1a1412', k: '#4a2a1e', S: '#e8b48a', w: '#f2e6c9', r: '#b3261e', G: '#3c5a2a', W: '#efe4c6', Y: '#f5c542', R: '#8a2a24' };

function portrait(id) {
  const cv = document.createElement('canvas');
  cv.width = 12; cv.height = 12;
  cv.className = 'pr-portrait';
  const ctx = cv.getContext('2d');
  PORTRAITS[id].forEach((row, y) => [...row].forEach((ch, x) => { if (PCOL[ch]) { ctx.fillStyle = PCOL[ch]; ctx.fillRect(x, y, 1, 1); } }));
  return cv;
}

// ---------------------------------------------------------------- HUD chip
export function createReputationChip({ press, onOpen }) {
  const chip = el('button', 'hud-stat hud-meter pr-chip');
  chip.type = 'button';
  chip.title = 'Reputation 0-100 and the stories being written about you. Click or press P for the press desk.';
  chip.append(el('span', 'hud-label', 'REPUTATION [P]'));
  const bar = el('div', 'hud-bar');
  const fill = el('div', 'hud-bar-fill');
  bar.append(fill);
  const value = el('span', 'hud-value');
  const stories = el('span', 'pr-chip-stories');
  chip.append(bar, value, stories);
  chip.addEventListener('click', () => onOpen?.());
  function render() {
    const s = press.snapshot();
    fill.style.width = `${s.reputation}%`;
    chip.dataset.zone = s.reputationZone.id;
    value.textContent = `${Math.round(s.reputation)} ${s.reputationZone.word}`;
    const live = s.journalists.filter((j) => j.story);
    const worst = live.reduce((a, j) => (!a || j.story.progress > a.story.progress ? j : a), null);
    stories.textContent = worst ? `${worst.name.split(' ')[0]}'s story ${Math.round(worst.story.progress)}%` : 'No stories running';
    stories.dataset.hot = String(!!worst && worst.story.progress >= 70);
  }
  press.on('change', render);
  render();
  return { el: chip, render };
}

// ---------------------------------------------------------------- press desk
export function createPressDesk({ press, pushback, onAction = () => {}, showSites = true }) {
  const desk = el('section', 'pr-desk');
  const head = el('div', 'pr-head');
  const title = el('div', 'pr-title', 'PRESS DESK');
  const week = el('div', 'pr-week');
  head.append(title, week);

  const rep = el('div', 'pr-rep');
  const journos = el('div', 'pr-journos');
  const sitesBox = el('div', 'pr-sites');
  desk.append(head, rep, journos, sitesBox);

  const act = (fn) => () => { const r = fn(); onAction(r); render(); };

  function renderRep(s) {
    const z = s.reputationZone;
    const bar = el('div', 'pr-rep-bar');
    const fill = el('i', 'pr-rep-fill');
    fill.style.width = `${s.reputation}%`;
    bar.append(fill);
    for (const at of [20, 40, 70]) { const m = el('b', 'pr-rep-mark'); m.style.left = `${at}%`; bar.append(m); }
    rep.dataset.zone = z.id;
    rep.replaceChildren(
      el('div', 'pr-rep-top', ''),
      bar,
    );
    rep.firstChild.append(el('span', 'pr-label', 'REPUTATION'), el('span', 'pr-rep-val', `${Math.round(s.reputation)}/100 ${z.word}`));
  }

  function renderJourno(j) {
    const card = el('article', 'pr-journo');
    card.dataset.id = j.id;
    const top = el('div', 'pr-j-top');
    const who = el('div', 'pr-j-who');
    who.append(el('div', 'pr-j-name', j.name), el('div', 'pr-j-outlet', j.outlet));
    top.append(portrait(j.id), who);
    if (j.trustMax) {
      const trust = el('div', 'pr-trust');
      trust.title = `Trust ${j.trust}/${j.trustMax}: each point slows her stories 10% and softens the hit when one runs.`;
      trust.append(el('span', 'pr-label', 'TRUST'));
      for (let i = 0; i < j.trustMax; i++) trust.append(el('i', i < j.trust ? 'on' : ''));
      top.append(trust);
    }
    card.append(top, el('div', 'pr-j-blurb', j.blurb));

    const storyBox = el('div', 'pr-story');
    if (j.story) {
      const p = j.story.progress;
      storyBox.dataset.zone = p >= 75 ? 'hot' : p >= 40 ? 'warm' : 'cold';
      storyBox.append(el('div', 'pr-angle', `"${j.story.angle}"`));
      const bar = el('div', 'pr-story-bar');
      const fill = el('i', 'pr-story-fill');
      fill.style.width = `${p}%`;
      bar.append(fill, el('span', 'pr-story-pct', `${Math.round(p)}%`));
      storyBox.append(bar, el('div', 'pr-story-eta', `+${j.growthPerWeek}% a week · runs in ~${j.weeksToAir} week${j.weeksToAir === 1 ? '' : 's'}`));
    } else if (j.restWeeks > 0) {
      storyBox.dataset.zone = 'idle';
      storyBox.append(el('div', 'pr-quiet', `Quiet for ${j.restWeeks} more week${j.restWeeks === 1 ? '' : 's'}.`));
    } else {
      storyBox.dataset.zone = 'idle';
      const need = PRESS.journalists[j.id].startHeat;
      storyBox.append(el('div', 'pr-quiet', press.getMinutes && press.getMinutes() < PRESS.story.firstStoryAt
        ? 'Not on your trail yet.' : `Not digging yet. Starts when heat reaches ${need}.`));
    }
    card.append(storyBox);

    const counters = el('div', 'pr-counters');
    for (const [kind, C] of Object.entries(PRESS.counters)) {
      const blocked = press.counterBlocked(j.id, kind);
      const cost = press.counterCost(j.id, kind);
      const costText = kind === 'kompromat' && cost === 0 ? '1 INTEL' : cost ? fmt(cost) : 'FREE';
      const b = btn('pr-counter', '', act(() => press.counter(j.id, kind)), `${C.blurb}${blocked ? `\n(${blocked})` : ''}`);
      b.dataset.kind = kind;
      b.append(el('span', 'pr-c-name', C.label.toUpperCase()), el('span', 'pr-c-cost', costText));
      b.disabled = !!blocked;
      counters.append(b);
    }
    card.append(counters);
    return card;
  }

  function renderSites(s) {
    const P = PRESS.pitchforks;
    const headRow = el('div', 'pr-sites-head');
    headRow.append(el('span', 'pr-label', 'SITES · THE PITCHFORKS'));
    const status = el('span', 'pr-pf', s.pitchforksOpen ? 'MOBS MARCHING WEEKLY' : `Opens at tension ${P.openAtTension}`);
    status.dataset.open = String(s.pitchforksOpen);
    headRow.append(status);
    const formula = el('div', 'pr-formula', `Siege strength = tension ${Math.round(pushback.tension)} / 20 + visible surface features. Beats security? The site is occupied.`);
    const list = el('div', 'pr-site-list');
    if (!s.sites.length) list.append(el('div', 'pr-quiet', 'No shelter sites built yet.'));
    for (const site of s.sites) {
      const row = el('div', 'pr-site');
      row.dataset.occupied = String(site.occupied);
      row.dataset.risk = site.strength > site.defence ? 'falls' : 'holds';
      const name = el('div', 'pr-site-name', site.name);
      const flags = el('div', 'pr-site-flags');
      if (site.decoy) flags.append(el('span', 'pr-flag', 'DECOY'));
      if (site.inspectedWeek != null) flags.append(el('span', 'pr-flag', 'INSPECTED'));
      if (site.occupied) flags.append(el('span', 'pr-flag pr-flag-red', 'OCCUPIED'));
      const vs = el('div', 'pr-vs');
      vs.append(
        el('span', 'pr-vs-mob', `MOB ${site.strength}`),
        el('span', 'pr-vs-x', site.strength > site.defence ? '>' : '≤'),
        el('span', 'pr-vs-def', `SEC ${site.defence}`),
      );
      vs.title = `Mob strength ${site.strength} (tension/20 + ${site.visible} visible features) vs defence ${site.defence} (security ${site.security}${site.decoy ? ' + decoy 2' : ''})`;
      const actions = el('div', 'pr-site-actions');
      const insp = btn('pr-sbtn', `INSPECTOR ${fmt(PRESS.inspector.cost)}`, act(() => press.inspect(site.id)), 'One walkthrough. Certifies a sound, quiet site (reputation +6) or lists what to fix.');
      insp.disabled = site.inspectedWeek != null && press.week - site.inspectedWeek < PRESS.inspector.onceEveryWeeks;
      const decoy = btn('pr-sbtn', `DECOY ${fmt(P.decoy.cost)}`, act(() => press.buildDecoy(site.id)), `A fake entrance for the mob: defence +${P.decoy.defence}.`);
      decoy.disabled = site.decoy;
      actions.append(insp, decoy);
      if (site.occupied) actions.append(btn('pr-sbtn pr-sbtn-red', `RETAKE ${fmt(P.retake.cost)}`, act(() => press.retake(site.id)), `Send in security. Heat +${P.retake.heat}.`));
      row.append(name, flags, vs, actions);
      list.append(row);
    }
    sitesBox.replaceChildren(headRow, formula, list);
  }

  function render() {
    const s = press.snapshot();
    week.textContent = `WEEK ${s.week}${s.intel ? ` · INTEL ${s.intel}` : ''}`;
    renderRep(s);
    journos.replaceChildren(...s.journalists.map(renderJourno));
    if (showSites) renderSites(s); else sitesBox.hidden = true;
  }
  press.on('change', render);
  pushback.on('change', render);
  render();
  return { el: desk, render };
}

// ---------------------------------------------------------------- front page
export function createFrontPage({ root, press, onClose }) {
  const queue = [];
  let showing = false;
  function show(evt) {
    showing = true;
    const overlay = el('div', 'report-overlay pr-fp-overlay');
    const paper = el('section', `pr-fp pr-fp-${evt.journalist}`);
    paper.setAttribute('role', 'dialog');
    if (evt.journalist === 'gil') {
      paper.append(el('div', 'pr-fp-breaking', 'BREAKING'), el('div', 'pr-fp-mast', evt.outlet.toUpperCase()));
    } else {
      paper.append(el('div', 'pr-fp-mast', evt.outlet.toUpperCase()), el('div', 'pr-fp-date', `By ${evt.name} · Special investigation`));
    }
    paper.append(el('h2', 'pr-fp-head', evt.angle), el('div', 'pr-fp-sub', 'Last Resort Holdings could not be reached for comment.'));
    const fx = el('ul', 'pr-fp-fx');
    fx.append(
      el('li', null, `Heat +${evt.heat}`),
      el('li', null, `Reputation ${evt.reputation}`),
      el('li', null, `Every client +${evt.leverage} leverage`),
    );
    if (evt.track) fx.append(el('li', null, `${evt.track === 'world' ? 'World tension' : `${evt.track} track`} +${PRESS.journalists.gil.trackShove}: the scare spreads`));
    paper.append(fx);
    const ok = btn('report-continue', 'NO COMMENT', () => {
      overlay.remove();
      showing = false;
      onClose?.(evt);
      if (queue.length) show(queue.shift());
    });
    paper.append(ok);
    overlay.append(paper);
    root.append(overlay);
    ok.focus();
  }
  press.on('aired', (evt) => (showing ? queue.push(evt) : show(evt)));
  return { get open() { return showing; } };
}
