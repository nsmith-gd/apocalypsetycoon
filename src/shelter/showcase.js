// A furnished showcase bunker used by the demo (?suite) and the interior tests.

// A furnished three-floor suite: lounge, kitchen-diner, bedroom, bathroom, plant room, all finished.
export function furnishedSuite(site, { instant = false } = {}) {
  for (let y = 0; y < 13; y++) { site.dig(0, y); site.dig(1, y); site.build('spine', 0, y); site.build('spine', 1, y); }
  const floor = (top, x1) => { site.digRect(2, top - 1, x1, top + 3); site.buildRect('wall', 2, top - 1, x1, top - 1); site.buildRect('wall', 2, top + 3, x1, top + 3); site.buildRect('wall', x1, top, x1, top + 2); };
  floor(1, 23); floor(5, 23); floor(9, 13);
  // lounge | kitchen-diner
  site.place('door', 14, 3);
  site.place('fireplace', 2, 3); site.place('sofa', 4, 3, { variant: 'emerald' }); site.place('rug_persian', 4, 3, { variant: 'burgundy' });
  site.place('coffee_table', 7, 3, { variant: 'ebony' }); site.place('armchair', 9, 3, { variant: 'leopard', flip: true }); site.place('aquarium', 11, 3); site.place('plant_tall', 13, 3);
  site.place('painting', 4, 2); site.place('chandelier', 7, 1, { variant: 'gold' }); site.place('faux_window', 9, 2); site.place('sconce', 13, 1);
  site.place('fridge', 15, 3); site.place('stove', 16, 3); site.place('espresso', 18, 3); site.place('dining_chair', 19, 3, { variant: 'walnut' });
  site.place('dining_table', 20, 3, { variant: 'walnut' }); site.place('wall_shelf', 16, 2); site.place('pendant', 21, 1); site.place('neon_sign', 19, 1);
  // bedroom | bathroom
  site.place('door', 13, 7);
  site.place('king_bed', 2, 7, { variant: 'navy' }); site.place('nightstand', 5, 7); site.place('rug', 6, 7); site.place('bed', 6, 7, { variant: 'burgundy' });
  site.place('nightstand', 9, 7); site.place('wardrobe', 10, 7, { variant: 'white' }); site.place('plant', 12, 7); site.place('chandelier', 6, 5); site.place('led_sky', 2, 5);
  site.place('toilet', 14, 7); site.place('sink', 15, 7); site.place('mirror', 15, 6); site.place('bathtub', 17, 7, { variant: 'gold' }); site.place('shower', 21, 7); site.place('vanity', 22, 7);
  // plant room
  site.place('diesel', 2, 11); site.place('fuel', 4, 11); site.place('battery', 5, 11); site.place('tank', 6, 11); site.place('hepa', 8, 11); site.place('diesel', 10, 11);
  for (const y of [1, 3, 5, 7]) site.conduitLine('power', 2, y, 22, y);
  site.conduitLine('water', 2, 7, 22, 7); site.conduitLine('air', 2, 2, 22, 2); site.conduitLine('air', 2, 6, 22, 6);
  site.conduitLine('power', 2, 11, 11, 11); site.conduitLine('water', 2, 10, 11, 10); site.conduitLine('air', 2, 10, 11, 10);
  if (instant) site.finishAll();
  const paint = () => {
    site.paint('wall', 'walnut', 5, 2); site.paint('floor', 'oak', 5, 2); site.paint('light', 'warm', 5, 2);
    site.paint('wall', 'tech', 18, 2); site.paint('floor', 'checker', 18, 2); site.paint('light', 'cool', 18, 2);
    site.paint('wall', 'velvet', 5, 6); site.paint('floor', 'carpet', 5, 6); site.paint('light', 'sunset', 5, 6);
    site.paint('wall', 'marble', 18, 6); site.paint('floor', 'terrazzo', 18, 6);
  };
  if (site.jobs.length) { const off = site.onChange(() => { if (!site.jobs.length) { off(); paint(); } }); } else paint();
}
