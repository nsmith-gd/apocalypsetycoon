// Story beats (#76, L0 greybox; GDD: Characters, Pacing > Signature moments, Writing voice).
// A beat fires once, keyed to play time ("0:25") and/or a condition, and is shown as a text popup that
// auto-pauses the game. More beats are data: add rows to STORY_BEATS.
//
//   const story = new StoryBeats();
//   story.due({ minutes, ...ctx })  -> beats now due (marked fired); show them one at a time
//   story.toJSON() / load()          -> fired beats survive a save

import { hm } from '../world/tracks.js';

export const STORY_BEATS = Object.freeze([
  {
    id: 'first_board_meeting', at: hm('0:25'), speaker: 'Cornelius Vane III', role: 'Chair of the board',
    title: 'FIRST BOARD MEETING',
    lines: [
      '"Q1 outlook: the world is regrettably stable."',
      '"We have reviewed the numbers. Calm worlds don\'t buy bunkers."',
      'Bryce Kettering slides a folder across the table. It is labelled MARKET ACTIVATION.',
    ],
    footer: 'Special Projects can now run its first scheme: a Leak.',
  },
  {
    id: 'iris_calls', at: hm('1:00'), speaker: 'Iris Kemp', role: 'The Ledger Review',
    title: 'IRIS KEMP CALLS FOR COMMENT',
    lines: [
      '"Iris Kemp, Ledger Review. I\'m writing about the residential shelter market."',
      '"Funny thing. Your sales go up every time the news gets worse. Would you like to comment?"',
      'Your press office says "no comment". She says she\'ll call back.',
    ],
    footer: 'The world is watching. Heat now matters.',
  },
]);

export class StoryBeats {
  constructor({ beats = STORY_BEATS } = {}) {
    this.beats = beats;
    this.fired = new Set();
  }

  /** Beats that are due now and not yet fired; marks them fired. ctx = { minutes, ... } for conditions. */
  due(ctx = {}) {
    const out = [];
    for (const b of this.beats) {
      if (this.fired.has(b.id)) continue;
      if (b.at != null && !((ctx.minutes ?? 0) >= b.at)) continue;
      if (b.when && !b.when(ctx)) continue;
      this.fired.add(b.id);
      out.push(b);
    }
    return out;
  }

  toJSON() { return { fired: [...this.fired] }; }
  load(d = {}) { this.fired = new Set(d.fired ?? []); }
}
