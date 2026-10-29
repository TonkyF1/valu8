// Headline private-sale RANGE for cheap cars (our own private estimate < £5,000). Pure TS, no imports: used by the edge
// functions (analyse-vehicle report.priceRange, emails) and the frontend (report page, share card, PDF, dashboard).
//
// Why: below £5k our single figure is much less precise (held-out median error ~22% vs ~10% above), so one number
// over-promises. Sized on the H1 time holdout (1,093 adverts first seen after the training snapshot; private adverts
// whose estimate was < £5k, n=231): actual/estimate is skewed upwards (adverts ask high), so the band is asymmetric:
//   estimate < £2,000:       x0.70 .. x1.50, £50 steps  (H1 69.7% inside, n=142)
//   estimate £2,000-£4,999:  x0.82 .. x1.35, £100 steps (H1 71.9% inside, n=89)
// Overall 70.6% of H1 private adverts inside; 60.8% on the later H2 holdout (scored once, not tuned on).
// The single midpoint (the engine's private figure) is unchanged and is still what we store (private_value).
// Low is rounded down and high up to the step. £5,000+ estimates: no range (single figure as before).

export const CHEAP_RANGE = {
  RULE: "cheap-range-1",
  THRESHOLD: 5000,
  TIERS: [
    { below: 2000, lo: 0.70, hi: 1.50, grain: 50 },
    { below: 5000, lo: 0.82, hi: 1.35, grain: 100 },
  ],
} as const;

// Older cars (16y+, any price): our figure is far less precise (held-out median error 27-48%), so show a wider band.
// Sized on private adverts first seen <= 2026-10-28 (15th-85th pct of actual/estimate), checked on 10-29 adverts:
//   16-19y x0.63..x1.40 (53% inside vs 50% cheap-range), 20-24y x0.62..x1.62 (55% vs 40%), 25y+ x0.65..x3.10 (68% vs 20%).
// Merged with the cheap-range band (widest of the two). Rule "old-range-1".
export const OLD_RANGE = {
  RULE: "old-range-1",
  TIERS: [
    { minAge: 25, lo: 0.65, hi: 3.10 },
    { minAge: 20, lo: 0.62, hi: 1.62 },
    { minAge: 16, lo: 0.63, hi: 1.40 },
  ],
} as const;

export interface PriceRange { low: number; high: number; mid: number; rule: string }

const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : null);

/** Range for a private estimate, or null when the estimate is missing or £5,000+. */
export function cheapPriceRange(estimate: unknown, ageYears?: unknown): PriceRange | null {
  const p = num(estimate);
  if (p == null) return null;
  const age = typeof ageYears === "number" && Number.isFinite(ageYears) ? ageYears : -1;
  const ot = OLD_RANGE.TIERS.find((x) => age >= x.minAge);
  if (ot) {
    const base = p < CHEAP_RANGE.THRESHOLD ? cheapPriceRange(p) : null;
    const grain = p < 2000 ? 50 : 100;
    const low = Math.max(grain, Math.floor((p * ot.lo) / grain) * grain, 0);
    const high = Math.ceil((p * ot.hi) / grain) * grain;
    return { low: Math.min(low, base?.low ?? low), high: Math.max(high, base?.high ?? high), mid: Math.round(p), rule: OLD_RANGE.RULE };
  }
  if (p >= CHEAP_RANGE.THRESHOLD) return null;
  const t = CHEAP_RANGE.TIERS.find((x) => p < x.below)!;
  const low = Math.max(t.grain, Math.floor((p * t.lo) / t.grain) * t.grain);
  const high = Math.max(low + t.grain, Math.ceil((p * t.hi) / t.grain) * t.grain);
  return { low, high, mid: Math.round(p), rule: CHEAP_RANGE.RULE };
}

/** Range to show for a stored report: the saved report.priceRange when present and consistent with the shown private
 *  figure, else computed from that figure (older reports). null = show the single figure. */
export function reportPriceRange(report: any, privateSale?: number | null): PriceRange | null {
  const p = num(privateSale ?? report?.values?.privateSale);
  if (p == null || report?.valuationUnavailable) return null;
  const s = report?.priceRange;
  if (s && num(s.low) && num(s.high) && s.low <= p && p <= s.high && (p < CHEAP_RANGE.THRESHOLD || s.rule === OLD_RANGE.RULE)) {
    return { low: s.low, high: s.high, mid: Math.round(p), rule: String(s.rule ?? CHEAP_RANGE.RULE) };
  }
  return cheapPriceRange(p);
}

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
/** "£700–£1,500" */
export function formatPriceRange(r: PriceRange, sep = "–"): string {
  return `${gbp(r.low)}${sep}${gbp(r.high)}`;
}
/** Headline private figure as text: a range below £5,000, else the single £ figure. */
export function headlinePrivateText(privateSale: number, report?: any, sep = "–"): string {
  const r = report ? reportPriceRange(report, privateSale) : cheapPriceRange(privateSale);
  return r ? formatPriceRange(r, sep) : gbp(privateSale);
}
