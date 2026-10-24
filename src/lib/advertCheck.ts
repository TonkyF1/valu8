/** Market range from the existing fair-price function (own-comps / AI estimate, or MarketCheck when enabled). */
export interface MarketRange { low: number; mid: number; high: number }

export type AdvertVerdict = "overpriced" | "fair" | "bargain";

export interface AdvertCheck {
  verdict: AdvertVerdict;
  privateLow: number; privateSale: number; privateHigh: number;
  retailLow: number; retailMid: number; retailHigh: number;
  /** % the asking price sits above (+) / below (−) the retail median. */
  vsRetailPct: number;
}

/**
 * fair-price returns a DEALER band (mid = typical dealer asking price). The engine's dealer
 * level is private × 1.1 + £1,500 (ownComps DEALER_NORM), so invert that to get the matching
 * private-sale figure. Cheap cars carry a bigger fixed dealer margin, so a flat ratio overstated them.
 */
const DEALER_FIXED = 1500, DEALER_MULT = 1.1;
export function dealerToPrivate(dealer: number): number {
  return Math.min(dealer / 1.08, Math.max(dealer * 0.6, (dealer - DEALER_FIXED) / DEALER_MULT));
}
/** @deprecated kept for compatibility; use dealerToPrivate. */
export const RETAIL_TO_PRIVATE = 1 / 1.2;
const r50 = (n: number) => Math.round(n / 50) * 50;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function parseMoney(v: string | number): number {
  const n = Number(String(v).replace(/[£,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : NaN;
}

/**
 * Two coherent ranges from one centre:
 *   privateLow ≤ privateSale ≤ privateHigh < retailLow ≤ retailMid ≤ retailHigh
 * Widths follow the market band's spread (halved — the raw band is single-advert noise,
 * often ±30–40%) and are clamped to 6–15% each side.
 * Overpriced: above the top of the dealer range. Bargain: below the bottom of the private range.
 */
export function checkAdvert(asking: number, m: MarketRange): AdvertCheck | null {
  if (![asking, m.low, m.mid, m.high].every((x) => Number.isFinite(x) && x > 0)) return null;
  const mid = m.mid;
  const sLo = clamp((mid - Math.min(m.low, mid)) / mid / 2, 0.06, 0.15);
  const sHi = clamp((Math.max(m.high, mid) - mid) / mid / 2, 0.06, 0.15);

  const privateSale = r50(dealerToPrivate(mid));
  const privateLow = r50(privateSale * (1 - sLo));
  // Private top never reaches past halfway to the dealer median.
  const privateHigh = Math.max(privateSale, r50(Math.min(privateSale * (1 + sHi), (privateSale + mid) / 2)));
  const retailHigh = Math.max(r50(mid * (1 + sHi)), mid + 100);
  const retailLow = Math.min(Math.max(r50(mid * (1 - sLo)), privateHigh + 50), mid);

  const verdict: AdvertVerdict = asking > retailHigh ? "overpriced" : asking < privateLow ? "bargain" : "fair";
  return {
    verdict, privateLow, privateSale, privateHigh,
    retailLow, retailMid: mid, retailHigh, vsRetailPct: Math.round(((asking - mid) / mid) * 100),
  };
}
