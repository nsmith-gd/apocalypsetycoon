// Retired general: thinks in perimeters and supply lines. Trusts concrete, distrusts civilians.
export default {
  id: 'general_war_room',
  archetype: 'general',
  title: 'The general at the buffet',
  start: 'open',
  nodes: {
    open: {
      speaker: 'guest',
      text: '{name} is standing with his back to the wall, facing every exit at once. "Last Resort. Civilians building bunkers. State your business, son."',
      choices: [
        { text: 'Logistics, General. Air, water, food. Everything else is decoration.', next: 'brief', effects: { trait: 'practical' } },
        { text: "You've war-gamed {fear}. I'd like to hear how it ends.", next: 'threat', effects: { fear: '$guest' } },
        { text: 'Picture it: your own command suite. Brass fittings. Your portrait over the door.', next: 'parade', effects: { trait: 'vain' } },
      ],
    },
    brief: {
      speaker: 'guest',
      text: '"Decoration. Good. Last outfit sold me a bunker with a cinema and four days of oxygen. Who holds the perimeter? Who holds the keys?"',
      choices: [
        { text: 'You do. Keys, codes, blast doors. Nobody else in the chain of command.', next: 'won_fear', effects: { trait: 'paranoid', trust: 8, learn: 'paranoid' } },
        { text: 'Two hundred days sealed, three water sources, and a hydroponics bay I will personally walk you through.', next: 'won_fear', effects: { trust: 6, promise: 'mil_scrubber', learn: 'practical' } },
        { text: 'Our staff handles all that. You just enjoy the spa level.', next: 'rebuffed', effects: { trust: -8 } },
      ],
    },
    threat: {
      speaker: 'guest',
      text: '"I\'ve run {fear} on a tabletop forty times. We lose every time. The planners always forget the water."',
      choices: [
        { text: "We didn't forget the water. We dug for it first and poured the marble second.", next: 'brief', effects: { trait: 'practical', trust: 5 } },
        { text: "You've got one window, General. It closes this quarter. Sign tonight.", next: 'won_hard', effects: { aggressive: true } },
        { text: "Off the record? Our models say sooner than your tabletops. Much sooner.", next: 'won_tip', effects: { slip: true, trust: 4 } },
        { text: 'Respectfully, General, the smart money is worried about {otherFear}.', next: 'backfire', effects: { fear: '$other', aggressive: true } },
      ],
    },
    parade: {
      speaker: 'guest',
      text: '"A portrait. I had my portrait painted once. The artist is now a person of interest." He does not blink.',
      choices: [
        { text: 'Scratch the portrait. What do you actually need down there?', next: 'brief', effects: { trust: 3 } },
        { text: 'Understood. My card, General, for when the flags go to half-mast.', next: 'exit', effects: { trust: 2 } },
      ],
    },
    won_fear: { ending: 'sold_fear', text: '{name} pockets your card in a breast pocket, then moves it to a different one. "Send the schematics. Encrypted."' },
    won_hard: { ending: 'hard_close', text: '{name} signs like he\'s authorising a strike. "If this is a sales tactic, I will find out."' },
    won_tip: { ending: 'insider_tip', text: '{name} lowers his voice to a parade-ground whisper. Three aides nearby suddenly need the restroom.' },
    rebuffed: { ending: 'rebuffed', text: '"A spa level." {name} turns and marches off toward the canapes like they owe him money.' },
    exit: { ending: 'polite_exit', text: '{name} salutes, barely. Your card disappears into a coat lined with other people\'s cards.' },
    backfire: { ending: 'backfire', text: '"Smart money." {name} says it loud enough for the whole wake to hear. "I buried smarter men than you."' },
  },
};
