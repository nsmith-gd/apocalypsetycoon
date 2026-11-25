// Client orders screen: order board, fit-out (room slots + palette), and the pillar-3 split
// side by side: WHAT THEY PAY FOR vs WHAT MIDNIGHT GRADES. Plus the sold-shelter register.
//
//   const ui = createOrdersUI({ root, book, ledger, isUnlocked, getQuarter, getPriceMultiplier });

import { ROOM_CATALOG, roomInfo, availableRooms } from './rooms.js';
import { formatMoney } from '../ledger/ledger.js';
import { drawSprite } from '../art/render.js';
import { TILES, AMENITIES } from '../art/sprites-shelter.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

function roomIcon(id, size = 32) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64; // #116: the 64 px remaster at full resolution
  cv.className = 'co-icon';
  cv.style.width = cv.style.height = `${size}px`;
  const ctx = cv.getContext('2d');
  drawSprite(ctx, TILES.roomEmpty, 0, 0, { native: true });
  if (id && AMENITIES[id]) drawSprite(ctx, AMENITIES[id], 0, 0, { native: true });
  return cv;
}

const STAT_LABEL = { air: 'AIR', water: 'WATER', food: 'FOOD' };

export function createOrdersUI({ root, book, ledger, isUnlocked = () => false, getQuarter = () => 1, getPriceMultiplier = () => 1, onSale }) {
  const wrap = el('section', 'co');
  const board = el('div', 'co-col co-board');
  const fit = el('div', 'co-col co-fit');
  const split = el('div', 'co-col co-split');
  const register = el('div', 'co-register');
  wrap.append(board, fit, split, register);
  root.append(wrap);

  let selectedId = null;
  const fitouts = new Map(); // orderId -> rooms[]

  const roomsFor = (id) => {
    if (!fitouts.has(id)) fitouts.set(id, []);
    return fitouts.get(id);
  };

  function render() {
    const orders = book.orders;
    if (selectedId && !book.getOrder(selectedId)) selectedId = null;
    if (!selectedId && orders.length) selectedId = orders[0].id;
    renderBoard(orders);
    renderFit();
    renderRegister();
  }

  function renderBoard(orders) {
    board.replaceChildren(el('h3', 'co-h', `ORDERS (${orders.length})`));
    if (!orders.length) board.append(el('p', 'co-empty', 'No open orders. Calm worlds don’t buy bunkers.'));
    const q = getQuarter();
    for (const o of orders) {
      const card = el('button', 'co-order');
      card.type = 'button';
      card.dataset.order = o.id;
      card.classList.toggle('active', o.id === selectedId);
      card.append(el('div', 'co-client', o.client), el('div', 'co-type', `${o.typeLabel} · ${o.occupants} people · ${o.slots} slots`));
      const wants = el('div', 'co-wants');
      for (const w of o.wants) {
        const chip = el('span', 'co-want');
        chip.append(roomIcon(w.room, 16), el('span', null, `${w.qty > 1 ? `${w.qty}x ` : ''}${ROOM_CATALOG[w.room].name} ${formatMoney(w.pays)}`));
        wants.append(chip);
      }
      card.append(wants);
      card.append(el('div', 'co-expiry', o.expiresQuarter <= q ? 'Last chance: expires after this quarter' : `Open until the end of Q${o.expiresQuarter}`));
      card.addEventListener('click', () => { selectedId = o.id; render(); });
      board.append(card);
    }
  }

  function renderFit() {
    fit.replaceChildren();
    split.replaceChildren();
    const o = book.getOrder(selectedId);
    if (!o) return;
    const rooms = roomsFor(o.id);

    fit.append(el('h3', 'co-h', `FIT-OUT · ${o.client.toUpperCase()}`), el('p', 'co-blurb', `“${o.blurb}”`));
    const slots = el('div', 'co-slots');
    for (let i = 0; i < o.slots; i++) {
      const id = rooms[i];
      const s = el('button', 'co-slot');
      s.type = 'button';
      s.dataset.slot = i;
      s.append(roomIcon(id, 40));
      if (id) {
        s.title = `${ROOM_CATALOG[id].name}: click to remove`;
        s.classList.add('filled');
        if (o.wants.some((w) => w.room === id)) s.classList.add('wanted');
        s.addEventListener('click', () => { rooms.splice(i, 1); render(); });
      } else {
        s.title = 'Empty slot';
        s.disabled = true;
      }
      slots.append(s);
    }
    fit.append(slots);

    const pal = el('div', 'co-palette');
    for (const id of availableRooms(isUnlocked)) {
      const r = roomInfo(id);
      const b = el('button', 'co-room');
      b.type = 'button';
      b.dataset.room = id;
      b.disabled = rooms.length >= o.slots;
      if (o.wants.some((w) => w.room === id)) b.classList.add('wanted');
      const tags = el('span', 'co-tags');
      for (const k of ['air', 'water', 'food']) if (r[k]) tags.append(el('i', `co-tag ${k}${r[k] < 0 ? ' neg' : ''}`, `${STAT_LABEL[k]}${r[k] > 0 ? '+' : ''}${r[k]}`));
      if (r.kind === 'luxury') tags.append(el('i', 'co-tag lux', 'LUXURY'));
      b.append(roomIcon(id, 32), el('span', 'co-rname', r.name), el('span', 'co-rcost', formatMoney(r.cost)), tags);
      b.addEventListener('click', () => { if (rooms.length < o.slots) { rooms.push(id); render(); } });
      pal.append(b);
    }
    fit.append(pal);

    // ---- the split: what they pay for vs what Midnight grades ----
    const priced = book.price(o, rooms, { priceMultiplier: getPriceMultiplier() });
    const graded = book.forecast(o, rooms);
    const buildCost = rooms.reduce((s, id) => s + ROOM_CATALOG[id].cost, 0);

    const pay = el('div', 'co-card co-pay');
    pay.append(el('h4', 'co-h', 'WHAT THEY PAY FOR'));
    const t = el('table', 'co-lines');
    for (const l of priced.lines) {
      const tr = el('tr', l.unpaid ? 'unpaid' : l.want ? (l.met ? 'met' : 'missing') : '');
      tr.append(el('td', null, l.label), el('td', 'amt', l.unpaid ? '$0' : formatMoney(l.amount)));
      t.append(tr);
    }
    if (priced.priceMultiplier !== 1) {
      const tr = el('tr', 'mult');
      tr.append(el('td', null, `Crisis pricing x${priced.priceMultiplier.toFixed(2)}`), el('td', 'amt', formatMoney(priced.total - priced.subtotal, { sign: true })));
      t.append(tr);
    }
    pay.append(t);
    const sums = el('div', 'co-sums');
    sums.append(
      el('div', 'co-sum', `Client pays ${formatMoney(priced.total)}`),
      el('div', 'co-sum dim', `Build cost ${formatMoney(buildCost)}`),
      el('div', `co-sum ${priced.total - buildCost >= 0 ? 'up' : 'down'}`, `Margin ${formatMoney(priced.total - buildCost, { sign: true })}`),
    );
    pay.append(sums);

    const grade = el('div', 'co-card co-grade');
    grade.append(el('h4', 'co-h', 'WHAT MIDNIGHT GRADES'));
    for (const k of ['air', 'water', 'food']) {
      const row = el('div', 'co-stat');
      row.dataset.grade = graded.grades[k];
      const bar = el('div', 'co-bar');
      const fill = el('div', 'co-fill');
      fill.style.width = `${Math.min(100, graded.ratios[k] * 80)}%`;
      bar.append(fill, el('i', 'co-need'));
      row.append(el('span', 'co-stat-name', STAT_LABEL[k]), bar, el('span', 'co-letter', graded.grades[k]), el('span', 'co-supply', `${Math.round(graded.supply[k])}/${o.occupants}`));
      grade.append(row);
    }
    grade.append(el('div', `co-forecast ${graded.outcome}`, graded.outcome === 'survived'
      ? `At Midnight: all ${o.occupants} survive.`
      : graded.survivors === 0 ? `At Midnight: nobody survives. Weakest: ${STAT_LABEL[graded.weakest]}.` : `At Midnight: ${graded.survivors} of ${o.occupants} survive. Weakest: ${STAT_LABEL[graded.weakest]}.`));
    grade.append(el('div', 'co-note', 'Clients never pay for these. Midnight only counts these.'));

    const err = book.validate(o, rooms);
    const deliver = el('button', 'co-deliver', err ?? `DELIVER & SELL · ${formatMoney(priced.total)}`);
    deliver.type = 'button';
    deliver.disabled = !!err;
    deliver.addEventListener('click', () => {
      for (const id of rooms) ledger?.record('builds', ROOM_CATALOG[id].name, -ROOM_CATALOG[id].cost);
      const shelter = book.deliver(o.id, rooms, { quarter: getQuarter(), priceMultiplier: getPriceMultiplier() });
      fitouts.delete(o.id);
      onSale?.(shelter, priced);
      render();
    });
    split.append(pay, grade, deliver);
  }

  function renderRegister() {
    register.replaceChildren(el('h3', 'co-h', `SOLD SHELTERS (${book.shelters.length}) · RECORDED FOR MIDNIGHT`));
    if (!book.shelters.length) { register.append(el('p', 'co-empty', 'Nothing sold yet.')); return; }
    const t = el('table', 'co-reg');
    const head = el('tr');
    for (const h of ['Client', 'Q', 'People', 'Wants', 'Paid', 'AIR', 'WATER', 'FOOD']) head.append(el('th', null, h));
    t.append(head);
    for (const s of book.shelters) {
      const tr = el('tr');
      tr.append(el('td', null, s.owner), el('td', null, `Q${s.soldQuarter}`), el('td', null, String(s.occupants)), el('td', null, `${s.wantsMet}/${s.wantsTotal}`), el('td', 'amt', formatMoney(s.price)));
      for (const k of ['air', 'water', 'food']) {
        const td = el('td', 'co-gcell', `${s.grades[k]} ${Math.round(s.ratings[k] * 100)}%`);
        td.dataset.grade = s.grades[k];
        tr.append(td);
      }
      t.append(tr);
    }
    register.append(t);
  }

  book.onChange(render);
  render();
  return { render, select(id) { selectedId = id; render(); }, fitout: roomsFor };
}
