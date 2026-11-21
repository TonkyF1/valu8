// pf-1: how much the trim and the seller's own words moved the model price, for the "What moved your price" list.
// Explanation only: never feeds a shown price. Inputs are three pm-1 prices for the same car (with everything, without the
// trim, without the typed details) plus own-comps' fitted trim uplift. Shared by analyse-vehicle and the report UI.

export interface PriceFactors {
  version: "pf-1";
  /** Approximate % effect of the trim the seller typed (blend of pm-1 and own-comps). null = no trim given. */
  trimPct: number | null;
  trimLabel: string | null;
  /** Approx % effect on the shown price (pm-1's share of the blend) of the typed history/notes (service history, one owner, long MOT, declared damage...). null = none typed. */
  detailsPct: number | null;
}

const pct = (a: number, b: number) => (a > 0 && b > 0 ? Math.round((a / b - 1) * 1000) / 10 : 0);

export function priceFactorsFrom(x: {
  full: number; noTrim: number; noDetails: number; ocTrimPct?: number | null; variant?: string | null; details?: string | null;
}): PriceFactors | null {
  const variant = String(x.variant ?? "").trim();
  const details = String(x.details ?? "").trim();
  if (!variant && !details) return null;
  // ens-2 leans ~60/40 pm-1 / own-comps, so the trim effect is shown on the same footing.
  const trimPct = variant
    ? Math.round((0.6 * pct(x.full, x.noTrim) + 0.4 * (Number.isFinite(Number(x.ocTrimPct)) ? Number(x.ocTrimPct) : 0)) * 10) / 10
    : null;
  return {
    version: "pf-1",
    trimPct,
    trimLabel: variant ? variant.slice(0, 40) : null,
    detailsPct: details ? Math.round(0.6 * pct(x.full, x.noDetails) * 10) / 10 : null,
  };
}
