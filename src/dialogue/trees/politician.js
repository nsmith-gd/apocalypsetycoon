// Politician: publicly reassuring the nation, privately pricing concrete. Never says yes on the record.
export default {
  id: 'politician_offrecord',
  archetype: 'politician',
  title: 'Off the record',
  start: 'open',
  nodes: {
    open: {
      speaker: 'guest',
      text: '{name} smiles for a passing camera, then turns away from it. "Lovely speech, wasn\'t it? I said there\'s no cause for alarm. So. How alarmed should I be?"',
      choices: [
        { text: 'Officially? Not at all. Unofficially, about {fear}? Alarmed enough to call me.', next: 'private', effects: { fear: '$guest', trait: 'discreet', learn: 'discreet' } },
        { text: 'The voters will look after themselves. You need to look after you.', next: 'cold', effects: { trait: 'ruthless' } },
        { text: 'Think of your family. Your wife, the kids, the dog from the campaign ads.', next: 'cold', effects: { trait: 'family', trust: -2 } },
      ],
    },
    private: {
      speaker: 'guest',
      text: '"Calling you would leave a record." {name} pretends to admire a canapé. "Suppose a friend of a friend wanted a place. Unlisted. Who else would know?"',
      choices: [
        { text: 'Nobody. Shell company, separate site, no neighbours who vote. Air, water, food for a year.', next: 'won_fear', effects: { trait: 'discreet', trust: 8 } },
        { text: "The committee you chair votes on {fear} preparedness next month. I'd vote late.", next: 'won_tip', effects: { slip: true, aggressive: true } },
        { text: 'Three of your colleagues have already bought. One of them is your opponent.', next: 'won_hard', effects: { aggressive: true, trait: 'ruthless' } },
      ],
    },
    cold: {
      speaker: 'guest',
      text: '"I\'m sorry, are you a constituent?" The smile stays. The eyes leave. "My office has a public form for concerns."',
      choices: [
        { text: 'Not a constituent. A solution. One that never appears in a disclosure filing.', next: 'private', effects: { trait: 'discreet', trust: 4 } },
        { text: 'Of course, I understand. Your office has my card.', next: 'exit', effects: { trust: 2 } },
        { text: 'I could fill in that form. Mention the bunker your chief of staff already toured.', next: 'backfire', effects: { aggressive: true, slip: true } },
      ],
    },
    won_fear: { ending: 'sold_fear', text: '{name} shakes your hand for the cameras. Your palm comes away with a phone number written on it.' },
    won_tip: { ending: 'insider_tip', text: '{name} laughs a little too loudly. "Ha! Good one." Then, quietly: "Monday. My other phone."' },
    won_hard: { ending: 'hard_close', text: '"The opponent? Get me the bigger one." {name} has never been so decisive in public life.' },
    exit: { ending: 'polite_exit', text: '{name} pivots to a donor mid-sentence. You are already a forgotten talking point.' },
    backfire: { ending: 'backfire', text: '"Security?" {name} says it warmly, the way you say it on television. A columnist is taking notes.' },
  },
};
