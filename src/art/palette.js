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
  // #136 world map redo: a brighter daylight atlas (target sheet v2), 28 colours. The war-room mood is carried
  // by the crisis overlays and the UI frame, not by dark terrain.
  ocean: Object.freeze(['#073d6e', '#0a66a8', '#1196d6', '#47c6ee']), // lake deep, open sea, shelf, lagoon
  forest: Object.freeze(['#0d2f3a', '#123f45', '#16564c', '#227346', '#36964a']), // jungle core -> mid green
  meadow: Object.freeze(['#5bbf4e', '#97df63', '#cdf57f']), // light green, highlight, glint (sparingly)
  savanna: Object.freeze(['#7a8a4a', '#9fae5a', '#c8b874']), // dry scrub -> dry grass
  tundra: Object.freeze(['#5c7a6c', '#8fa39a']), // cold moss, frost
  desert: Object.freeze(['#7e3f31', '#b0623f', '#de9562', '#f2c497', '#f7e3c8']), // rust ridge -> pale sand
  rock: Object.freeze(['#40465a', '#69779a', '#a3aec4']), // mountain shadow, face, lit ridge
  snow: Object.freeze(['#c4cddd', '#ffffff']), // shadow edge, cap
  water: Object.freeze(['#1196d6', '#073d6e']), // rivers (shelf blue), lakes (deep)
  outline: '#0a0807', // = K: the 1px coast outline
});
export const MAP_COLOURS = Object.freeze([...new Set(Object.values(MAP_PALETTE).flat())]);

export const HEX = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, v.hex]));

/** Hex -> [r,g,b] */
export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
