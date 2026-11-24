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

export function createCompanyPanel({ root, company, getWorkingCrews = () => company.crewCap }) {
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
    for (const h of ['Department', 'Head', 'Level', 'Each level adds', '']) hr.append(el('th', null, h));
    t.append(hr);
    for (const d of v.departments) {
      const tr = el('tr');
      tr.dataset.open = String(d.open);
      tr.dataset.dept = d.id;
      tr.append(el('td', null, d.name), el('td', null, d.head), el('td', 'cp-lvl', d.open ? `${d.level} / ${d.cap}` : '-'), el('td', 'cp-dim', d.perLevel));
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
    if (msg) box.append(el('p', 'cp-msg', msg));
    msg = '';
  }

  function toggle(force) { overlay.hidden = force != null ? !force : !overlay.hidden; render(); }
  const off = company.onChange(render);
  company.ledger?.onChange?.(() => { if (!overlay.hidden) render(); });
  render();
  return { chip, render, toggle, get isOpen() { return !overlay.hidden; }, destroy() { off(); overlay.remove(); } };
}
