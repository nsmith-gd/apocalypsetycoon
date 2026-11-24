// Containment card: opens (and pauses the game) when a track breaches. Shows the 100-point bar,
// weeks left in the window and the five containment sources with their price.
//
//   const ui = createContainmentUI({ root, crisis, onAdvanceWeek });
//   // the card's ADVANCE WEEK button calls onAdvanceWeek() (the campaign clock's weekly step)

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const money = (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : `$${Math.round(n / 1e3)}K`);

export function createContainmentUI({ root = document.body, crisis, onAdvanceWeek }) {
  const overlay = el('div', 'br-overlay');
  overlay.hidden = true;
  const card = el('section', 'br-card');
  card.setAttribute('role', 'dialog');
  overlay.append(card);
  root.append(overlay);
  let focus = null; // track id shown

  function render() {
    const open = crisis.activeBreaches;
    if (!open.length) { overlay.hidden = true; focus = null; return; }
    if (!focus || !open.find((t) => t.id === focus)) focus = open[0].id;
    const t = crisis.tracks[focus];
    overlay.hidden = false;
    card.replaceChildren();
    const head = el('div', 'br-head');
    head.append(el('div', 'br-paused', 'GAME PAUSED'), el('div', 'br-title', `${t.name.toUpperCase()} HAS BREACHED`));
    if (open.length > 1) {
      const tabs = el('div', 'br-tabs');
      for (const o of open) {
        const b = el('button', 'br-tab' + (o.id === focus ? ' active' : ''), `${o.name} · ${o.window.weeksLeft}w`);
        b.onclick = () => { focus = o.id; render(); };
        tabs.append(b);
      }
      head.append(tabs);
    }
    const w = t.window;
    const weeks = el('div', 'br-weeks');
    for (let i = 0; i < w.total; i++) {
      const pip = el('i', 'br-pip');
      if (i < w.total - w.weeksLeft) pip.dataset.gone = 'true';
      weeks.append(pip);
    }
    const weekText = el('div', 'br-weektext', `${w.weeksLeft} of ${w.total} weeks left to contain it. Each breach week: heat +2, board confidence -2, panic premium x2.`);
    const barWrap = el('div', 'br-bar');
    const fill = el('div', 'br-fill');
    fill.style.width = `${w.bar}%`;
    barWrap.append(fill, el('span', 'br-bartext', `CONTAINMENT ${w.bar} / 100`));
    const srcs = el('div', 'br-sources');
    for (const key of Object.keys(crisis.cfg.sources)) {
      const offer = crisis.sourceOffer(t.id, key);
      const s = crisis.cfg.sources[key];
      const b = el('button', 'br-src');
      b.dataset.source = key;
      const cost = [];
      if (offer?.cash) cost.push(money(offer.cash));
      if (s.heat) cost.push(`heat +${s.heat}`);
      if (s.boardConfidence) cost.push(`board ${s.boardConfidence}`);
      if (s.blocksResearch) cost.push('research paused');
      if (key === 'calming') cost.push('relief scheme');
      b.innerHTML = `<b>${s.label}</b><span>+${s.points}${offer && offer.usesLeft > 1 ? ` · ${offer.usesLeft} left` : ''}</span><small>${offer ? cost.join(' · ') || 'free' : 'used'}</small>`;
      b.disabled = !offer;
      b.onclick = () => { crisis.contribute(t.id, key); render(); };
      srcs.append(b);
    }
    const foot = el('div', 'br-foot');
    const tip = el('div', 'br-stakes', 'Contain it: tension drops to 60 for 3 weeks, the tipping point is revealed (and scarred 3 lower). Fail: the track collapses at 100 and shoves every linked crisis.');
    const adv = el('button', 'br-advance', 'ADVANCE 1 WEEK');
    adv.onclick = () => { onAdvanceWeek?.(); render(); };
    foot.append(tip, adv);
    card.append(head, weeks, weekText, barWrap, srcs, foot);
  }

  const offs = ['breach', 'contribute', 'contained', 'collapse', 'week'].map((k) => crisis.on(k, () => render()));
  render();
  return { render, el: overlay, destroy() { offs.forEach((o) => o()); overlay.remove(); } };
}
