// Oligarch: owns a mine, a newspaper and several former business partners. Respects leverage only.
export default {
  id: 'oligarch_yacht_deck',
  archetype: 'oligarch',
  title: 'The man on the yacht deck',
  start: 'open',
  nodes: {
    open: {
      speaker: 'guest',
      text: '{name} does not stand up. Two large men do. "You sell bunkers. I already own three. Why do I need a fourth?"',
      choices: [
        { text: 'Because the people who built the first three know where they are.', next: 'leak', effects: { trait: 'paranoid' } },
        { text: 'You need one big enough for your whole family. Grandchildren, cousins, everyone.', next: 'family', effects: { trait: 'family' } },
        { text: "Because none of your three were built for {fear}. Mine is.", next: 'terms', effects: { fear: '$guest' } },
      ],
    },
    leak: {
      speaker: 'guest',
      text: '"Hm." He signals, and the large men sit. "The architect of the second one had an accident. Still. Builders talk."',
      choices: [
        { text: 'Ours don\'t. Separate crews, no blueprints in one place, NDAs with teeth.', next: 'terms', effects: { trait: 'ruthless', trust: 6, learn: 'paranoid' } },
        { text: 'Then let me build you something nobody else will ever see. A cellar, a vault, a private gallery.', next: 'luxury', effects: { trust: 4 } },
      ],
    },
    family: {
      speaker: 'guest',
      text: '"My family." He laughs. Nobody else does. "My family is the reason I need a bunker with one key."',
      choices: [
        { text: 'One key, then. Yours. Everyone else waits outside the blast door.', next: 'terms', effects: { trait: 'ruthless', trust: 5, learn: 'ruthless' } },
        { text: 'Understood. I\'ll leave my card with your, ah, security.', next: 'rebuffed', effects: { trust: -4 } },
      ],
    },
    luxury: {
      speaker: 'guest',
      text: '"A vault I like. And a wine cellar. Pre-war vintages. Which war, I let you choose."',
      choices: [
        { text: 'Twelve thousand bottles, a gold-plated tasting room, and a butler who has never heard of you.', next: 'won_dream', effects: { promise: 'wine_cellar', trait: 'paranoid' } },
        { text: 'And gold taps. In every bathroom. Even the ones you have the staff use.', next: 'won_dream', effects: { promise: 'gold_taps', trust: 3 } },
        { text: 'Wine is lovely. Wine is not water. I\'d put the budget into the well.', next: 'terms', effects: { trait: 'practical', trust: -2 } },
      ],
    },
    terms: {
      speaker: 'guest',
      text: '"Fine. Now tell me something I don\'t know. I do not pay for things I know."',
      choices: [
        { text: 'You have until the next quarter. After that, the price doubles and the waitlist closes.', next: 'won_hard', effects: { aggressive: true, trait: 'ruthless' } },
        { text: "Between friends? I know when {fear} starts. I may have had a hand in the schedule.", next: 'won_tip', effects: { slip: true, aggressive: true } },
        { text: 'Everyone in your circle is already moving money ahead of {otherFear}.', next: 'backfire', effects: { fear: '$other' } },
      ],
    },
    won_dream: { ending: 'sold_dream', text: '{name} is already planning the cellar party. The air handling is never discussed. It can be "value-engineered".' },
    won_hard: { ending: 'hard_close', text: '{name} pays in full, in a currency you have to look up. "I respect a man who squeezes. Do not squeeze me twice."' },
    won_tip: { ending: 'insider_tip', text: '{name} smiles for the first time. "A man who sets the schedule. We should talk more." The steward leaves very quickly.' },
    rebuffed: { ending: 'rebuffed', text: 'One of the large men walks you, politely and completely, to the gangway.' },
    backfire: { ending: 'backfire', text: '"Everyone in my circle is in prison or the sea." {name} has you put off the yacht at the next port. In a dinghy.' },
  },
};
