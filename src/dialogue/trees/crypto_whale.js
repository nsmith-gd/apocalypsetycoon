// Crypto whale: all-in on everything, trusts nobody, keeps the seed phrase tattooed somewhere private.
export default {
  id: 'crypto_whale_coldwallet',
  archetype: 'crypto_whale',
  title: 'Cold storage',
  start: 'open',
  nodes: {
    open: {
      speaker: 'guest',
      text: '{name} leans in, sunglasses on, indoors, at night. "Before you talk: are you wearing a wire? Everyone here is a fed or a bot."',
      choices: [
        { text: "I'm neither. I sell the one asset nobody can rug-pull: four metres of concrete.", next: 'pitch', effects: { trait: 'paranoid', learn: 'paranoid' } },
        { text: "No wire. But I'll tell you what the room won't: {fear} is coming.", next: 'fear', effects: { fear: '$guest', aggressive: true } },
        { text: 'Relax. Have a drink. Think about your grandkids.', next: 'cold', effects: { trait: 'family', trust: -4 } },
      ],
    },
    pitch: {
      speaker: 'guest',
      text: '"Concrete. Huh. Can I pay in coin? Can I mint the bunker? I want a vault for the cold wallets and a gold toilet. Ironically."',
      choices: [
        { text: "Coin accepted. The bunker's air runs on scrubbers, not sentiment. Your wallet survives because you do.", next: 'odds', effects: { trust: 6 } },
        { text: 'Gold toilet, cold-wallet vault, retina lock. Nobody gets in but you.', next: 'odds', effects: { promise: 'gold_taps', trait: 'paranoid' } },
        { text: "We don't take magic internet money. Wire transfer only.", next: 'cold', effects: { trait: 'traditional' } },
      ],
    },
    fear: {
      speaker: 'guest',
      text: '"{fear}. Yeah. I\'ve been shorting the planet for a year. What\'s the timing? Give me a number."',
      choices: [
        { text: "Off the record? Price it in by spring. That's when we break ground on the last units.", next: 'won_tip', effects: { slip: true, trust: 5 } },
        { text: 'The timing is: the price doubles if you walk away from this table.', next: 'won_hard', effects: { aggressive: true, trait: 'gambler' } },
        { text: 'You want the odds? Let me show you what you are actually betting on.', next: 'odds', effects: { trait: 'gambler' } },
      ],
    },
    odds: {
      speaker: 'guest',
      text: '"Okay, degen math. What are the odds I need it, and what\'s the payout if I do?"',
      choices: [
        { text: "Odds are rising. Payout is breathing filtered air while everyone else breathes {fear}. That's a hundred-x.", next: 'won_fear', effects: { fear: '$guest', trait: 'gambler' } },
        { text: 'Bet the house. Literally. Put a deposit down tonight before the dip ends.', next: 'won_hard', effects: { aggressive: true } },
        { text: 'Odds are a coin flip on {otherFear}. Feeling lucky?', next: 'cold', effects: { fear: '$other' } },
      ],
    },
    cold: {
      speaker: 'guest',
      text: '{name} lowers the sunglasses half an inch. "You sound like a guy who gets paid either way. Who sent you?"',
      choices: [
        { text: 'Nobody. Here is my card. Burn it after reading if you like.', next: 'rebuffed', effects: { trust: 3 } },
        { text: "Nobody needs to send me. I already know what's on your laptop.", next: 'backfire', effects: { aggressive: true, slip: true } },
      ],
    },
    won_fear: { ending: 'sold_fear', text: '{name} sends a deposit from three wallets at once. "For privacy," apparently.' },
    won_hard: { ending: 'hard_close', text: '"Fine. FINE. Aping in." {name} signs, then films you signing, as collateral.' },
    won_tip: { ending: 'insider_tip', text: '{name} is already tweeting "something big is coming" with zero context. Ten thousand people retweet it.' },
    rebuffed: { ending: 'rebuffed', text: '{name} drops your card into a champagne glass, which seems to count as burning it.' },
    backfire: { ending: 'backfire', text: '"HE\'S A FED!" {name} shouts it across the yacht. Three people jump overboard.' },
  },
};
