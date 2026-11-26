// The tutorial's prompt card and highlight (#162). One small card above the clock bar: step count, a title, one or two
// lines, an action button when the step needs one, and SKIP. The control the step is about pulses.
//
//   const tut = createTutorialUI({ root: document.body, tutorial, site, leads, schemes, mapSales });
//   tut.tick()     // rebuilds the context and updates (also runs on its own every half second)

import { STEPS } from './tutorial.js';

/** What the tutorial checks, read from the live systems. */
export function tutorialContext({ site, leads, schemes, mapSales, tutorial }) {
  let dug = 0;
  for (let y = 0; y < site.H; y++) for (let x = 0; x < site.W; x++) if (site.dug[site.idx(x, y)]) dug++;
  const kinds = new Set();
  for (const o of site.objects.values()) kinds.add(o.kind);
  const nets = new Set();
  const BIT = { air: 1, water: 2, power: 4 };
  for (let i = 0; i < site.conduits.length; i++) if (site.conduits[i]) for (const [n, b] of Object.entries(BIT)) if (site.conduits[i] & b) nets.add(n);
  for (const j of site.jobs) { if (j.type === 'dig') dug++; if (j.kind) kinds.add(j.kind); if (j.type === 'conduit') nets.add(j.net); }
  const sim = site.simulate();
  const marla = tutorial.leadId != null ? leads?.get(tutorial.leadId) : null;
  return {
    dug, kinds, nets, rooms: 0, objects: site.objects.size, jobs: site.jobs.length,
    occupants: sim.occupants ?? 0, daysSealed: sim.daysSealed ?? 0,
    handedOver: site.handedOver, handedOverAtStart: tutorial.handedOverAtStart ?? 0,
    marlaSold: marla?.status === 'consumed', sales: mapSales?.sold?.length ?? 0, schemes: schemes?.log?.length ?? 0,
  };
}

export function createTutorialUI({ root = document.body, tutorial, site, leads, schemes, mapSales, onChange = () => {} }) {
  const card = document.createElement('aside');
  card.className = 'tut';
  card.setAttribute('role', 'status');
  root.append(card);
  let lit = null;
  let shown = null;
  let doneUntil = 0;

  function signMarla() {
    if (tutorial.signed) return;
    try {
      const lead = leads.create({
        guest: { id: 'marla', name: 'Marla Quist' }, region: 'heartland', wealthClass: 'C1', quality: 60, lifetime: 4,
        source: { type: 'tutorial', note: 'Solo Pod' }, traits: ['reads the spec sheet', 'Survive tier first'], bonus: false,
      });
      tutorial.leadId = lead.id;
    } catch { /* no lead system: the step still teaches the signing */ }
    tutorial.sign();
    tick();
  }

  function highlight(sel) {
    // a step may name several targets: the first one on screen gets the highlight
    const target = [].concat(sel ?? []).map((q) => [...document.querySelectorAll(q)].find((e) => e.offsetParent !== null || e.getClientRects().length)).find(Boolean) ?? null;
    if (target === lit) return;
    lit?.classList.remove('tut-target');
    lit = target;
    lit?.classList.add('tut-target');
  }

  function render(step) {
    if (!step) {
      highlight(null);
      if (tutorial.finished && !tutorial.skipped && Date.now() < doneUntil) return;
      if (tutorial.finished && !tutorial.skipped && shown !== 'done') {
        shown = 'done'; doneUntil = Date.now() + 6000;
        card.hidden = false;
        card.innerHTML = '<div class="tut-k">TUTORIAL COMPLETE</div><div class="tut-t">Last Resort Holdings is open for business.</div><div class="tut-x">Everything else in the game is how close to the edge you dare run it.</div>';
        setTimeout(() => { card.hidden = true; }, 6000);
        return;
      }
      card.hidden = true;
      return;
    }
    card.hidden = false;
    highlight(step.target);
    if (shown === step.id) return;
    shown = step.id;
    const n = STEPS.indexOf(step) + 1;
    card.innerHTML = `<div class="tut-k">TUTORIAL ${n}/${STEPS.length}</div><div class="tut-t">${step.title}</div><div class="tut-x">${step.text}</div><div class="tut-b"></div>`;
    const row = card.querySelector('.tut-b');
    if (step.action) { const b = document.createElement('button'); b.className = 'tut-go'; b.textContent = step.action; b.onclick = signMarla; row.append(b); }
    const skip = document.createElement('button'); skip.className = 'tut-skip'; skip.textContent = 'SKIP TUTORIAL';
    skip.onclick = () => { tutorial.skip(); tick(); onChange(); };
    row.append(skip);
    onChange();
  }

  function tick() {
    let step = tutorial.update(tutorialContext({ site, leads, schemes, mapSales, tutorial }));
    if (step?.id === 'sell' && tutorial.leadId == null) { signMarla(); step = tutorial.current; } // signing was bypassed: Marla still waits
    render(step);
    return step;
  }
  const timer = setInterval(tick, 500);
  tick();
  return { el: card, tick, destroy() { clearInterval(timer); highlight(null); card.remove(); } };
}
