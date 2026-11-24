// Oil heir: third generation, first idea. Wants the bunker to look like the yacht. Would die for the décor.
export default {
  id: 'oil_heir_wine',
  archetype: 'oil_heir',
  title: 'The heir to the well',
  start: 'open',
  nodes: {
    open: {
      speaker: 'guest',
      text: '{name} waves a glass of something older than you. "Daddy built refineries. I build vibes. Does your bunker have a helipad? Mine has to have a helipad."',
      choices: [
        { text: 'A helipad, a cinema and a spa. The end of the world, but make it a lifestyle.', next: 'dream', effects: { trait: 'vain', learn: 'vain' } },
        { text: 'Your family name deserves to outlive {fear}. All of it. The whole dynasty.', next: 'family', effects: { fear: '$guest', trait: 'family' } },
        { text: 'Helipads are a target. Have you priced a sensible air filtration system?', next: 'bored', effects: { trait: 'practical' } },
      ],
    },
    dream: {
      speaker: 'guest',
      text: '"A cinema. Okay. But will it be, like, nicer than my cousin Tad\'s? Tad has a bowling alley in his."',
      choices: [
        { text: 'Gold taps in every bathroom. Tad has chrome. Tad will hear about it.', next: 'won_dream', effects: { promise: 'gold_taps', trait: 'vain', trust: 6 } },
        { text: 'Forty-seat cinema, IMAX, your face on the curtain. Tad bowls alone.', next: 'won_dream', effects: { promise: 'cinema', trait: 'vain' } },
        { text: 'Honestly? Nicer matters less than ninety days of clean water.', next: 'bored', effects: { trait: 'practical', trust: -4 } },
      ],
    },
    family: {
      speaker: 'guest',
      text: '"The dynasty. Yeah. My kids, my ex\'s kids, my nanny\'s kids, technically. How many people fit? Like, comfortably?"',
      choices: [
        { text: "Twelve, comfortably. Eight if the air has to last. We'll call it twelve.", next: 'dream', effects: { trait: 'family', trust: 5 } },
        { text: 'Sign today and I hold the last family suite at this price. Tomorrow it goes to Tad.', next: 'won_hard', effects: { aggressive: true } },
        { text: "Between us, {fear} isn't a maybe. Your father's old friends are already digging.", next: 'spooked', effects: { slip: true } },
      ],
    },
    bored: {
      speaker: 'guest',
      text: '{name} stares at you like you just served tap water. "Filtration. Wow. Do you also do, like, spreadsheets?"',
      choices: [
        { text: 'Kidding. Let me tell you about the infinity pool. It has a DJ booth.', next: 'won_dream', effects: { promise: 'infinity_pool', trait: 'vain', trust: -2 } },
        { text: "I'll leave you my card. It's gold-leafed.", next: 'exit', effects: { trust: 2 } },
      ],
    },
    spooked: {
      speaker: 'guest',
      text: '"Wait. You know something? Daddy said never trust a man who knows things." {name} glances at the security detail.',
      choices: [
        { text: 'I know marble prices. Relax. Ask me about the wine cellar.', next: 'won_dream', effects: { promise: 'wine_cellar', trust: 4 } },
        { text: 'I know your father bought in last spring. He forgot to mention you.', next: 'rebuffed', effects: { aggressive: true, trait: 'ruthless' } },
      ],
    },
    won_dream: { ending: 'sold_dream', text: '{name} signs on a cocktail napkin. "Tell Tad nothing." Nobody mentions the air.' },
    won_hard: { ending: 'hard_close', text: '{name} wires a deposit from a phone shaped like a lighter. "Tad can live in a tent."' },
    exit: { ending: 'polite_exit', text: '{name} pockets your card, then hands it to a waiter by mistake.' },
    rebuffed: { ending: 'rebuffed', text: '"Daddy\'s lawyers will want a word." {name} drifts off toward the champagne tower.' },
  },
};
