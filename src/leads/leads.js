// Leads: the sales pipeline resource (director note D2: leads come from going to events and talking
// to guests). A lead is a person you met who might buy a shelter. You hold leads in an inventory;
// shelter sales on the world map consume them. Pure data and rules: no DOM, no dialogue UI.
//
//   const inv = new LeadInventory({ getQuarter: () => clock.quarter });
//   const lead = inv.fromDialogue({ guest, venueId, outcome: { interest: 80 } })   // dialogue result -> lead
//   inv.open({ region: 'coastal' })      -> leads you can sell to, best first
//   inv.expire()                         -> closes leads past their expiry quarter (call at quarter start)
//   inv.sell(sales, shelterId, lead.id)  -> sells through the world map's sales hook and consumes the lead
//
// LEAD     { id, source: { type: 'event', venueId, quarter, guestId }, guest: { id, name },
//            region (GDD region id), salesRegion (world-map region id), wealthClass (C1-C5),
//            quality 0-100, tier cold|warm|hot, fears, traits, createdQuarter, expiresQuarter,
//            status open|consumed|expired|lost, closedQuarter, saleId }
// EXPIRY   a lead stays open through `expiresQuarter` and expires at the start of the next quarter.
//          Lifetime by tier: cold leads last the quarter they were made, warm one more, hot two more.
// QUALITY  from the dialogue outcome (0-100). Every 20 points of reputation or Showroom prestige above
//          40 adds a step (GDD: World canvas > Demand), capped at 100.

import { GDD_REGIONS } from '../world/tracks.js';

export const LEADS = Object.freeze({
  tiers: [{ id: 'hot', min: 75, lifetime: 2 }, { id: 'warm', min: 40, lifetime: 1 }, { id: 'cold', min: 0, lifetime: 0 }],
  maxOpen: 24, // the CEO's rolodex: past this, the oldest cold lead is dropped
  qualityStep: 20,
});

export const WEALTH_CLASSES = Object.freeze(['C1', 'C2', 'C3', 'C4', 'C5']);

// Until the world map (#3) moves to the GDD regions, each GDD region maps onto one of the map's
// eight sales regions, and each GDD wealth class onto the map's four price bands. Provisional.
export const GDD_TO_SALES_REGION = Object.freeze({ heartland: 'nam', coastal: 'eur', tech: 'eas', capitals: 'mea', north: 'sas', equator: 'afr', islands: 'oce', frontier: 'lat' });
export const CLASS_TO_SALES_WEALTH = Object.freeze({ C1: 'comfortable', C2: 'rich', C3: 'ultra', C4: 'apex', C5: 'apex' });
// Which client archetype (src/clients) a lead of each class becomes at the sale, by default.
export const CLASS_TO_CLIENT_TYPE = Object.freeze({ C1: 'prepper', C2: 'tech_founder', C3: 'oil_heir', C4: 'oil_heir', C5: 'politician' });

export const tierFor = (quality) => LEADS.tiers.find((t) => quality >= t.min).id;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Validate the fields of a lead; returns a list of problems (empty when fine). */
export function validateLead(l) {
  const bad = [];
  if (!l.guest?.name) bad.push('guest.name');
  if (!GDD_REGIONS.some((r) => r.id === l.region)) bad.push(`region "${l.region}"`);
  if (!WEALTH_CLASSES.includes(l.wealthClass)) bad.push(`wealthClass "${l.wealthClass}"`);
  if (!(l.quality >= 0 && l.quality <= 100)) bad.push('quality');
  if (!Number.isInteger(l.expiresQuarter) || l.expiresQuarter < l.createdQuarter) bad.push('expiresQuarter');
  return bad;
}

export class LeadInventory {
  constructor({ getQuarter = () => 1, getReputation = () => 40, getShowroomPrestige = () => 0, maxOpen = LEADS.maxOpen } = {}) {
    this.getQuarter = getQuarter;
    this.getReputation = getReputation;
    this.getShowroomPrestige = getShowroomPrestige;
    this.maxOpen = maxOpen;
    this.leads = [];
    this._id = 0;
    this._listeners = new Set();
  }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit(e) { for (const fn of this._listeners) fn(e, this); }

  /**
   * Create a lead. Required: guest { id?, name }, region (GDD id), wealthClass, quality.
   * Optional: source, fears, traits, quarter (defaults to now), lifetime (quarters; defaults by tier).
   */
  create({ guest, region, wealthClass, quality, source = { type: 'manual' }, fears = [], traits = [], quarter = this.getQuarter(), lifetime = null, bonus = true } = {}) {
    const steps = bonus ? Math.floor(Math.max(0, this.getReputation() - 40) / LEADS.qualityStep) + Math.floor(Math.max(0, this.getShowroomPrestige() - 40) / LEADS.qualityStep) : 0;
    const q = clamp(Math.round((quality ?? 0) + steps * 10), 0, 100);
    const tier = tierFor(q);
    const life = lifetime ?? LEADS.tiers.find((t) => t.id === tier).lifetime;
    const lead = {
      id: ++this._id,
      source: { ...source },
      guest: { id: guest?.id ?? null, name: guest?.name },
      region,
      salesRegion: GDD_TO_SALES_REGION[region] ?? null,
      wealthClass,
      salesWealth: CLASS_TO_SALES_WEALTH[wealthClass] ?? null,
      clientType: CLASS_TO_CLIENT_TYPE[wealthClass] ?? 'prepper',
      quality: q,
      tier,
      fears: [...fears],
      traits: [...traits],
      createdQuarter: quarter,
      expiresQuarter: quarter + life,
      status: 'open',
      closedQuarter: null,
      saleId: null,
    };
    const bad = validateLead(lead);
    if (bad.length) throw new Error(`Invalid lead: ${bad.join(', ')}`);
    this.leads.push(lead);
    this._enforceCap(quarter);
    this._emit({ type: 'created', lead });
    return lead;
  }

