import { coherentPricing, type CoherentPricing } from "../../supabase/functions/_shared/coherentPricing";

/**
 * Suggested asking range shown on the report. Always sits ABOVE the realistic
 * private-sale figure so the seller has room to negotiate down to it:
 * low ≈ private +5%, high ≈ private +15%, rounded up to £50 (under £10k) or £100.
 */
export function askGrain(value: number): number {
  return value < 10000 ? 50 : 100;
}

export function roundUpTo(value: number, grain: number): number {
  return Math.ceil(value / grain) * grain;
}

export function suggestedAskRange(privateSale: number): { low: number; high: number } {
  if (!Number.isFinite(privateSale) || privateSale <= 0) return { low: 0, high: 0 };
  const grain = askGrain(privateSale);
  let low = roundUpTo(privateSale * 1.05, grain);
  if (low <= privateSale) low = roundUpTo(privateSale + grain, grain);
  let high = roundUpTo(privateSale * 1.15, grain);
  if (high <= low) high = low + grain * 2;
  return { low, high };
}

/** True when the valuation had at least one uploaded photo (condition score is only meaningful then). */
export function hasPhotos(photoUrls: unknown): boolean {
  return Array.isArray(photoUrls) && photoUrls.filter(Boolean).length > 0;
}

/**
 * Frontend normalisation: rebuild every report figure from one coherent model so
 * old saved reports (generated before the backend enforced ordering) display consistently.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normaliseReportPricing(r: any): CoherentPricing {
  return coherentPricing({
    privateSale: Number(r?.values?.privateSale) || 0,
    tradeIn: Number(r?.values?.dealerTradeIn) || null,
    retail: Number(r?.values?.dealerRetail) || null,
    privateLow: r?.valueRange?.privateSaleLow ?? null,
    privateHigh: r?.valueRange?.privateSaleHigh ?? null,
    buffer: r?.negotiationBuffer || r?.recommendations?.negotiationBuffer || null,
  });
}
