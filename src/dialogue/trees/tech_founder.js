// Tech founder: wants to be uploaded, optimized and admired. Has never once thought about drinking water.
export default {
  id: 'tech_founder_upload',
  archetype: 'tech_founder',
  title: 'Disrupting extinction',
  start: 'open',
  nodes: {
    open: {
      alt: [
        { when: { suspicious: true }, text: "{name} squints at you. \"Weird. {fear} trended right before your company showed up here. Coincidence is a bad prior.\"" },
        { when: { band: 'brink' }, text: "{name} is refreshing a dashboard. \"{fear} just went {level}. My model said eighteen months. Talk fast.\"" },
      ],
      speaker: 'guest',
      text: '{name} is wearing a hoodie that costs more than your car. "Bunkers are legacy tech. I\'m planning to upload. Pitch me why I shouldn\'t."',
      choices: [
        { text: "Uploading needs a server. Servers need a building. We build the building.", next: 'vision', effects: { trait: 'futurist', learn: 'futurist' } },
        { text: "You'd be the first mind worth preserving. History needs a backup of you.", next: 'vision', effects: { trait: 'vain', trust: 4 } },
        { text: "Uploading won't help you with {fear}. Concrete will.", next: 'fear', effects: { fear: '$guest' } },
        { text: 'Think of your family. A bunker is a place to raise them.', next: 'bored', effects: { trait: 'family' } },
      ],
    },
    vision: {
      speaker: 'guest',
      text: '"Okay, I\'m listening. But it has to be iconic. I want a cryo pod, an AI butler, and a keynote stage. Underground."',
      choices: [
        { text: 'Cryo pod, AI butler, and a stage with perfect acoustics for when the survivors need inspiring.', next: 'won_dream', effects: { promise: 'cryo_pod', trait: 'vain' } },
        { text: "Done. And the butler runs on our own grid, so it's still talking when the internet isn't.", next: 'won_dream', effects: { promise: 'ai_butler', trait: 'futurist' } },
        { text: 'Sure. Quick question first: how many litres of water does a keynote drink a day?', next: 'basics', effects: { trait: 'practical', trust: -2 } },
      ],
    },
    basics: {
      speaker: 'guest',
      text: '"Water is a solved problem. I\'ll have a drone bring it." {name} looks genuinely puzzled. "Who would I even ask for water?"',
      choices: [
        { text: 'The air scrubber. The well. The hydroponics bay. Boring things that keep geniuses alive.', next: 'fear', effects: { trust: 6 } },
        { text: "Nobody, after Midnight. The drones won't be flying.", next: 'won_tip', effects: { slip: true, aggressive: true } },
        { text: 'You\'re right. Forget I asked. Let\'s talk about the pod.', next: 'won_dream', effects: { promise: 'cryo_pod' } },
      ],
    },
    fear: {
      speaker: 'guest',
      text: '"I\'ve modelled {fear}. Ninety-something percent. My board says I\'m catastrophizing. My board is in Lisbon."',
      choices: [
        { text: 'Your board will be in Lisbon when it hits. You can be under four metres of granite.', next: 'won_fear', effects: { fear: '$guest', trust: 6 } },
        { text: 'Your model is right. Ours just runs a little ahead of yours.', next: 'won_tip', effects: { slip: true } },
        { text: "Honestly, I'd worry more about {otherFear}.", next: 'bored', effects: { fear: '$other' } },
        { when: { headline: true }, text: 'You saw {headline}. Your model is running behind the news now.', next: 'won_fear', effects: { fear: '$guest', trust: 4 } },
      ],
    },
    bored: {
      speaker: 'guest',
      text: '{name} is already checking a smartwatch. "This feels very... analog."',
      choices: [
        { text: 'Analog survives. Take my card. Paper, also very analog.', next: 'exit', effects: { trust: 2 } },
        { text: "Analog is what's left when your servers melt. Sign now or swim later.", next: 'rebuffed', effects: { aggressive: true } },
      ],
    },
    won_dream: { ending: 'sold_dream', text: '{name} is already sketching the keynote stage on a napkin. Nobody mentions the air scrubbers.' },
    won_fear: { ending: 'sold_fear', text: '"Send me the spec sheet. I\'ll have my AI read it." {name} pockets your card.' },
    won_tip: { ending: 'insider_tip', text: '{name} stops blinking. "Ahead how far?" A deposit is wired before dessert.' },
    exit: { ending: 'polite_exit', text: '{name} photographs your card instead of taking it.' },
    rebuffed: { ending: 'rebuffed', text: '"I don\'t do fear-based products." {name} leaves to invest in a fear-based product.' },
  },
};
