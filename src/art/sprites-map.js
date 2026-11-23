// World map ("war room") sprites: terrain tiles, markers, crisis icons and overlays.
// Pixel maps use palette keys from ./palette.js; '.' is transparent.
// Light comes from the top-left. Terrain tiles are 8x8 and tile seamlessly.

// ---------------------------------------------------------------- terrain

const OCEAN_A = [
  'NNNNNNNN',
  'NNNNNNNN',
  'NnnnNNNN',
  'NNNNNNNN',
  'NNNNNNNN',
  'NNNNNnnn',
  'NNNNNNNN',
  'NNNNNNNN',
];
const OCEAN_B = [
  'NNNNNNNN',
  'NNNNNNNN',
  'NNnnnNNN',
  'NNNNNNNN',
  'NNNNNNNN',
  'nNNNNNnn',
  'NNNNNNNN',
  'NNNNNNNN',
];

export const MAP_TILES = {
  ocean: { w: 8, h: 8, frames: [OCEAN_A, OCEAN_B], rows: OCEAN_A },
  shallows: {
    w: 8, h: 8, rows: [
      'nnnnnnnn',
      'nnnccnnn',
      'nnnnnnnn',
      'nnnnnnnn',
      'nnnnnnnn',
      'cnnnnnnc',
      'nnnnnnnn',
      'nnnnnnnn',
    ],
  },
  land: {
    w: 8, h: 8, rows: [
      'gggggggg',
      'ggGggggg',
      'gGgggggg',
      'gggggggg',
      'gggggggg',
      'ggggggGg',
      'gggggGgg',
      'gggggggg',
    ],
  },
  forest: {
    w: 8, h: 8, rows: [
      'gGeggggg',
      'Geeegggg',
      'geeegggg',
      'ggeggggg',
      'gggggGeg',
      'ggggGeee',
      'gggggeee',
      'ggggggeg',
    ],
  },
  desert: {
    w: 8, h: 8, rows: [
      'bbbbbbbb',
      'bbbbbbbb',
      'BBbbbbbb',
      'bbBBBbbb',
      'bbbbbbbb',
      'bbbbbbbb',
      'bbbbbbBB',
      'BBBbbbbb',
    ],
  },
  ice: {
    w: 8, h: 8, rows: [
      'WWWWWWWW',
      'WWWCWWWW',
      'WWWWCCWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'CWWWWWWW',
      'WCCWWWWW',
      'WWWWWWWW',
    ],
  },
  mountain: {
    w: 8, h: 8, rows: [
      'BBBBBBBB',
      'BBmBBBBB',
      'BmmMBBBB',
      'mmmMMBBB',
      'BBBBBmBB',
      'BBBBmmMB',
      'BBBmmmMM',
      'BBBBBBBB',
    ],
  },
  city: {
    w: 8, h: 8, rows: [
      'gggggggg',
      'gmMggggg',
      'gmMgmMMg',
      'gmYgmMMg',
      'gmMgmYMg',
      'gkkgkkkg',
      'ggggggGg',
      'gGgggggg',
    ],
  },
};

// ---------------------------------------------------------------- markers

export const MAP_MARKERS = {
  bunker: {
    w: 10, h: 10, rows: [
      '..KKKKKK..',
      '.KLLYYYyK.',
      'KLYKKKKYyK',
      'KYKkkkkKyK',
      'KYKkkLkKyK',
      'KYKkkkkKyK',
      '.KyKKKKyK.',
      '..KyYyyK..',
      '...KyyK...',
      '....KK....',
    ],
  },
  client: {
    w: 8, h: 8, rows: [
      '.KKKKKK.',
      '.KLYYYK.',
      '.KYYYyK.',
      '.KVVVVK.',
      '.KYYYyK.',
      'KKKKKKKK',
      'KLYYYYyK',
      'KKKKKKKK',
    ],
  },
  hq: {
    w: 12, h: 12, rows: [
      '.....KK.....',
      '....KLYK....',
      '...KKKKKK...',
      '..KwmmmMMK..',
      '.KwmmmMMMkK.',
      '.KmmmMMMkkK.',
      'KYLYYYYYYyyK',
      'KmMMKKKKMMkK',
      'KmMMKYkKMMkK',
      'KmMMKkkKMMkK',
      'KyyyyyyyyyyK',
      'KKKKKKKKKKKK',
    ],
  },
};

// ---------------------------------------------------------------- crisis icons

