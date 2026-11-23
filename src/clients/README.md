# Client orders (pillar 3: build what they want, grade what they need)

- `rooms.js`: `ROOM_CATALOG` (cost, luxury/survival/basic, research-gated). Survival numbers come from Midnight's `ROOM_STATS`.
- `clients.js`: `CLIENT_TYPES` (data: occupants, slots, base fee, luxury wants and what each pays), `ClientBook`:
  - `generateOrder({ quarter, region, crisis, isUnlocked })`: wants only use buildable rooms; crisis shifts the client mix toward luxury buyers.
  - `price(order, rooms, { priceMultiplier })`: base fee + want premiums + 25% all-wants bonus. Air/water/food rooms pay $0.
  - `forecast(order, rooms)`: Midnight's own `gradeShelter` preview.
  - `deliver(orderId, rooms, { quarter, priceMultiplier })`: ledger sale, `pushback.onSale`, and a stored shelter record
    with `ratings {air, water, food}` (supply / occupants), `grades`, `supply`, `prestige`.
  - `sheltersForMidnight()` feeds `computeMidnight({ shelters })` directly. `expire(quarter)`, `toJSON()/load()`.
- `orders-ui.js` + `orders.css`: order board, fit-out slots + room palette, "what they pay for" vs "what Midnight grades", sold register.
- Demo: `demo/clients-demo.html`.
- Integration: the world map should call `generateOrder` per region and pass its crisis price curve as `priceMultiplier`;
  the shelter grid can hand its placed room ids to `deliver`.
