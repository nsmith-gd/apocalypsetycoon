// Procedural chiptune voices, the management-view music and every SFX.
// Everything here takes a BaseAudioContext, so the same code plays live (AudioContext) and renders
// clips offline (OfflineAudioContext) for captures and tests. No audio files.

const noiseCache = new WeakMap();
function noiseBuffer(ctx) {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = b.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    noiseCache.set(ctx, b);
  }
  return b;
}

export const midi = (n) => 440 * 2 ** ((n - 69) / 12);

/** One enveloped oscillator note. */
export function tone(ctx, dest, t, { freq, to, type = 'square', dur = 0.2, gain = 0.2, attack = 0.005, release, detune = 0, filter, q = 1, vibrato }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  o.detune.value = detune;
  const g = ctx.createGain();
  const rel = release ?? dur;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + rel);
  let node = o;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter.type ?? 'lowpass';
    f.frequency.setValueAtTime(filter.freq, t);
    if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t + dur);
    f.Q.value = q;
    node.connect(f);
    node = f;
  }
  if (vibrato) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = vibrato.rate;
    lg.gain.value = vibrato.depth;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + attack + rel + 0.05);
  }
  node.connect(g).connect(dest);
  o.start(t);
  o.stop(t + attack + rel + 0.05);
}

/** A burst of filtered noise (drums, dirt, shimmer). */
export function noise(ctx, dest, t, { dur = 0.1, gain = 0.2, type = 'highpass', freq = 6000, to, q = 0.7 }) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(dest);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

const kick = (ctx, d, t, gain = 0.5) => tone(ctx, d, t, { freq: 150, to: 40, type: 'sine', dur: 0.18, gain });
const hat = (ctx, d, t, gain = 0.05) => noise(ctx, d, t, { dur: 0.04, gain, freq: 8000 });
const snare = (ctx, d, t, gain = 0.18) => {
  noise(ctx, d, t, { dur: 0.14, gain, type: 'bandpass', freq: 1800, q: 0.8 });
  tone(ctx, d, t, { freq: 220, to: 120, type: 'triangle', dur: 0.08, gain: gain * 0.6 });
};

// ---------------------------------------------------------------------------------------------
// Music: "Lobby of the Last Resort" — lounge chiptune in A minor for the management view.
// Base layers always play. Three tension layers fade in with the crisis level (0-100), and the
// tempo creeps up from 92 to 120 BPM as the world gets worse.
// ---------------------------------------------------------------------------------------------

// Am – F – C – E, one bar each (semitones above A2 = MIDI 45).
const CHORDS = [
  { root: 45, tones: [0, 3, 7] }, // Am
  { root: 41, tones: [0, 4, 7] }, // F
  { root: 48, tones: [0, 4, 7] }, // C
  { root: 40, tones: [0, 4, 7, 10] }, // E7
];
// Lounge melody, one entry per 8th note across the 4 bars (MIDI, null = rest).
const MELODY = [
  76, null, 72, 74, 76, null, null, 79,
  77, null, 76, 74, 72, null, null, null,
  76, null, 79, 81, 79, null, 76, 74,
  71, null, 74, 76, 80, null, null, null,
];

export const MUSIC = Object.freeze({
  bars: CHORDS.length,
  stepsPerBar: 16,
  tempo: (crisis) => 92 + Math.max(0, Math.min(100, crisis)) * 0.28,
  /** 0..1 loudness of each tension layer at a crisis level. */
  layers: (crisis) => ({
    pulse: clamp01((crisis - 30) / 25), // driving 16th hats + offbeat heartbeat kick
    drone: clamp01((crisis - 50) / 25), // detuned, dissonant saw drone
    alarm: clamp01((crisis - 75) / 15), // tritone alarm ostinato + snare
  }),
});
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

/**
 * Schedule one 16th-note step of the music.
 * @param step  absolute step counter (wraps over the 4-bar loop)
 * @param crisis 0..100
 * @param dests  { music, tension } gain nodes
 */
