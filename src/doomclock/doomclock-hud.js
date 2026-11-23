// Doom Clock on the HUD: a pixel clock face whose minute hand creeps toward twelve, a red wedge for
// the one-way floor (the hand can never go back past it), minutes to Midnight, and the Final
// Countdown in weeks once it starts.
//
//   const hudClock = createDoomClockHud({ clock, hud: document.querySelector('.hud') });

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const S = 32; // clock canvas is 32x32 pixels, scaled up crisp

function drawFace(ctx, clock, t) {
  const c = S / 2;
  const R = 14;
  ctx.clearRect(0, 0, S, S);
  // face
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (d <= R) ctx.fillStyle = d > R - 1.5 ? '#0a0807' : '#efe4c6';
      else continue;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // the danger arc: the last 15 minutes (between 9 and 12 o'clock positions), wedge from floor to 12
  const angleFor = (minsBefore) => -Math.PI / 2 - (minsBefore / 60) * Math.PI * 2;
  const wedge = (from, to, color) => {
    ctx.fillStyle = color;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        const d = Math.hypot(dx, dy);
        if (d > R - 2 || d < 4) continue;
        let a = Math.atan2(dy, dx);
        // minutes before midnight this pixel sits at (0 at twelve, 15 at nine)
        let mb = ((-Math.PI / 2 - a) / (Math.PI * 2)) * 60;
        mb = ((mb % 60) + 60) % 60;
        if (mb >= to && mb <= from) ctx.fillRect(x, y, 1, 1);
      }
    }
  };
  wedge(15, 0, '#e8d6a8'); // the last quarter hour, shaded
  wedge(15, Math.min(15, clock.floor), clock.finalCountdown ? '#ff5a4f' : '#c98a7a'); // above the floor: lost for good
  // hour ticks
  ctx.fillStyle = '#2a2118';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillRect(Math.round(c + Math.cos(a) * (R - 3) - 0.5), Math.round(c + Math.sin(a) * (R - 3) - 0.5), 1, 1);
  }
  // hands (pixel lines)
  const line = (a, len, color) => {
    ctx.fillStyle = color;
    for (let r = 0; r <= len; r += 0.5) ctx.fillRect(Math.round(c + Math.cos(a) * r - 0.5), Math.round(c + Math.sin(a) * r - 0.5), 1, 1);
  };
  const m = clock.minutes;
  const minuteAngle = angleFor(m);
  const hourAngle = -Math.PI / 2 - ((m / 60) * Math.PI * 2) / 12;
  line(hourAngle, 7, '#2a2118');
  const shake = clock.finalCountdown && Math.floor(t / 120) % 2 ? 0.04 : 0;
  line(minuteAngle + shake, 11, clock.minutes <= 3 ? '#ff5a4f' : '#2a2118');
  ctx.fillStyle = '#ff5a4f';
  ctx.fillRect(c - 1, c - 1, 2, 2);
}

export function createDoomClockHud({ clock, hud, before = '.view-toggle' }) {
  const box = el('div', 'hud-stat dc-hud');
  box.title = 'The Doom Clock: minutes to Midnight. The red wedge is the floor — time you can never win back.';
  box.append(el('span', 'hud-label', 'DOOM CLOCK'));
  const row = el('div', 'dc-row');
  const canvas = el('canvas', 'dc-face');
  canvas.width = S;
  canvas.height = S;
  const text = el('div', 'dc-text');
  const time = el('span', 'hud-value dc-time');
  const sub = el('span', 'dc-sub');
  text.append(time, sub);
  row.append(canvas, text);
  box.append(row);
  const anchor = hud.querySelector(before);
  if (anchor) hud.insertBefore(box, anchor);
  else hud.append(box);

  const ctx = canvas.getContext('2d');
  let lastFloor = clock.floor;
  function render(t = performance.now()) {
    const s = clock.snapshot();
    time.textContent = s.midnight ? '12:00' : s.time.slice(0, 5);
    if (s.midnight) sub.textContent = 'MIDNIGHT';
    else if (s.finalCountdown) sub.textContent = `FINAL COUNTDOWN ${s.countdownWeeks} WK${s.countdownWeeks === 1 ? '' : 'S'}`;
    else sub.textContent = `${s.minutes.toFixed(2).replace(/\.?0+$/, '')} MIN · FLOOR ${s.floor}`;
    box.dataset.zone = s.midnight || s.finalCountdown ? 'countdown' : s.minutes <= 5 ? 'danger' : s.minutes <= 10 ? 'uneasy' : 'calm';
    if (clock.floor < lastFloor) {
      box.classList.remove('dc-drop');
      void box.offsetWidth;
      box.classList.add('dc-drop');
    }
    lastFloor = clock.floor;
    drawFace(ctx, clock, t);
  }
  let raf = 0;
  const loop = (t) => { if (clock.finalCountdown) render(t); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  const offs = ['tick', 'floor', 'countdown', 'midnight'].map((k) => clock.on(k, () => render()));
  render();
  return { el: box, render, destroy() { cancelAnimationFrame(raf); offs.forEach((o) => o()); box.remove(); } };
}
