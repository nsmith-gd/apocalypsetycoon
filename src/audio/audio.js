// Live audio engine: music loop with a crisis-driven tension layer, SFX, mute and volume.
//
//   const audio = createAudio();
//   audio.start();                    // call from a click / key press (browser autoplay rules)
//   audio.setCrisis(tension);         // 0..100, eases the tension layers and tempo
//   audio.play('sell');               // any key of SFX in synth.js
//   await audio.midnight('failed');   // fades the music and plays the Midnight stinger
//   wireAudio(audio, { ledger, pushback })  // hooks builds / sales / schemes / heat / board for you

import { musicStep, MUSIC, SFX, midnightStinger, midnightTimes } from './synth.js';
import { settings } from '../settings/settings.js';

export { midnightTimes };

const MUTE_KEY = 'at-audio-muted';
const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export function createAudio({ volume = 0.7, AudioCtx = globalThis.AudioContext ?? globalThis.webkitAudioContext } = {}) {
  let ctx = null;
  let master, musicBus, tensionBus, sfxBus, analyser;
  let crisis = 0;
  let smoothed = 0;
  let step = 0;
  let nextTime = 0;
  let timer = null;
  let playing = false;
  let muted = storage.get(MUTE_KEY) === '1';
  const listeners = new Set();

  function ensure() {
    if (ctx || !AudioCtx) return ctx;
    ctx = new AudioCtx();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    const makeup = ctx.createGain();
    makeup.gain.value = 1.8; // compressor make-up gain
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.55;
    tensionBus = ctx.createGain();
    tensionBus.gain.value = 0.6;
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    musicBus.connect(master);
    tensionBus.connect(master);
    sfxBus.connect(master);
    master.connect(comp).connect(makeup).connect(ctx.destination);
    analyser = ctx.createAnalyser(); // read-only tap for meters / scopes
    analyser.fftSize = 1024;
    makeup.connect(analyser);
    return ctx;
  }

  function schedule() {
    // Ease the crisis so the tension layer swells rather than snapping.
    smoothed += (crisis - smoothed) * 0.08;
    const stepDur = 60 / MUSIC.tempo(smoothed) / 4;
    while (nextTime < ctx.currentTime + 0.12) {
      musicStep(ctx, { music: musicBus, tension: tensionBus }, nextTime, step, smoothed, stepDur);
      nextTime += stepDur;
      step += 1;
    }
  }

  function emit() { for (const fn of listeners) fn(api); }

  const api = {
    get ready() { return !!ctx && ctx.state === 'running'; },
    get muted() { return muted; },
    get crisis() { return crisis; },
    get playing() { return playing; },
    /** Unlocks audio and starts the music loop. Safe to call repeatedly. */
    start() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (playing) return;
      playing = true;
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setValueAtTime(0.55, ctx.currentTime);
      tensionBus.gain.setValueAtTime(0.6, ctx.currentTime);
      nextTime = ctx.currentTime + 0.05;
      timer = setInterval(schedule, 25);
      emit();
    },
    stopMusic(fade = 1.5) {
      if (!ctx || !playing) return;
      const t = ctx.currentTime;
      for (const bus of [musicBus, tensionBus]) {
        bus.gain.cancelScheduledValues(t);
        bus.gain.setValueAtTime(bus.gain.value, t);
        bus.gain.linearRampToValueAtTime(0, t + fade);
      }
      setTimeout(() => { clearInterval(timer); playing = false; emit(); }, fade * 1000);
    },
    setCrisis(level) { crisis = Math.max(0, Math.min(100, Number(level) || 0)); },
    play(name) {
      if (!ensure() || !SFX[name]) return 0;
      if (ctx.state === 'suspended') ctx.resume();
      return SFX[name](ctx, sfxBus, ctx.currentTime + 0.01);
    },
    /** Fade the music out and play the Midnight stinger. Resolves when the boom lands. */
    midnight(type = 'engineered') {
      const { boom } = midnightTimes();
      if (!ensure()) return new Promise((r) => setTimeout(r, boom * 1000));
      api.stopMusic(1.2);
      midnightStinger(ctx, sfxBus, ctx.currentTime + 0.05, type);
      return new Promise((r) => setTimeout(r, (boom + 0.05) * 1000));
    },
    setMuted(m) {
      muted = !!m;
      storage.set(MUTE_KEY, muted ? '1' : '0');
      if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05);
      emit();
    },
    toggleMute() { api.setMuted(!muted); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get context() { return ctx; },
    get analyser() { return analyser; },
  };
  return api;
}

/**
 * Hook the audio up to the game's ledger and pushback systems so nothing else needs to know
 * about sound. Returns an unsubscribe function.
 */
export function wireAudio(audio, { ledger, pushback } = {}) {
  const offs = [];
  if (ledger?.onChange) {
    offs.push(ledger.onChange((entry) => {
      if (!entry) return;
      if (entry.category === 'builds' && entry.amount < 0) audio.play('place');
      else if (entry.category === 'sales' && entry.amount > 0) audio.play('sell');
      else if (entry.category === 'schemes') audio.play('scheme');
    }));
  }
  if (pushback?.on) {
    const H = pushback.cfg.heat;
    let lastHeat = pushback.heat;
    audio.setCrisis(pushback.tension);
    offs.push(pushback.on('change', (s) => {
      audio.setCrisis(s.tension);
      // Heat warning each time heat climbs into the "watched" band or the fine line.
      for (const line of [H.investigationAt - 15, H.fineAt]) {
        if (lastHeat < line && s.heat >= line) audio.play('heatWarning');
      }
      lastHeat = s.heat;
    }));
    offs.push(pushback.on('event', (e) => {
      if (e.type === 'investigation') audio.play('heatWarning');
      else if (e.type === 'raid') audio.play('raid');
      else if (e.type === 'runaway') audio.play('runaway');
      else if (e.type === 'demand' || e.type === 'blackmail') audio.play('leverage');
      else if (e.type === 'board') audio.play('boardMiss');
    }));
  }
  return () => offs.forEach((off) => off());
}

/** Small speaker toggle for the HUD; also binds the M key. */
export function createSoundToggle(audio) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'view-btn sound-toggle';
  const render = () => {
    b.textContent = audio.muted ? 'SOUND OFF' : 'SOUND ON';
    b.title = 'Toggle sound [M]';
    b.classList.toggle('active', !audio.muted);
  };
  b.addEventListener('click', () => { audio.start(); audio.toggleMute(); });
  window.addEventListener('keydown', (e) => {
    if (settings.matches(e, 'mute')) { audio.start(); audio.toggleMute(); }
  });
  audio.onChange(render);
  render();
  return b;
}

/** Start audio on the first click or key press anywhere (browsers block autoplay). */
export function startOnFirstGesture(audio, target = window) {
  const go = () => { audio.start(); target.removeEventListener('pointerdown', go); target.removeEventListener('keydown', go); };
  target.addEventListener('pointerdown', go);
  target.addEventListener('keydown', go);
}
