// Price-first: the early private-sale estimate returned by analyse-vehicle in `quick` mode.
// Everything here is display-only. The full call still produces (and saves) the final valuation.

/** The quick report from an analyse-vehicle response, or null when quick wasn't offered / isn't deployed / failed. */
export function quickReportFrom(data: unknown): any | null {
  const d = data as { quick?: unknown; report?: any } | null | undefined;
  if (!d || d.quick !== true || !d.report || typeof d.report !== "object") return null;
  const ps = Number(d.report?.values?.privateSale);
  if (!Number.isFinite(ps) || ps <= 0) return null;
  // Only ever the private-sale headline: strip anything else defensively so a paid-only figure can't reach the screen.
  const r = d.report;
  return {
    values: { privateSale: ps },
    valueRange: r.valueRange ? { privateSaleLow: r.valueRange.privateSaleLow, privateSaleHigh: r.valueRange.privateSaleHigh } : undefined,
    priceRange: r.priceRange,
  };
}

/** What the headline shows: the final band once there is one, else the early estimate while the full report is still loading. */
export function shownBand<B>(band: B | null, quickBand: B | null, stage: string): { band: B | null; early: boolean } {
  if (band) return { band, early: false };
  if (stage === "estimating" && quickBand) return { band: quickBand, early: true };
  return { band: null, early: false };
}
