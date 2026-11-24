// UI for Engineered Midnight: the planner, the LAST CALL banner, the Seal Order board and the
// Overtime offer. Plain DOM over the HUD.

import { PROJECTS, APOCALYPSES, requirementFor, ENGINEERED } from './engineered.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const money = (n) => `$${n >= 1e6 ? `${Math.round(n / 1e6)}M` : `${Math.round(n / 1e3)}K`}`;
const reqText = (r) => `${r.days} days sealed · ${Object.entries(r.critical).map(([k, v]) => `${k} ${v}`).join(', ')}`;

function modal(root, cls = '') {
  const overlay = el('div', `em-overlay ${cls}`);
  const card = el('section', 'em-card');
  overlay.append(card);
  root.append(overlay);
  return { overlay, card, close: () => overlay.remove() };
}

/** Planner: resolves with the start() result, or null if cancelled. */
export function openPlanner({ root = document.body, em, availability = () => true, tracks = Object.keys(APOCALYPSES).filter((k) => APOCALYPSES[k].campaign) }) {
  return new Promise((resolve) => {
    const { card, close } = modal(root);
    let project = 'lights_out';
    let first = tracks[0];
    let second = '';
    let weeks = 8;
    const body = el('div');
    const render = () => {
      const target = second ? [first, second] : first;
      const req = requirementFor(target);
      const P = PROJECTS[project];
      body.innerHTML = `
        <div class="em-kicker">ENGINEER MIDNIGHT</div>
        <div class="em-title">Pick your apocalypse</div>
        <div class="em-row">${Object.values(PROJECTS).map((p) => `<button class="em-opt ${p.id === project ? 'on' : ''}" data-project="${p.id}" ${availability(p.id) ? '' : 'disabled'}>${p.name}<small>${p.timeline}${p.boardVote ? ` · board vote ${p.boardVote.need} of ${p.boardVote.of}` : ''}</small></button>`).join('')}</div>
        <div class="em-label">TRACK</div>
        <div class="em-row">${tracks.map((t) => `<button class="em-opt ${t === first ? 'on' : ''}" data-first="${t}">${APOCALYPSES[t].name}</button>`).join('')}</div>
        <div class="em-label">LINK A SECOND TRACK (harsher requirements, bigger payout)</div>
        <div class="em-row"><button class="em-opt ${!second ? 'on' : ''}" data-second="">None</button>${tracks.filter((t) => t !== first).map((t) => `<button class="em-opt ${t === second ? 'on' : ''}" data-second="${t}">${APOCALYPSES[t].name}</button>`).join('')}</div>
        <div class="em-label">DATE · MIDNIGHT IN <b>${weeks}</b> WEEKS</div>
        <input class="em-range" type="range" min="${ENGINEERED.minWeeks}" max="${ENGINEERED.maxWeeks}" value="${weeks}">
        <div class="em-req"><b>${req.name}</b><br>Shelters will need ${reqText(req)}.<br>Payout ${money(second ? P.pairPayout : P.payout)} x grade.<br>Until then: LAST CALL. Sales at triple premium, heat +3 a week. You can call it off once (board confidence -20).</div>
        <div class="em-err"></div>
        <div class="em-row em-actions"><button class="em-cancel">NOT YET</button><button class="em-go">SET THE DATE</button></div>`;
      body.querySelectorAll('[data-project]').forEach((b) => (b.onclick = () => { project = b.dataset.project; render(); }));
      body.querySelectorAll('[data-first]').forEach((b) => (b.onclick = () => { first = b.dataset.first; if (second === first) second = ''; render(); }));
      body.querySelectorAll('[data-second]').forEach((b) => (b.onclick = () => { second = b.dataset.second; render(); }));
      body.querySelector('.em-range').oninput = (e) => { weeks = Number(e.target.value); render(); };
      body.querySelector('.em-cancel').onclick = () => { close(); resolve(null); };
      body.querySelector('.em-go').onclick = () => {
        const r = em.start({ project, target: second ? [first, second] : first, weeks });
        if (!r.ok) {
          body.querySelector('.em-err').textContent = r.reason + (r.vote ? ` Votes: ${r.vote.votes.map((v) => (v ? 'YES' : 'no')).join(' ')}` : '');
          return;
        }
        close();
        resolve(r);
      };
    };
    card.append(body);
    render();
  });
}

