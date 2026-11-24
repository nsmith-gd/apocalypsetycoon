// Exiled royal: lost a kingdom, kept the tiara. Wants a court underground, not a shelter.
export default {
  id: 'royal_court_in_exile',
  archetype: 'royal',
  title: 'The court in exile',
  start: 'open',
  nodes: {
    open: {
      speaker: 'guest',
      text: '{name} extends a hand at an angle that suggests it should be kissed. "One is told you build... refuges. One has had quite enough of fleeing to rented villas."',
      choices: [
        { text: 'Not a refuge, Your Highness. A court. Built to outlast the republic that exiled you.', next: 'court', effects: { trait: 'traditional' } },
        { text: 'Your family survived revolutions. {fear} is just the next one.', next: 'dynasty', effects: { fear: '$guest' } },
        { text: 'Picture it: smart glass, an AI concierge, total automation. The palace of the future.', next: 'modern', effects: { trait: 'futurist' } },
      ],
    },
    court: {
      speaker: 'guest',
      text: '"A court requires a throne. And a gallery for the portraits. And a ballroom. One does not simply wait out the end of the world in a corridor."',
      choices: [
        { text: 'A throne room, Your Highness. Gilded, raised dais, your crest above it.', next: 'staff', effects: { trait: 'vain', promise: 'throne_room', learn: 'vain' } },
        { text: 'A full portrait gallery. Climate-controlled, so the ancestors outlive the mob.', next: 'staff', effects: { promise: 'portrait_gallery', trust: 5 } },
        { text: 'Honestly? A throne takes the space of a water tank. I\'d skip it.', next: 'rebuffed', effects: { trait: 'practical', trust: -6 } },
      ],
    },
    staff: {
      speaker: 'guest',
      text: '"And the staff? One cannot be expected to pour one\'s own wine. Twelve, at minimum. Fewer is a hostage situation."',
      choices: [
        { text: 'Twelve in livery, and a cellar of vintages older than most countries.', next: 'won_dream', effects: { promise: 'wine_cellar', trait: 'traditional', learn: 'traditional' } },
        { text: 'Twelve mouths is twelve more rations. Lovely people. Short-lived, unless we plan the food.', next: 'won_fear', effects: { fear: '$guest', trust: 4 } },
        { text: "Staff will be robots. Nobody's had a butler since the monarchy fell.", next: 'backfire', effects: { aggressive: true } },
      ],
    },
    dynasty: {
      speaker: 'guest',
      text: '"{fear}. Yes. Great-grandmama said the peasants would come back. One assumed she meant with pitchforks, not this."',
      choices: [
        { text: 'The line continues, Your Highness. Below the line of fire, with ninety days of air.', next: 'won_fear', effects: { trait: 'traditional', trust: 6 } },
        { text: 'Let me show you how a proper court survives it. Thrones included.', next: 'court', effects: { trust: 3 } },
      ],
    },
    modern: {
      speaker: 'guest',
      text: '"Automation." {name} says the word like it is a rash. "My family has employed the same footmen\'s families for three hundred years."',
      choices: [
        { text: 'Forgive me. Tradition, then. Something your ancestors would recognise.', next: 'court', effects: { trust: 2 } },
        { text: 'Of course. I\'ll send the brochure to your secretary.', next: 'exit' },
      ],
    },
    won_dream: { ending: 'sold_dream', text: '{name} is already describing the dais to an aide. Nobody mentions the air handling. Nobody ever does.' },
    won_fear: { ending: 'sold_fear', text: '{name} nods gravely. "Very well. The dynasty goes underground. Send the papers on proper letterhead."' },
    rebuffed: { ending: 'rebuffed', text: '"Skip the throne." {name} looks at you as one looks at a stain on a tablecloth, and drifts away.' },
    exit: { ending: 'polite_exit', text: '{name} accepts your card between two fingers and hands it, unread, to a man in a sash.' },
    backfire: { ending: 'backfire', text: '"Since the monarchy FELL?" The quartet stops playing. Somewhere a duchess drops a canape.' },
  },
};
