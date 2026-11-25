// GREYBOX company panel (#73, L0): a tier chip for the top bar and a plain overlay listing the
// departments with their level against the tier cap. LEVEL UP is refused (and says why) at the cap.
// #72 owns the full company panel; it can replace this file and keep using Company.view()/levelUp().

import { formatMoney } from '../ledger/ledger.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export function createCompanyPanel({ root, company, getWorkingCrews = () => company.crewCap, onScapegoat = null }) {
  const chip = el('button', 'hud-stat co-tier');
  chip.type = 'button';
  chip.title = 'Company: tier, caps and departments';
  const chipLabel = el('span', 'hud-label', 'COMPANY');
  const chipValue = el('span', 'hud-value');
  const chipSub = el('span', 'co-tier-sub');
  chip.append(chipLabel, chipValue, chipSub);

  const overlay = el('div', 'cp-overlay');
  overlay.hidden = true;
  const box = el('section', 'cp');
  overlay.append(box);
  root.append(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) toggle(false); });
  chip.onclick = () => toggle();
  let msg = '';

  function render() {
    const v = company.view();
    chipValue.textContent = v.tier.toUpperCase();
    chipSub.textContent = `${v.sites} site · ${getWorkingCrews()}/${v.crews} crews · cap ${v.cap}`;
    if (overlay.hidden) return;
    box.replaceChildren();
    const head = el('div', 'cp-head');
    head.append(el('h2', 'cp-h', `LAST RESORT HOLDINGS · ${v.tier.toUpperCase()}`));
    const x = el('button', 'cp-x', 'CLOSE');
    x.type = 'button';
    x.onclick = () => toggle(false);
    head.append(x);
    box.append(head, el('p', 'cp-sub', `Sites ${v.sites} · crews ${getWorkingCrews()} of ${v.crews} · department level cap ${v.cap} · crew speed x${v.crewSpeed.toFixed(2)}${v.extraCrews ? ` · Engineering +${v.extraCrews} crew${v.extraCrews > 1 ? 's' : ''}` : ''}${v.rpPerWeek ? ` · R&D +${v.rpPerWeek} RP/week` : ''}`));
    const t = el('table', 'cp-t');
    const hr = el('tr');
    for (const h of ['Department', 'Head', 'Loyalty', 'Level', 'Each level adds', '']) hr.append(el('th', null, h));
    t.append(hr);
    for (const d of v.departments) {
      const tr = el('tr');
      tr.dataset.open = String(d.open);
      tr.dataset.dept = d.id;
      tr.append(el('td', null, d.name), el('td', null, d.head), el('td', 'cp-lvl', d.open ? String(d.loyalty) : '-'), el('td', 'cp-lvl', d.open ? `${d.level} / ${d.cap}` : '-'), el('td', 'cp-dim', d.perLevel));
      const td = el('td');
      const b = el('button', 'cp-up', d.blocker ? d.blocker.toUpperCase() : `LEVEL UP ${formatMoney(d.cost)}`);
      b.type = 'button';
      b.disabled = !!d.blocker;
      b.onclick = () => { const r = company.levelUp(d.id); msg = r.ok ? `${d.name} is now level ${r.level}.` : r.reason; render(); };
      td.append(b);
      tr.append(td);
      t.append(tr);
    }
    box.append(t);

    // #151: the Inspector (Sales level 3) and the once-a-campaign scapegoat
    const extra = el('div', 'cp-extra');
    const insp = el('div', 'cp-row');
    const ib = company.inspectorBlocker();
    insp.append(el('div', 'cp-row-t', 'THE INSPECTOR'), el('p', 'cp-dim', `A Sales hire from level 3. $0.2M per walkthrough (each handover): clients see the Survive tier, and their leverage grows half as fast.${company.inspections ? ` Walkthroughs so far: ${company.inspections}.` : ''}`));
    const ibtn = el('button', 'cp-up', ib ? ib.toUpperCase() : company.inspectorHired ? 'HIRED: RELEASE' : 'HIRE THE INSPECTOR');
    ibtn.type = 'button';
    ibtn.disabled = !!ib && !company.inspectorHired;
    ibtn.onclick = () => { const r = company.setInspector(!company.inspectorHired); msg = r.ok ? (r.hired ? 'The Inspector joins every walkthrough from now on.' : 'The Inspector is released.') : r.reason; render(); };
    insp.append(ibtn);
    const sg = el('div', 'cp-row');
    sg.append(el('div', 'cp-row-t', 'NAME A SCAPEGOAT'), el('p', 'cp-dim', company.scapegoated
      ? `Used: ${company.scapegoated.head} took the fall. Once per campaign.`
      : 'Once per campaign. The executive leaves, their department drops two levels, every other head loses 15 loyalty (Marcus Dell 25), and heat falls by 40.'));
    if (!company.scapegoated && onScapegoat) {
      const pick = el('div', 'cp-pick');
      for (const d of v.departments.filter((x) => x.open)) {
        const b = el('button', 'cp-up', `${d.head.toUpperCase()}`);
        b.type = 'button';
        b.title = `${d.name}: level ${d.level} -> ${Math.max(1, d.level - 2)}`;
        b.onclick = () => { if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = `CONFIRM: ${d.head.toUpperCase()}`; return; } const r = onScapegoat(d.id); msg = r.ok ? `${r.head} resigned. Heat fell to ${Math.round(r.heatAfter)}.` : r.reason; render(); };
        pick.append(b);
      }
      sg.append(pick);
    }
    extra.append(insp, sg);
    box.append(extra);
    if (msg) box.append(el('p', 'cp-msg', msg));
    msg = '';
  }

  function toggle(force) { overlay.hidden = force != null ? !force : !overlay.hidden; render(); }
  const off = company.onChange(render);
  company.ledger?.onChange?.(() => { if (!overlay.hidden) render(); });
  render();
  return { chip, render, toggle, get isOpen() { return !overlay.hidden; }, destroy() { off(); overlay.remove(); } };
}