/** Top banner during LAST CALL and the Seal Order. */
export function createBanner({ root = document.body, em, onCallOff }) {
  const b = el('div', 'em-banner');
  b.hidden = true;
  root.append(b);
  const render = () => {
    if (em.phase === 'last_call') {
      b.hidden = false;
      b.dataset.phase = 'last_call';
      b.innerHTML = `<b>LAST CALL</b> · ${em.plan.projectName}: ${em.plan.requirement.name} in <b>${em.plan.weeksLeft}</b> week${em.plan.weeksLeft === 1 ? '' : 's'} · sales x3 · heat +3/wk ${em.calledOff ? '' : '<button class="em-calloff">CALL IT OFF (-20 board confidence)</button>'}`;
      b.querySelector('.em-calloff')?.addEventListener('click', () => { em.callOff(); onCallOff?.(); render(); });
    } else if (em.phase === 'seal_order') {
      b.hidden = false;
      b.dataset.phase = 'seal_order';
      b.innerHTML = `<b>SEAL ORDER</b> · convoys and helicopters bringing clients in · doors seal in <b>${em.sealWeeksLeft}</b> week${em.sealWeeksLeft === 1 ? '' : 's'}`;
    } else b.hidden = true;
  };
  ['start', 'week', 'sealOrder', 'midnight', 'callOff'].forEach((k) => em.on(k, render));
  render();
  return { render, el: b };
}

/** The Seal Order board: every client's pickup, revealed one by one. Resolves when dismissed. */
export function showSealOrder({ root = document.body, results }) {
  return new Promise((resolve) => {
    const { card, close } = modal(root, 'em-seal');
    const counts = { on_time: 0, late: 0, lost: 0 };
    for (const r of results) counts[r.outcome] += 1;
    card.innerHTML = `<div class="em-kicker">SEAL ORDER</div><div class="em-title">Bringing them in</div>
      <table class="em-table"><tr><th>CLIENT</th><th>PICKUP</th><th>RISK</th><th>ARRIVAL</th></tr>${results.map((r, i) => `<tr data-o="${r.outcome}" style="animation-delay:${i * 0.18}s"><td>${r.name}</td><td>${r.transport === 'helicopter' ? 'HELICOPTER' : 'CONVOY'}${r.why.length ? `<small> · ${r.why.join(', ')}</small>` : ''}</td><td>${Math.round(r.risk * 100)}%</td><td class="em-out">${{ on_time: 'ON TIME', late: 'LATE', lost: 'LOST' }[r.outcome]}</td></tr>`).join('')}</table>
      <div class="em-req">${counts.on_time} on time · ${counts.late} late (a quarter of each late party won't make it inside) · ${counts.lost} lost</div>
      <div class="em-row em-actions"><button class="em-go">SEAL THE DOORS</button></div>`;
    card.querySelector('.em-go').onclick = () => { close(); resolve(); };
  });
}

/** Overtime offer at the end of Q12. Resolves true if accepted. */
export function offerOvertime({ root = document.body, quota, unopened = [] }) {
  return new Promise((resolve) => {
    const { card, close } = modal(root);
    card.innerHTML = `<div class="em-kicker">END OF QUARTER 12</div><div class="em-title">Overtime?</div>
      <div class="em-req">The world hasn't ended yet. The board offers Overtime: endless quarters, the quota growing 30% each quarter (next: ${money(quota)}), and a new crisis opening every quarter: ${unopened.map((t) => APOCALYPSES[t].name).join(', ')}.<br>Or let Midnight come now.</div>
      <div class="em-row em-actions"><button class="em-cancel">LET MIDNIGHT COME</button><button class="em-go">TAKE OVERTIME</button></div>`;
    card.querySelector('.em-cancel').onclick = () => { close(); resolve(false); };
    card.querySelector('.em-go').onclick = () => { close(); resolve(true); };
  });
}
