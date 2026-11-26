// Lead redemption on the world map (#58, director note D2: leads come from events and dialogue).
//
// Selling a finished shelter to one of YOUR leads (someone you met at an event) instead of a
// walk-in buyer from the demand ticker pays off three ways:
//   1. PRICE   a better-warmed lead pays more: a bonus by tier, by the quality of the conversation,
//              and when the region's worst crisis is one of the fears that brought them in.
//   2. TIER    a lead brings their own wealth class. Walk-in buyers are capped by the region's
//              wealth band; a C4/C5 guest from a gala buys at the top band in any region.
//   3. DEMAND  a happy hot or warm lead talks: referrals add waiting buyers in that region
//              (hot: one at once, warm: half a buyer, so two warm sales bring one).
// Leads that are not redeemed expire on the LeadInventory's schedule (cold this quarter,
// warm +1, hot +2) and can no longer be redeemed.
//
//   quoteLead(sales, inventory, leadId, shelterId)   -> what this lead would pay vs a walk-in
//   redeemLead(sales, inventory, leadId, shelterId)  -> sells, consumes the lead, adds referrals

import { referralMultiplier } from '../clients/traits.js';
import { TRACK_APOCALYPSE } from '../midnight/engineered.js';
import { WEALTH } from '../demand/demand.js';
import { salePrice } from '../worldmap/sales.js';

export const REDEMPTION = Object.freeze({
  tierBonus: { cold: 0, warm: 0.05, hot: 0.1 }, // price bonus by lead tier
  qualityBonus: 0.1, // + up to 10% more at quality 100 (scaled by quality / 100)
  fearMatchBonus: 0.1, // the region's worst crisis is a fear that brought them to you
  referrals: { cold: 0, warm: 0.5, hot: 1 }, // waiting buyers added in the region after the sale
});

/** Which of the lead's fears (GDD track ids) matches a map crisis track (demand track id). */
export function fearMatches(lead, mapTrack) {
  if (!mapTrack) return false;
  const gddTrack = TRACK_APOCALYPSE[mapTrack];
  return !!gddTrack && (lead.fears ?? []).includes(gddTrack);
}

/** The price bonus a lead brings, itemised. */
export function leadBonus(lead, mapTrack, cfg = REDEMPTION) {
  const lines = [];
  const tier = cfg.tierBonus[lead.tier] ?? 0;
  if (tier) lines.push({ label: `${lead.tier} lead`, bonus: tier });
  const quality = Math.round(((lead.quality ?? 0) / 100) * cfg.qualityBonus * 1000) / 1000;
  if (quality) lines.push({ label: `rapport ${lead.quality}/100`, bonus: quality });
  if (fearMatches(lead, mapTrack)) lines.push({ label: 'already scared of this crisis', bonus: cfg.fearMatchBonus });
  const total = Math.round(lines.reduce((s, l) => s + l.bonus, 0) * 1000) / 1000;
  return { total, lines };
}

/** Quote a pipeline lead for a shelter, next to what the region's best walk-in buyer would pay. */
export function quoteLead(sales, inventory, leadId, shelterId, cfg = REDEMPTION) {
  const lead = inventory.get(leadId);
  if (!lead || lead.status !== 'open') return { error: 'That lead is no longer open.' };
  if (inventory.getQuarter() > lead.expiresQuarter) return { error: `${lead.guest.name} has gone cold: the lead expired.` };
  const regionId = lead.salesRegion;
  const view = sales.regionView(regionId);
  if (!view) return { error: 'That lead is in an unknown region.' };
  const shelter = sales.stock.find((s) => s.id === shelterId);
  if (!shelter) return { error: 'That shelter is not in stock.' };
  const bonus = leadBonus(lead, view.crisisTrack, cfg);
  const base = salePrice(shelter, lead.salesWealth, view.premium, sales.cfg);
  const price = Math.round((base * (1 + bonus.total)) / 1000) * 1000;
  const walkIn = view.best ? { wealth: view.best.wealth, price: salePrice(shelter, view.best.wealth, view.premium, sales.cfg) } : null;
  const tierUp = WEALTH.indexOf(lead.salesWealth) - WEALTH.indexOf(walkIn?.wealth ?? view.buyerList[0]?.wealth ?? 'comfortable');
  return {
    lead, shelter, region: view, regionId,
    base, bonus, price,
    walkIn, // null: nobody else in this region would buy at all
    tierUp: walkIn ? Math.max(0, tierUp) : 0,
    onlyBuyer: !walkIn,
    referrals: cfg.referrals[lead.tier] ?? 0,
  };
}

/**
 * Sell a finished shelter to a lead: the boosted price goes through the world map's sale (ledger,
 * Pushback, Midnight record), the lead is consumed, and referrals land in that region's demand.
 */
export function redeemLead(sales, inventory, leadId, shelterId, cfg = REDEMPTION) {
  const q = quoteLead(sales, inventory, leadId, shelterId, cfg);
  if (q.error) throw new Error(q.error);
  const record = sales.sell(q.regionId, shelterId, { lead: inventory.asBuyer(q.lead), priceBonus: q.bonus.total });
  inventory.consume(q.lead.id, { saleId: record.id });
  const refs = q.referrals * referralMultiplier(record.traits ?? []); // #163: Influencers double referral leads
  const fresh = refs > 0 ? sales.market.addLeads(q.regionId, refs) : [];
  record.leadId = q.lead.id;
  record.leadBonus = q.bonus.total;
  return { record, quote: q, referrals: fresh.length };
}
