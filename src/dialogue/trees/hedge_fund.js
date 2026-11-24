// Hedge-fund manager: believes nothing, prices everything, and wants to know your downside.
export default {
  id: 'hedge_fund_shortposition',
  archetype: 'hedge_fund',
  title: 'Short the world',
  start: 'open',
  nodes: {
    open: {
      alt: [
        { when: { suspicious: true }, text: "{name} has a terminal open. \"Bunker demand spikes the same week {fear} gets a shove. Every time. Want to explain that correlation?\"" },
        { when: { band: 'brink' }, text: "\"{fear} is {level} and my risk desk is crying.\" {name} checks a watch. \"Fine. Thirty seconds.\"" },
      ],
      speaker: 'guest',
      text: '{name} doesn\'t shake your hand. "Bunkers. The most overpriced asset class since tulips. Convince me in thirty seconds."',
      choices: [
        { text: "I won't. Here's the spec sheet. Days sealed, litres per head, calories per square metre.", next: 'numbers', effects: { trait: 'skeptic', learn: 'skeptic' } },
        { text: "It's not an asset, it's a hedge. Your whole book goes to zero with {fear}. This doesn't.", next: 'hedge', effects: { fear: '$guest' } },
        { text: 'Gold taps, a cinema and a wine cellar. You deserve it.', next: 'scoff', effects: { trait: 'vain' } },
        { when: { suspicious: true }, text: "Correlation isn't causation. But if you can see the pattern, you're already late to the trade.", next: 'hedge', effects: { aggressive: true, trait: 'gambler' } },
      ],
    },
    numbers: {
      speaker: 'guest',
      text: '{name} reads the whole thing. Twice. "Your water numbers are real. Your marble numbers are insane. Why sell both?"',
      choices: [
        { text: 'The marble pays for the water. You only buy the water.', next: 'won_fear', effects: { trust: 8, trait: 'skeptic' } },
        { text: "Because rich people buy marble. You're not rich people, you're a counterparty.", next: 'hedge', effects: { trait: 'gambler', trust: 4 } },
        { when: { bandBelow: 'simmer' }, text: "Nobody is pricing {fear} yet. That's why it's cheap today.", next: 'won_fear', effects: { trait: 'gambler', trust: 4 } },
      ],
    },
    hedge: {
      speaker: 'guest',
      text: '"Fine. Say I price in {fear}. What\'s my edge? Everyone in this room will be bidding on the same concrete."',
      choices: [
        { text: 'Your edge is you sign before they do. Prices reset Monday. Today is Friday.', next: 'won_hard', effects: { aggressive: true, trait: 'gambler' } },
        { text: "Your edge is that I know the timeline. Not a guess. A timeline.", next: 'won_tip', effects: { slip: true, aggressive: true } },
        { text: 'Your edge is the scrubbers. Most of these people buy a cinema and forget to breathe.', next: 'won_fear', effects: { fear: '$guest', trust: 4 } },
        { text: "Honestly, I'd price in {otherFear} first.", next: 'rebuffed', effects: { fear: '$other' } },
      ],
    },
    scoff: {
      speaker: 'guest',
      text: '"That\'s retail talk." {name} is already looking past you for someone with a better pitch.',
      choices: [
        { text: "Fair. Then let's skip the brochure. What's the scenario you can't hedge?", next: 'hedge', effects: { trust: 4 } },
        { text: "Retail will be underground. You'll be on the surface, explaining your Sharpe ratio to {fear}.", next: 'backfire', effects: { aggressive: true, slip: true } },
        { text: 'Then I wish you luck with the tulips.', next: 'rebuffed', effects: { trust: -4 } },
      ],
    },
    won_fear: { ending: 'sold_fear', text: '"Send me the term sheet. Water clause on page one." {name} has already done the math.' },
    won_hard: { ending: 'hard_close', text: '{name} signs with the expression of a man who will be reviewing this trade later. Hard.' },
    won_tip: { ending: 'insider_tip', text: '{name} quietly texts a trading desk. Somewhere, a market twitches. Somewhere else, a journalist notices.' },
    rebuffed: { ending: 'rebuffed', text: '"Pass." {name} turns away to short something.' },
    backfire: { ending: 'backfire', text: '"Did you just threaten me with {fear}?" {name} says it loudly. Compliance-officer loudly.' },
  },
};
