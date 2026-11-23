// Render music and SFX offline (OfflineAudioContext) to WAV, for captures, QA and tests.

import { musicStep, MUSIC, SFX, midnightStinger } from './synth.js';

const RATE = 44100;

/** Music for `seconds`, with crisis following `crisisAt(t)` (seconds -> 0..100). */
export async function renderMusic(seconds, crisisAt = () => 0) {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * RATE), RATE);
  const music = ctx.createGain();
  music.gain.value = 0.55;
  const tension = ctx.createGain();
  tension.gain.value = 0.6;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  const makeup = ctx.createGain();
  makeup.gain.value = 1.8;
  music.connect(comp);
  tension.connect(comp);
  comp.connect(makeup).connect(ctx.destination);
  let t = 0.02;
  let step = 0;
  while (t < seconds - 0.5) {
    const c = crisisAt(t);
    const stepDur = 60 / MUSIC.tempo(c) / 4;
    musicStep(ctx, { music, tension }, t, step++, c, stepDur);
    t += stepDur;
  }
  return ctx.startRendering();
}

/** One SFX (or 'midnight-engineered' / 'midnight-failed') with a little tail. */
export async function renderSfx(name) {
  const isMidnight = name.startsWith('midnight');
  const len = isMidnight ? 13 : 2.2;
  const ctx = new OfflineAudioContext(1, Math.ceil(len * RATE), RATE);
  const out = ctx.createGain();
  out.gain.value = 0.9;
  out.connect(ctx.destination);
  if (isMidnight) midnightStinger(ctx, out, 0.05, name.endsWith('failed') ? 'failed' : 'engineered');
  else SFX[name](ctx, out, 0.05);
  return ctx.startRendering();
}

/** 16-bit mono WAV bytes from an AudioBuffer. */
export function toWav(buffer) {
  const data = buffer.getChannelData(0);
  const bytes = new ArrayBuffer(44 + data.length * 2);
  const v = new DataView(bytes);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + data.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, buffer.sampleRate, true); v.setUint32(28, buffer.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 0x7fff, true);
  return new Uint8Array(bytes);
}

/** RMS loudness per window, for meters and tests. */
export function loudness(buffer, windowSec = 0.5) {
  const d = buffer.getChannelData(0);
  const w = Math.floor(windowSec * buffer.sampleRate);
  const out = [];
  for (let i = 0; i + w <= d.length; i += w) {
    let s = 0;
    for (let j = i; j < i + w; j++) s += d[j] * d[j];
    out.push(Math.sqrt(s / w));
  }
  return out;
}