const FIRE_A = [
  '....K.....',
  '...KRK....',
  '..KRRK.K..',
  '..KROKKRK.',
  '.KROORROK.',
  '.KROYOOOK.',
  'KROYYYOORK',
  'KROYLLYORK',
  'KRROYYORRK',
  '.KKKKKKKK.',
];
const FIRE_B = [
  '.....K....',
  '....KRK...',
  '.K..KRRK..',
  'KRKKROOK..',
  'KROROORRK.',
  '.KOOYOOOK.',
  'KROYYYYORK',
  'KROYLLYORK',
  'KRROYYORRK',
  '.KKKKKKKK.',
];

export const CRISIS_ICONS = {
  pandemic: {
    w: 10, h: 10, rows: [
      '..KKKKKK..',
      '.KKGGGGKK.',
      'KKGGKKGGKK',
      'KKGKGGKGKK',
      'KKKKGGKKKK',
      'KGGKKKKGGK',
      'KGKGKKGKGK',
      'KGGGKKGGGK',
      '.KGKKKKGK.',
      '..KKKKKK..',
    ],
  },
  fire: { w: 10, h: 10, frames: [FIRE_A, FIRE_B], rows: FIRE_A },
  radiation: {
    w: 10, h: 10, rows: [
      '..KKKKKK..',
      '.KYYKKYYK.',
      'KYYYKKYYYK',
      'KKYYKKYYKK',
      'KKKKYYKKKK',
      'KKKKYYKKKK',
      'KKKKKKKKKK',
      'KKKYYYYKKK',
      '.KYYYYYYK.',
      '..KKKKKK..',
    ],
  },
  unrest: {
    w: 10, h: 10, rows: [
      '..KKKKKK..',
      '.KWKWKWKK.',
      '.KWKWKWKWK',
      '.KWKWKWKWK',
      '.KSWWWWKSK',
      '.KKKKKWWSK',
      '..KWWWWSK.',
      '..KRRRRrK.',
      '..KRRRRrK.',
      '..KKKKKKK.',
    ],
  },
  flood: {
    w: 10, h: 10, rows: [
      '....KKKK..',
      '..KKCCCCK.',
      '.KCCcKKCCK',
      'KCcK..KcK.',
      'KCcK..KK..',
      'KCccK.....',
      'KCcccKKKKK',
      'KCccccCCCK',
      'KccccccccK',
      '.KKKKKKKK.',
    ],
  },
  crash: {
    w: 10, h: 10, rows: [
      'KKKKKKKKKK',
      'KRWWWWWWWK',
      'KRRWWWWWWK',
      'KWRRWRWWWK',
      'KWWRRRRWWK',
      'KWWWRWRRWK',
      'KWWWWWRRRK',
      'KWWWWRRRRK',
      'KWWWWWWWWK',
      'KKKKKKKKKK',
    ],
  },
  blackout: {
    w: 10, h: 10, rows: [
      '...KKKK...',
      '..KkMMkKR.',
      '.KkMkkkRK.',
      '.KMkkkRkK.',
      '.KkkkRkkK.',
      '..KkRkkK..',
      '..KRYYYK..',
      '..RKyyyK..',
      '.R.KKKK...',
      '..........',
    ],
  },
};

// ---------------------------------------------------------------- overlays

const TIPPING_A = [
  'R.R.R.r.',
  '.R.R.R.R',
  'R.r.R.R.',
  '.R.R.R.r',
  'R.R.r.R.',
  '.r.R.R.R',
  'R.R.R.r.',
  '.R.r.R.R',
];
const TIPPING_B = [
  '.R.r.R.R',
  'R.R.R.r.',
  '.R.R.R.R',
  'r.R.R.R.',
  '.R.R.r.R',
  'R.R.R.R.',
  '.r.R.R.R',
  'R.R.R.R.',
];

export const CRISIS_OVERLAYS = {
  uneasy: {
    w: 8, h: 8, rows: [
      '........',
      'Y...Y...',
      '........',
      '........',
      '........',
      '..Y...Y.',
      '........',
      '........',
    ],
  },
  edge: {
    w: 8, h: 8, rows: [
      'O.O.O.O.',
      '........',
      '.O.O.O.O',
      '........',
      'O.O.O.O.',
      '........',
      '.O.O.O.O',
      '........',
    ],
  },
  tipping: { w: 8, h: 8, frames: [TIPPING_A, TIPPING_B], rows: TIPPING_A },
  selected: {
    w: 8, h: 8, rows: [
      'W...W...',
      '........',
      '..W...W.',
      '........',
      'W...W...',
      '........',
      '..W...W.',
      '........',
    ],
  },
};
