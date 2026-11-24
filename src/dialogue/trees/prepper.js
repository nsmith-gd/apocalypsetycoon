// Billionaire prepper: reads the spec sheet. The one guest who asks about air, water and food.
export default {
  id: 'prepper_jerky',
  archetype: 'prepper',
  title: 'The man with the jerky',
  start: 'open',
  nodes: {
    open: {
      alt: [
        { when: { suspicious: true }, text: "{name} taps a folded newspaper: {headline}. \"Funny. Every time this happens, your people are already at the party.\"" },
        { when: { band: 'boil' }, text: "{name} hasn't touched the jerky. \"{fear} is {level}. I don't need the brochure. I need a date.\"" },
      ],
      speaker: 'guest',
      text: "{name} sizes you up over a paper plate of jerky. \"Last Resort. You're the gold-tap people. I've seen the brochures.\"",
      choices: [
        { text: 'The gold taps are for the brochures. Ask me about the air scrubbers.', next: 'spec', effects: { trait: 'practical' } },
        { text: "You're worried about {fear}. Of course you are. That's why you're here.", next: 'fear', effects: { fear: '$guest' } },
        { text: "Everyone's losing sleep over {otherFear} this season.", next: 'doubt', effects: { fear: '$other' } },
        { when: { band: 'boil' }, text: 'You read the news. {fear} is {level}. I can have crews digging on Monday.', next: 'won_fear', effects: { fear: '$guest', trust: 4 } },
      ],
    },
    spec: {
      speaker: 'guest',
      text: '"Fine. Military scrubbers or cheap vents? How many days sealed? Don\'t round up."',
      choices: [
        { text: 'Ninety days sealed. Scrubbers, a deep well, hydroponics. I\'ll put it in the contract.', next: 'won_fear', effects: { trust: 10, promise: 'mil_scrubber', learn: 'practical' } },
        { text: "Most clients never ask. Yours will be the one that actually works.", next: 'won_fear', effects: { trait: 'paranoid' } },
        { text: 'Days sealed is a number for accountants. Feel this marble sample instead.', next: 'rebuffed', effects: { trait: 'vain' } },
      ],
    },
    fear: {
      speaker: 'guest',
      text: '"Everyone says they\'re ready. Nobody is. What do you know that the news doesn\'t?"',
      choices: [
        { text: "Nothing the news won't say by spring. Which is why you sign by winter.", next: 'won_hard', effects: { aggressive: true } },
        { text: 'Between us? We see the numbers early. You have months, not years.', next: 'won_tip', effects: { slip: true, trust: 5 } },
        { text: "I know how deep the granite goes under the Heartland. That's all I know.", next: 'spec', effects: { trait: 'practical', trust: 4 } },
      ],
    },
    doubt: {
      speaker: 'guest',
      text: '"{otherFear}? That\'s tabloid stuff. You sound like DoomWatch Live."',
      choices: [
        { text: 'Fair. Then tell me what actually keeps you up at night.', next: 'fear', effects: { trust: 4 } },
        { text: "Read the forums. You're already late, and you know it.", next: 'backfire', effects: { aggressive: true } },
      ],
    },
    won_fear: { ending: 'sold_fear', text: '{name} folds your card into a ziplock bag. "Send me the air numbers. The real ones."' },
    won_hard: { ending: 'hard_close', text: '{name} hands over a deposit with a look that says this conversation is not forgotten.' },
    won_tip: { ending: 'insider_tip', text: '{name} goes pale, then reaches for a pen. Over by the bar, someone stops talking.' },
    rebuffed: { ending: 'rebuffed', text: '"Marble." {name} walks off to look at water filters.' },
    backfire: { ending: 'backfire', text: '"Salesmen like you are WHY I have a bunker." Heads turn across the expo hall.' },
  },
};
