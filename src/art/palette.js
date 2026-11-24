// "Last Resort 28": the game's only palette. Every sprite pixel and every UI colour
// comes from here. Each entry has a one-character key used in sprite pixel maps.
// '.' (and ' ') in a pixel map means transparent.
//
// Ramps run dark -> light. Light comes from the top-left.

export const PALETTE = Object.freeze({
  // Neutrals / outline
  K: { hex: '#0a0807', name: 'Void (outline)' },
  D: { hex: '#241f1a', name: 'Panel' },
  d: { hex: '#3b2f26', name: 'Panel raised' },
  S: { hex: '#a8977a', name: 'Dust (dim text)' },
  W: { hex: '#f2e6c9', name: 'Bone (text, paper)' },

  // Earth (the dig)
  e: { hex: '#2a1d14', name: 'Deep earth' },
  E: { hex: '#3b2a1e', name: 'Earth' },
  B: { hex: '#5c4636', name: 'Clay' },
  b: { hex: '#8a6a4a', name: 'Sand' },

  // Metal (bunker structure, machines)
  k: { hex: '#3a3f46', name: 'Gunmetal' },
  M: { hex: '#6b7078', name: 'Steel' },
  m: { hex: '#9aa3ad', name: 'Chrome' },
  w: { hex: '#dfe6ec', name: 'Glint' },

  // Gold (luxury, cash)
  y: { hex: '#8a5a1a', name: 'Old gold' },
  Y: { hex: '#f5c542', name: 'Gold' },
  L: { hex: '#fff1a8', name: 'Gold glint' },

  // Green (food, growth, safe)
  g: { hex: '#2f5a24', name: 'Moss' },
  G: { hex: '#7ed957', name: 'Leaf' },

  // Blue (water, cold, cryo)
  N: { hex: '#16324a', name: 'Ocean' },
  n: { hex: '#24507a', name: 'Shallows' },
  c: { hex: '#3f8fc8', name: 'Water' },
  C: { hex: '#8fd3ff', name: 'Ice' },

  // Crisis (heat, danger, edge)
  r: { hex: '#6b1f1a', name: 'Dried blood' },
  R: { hex: '#ff5a4f', name: 'Alarm' },
  O: { hex: '#ff9f1c', name: 'Edge amber' },

  // Accents
  V: { hex: '#7a2a5a', name: 'Velvet' },
  v: { hex: '#c070ff', name: 'Neon' },
  T: { hex: '#b8e0c8', name: 'Clean air' },

  // Interior materials (design-layer room styles, #88): longer ramps so walls can carry texture and light.
  a: { hex: '#262426', name: 'Concrete shadow' },
  f: { hex: '#3a3738', name: 'Concrete dark' },
  h: { hex: '#524d4b', name: 'Concrete' },
  i: { hex: '#6c655f', name: 'Concrete lit' },
  j: { hex: '#8b8179', name: 'Concrete pale' },
  l: { hex: '#ab9f92', name: 'Concrete highlight' },
  o: { hex: '#b8742a', name: 'Sodium glow' },
  p: { hex: '#f0b052', name: 'Sodium lamp' },
  q: { hex: '#3e1230', name: 'Velvet shadow' },
  s: { hex: '#a2407a', name: 'Velvet sheen' },
  t: { hex: '#c79430', name: 'Gold leaf' },
  u: { hex: '#ddd3c0', name: 'Marble' },
  x: { hex: '#b3a68f', name: 'Marble vein' },
  z: { hex: '#3e2414', name: 'Walnut dark' },
  A: { hex: '#6e4428', name: 'Walnut' },
});

// ---------------- World map extension (#99; docs/art/style-guide.md "World map") ----------------
// The base map paints only from these ramps (plus K for the coast outline). Values are the director's
// pixel-earth reference ramps at about 80% brightness: the reference's richness, dark enough that the
// amber and red crisis overlays still pop. Ramps run dark -> light.
export const MAP_PALETTE = Object.freeze({
  ocean: Object.freeze(['#002e59', '#00548a', '#007ab0']), // trench, deep (the sea itself), shelf
  forest: Object.freeze(['#0f3d3d', '#185a42', '#297a3c', '#489e3f']), // dark core -> open grass
  meadow: Object.freeze(['#7ab84c', '#a9cf65']), // brightest grass and highlight, used sparingly
  desert: Object.freeze(['#6e3a2b', '#995a3b', '#b87d54', '#c5a27f', '#d4c2ad']), // rust ridge -> pale sand
  rock: Object.freeze(['#3a3f46', '#5a5f6e', '#8a8f9c']), // mountain shadow, face, lit ridge
  snow: Object.freeze(['#9aa1b0', '#d0d4dc']), // shadow edge, cap
  water: Object.freeze(['#007ab0']), // lakes and rivers: the shelf blue
  outline: '#0a0807', // = K: the 1px coast outline
});
export const MAP_COLOURS = Object.freeze([...new Set(Object.values(MAP_PALETTE).flat())]);

export const HEX = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, v.hex]));

/** Hex -> [r,g,b] */
export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