export function musicStep(ctx, dests, t, step, crisis, stepDur) {
  const { music, tension } = dests;
  const s = step % (MUSIC.bars * MUSIC.stepsPerBar);
  const bar = Math.floor(s / MUSIC.stepsPerBar);
  const beat = s % MUSIC.stepsPerBar;
  const ch = CHORDS[bar];
  const L = MUSIC.layers(crisis);

  // --- base: bass, arp, melody, light kit ---
  if ([0, 6, 8, 14].includes(beat)) {
    tone(ctx, music, t, { freq: midi(ch.root - 12 + (beat === 14 ? 7 : 0)), type: 'triangle', dur: stepDur * 1.8, gain: 0.28 });
  }
  const arpTone = ch.tones[[0, 1, 2, 1][beat % 4] % ch.tones.length];
  tone(ctx, music, t, { freq: midi(ch.root + 12 + arpTone), type: 'square', dur: stepDur * 0.9, gain: 0.035, filter: { freq: 1400 + crisis * 20 } });
  if (beat % 2 === 0) {
    const m = MELODY[bar * 8 + beat / 2];
    if (m) tone(ctx, music, t, { freq: midi(m), type: 'sine', dur: stepDur * 3, gain: 0.11, vibrato: { rate: 5, depth: 3 } });
  }
  if (beat === 0 || beat === 8) kick(ctx, music, t, 0.35);
  if (beat % 4 === 2) hat(ctx, music, t, 0.03);

  // --- tension layers ---
  if (L.pulse > 0) {
    hat(ctx, tension, t, 0.07 * L.pulse * (beat % 2 ? 0.6 : 1));
    if (beat === 4 || beat === 12 || beat === 7) kick(ctx, tension, t, 0.45 * L.pulse);
  }
  if (L.drone > 0 && beat === 0) {
    const barDur = stepDur * MUSIC.stepsPerBar;
    for (const [semi, det] of [[0, -9], [1, 7], [12, 4]]) {
      tone(ctx, tension, t, {
        freq: midi(ch.root - 12 + semi), type: 'sawtooth', dur: barDur, attack: barDur * 0.3, release: barDur * 0.75,
        gain: 0.085 * L.drone, detune: det, filter: { freq: 300 + L.drone * 900 }, vibrato: { rate: 3 + L.drone * 4, depth: 2 },
      });
    }
  }
  if (L.alarm > 0) {
    if (beat % 2 === 0) {
      const n = ch.root + 24 + (beat % 4 === 0 ? 0 : 6); // root / tritone
      tone(ctx, tension, t, { freq: midi(n), type: 'square', dur: stepDur * 0.7, gain: 0.07 * L.alarm, filter: { type: 'bandpass', freq: 1800 }, q: 3 });
    }
    if (beat === 4 || beat === 12) snare(ctx, tension, t, 0.24 * L.alarm);
  }
}

// ---------------------------------------------------------------------------------------------
// SFX. Each returns its length in seconds.
// ---------------------------------------------------------------------------------------------
export const SFX = {
  /** A room drops into the shelter grid: dirt thunk and a bolt click. */
  place(ctx, d, t) {
    tone(ctx, d, t, { freq: 140, to: 45, type: 'sine', dur: 0.16, gain: 0.6 });
    noise(ctx, d, t, { dur: 0.12, gain: 0.25, type: 'lowpass', freq: 900, to: 200 });
    tone(ctx, d, t + 0.09, { freq: 1600, type: 'square', dur: 0.02, gain: 0.08 });
    tone(ctx, d, t + 0.12, { freq: 1200, type: 'square', dur: 0.02, gain: 0.06 });
    return 0.3;
  },
  /** A shelter sells: register drawer and climbing coins. */
  sell(ctx, d, t) {
    noise(ctx, d, t, { dur: 0.08, gain: 0.2, type: 'bandpass', freq: 3000, q: 2 });
    tone(ctx, d, t, { freq: midi(88), type: 'square', dur: 0.08, gain: 0.12 });
    tone(ctx, d, t + 0.07, { freq: midi(95), type: 'square', dur: 0.3, gain: 0.12 });
    [84, 88, 91, 96].forEach((n, i) => tone(ctx, d, t + 0.16 + i * 0.06, { freq: midi(n), type: 'triangle', dur: 0.25, gain: 0.14 }));
    noise(ctx, d, t + 0.16, { dur: 0.4, gain: 0.05, freq: 9000 });
    return 0.7;
  },
  /** A scheme fires: a sinking resonant swoop and a diminished stab. */
  scheme(ctx, d, t) {
    tone(ctx, d, t, { freq: 520, to: 70, type: 'sawtooth', dur: 0.7, gain: 0.18, filter: { freq: 2400, to: 300 }, q: 8 });
    [45, 48, 51, 54].forEach((n) => tone(ctx, d, t + 0.18, { freq: midi(n), type: 'square', dur: 0.55, gain: 0.05, filter: { freq: 900 } }));
    kick(ctx, d, t + 0.18, 0.4);
    return 0.9;
  },
  /** Heat crosses a warning line: two-tone siren. */
  heatWarning(ctx, d, t) {
    for (let i = 0; i < 4; i++) {
      tone(ctx, d, t + i * 0.2, { freq: i % 2 ? 660 : 880, type: 'square', dur: 0.18, gain: 0.2, filter: { type: 'bandpass', freq: 900 }, q: 2 });
    }
    return 0.85;
  },
  /** Heat maxed: raid. Fast siren over a heavy hit. */
  raid(ctx, d, t) {
    kick(ctx, d, t, 0.7);
    noise(ctx, d, t, { dur: 0.5, gain: 0.25, type: 'lowpass', freq: 1500, to: 100 });
    for (let i = 0; i < 8; i++) tone(ctx, d, t + 0.05 + i * 0.11, { freq: i % 2 ? 700 : 1000, type: 'square', dur: 0.1, gain: 0.08 });
    return 1.0;
  },
  /** Runaway crisis: rising alarm into a boom. */
  runaway(ctx, d, t) {
    tone(ctx, d, t, { freq: 200, to: 1600, type: 'sawtooth', dur: 0.8, gain: 0.12, filter: { freq: 3000 } });
    kick(ctx, d, t + 0.8, 0.8);
    noise(ctx, d, t + 0.8, { dur: 1.2, gain: 0.35, type: 'lowpass', freq: 2000, to: 60 });
    return 2.0;
  },
  /** Client demand / blackmail: an "uh-oh" two-note. */
  leverage(ctx, d, t) {
    tone(ctx, d, t, { freq: midi(70), type: 'square', dur: 0.15, gain: 0.14, filter: { freq: 2000 } });
    tone(ctx, d, t + 0.16, { freq: midi(64), type: 'square', dur: 0.35, gain: 0.14, filter: { freq: 1600 }, vibrato: { rate: 7, depth: 6 } });
    return 0.55;
  },
  /** Board target missed: the sad trombone. */
  boardMiss(ctx, d, t) {
    [[58, 0.25], [57, 0.25], [56, 0.25], [55, 0.9]].forEach(([n, len], i) => {
      tone(ctx, d, t + i * 0.27, { freq: midi(n), type: 'sawtooth', dur: len, gain: 0.18, filter: { freq: 900 }, vibrato: i === 3 ? { rate: 6, depth: 4 } : undefined });
    });
    return 1.8;
  },
  /** Board target met: brass hit. */
  boardMet(ctx, d, t) {
    [[60, 64, 67], [65, 69, 72]].forEach((ch, i) => ch.forEach((n) => tone(ctx, d, t + i * 0.14, { freq: midi(n), type: 'square', dur: i ? 0.5 : 0.12, gain: 0.1, filter: { freq: 2500 } })));
    return 0.7;
  },
  /** UI blip. */
  click(ctx, d, t) {
    tone(ctx, d, t, { freq: 1800, type: 'square', dur: 0.03, gain: 0.05 });
    return 0.05;
  },
};

