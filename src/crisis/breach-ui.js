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
    const pending = [...(w.pending ?? []).map((p) => `${p.label}: +${p.points} lands in ${p.weeksLeft} week${p.weeksLeft === 1 ? '' : 's'}`),
      ...(w.research ? [`Crash research: +${w.research.points} every breach week${w.research.rp ? ` (${w.research.rp} RP a week)` : ''}`] : [])];
    for (const key of Object.keys(crisis.cfg.sources)) {
      const offer = crisis.sourceOffer(t.id, key);
      if (!offer) continue;
      const b = el('button', 'br-src');
      b.dataset.source = key;
      const cost = [];
      if (offer.cash) cost.push(money(offer.cash));
      if (offer.rpPerWeek) cost.push(`${offer.rpPerWeek} RP/week`);
      if (offer.heat) cost.push(`heat ${offer.heat > 0 ? '+' : ''}${offer.heat}`);
      if (offer.boardConfidence) cost.push(`board ${offer.boardConfidence}`);
      if (offer.blocksResearch) cost.push('research paused');
      const pts = offer.weeks ? `+${offer.points} in ${offer.weeks} weeks` : offer.perWeek ? `+${offer.points} a week` : `+${offer.points}`;
      const left = Number.isFinite(offer.usesLeft) && offer.usesLeft > 1 ? ` · ${offer.usesLeft} left` : '';
      b.innerHTML = `<b>${offer.label}</b><span>${pts}${left}</span><small>${offer.available ? cost.join(' · ') || 'free' : offer.reason}</small>`;
      b.disabled = !offer.available;
      b.onclick = () => { crisis.contribute(t.id, key); render(); };
      srcs.append(b);
    }
    if (pending.length) srcs.append(el('div', 'br-weektext', `Under way: ${pending.join(' · ')}`));
    const foot = el('div', 'br-foot');
    const tip = el('div', 'br-stakes', 'Contain it: tension drops to 60 for 3 weeks, the tipping point is revealed (and scarred 3 lower). Fail: the track collapses at 100 and shoves every linked crisis.');
    const adv = el('button', 'br-advance', 'ADVANCE 1 WEEK');
    adv.onclick = () => { onAdvanceWeek?.(); render(); };
    foot.append(tip, adv);
    const sip = el('div', 'br-sip');
    const tests = w.shelterTests ?? [];
    sip.append(el('div', 'br-sip-head', `SHELTER-IN-PLACE · ${tests.length ? `${tests.filter((r) => r.pass).length} passed, ${tests.filter((r) => r.pass === false).length} failed` : 'no shelters in its hot regions'}`));
    for (const r of tests) {
      const row = el('div', 'br-sip-row');
      row.dataset.pass = r.site ? 'delay' : String(r.pass);
      row.textContent = r.site
        ? `${r.name}: still under construction, crews sent home for a week`
        : `${r.name}${r.owner ? ` (${r.owner})` : ''}: ${r.pass ? 'PASSED · reputation +2' : `FAILED · reputation -5, leverage +15${r.lost ? `, ${r.lost} lost` : ''}`}${r.why.length ? ` · ${r.why.join(', ')}` : ''}`;
      sip.append(row);
    }
    card.append(head, weeks, weekText, barWrap, srcs, sip, foot);
  }

  const offs = ['breach', 'contribute', 'contained', 'collapse', 'week'].map((k) => crisis.on(k, () => render()));
  render();
  return { render, el: overlay, destroy() { offs.forEach((o) => o()); overlay.remove(); } };
}
