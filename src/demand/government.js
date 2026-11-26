// Government shelter contracts (#161; GDD Core loop "Crisis dividend", Company and board > Money).
//
// "Government shelter contracts (high volume, low prestige, heat −1 each) appear in any region where a track is at
// Brink." Each crisis week, every region exposed (high or medium) to an open track at its Brink gets one offer, if it
// has none open: a block of plain volume shelters for the state. Signing pays through the one ledger as a 'sales'
// entry in the 'government' revenue stream, cools heat by 1 (working for the government looks respectable), and adds
// no prestige. Unsigned offers lapse after a few weeks. Size and price are stand-ins in TUNING.government.
//
// L1 simplification: the volume shelters are prefab blocks the state builds to your plans, so a signed contract
// pays at signing and doesn't take crews or grid space. Noted in the report.
//
//   const gov = new GovernmentContracts({ crisis, regions: market.regions, ledger, pushback: pb });
//   gov.refresh()              // offers for tracks at Brink now (also runs every crisis week)
//   gov.offersIn('mea')        // -> [{ id, region, track, shelters, price, expires }]
//   gov.sign(id)               // -> { ok, offer } and pays, heat -1

import { TUNING } from '../config/tuning.js';

export class GovernmentContracts {
  constructor({ crisis, regions = [], ledger = null, pushback = null, cfg = TUNING.government } = {}) {
    this.crisis = crisis;
    this.regions = regions;
    this.ledger = ledger;
    this.pb = pushback;
    this.cfg = { ...TUNING.government, ...cfg };
    this.offers = []; // open offers
    this.signed = []; // { id, region, track, shelters, price, week }
    this.nextId = 1;
    this._listeners = new Set();
    this._off = crisis?.on?.('week', () => this.refresh());
  }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit(e) { for (const fn of this._listeners) fn(e, this); }

  get week() { return this.crisis?.week ?? 0; }

  /** Tracks at their Brink that this region is exposed to (high/medium). */
  brinkTracksIn(region) {
    return Object.values(this.crisis?.tracks ?? {}).filter((t) => t.open && t.state === 'brink' && this.cfg.exposures.includes(region.exposure?.[t.id]));
  }

  /** Lapse old offers and post new ones where a track is at Brink. */
  refresh() {
    let changed = false;
    const keep = this.offers.filter((o) => o.expires > this.week);
    if (keep.length !== this.offers.length) { changed = true; this.offers = keep; }
    for (const region of this.regions) {
      if (this.offers.length >= this.cfg.maxOpen) break;
      if (this.offers.some((o) => o.region === region.id)) continue;
      const tracks = this.brinkTracksIn(region);
      if (!tracks.length) continue;
      const shelters = this.cfg.shelters;
      const offer = {
        id: `gov-${this.nextId++}`, region: region.id, regionName: region.name, track: tracks[0].id, trackName: tracks[0].name,
        shelters, price: shelters * this.cfg.pricePerShelter, heat: this.cfg.heat, expires: this.week + this.cfg.offerWeeks,
      };
      this.offers.push(offer);
      changed = true;
      this._emit({ type: 'offer', offer });
    }
    if (changed) this._emit({ type: 'change' });
    return this.offers;
  }

  offersIn(regionId) { return this.offers.filter((o) => o.region === regionId); }

  /** Sign an open offer: pays at signing (government stream), heat -1, no prestige. */
  sign(id) {
    const offer = this.offers.find((o) => o.id === id);
    if (!offer) return { ok: false, reason: 'That contract is no longer on the table.' };
    this.offers = this.offers.filter((o) => o !== offer);
    this.ledger?.record('sales', `Government contract: ${offer.shelters} volume shelters (${offer.regionName})`, offer.price, { stream: 'government' });
    this.pb?.addHeat?.(offer.heat, `Government contract (${offer.regionName})`);
    this.signed.push({ id: offer.id, region: offer.region, track: offer.track, shelters: offer.shelters, price: offer.price, week: this.week });
    this._emit({ type: 'sign', offer });
    this._emit({ type: 'change' });
    return { ok: true, offer };
  }

  /** Save slot. */
  toJSON() { return { offers: this.offers.map((o) => ({ ...o })), signed: this.signed.map((s) => ({ ...s })), nextId: this.nextId }; }
  load(d = {}) {
    this.offers = (d.offers ?? []).map((o) => ({ ...o }));
    this.signed = (d.signed ?? []).map((s) => ({ ...s }));
    this.nextId = d.nextId ?? this.offers.length + this.signed.length + 1;
    this._emit({ type: 'change' });
  }

  destroy() { this._off?.(); }
}