/** When each of the twelve tolls and the final boom land, in seconds after the stinger starts. */
export function midnightTimes() {
  const tolls = [];
  let tt = 2;
  for (let i = 0; i < 12; i++) {
    tolls.push(tt);
    tt += Math.max(0.12, 0.42 - i * 0.03);
  }
  return { tolls, boom: tolls[11] + 0.6 };
}

/** The Midnight stinger: clock ticks, twelve fast tolls, then the end of the world. */
export function midnightStinger(ctx, d, t, type = 'engineered') {
  const failed = type === 'failed';
  // ticking clock
  for (let i = 0; i < 4; i++) tone(ctx, d, t + i * 0.5, { freq: i % 2 ? 1900 : 2300, type: 'square', dur: 0.02, gain: 0.08 });
  // twelve bell tolls, accelerating
  const times = midnightTimes();
  times.tolls.forEach((at, i) => bell(ctx, d, t + at, failed ? midi(45) : midi(57), i === 11 ? 3.5 : 1.2, i === 11 ? 0.35 : 0.18, failed));
  const hit = t + times.boom;
  // the event
  kick(ctx, d, hit, 0.9);
  noise(ctx, d, hit, { dur: failed ? 4 : 3, gain: failed ? 0.5 : 0.35, type: 'lowpass', freq: failed ? 3000 : 1200, to: 40 });
  tone(ctx, d, hit, { freq: 55, to: 30, type: 'sine', dur: 3, gain: 0.6 });
  if (failed) {
    // chaos: detuned screaming saws
    [0, 1, 6].forEach((semi, i) => tone(ctx, d, hit + 0.2, { freq: midi(57 + semi), to: midi(45 + semi), type: 'sawtooth', dur: 3, gain: 0.06, detune: i * 13, filter: { freq: 2000, to: 200 } }));
  } else {
    // a calm, chilling choir: the end, on schedule
    [57, 60, 64, 69].forEach((n) => tone(ctx, d, hit + 0.8, { freq: midi(n), type: 'triangle', dur: 4, attack: 1.2, release: 3, gain: 0.07, vibrato: { rate: 4, depth: 2 } }));
  }
  return hit - t + 5;
}

function bell(ctx, d, t, f, dur, gain, harsh) {
  // inharmonic partials make it ring like a bell
  const partials = harsh ? [1, 2.01, 2.76, 4.07, 5.43] : [1, 2, 2.76, 5.4];
  partials.forEach((p, i) => tone(ctx, d, t, { freq: f * p, type: 'sine', dur, attack: 0.002, release: dur / (1 + i * 0.6), gain: gain / (1 + i) }));
}
