import { coherentPricing } from "../../supabase/functions/_shared/coherentPricing";

/** Market range from the existing fair-price function (live UK listing prices, mileage-adjusted). */
export interface MarketRange { low: number; mid: number; high: number }

export type AdvertVerdict = "overpriced" | "fair" | "bargain";

export interface AdvertCheck {
  verdict: AdvertVerdict;
  privateLow: number; privateSale: number; privateHigh: number;
  retailLow: number; retailMid: number; retailHigh: number;
  /** % the asking price sits above (+) / below (−) the retail median. */
  vsRetailPct: number;
}

/** Listings are dealer-style asking prices; a realistic private sale sits roughly 1/1.2 of the median. */
export const RETAIL_TO_PRIVATE = 1 / 1.2;
const r50 = (n: number) => Math.round(n / 50) * 50;

export function parseMoney(v: string | number): number {
  const n = Number(String(v).replace(/[£,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : NaN;
}

/**
 * Overpriced: above the top of the retail range. Bargain: below the bottom of the private range.
 * Fair: anywhere in between (private low → retail high).
 */
export function checkAdvert(asking: number, m: MarketRange): AdvertCheck | null {
  if (![asking, m.low, m.mid, m.high].every((x) => Number.isFinite(x) && x > 0)) return null;
  const retailLow = Math.min(m.low, m.mid), retailHigh = Math.max(m.high, m.mid);
  const p = coherentPricing({ privateSale: r50(m.mid * RETAIL_TO_PRIVATE), retail: m.mid, tradeIn: null, privateLow: null, privateHigh: null, buffer: null });
  const verdict: AdvertVerdict = asking > retailHigh ? "overpriced" : asking < p.privateLow ? "bargain" : "fair";
  return {
    verdict, privateLow: p.privateLow, privateSale: p.privateSale, privateHigh: p.privateHigh,
    retailLow, retailMid: m.mid, retailHigh, vsRetailPct: Math.round(((asking - m.mid) / m.mid) * 100),
  };
}
