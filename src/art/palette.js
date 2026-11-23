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
});

export const HEX = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, v.hex]));

/** Hex -> [r,g,b] */
export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
