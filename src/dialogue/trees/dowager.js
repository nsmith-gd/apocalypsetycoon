// Old-money dowager: has survived three husbands and two wars. Considers the apocalypse vulgar.
export default {
  id: 'dowager_silver',
  archetype: 'dowager',
  title: 'The dowager and the silver',
  start: 'open',
  nodes: {
    open: {
      alt: [
        { when: { breach: true }, text: "{name} has stopped pretending not to read the papers. \"{fear}. In breach, they say. Grandfather would have built something. Well?\"" },
      ],
      speaker: 'guest',
      text: '{name} regards you through a lorgnette. "Last Resort. My grandson says you dig holes for people with new money. We have old money, young man. It prefers to stay above ground."',
      choices: [
        { text: 'Then think of it as a cellar, madam. Your family has always kept good cellars.', next: 'cellar', effects: { trait: 'traditional', learn: 'traditional' } },
        { text: 'Even old money worries about {fear}. Your grandchildren certainly do.', next: 'heirs', effects: { fear: '$guest', trait: 'family' } },
        { text: 'Our shelters are fully smart. The AI butler learns your tea preferences.', next: 'frost', effects: { trait: 'futurist', promise: 'ai_butler' } },
      ],
    },
    cellar: {
      speaker: 'guest',
      text: '"A cellar." She considers it. "Father laid down the 1961 Pétrus the week of the Bay of Pigs. Can your hole hold eight hundred bottles at thirteen degrees?"',
      choices: [
        { text: 'Twelve hundred. Climate-controlled, oak racks, a sommelier\'s alcove.', next: 'won_dream', effects: { promise: 'wine_cellar', trait: 'traditional', trust: 6 } },
        { text: 'It can. It will also hold a year of water, which the Pétrus will not provide.', next: 'heirs', effects: { trait: 'practical', trust: 4 } },
        { text: "With respect, nobody will care about vintages when they're boiling rainwater.", next: 'backfire', effects: { aggressive: true, trust: -10 } },
      ],
    },
    heirs: {
      speaker: 'guest',
      text: '"The grandchildren. Yes. Unbearable, all of them. But they carry the name." She taps her cane once. "How many could you keep?"',
      choices: [
        { text: 'All six, plus the portraits. Air, water and food for a full year, in writing.', next: 'won_fear', effects: { trait: 'family', trust: 8 } },
        { text: "The family chapel, rebuilt underground. Stone for stone. Same pews.", next: 'won_dream', effects: { promise: 'chapel', trait: 'traditional' } },
        { text: 'The four you like. We can be discreet about the other two.', next: 'exit', effects: { trait: 'discreet', trust: -3 } },
        { when: { band: 'boil' }, text: "With {fear} {level}, madam, I'd move the grandchildren down this season, not next.", next: 'won_fear', effects: { fear: '$guest', trait: 'family' } },
      ],
    },
    frost: {
      speaker: 'guest',
      text: '"A robot butler. How dreadfully American." The temperature near {name} drops several degrees. "Cuthbert has buttled for forty years. Cuthbert will be coming."',
      choices: [
        { text: 'Of course. Cuthbert gets the second-best suite. Tradition matters.', next: 'cellar', effects: { trait: 'traditional', trust: 4 } },
        { text: "Cuthbert is eighty. The robot doesn't need oxygen.", next: 'backfire', effects: { aggressive: true } },
        { text: "Forgive me. I'll send you a brochure without any robots in it.", next: 'exit', effects: { trust: 2 } },
      ],
    },
    won_fear: { ending: 'sold_fear', text: '"Send the papers to my solicitor. Handwritten." {name} has already chosen which grandchild gets the top bunk.' },
    won_dream: { ending: 'sold_dream', text: '{name} inclines her head a quarter-inch. In her circles, that is a signed contract.' },
    exit: { ending: 'polite_exit', text: '{name} accepts your card between two gloved fingers and passes it to Cuthbert to dispose of.' },
    backfire: { ending: 'backfire', text: '"How vulgar." {name} says it loudly enough for three duchesses and a columnist to hear.' },
  },
};
