// The five product lines (GDD: Shelter canvas > Product lines), Solo Pod to Ark.
// Prices are GDD dollars (multiply by PRICE_SCALE for today's $K economy). `plot.width` is in tiles;
// `plot.floors` is [min, max]; `perUnit` = the price is per household (Condo Silo); `consortium` = paid by
// a group of clients (Ark). `row` is the unlock schedule row (src/catalog/unlocks.js).

import { hm } from '../world/tracks.js';

const P = (id, name, occupants, plot, price, at, row, notes, extra = {}) => ({ id, name, occupants, plot, price, unlockAt: hm(at), row, notes, ...extra });

export const PRODUCT_LINES = Object.freeze([
  P('solo_pod', 'Solo Pod', { min: 2, max: 4 }, { width: 16, floors: [1, 3] }, { min: 3_000_000, max: 5_000_000 }, '0:00', 1, 'The tutorial product'),
  P('family_vault', 'Family Vault', { min: 4, max: 8 }, { width: 24, floors: [1, 5] }, { min: 8_000_000, max: 15_000_000 }, '0:50', 10, 'Multiple bedrooms, first real status rooms'),
  P('condo_silo', 'Condo Silo', { min: 4, max: 8, unit: 'households' }, { width: 16, floors: [8, 12] }, { min: 5_000_000, max: 9_000_000 }, '1:22', 16, 'Shared systems, shared gossip, client feuds', { perUnit: true }),
  P('compound', 'Compound', { min: 20, max: 80 }, { width: null, sites: 3, tunnels: true }, { min: 40_000_000, max: 80_000_000 }, '4:20', 37, 'Spreads risk across sites; tunnels can flood or be breached'),
  P('ark', 'Ark', { min: 200, max: 500 }, { width: 64, floors: [1, null], toStratum: 'abyss' }, { min: 500_000_000, max: null }, '5:00', 42, 'The endgame megaproject for The Table', { consortium: true }),
].map((p) => Object.freeze(p)));

export const PRODUCT_BY_ID = Object.freeze(Object.fromEntries(PRODUCT_LINES.map((p) => [p.id, p])));