  /**
   * Turn a dialogue outcome into a lead (or nothing). The dialogue system (a later ticket) reports
   * `outcome = { interest 0-100, lead: true|false, traits?, note? }` for a guest met at an event.
   * Guests come from src/events/attend.js: { id, name, wealthClass, region, fears, venueId }.
   */
  fromDialogue({ guest, venueId = guest?.venueId, outcome = {}, quarter = this.getQuarter() } = {}) {
    if (outcome.lead === false || (outcome.interest ?? 0) <= 0) return null;
    if (this.leads.some((l) => l.status === 'open' && l.guest.id != null && l.guest.id === guest.id)) return null; // already in the pipeline
    return this.create({
      guest, region: guest.region, wealthClass: guest.wealthClass, quality: outcome.interest,
      source: { type: 'event', venueId, quarter, guestId: guest.id, note: outcome.note ?? null },
      fears: guest.fears ?? [], traits: outcome.traits ?? [], quarter,
    });
  }

  get(id) { return this.leads.find((l) => l.id === id) ?? null; }

  /** Open leads, best first (hot before warm before cold, then richer class, then sooner expiry). */
  open({ region = null, salesRegion = null } = {}) {
    const rank = { hot: 0, warm: 1, cold: 2 };
    return this.leads
      .filter((l) => l.status === 'open' && (!region || l.region === region) && (!salesRegion || l.salesRegion === salesRegion))
      .sort((a, b) => rank[a.tier] - rank[b.tier] || WEALTH_CLASSES.indexOf(b.wealthClass) - WEALTH_CLASSES.indexOf(a.wealthClass) || a.expiresQuarter - b.expiresQuarter);
  }

  /** Close every open lead whose expiry quarter has passed. Call at the start of each quarter. */
  expire(quarter = this.getQuarter()) {
    const gone = this.leads.filter((l) => l.status === 'open' && quarter > l.expiresQuarter);
    for (const l of gone) { l.status = 'expired'; l.closedQuarter = quarter; }
    if (gone.length) this._emit({ type: 'expired', leads: gone });
    return gone;
  }

  /** Mark a lead used by a sale. */
  consume(id, { saleId = null, quarter = this.getQuarter() } = {}) {
    const l = this.get(id);
    if (!l || l.status !== 'open') return null;
    if (quarter > l.expiresQuarter) { this.expire(quarter); return null; }
    l.status = 'consumed';
    l.closedQuarter = quarter;
    l.saleId = saleId;
    this._emit({ type: 'consumed', lead: l });
    return l;
  }

  /** A rival poached it (event deck / rivals can call this). */
  lose(id, quarter = this.getQuarter()) {
    const l = this.get(id);
    if (!l || l.status !== 'open') return null;
    l.status = 'lost';
    l.closedQuarter = quarter;
    this._emit({ type: 'lost', lead: l });
    return l;
  }

  /**
   * Sell a finished shelter to one of your leads through the world map's sales hook. The sale happens
   * in the lead's (mapped) region; the lead is consumed only if the sale goes through.
   */
  sell(sales, shelterId, leadId) {
    const l = this.get(leadId);
    if (!l || l.status !== 'open') throw new Error('That lead is not open.');
    const record = sales.sell(l.salesRegion, shelterId, { lead: this.asBuyer(l) });
    this.consume(l.id, { saleId: record.id });
    return record;
  }

  /** The shape the world map's sales hook takes as a buyer. */
  asBuyer(l) {
    return { id: `lead-${l.id}`, pipelineId: l.id, region: l.salesRegion, wealth: l.salesWealth, type: l.clientType, name: l.guest.name, quality: l.quality, leverage: l.leverage ?? 0 };
  }

  _enforceCap(quarter) {
    let open = this.leads.filter((l) => l.status === 'open');
    while (open.length > this.maxOpen) {
      const drop = [...open].sort((a, b) => (a.tier === 'cold' ? 0 : 1) - (b.tier === 'cold' ? 0 : 1) || a.id - b.id)[0];
      drop.status = 'lost';
      drop.closedQuarter = quarter;
      open = open.filter((l) => l !== drop);
    }
  }

  counts() {
    const c = { open: 0, consumed: 0, expired: 0, lost: 0 };
    for (const l of this.leads) c[l.status] += 1;
    return c;
  }

  toJSON() { return { v: 1, id: this._id, leads: this.leads.map((l) => ({ ...l, source: { ...l.source }, guest: { ...l.guest }, fears: [...l.fears], traits: [...l.traits] })) }; }
  load(d) {
    if (!d || d.v !== 1) return;
    this._id = d.id;
    this.leads = d.leads.map((l) => ({ ...l, source: { ...l.source }, guest: { ...l.guest }, fears: [...l.fears], traits: [...l.traits] }));
    this._emit({ type: 'load' });
  }
}
