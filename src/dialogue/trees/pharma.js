// Pharma executive: reads the fine print for a living, writes it for a hobby. Assumes everyone is lying.
export default {
  id: 'pharma_trial',
  archetype: 'pharma',
  title: 'The executive with the data',
  start: 'open',
  nodes: {
    open: {
      speaker: 'guest',
      text: '{name} does not shake your hand. "Your brochure claims ninety-day survivability. Sample size? Control group? Who funded the study?"',
      choices: [
        { text: "Nobody's run the trial yet. That's rather the point. I can show you the engineering data.", next: 'data', effects: { trait: 'skeptic', learn: 'skeptic', trust: 4 } },
        { text: 'You of all people know how {fear} would spread. You\'ve seen the models.', next: 'models', effects: { fear: '$guest' } },
        { text: 'Imagine it: cryo pods. Sleep through the whole thing, wake up to a clean world.', next: 'scoff', effects: { trait: 'futurist', promise: 'cryo_pod' } },
      ],
    },
    data: {
      speaker: 'guest',
      text: '"Show me air exchange rates and water recycling efficiency. Not renderings. I\'ve approved enough renderings to know they cure nothing."',
      choices: [
        { text: 'Scrubber specs, well depth, crop yields. Audited, and under NDA. Nobody hears you asked.', next: 'won_fear', effects: { trait: 'discreet', trust: 8 } },
        { text: 'Here are the renderings. Look at that spa.', next: 'rebuffed', effects: { trait: 'vain' } },
      ],
    },
    models: {
      speaker: 'guest',
      text: '"I\'ve seen models. I\'ve also buried models." {name} lowers their voice. "Our board has a contingency. I\'d rather not depend on the board."',
      choices: [
        { text: "Then don't. Private contract, private site, no board minutes. It never happened.", next: 'won_fear', effects: { trait: 'discreet', trust: 6 } },
        { text: "Between us, the timeline your board's using is optimistic. By about a year.", next: 'probe', effects: { slip: true } },
        { text: "Sign tonight or I'll let your board know you shopped around.", next: 'backfire', effects: { aggressive: true, trait: 'ruthless' } },
      ],
    },
    scoff: {
      speaker: 'guest',
      text: '"Cryo pods have a revival rate of zero. I know, because we tried to patent one." A thin smile. "What else is in there, apart from coffins?"',
      choices: [
        { text: 'Fair. Forget the pods. Air, water, food. Everything else is upholstery.', next: 'data', effects: { trait: 'skeptic', trust: 3 } },
        { text: "The pods are for the clients who don't read. You read. Let me show you the real numbers.", next: 'data', effects: { trait: 'skeptic' } },
      ],
    },
    probe: {
      speaker: 'guest',
      text: '{name} goes very still. "Optimistic. How would a shelter salesman know that?"',
      choices: [
        { text: 'Same way you knew about the recall before the recall. We listen. Deposit by Friday.', next: 'won_tip', effects: { slip: true, aggressive: true } },
        { text: 'Lucky guess. I read a lot of forums.', next: 'rebuffed', effects: { trust: -6 } },
      ],
    },
    won_fear: { ending: 'sold_fear', text: '{name} takes the spec sheet, not the brochure. "I\'ll have my people check every number." They will. The numbers hold.' },
    won_tip: { ending: 'insider_tip', text: '{name} transfers the deposit from an account that does not appear in any annual report.' },
    rebuffed: { ending: 'rebuffed', text: '"Insufficient evidence." {name} files you mentally under side effects.' },
    backfire: { ending: 'backfire', text: '"Was that a threat?" {name} is already typing. Their general counsel replies before you reach the bar.' },
  },
};
