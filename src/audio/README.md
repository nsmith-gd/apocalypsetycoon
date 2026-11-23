# Audio: music and SFX (all synthesized with Web Audio, no files)

- `synth.js`: the voices, the management-view music ("Lobby of the Last Resort", A minor lounge chiptune) and every SFX.
  Works on any BaseAudioContext, so it plays live and renders offline.
  - Music = base layers (bass, arp, melody, light kit) + three tension layers that fade in with crisis:
    PULSE from 30 (16th hats, heartbeat kick), DRONE from 50 (detuned dissonant saws), ALARM from 75 (tritone ostinato, snare).
    Tempo rises from 92 to 120 BPM. `MUSIC.layers(crisis)` / `MUSIC.tempo(crisis)` give the mix.
  - SFX: place, sell, scheme, heatWarning, raid, runaway, leverage, boardMet, boardMiss, click; plus `midnightStinger(type)`.
- `audio.js`: `createAudio()` live engine (`start`, `setCrisis`, `play(name)`, `midnight(type)`, mute stored per browser, M key).
  `wireAudio(audio, { ledger, pushback })` hooks builds/sales/schemes (from ledger categories) and heat/runaway/leverage/board
  (from pushback) so other systems don't touch audio. `startOnFirstGesture(audio)` handles browser autoplay rules.
  `createSoundToggle(audio)` is a HUD button.
- World map / schemes: when a real crisis level exists, call `audio.setCrisis(level)` with it (today it follows world tension).
- `offline.js`: `renderMusic`, `renderSfx`, `toWav`, `loudness` for captures and QA.
- Demos: `demo/audio-demo.html` (sound desk: crisis slider, layer meters, every SFX, both stingers); the pushback and
  Midnight demos play everything in context.
