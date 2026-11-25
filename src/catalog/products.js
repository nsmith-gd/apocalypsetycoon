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

// ---------- plot templates (#141) ----------
// A contract picks a product; the product is the plot: its width and the floors you may dig (4 m a floor).
export const FLOOR_M = 4;
export const PLOT_PRODUCTS = Object.freeze(['solo_pod', 'family_vault', 'condo_silo']);

export const productUnlocked = (id, minutes = Infinity) => (PRODUCT_BY_ID[id]?.unlockAt ?? Infinity) <= minutes;

/** The plot a product gives: width in tiles, deepest metre you may dig, and floor counts. */
export function plotOf(id) {
  const p = PRODUCT_BY_ID[id];
  if (!p?.plot?.width || !p.plot.floors) return null;
  const [minFloors, maxFloors] = p.plot.floors;
  return { id, name: p.name, width: p.plot.width, minFloors, maxFloors, maxDepth: maxFloors * FLOOR_M, households: p.perUnit ? p.occupants : null };
}

/** The product a contract for this many occupants calls for: the smallest unlocked plot product that fits. */
export function productFor(occupants, { minutes = Infinity } = {}) {
  const fits = PLOT_PRODUCTS.map((id) => PRODUCT_BY_ID[id]).filter((p) => productUnlocked(p.id, minutes) && !p.perUnit && occupants <= p.occupants.max);
  return (fits[0] ?? PRODUCT_BY_ID.solo_pod).id;
}
