// Celebrity: needs the apocalypse to have good lighting. Loves the kids, mostly on camera.
export default {
  id: 'celebrity_closeup',
  archetype: 'celebrity',
  title: 'Ready for my close-up',
  start: 'open',
  nodes: {
    open: {
      speaker: 'guest',
      text: '{name} poses for a photo you did not ask to take. "Oh, you\'re the bunker person! Is it true they\'re, like, the new Malibu?"',
      choices: [
        { text: 'The new Malibu, but the paparazzi literally cannot get in.', next: 'dream', effects: { trait: 'vain', learn: 'vain' } },
        { text: "It's somewhere the kids are safe. Whatever happens.", next: 'kids', effects: { trait: 'family' } },
        { text: 'Let me talk you through scrubber throughput and caloric reserves.', next: 'glazed', effects: { trait: 'practical' } },
      ],
    },
    dream: {
      speaker: 'guest',
      text: '"I need a screening room. And a glam room. And a ring light that works without the grid. Is that... crazy?"',
      choices: [
        { text: 'Twenty-seat cinema, gold taps in the glam room, and lighting designed by the people who light you now.', next: 'won_dream', effects: { promise: 'cinema', trait: 'vain' } },
        { text: 'Not crazy. A wine cellar too, for the premiere nobody else survives to attend.', next: 'won_dream', effects: { promise: 'wine_cellar', trust: 4 } },
        { text: 'The ring light runs off the same power as the air. You might have to pick one.', next: 'kids', effects: { trust: -2 } },
      ],
    },
    kids: {
      speaker: 'guest',
      text: '{name} goes quiet, for once. "The twins have nightmares about {fear}. I tell them it\'s a movie. Is it a movie?"',
      choices: [
        { text: "It's not a movie. But in our shelters, they'd sleep through it. Three years of air, water, food.", next: 'won_fear', effects: { fear: '$guest', trait: 'family', trust: 6 } },
        { text: 'Between us, the studios will be shooting the documentary by next year.', next: 'leak', effects: { slip: true } },
        { text: 'Forget {fear}. {otherFear} is the one you should be scaring them with.', next: 'glazed', effects: { fear: '$other', aggressive: true } },
      ],
    },
    leak: {
      speaker: 'guest',
      text: '"Wait. You KNOW something?" {name}\'s publicist materializes at a distance that suggests they heard every word.',
      choices: [
        { text: "I know a shelter has a waiting list, and you're at the top of it. If you sign tonight.", next: 'won_fear', effects: { aggressive: true, fear: '$guest' } },
        { text: 'I know nothing. Lovely to meet you. Enjoy the gala.', next: 'exit', effects: { trust: -2 } },
      ],
    },
    glazed: {
      speaker: 'guest',
      text: '{name}\'s smile does not move, which is how you know they have left the conversation. "Totally. Love that. So intense."',
      choices: [
        { text: 'Let me send something to your team. It has photos.', next: 'exit', effects: { trust: 2 } },
        { text: "You'll want it when it's too late. They all do.", next: 'rebuffed', effects: { aggressive: true } },
      ],
    },
    won_dream: { ending: 'sold_dream', text: '{name} is already planning the bunker reveal on social. Nobody asks how many days of water a cinema holds.' },
    won_fear: { ending: 'sold_fear', text: '{name} hugs you, carefully, for the cameras. "For the twins." Then signs.' },
    exit: { ending: 'polite_exit', text: '{name} hands your card to an assistant, who hands it to another assistant.' },
    rebuffed: { ending: 'rebuffed', text: '"Okay, wow. Negative energy." {name} is gone in a cloud of perfume and security.' },
  },
};
