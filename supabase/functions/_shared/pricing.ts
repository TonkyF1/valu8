// Valu8 pricing calibration — pure functions, unit-tested and backtested
// (scripts/backtest.ts). Rationale for every constant is documented inline and in
// docs/pricing-calibration.md.

import { clamp, roundToGrain } from "./valuation-math.ts";

export type Comp = { price: number; miles?: number | null; year?: number | null };

/**
 * Mileage elasticity of used-car prices. -0.18 means a car with 2x the miles of a
 * comparable is worth ~12% less (2^-0.18 = 0.88). Applied per comparable so a
 * 180k-mile car is not priced off 60k-mile listings.
 */
export const MILEAGE_ELASTICITY = -0.18;
/** Typical UK used depreciation per year of age for 3–12 year-old cars. */
export const AGE_FACTOR_PER_YEAR = 0.88;

export function compAdjustmentFactor(carMiles: number, carYear: number, comp: Comp): number {
  let f = 1;
  if (comp.miles != null && Number.isFinite(comp.miles) && comp.miles > 0) {
    const m = Math.pow(Math.max(carMiles, 5000) / Math.max(comp.miles, 5000), MILEAGE_ELASTICITY);
    f *= clamp(m, 0.7, 1.15);
  }
  if (comp.year != null && Number.isFinite(comp.year) && comp.year > 1900) {
    const dy = clamp(comp.year - carYear, -4, 4);
    f *= Math.pow(AGE_FACTOR_PER_YEAR, dy);
  }
  return f;
}

/** Median of comps after correcting each one to this car's mileage and year. */
export function compAdjustedAnchor(comps: Comp[], carMiles: number, carYear: number): number | null {
  const vals = comps
    .filter((c) => Number.isFinite(c.price) && c.price > 0)
    .map((c) => c.price * compAdjustmentFactor(carMiles, carYear, c))
    .sort((a, b) => a - b);
  if (!vals.length) return null;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
}

/**
 * High-mileage penalty on top of normal mileage depreciation: above ~140k miles
 * the private buyer pool shrinks sharply (finance/warranty unavailable), so values
 * fall faster than the elasticity curve. Up to -35% by 200k.
 */
export function highMileagePenalty(miles: number): number {
  return 0.35 * clamp((miles - 140_000) / 60_000, 0, 1);
}

/**
 * Private-sale value from a dealer-retail figure. MarketCheck listings are
 * overwhelmingly dealer forecourt prices, which carry a roughly fixed cost
 * (prep, warranty, margin ≈ £750) plus a proportional margin (~7%). A fixed+
 * proportional model naturally widens the gap on cheap cars, where dealer
 * margin is a bigger share of the price.
 */
export function privateFromRetail(retail: number, miles: number): number {
  // Condition is already applied to retail via the condition multiplier.
  let p = retail * 0.93 - 750;
  p = clamp(p, retail * 0.68, retail * 0.9);
  return p * (1 - highMileagePenalty(miles));
}

export function tradeFrom(retail: number, privateSale: number): number {
  return Math.min(retail * 0.74, privateSale * 0.9);
}

const DURABLE_MAKES = /^(toyota|honda|lexus|mazda|suzuki)$/i;

/**
 * Calibrate the AI fallback (no live comps) estimate.
 * - Models anchor on dealer listings in their training data, so newer cars come
 *   out high: <=5y -12%, 5–10y -3%, older cars get no discount (their market is
 *   mostly private already).
 * - Same high-mileage penalty as the comps path.
 * - Old/cheap floor: a running, MOT'd car at or below average mileage rarely
 *   trades privately for under ~£1,500; durable makes hold ~15% more at 10+ years.
 */
export function calibrateAiPrivate(params: {
  aiPrivate: number;
  make: string;
  year: number;
  miles: number;
  currentYear: number;
  motValid: boolean;
}): { privateSale: number; notes: string[] } {
  const { aiPrivate, make, year, miles, currentYear, motValid } = params;
  const age = Math.max(0, currentYear - year);
  const notes: string[] = [];
  const dealerBias = age <= 5 ? 0.12 : age <= 10 ? 0.03 : 0;
  let p = aiPrivate * (1 - dealerBias);
  if (dealerBias) notes.push(`dealer-bias -${Math.round(dealerBias * 100)}%`);
  const hm = highMileagePenalty(miles);
  if (hm > 0) { p *= 1 - hm; notes.push(`high-mileage -${Math.round(hm * 100)}%`); }
  const expected = Math.max(age * 8000, 3000);
  const durable = DURABLE_MAKES.test(make.trim());
  if (age >= 10 && durable) { p *= 1.15; notes.push("durable make +15%"); }
  if (age >= 10 && motValid && miles / expected <= 1.1 && miles < 140_000) {
    const floor = 1500 * (durable ? 1.15 : 1);
    if (p < floor) { p = floor; notes.push(`old-car floor £${Math.round(floor)}`); }
  }
  return { privateSale: p, notes };
}

/**
 * Suggested asking range shown to the seller. Guarantees the realistic private
 * figure sits at or below the low end, so we never tell someone to ask less than
 * the car is worth.
 */
export function askRange(privateSale: number, askBase: number): { low: number; high: number; base: number } {
  const base = Math.max(askBase || 0, privateSale);
  const spread = Math.max(250, Math.round((base * 0.035) / 50) * 50);
  const low = Math.max(Math.ceil(privateSale / 50) * 50, Math.round((base - spread) / 50) * 50);
  const high = Math.max(low + 2 * Math.max(100, Math.round((spread / 2) / 50) * 50), Math.round((base + spread) / 50) * 50);
  return { low, high, base };
}

/** Private-sale range around the realistic figure; always contains it. */
export function privateRange(privateSale: number, spread: number): { low: number; high: number } {
  const low = roundToGrain(privateSale * (1 - spread * 0.8));
  const high = roundToGrain(privateSale * (1 + spread));
  return { low: Math.min(low, privateSale), high: Math.max(high, privateSale) };
}

export type PhotoImpact = { priceImpact?: number | string | null };

/** Net photo impact = exact sum of the line items shown (coerced to numbers). */
export function sumPhotoImpacts(items: PhotoImpact[] | null | undefined): number {
  return (items ?? []).reduce((s, i) => {
    const n = Number(i?.priceImpact);
    return s + (Number.isFinite(n) ? Math.round(n) : 0);
  }, 0);
}

function normSentence(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9£%]+/g, " ").trim();
}

export function splitSentences(text: string): string[] {
  return String(text ?? "").split(/(?<=[.!?])\s+(?=[A-Z0-9£"'(])/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Remove sentences repeated verbatim (case/punctuation-insensitive), both within
 * a field and across fields in order. `seen` is shared so callers can dedupe a
 * whole report. Short fragments (<20 chars) are never treated as duplicates.
 */
export function dedupeSentences(text: string, seen: Set<string> = new Set()): string {
  if (!text) return text;
  const out: string[] = [];
  for (const s of splitSentences(text)) {
    const k = normSentence(s);
    if (k.length >= 20 && seen.has(k)) continue;
    if (k.length >= 20) seen.add(k);
    out.push(s);
  }
  return out.join(" ");
}

export const NARRATIVE_FIELDS = [
  "headline", "marketContext", "valueReasoning", "honestAnalysis", "marketPositioning",
  "photoObservations", "marketConfidenceReason", "rareCarWarning", "sellerTip",
] as const;

/** Dedupe sentences across the report's narrative fields (returns a shallow copy). */
export function dedupeReportText<T extends Record<string, any>>(report: T): T {
  const seen = new Set<string>();
  const out: any = { ...report };
  for (const f of NARRATIVE_FIELDS) {
    if (typeof out[f] === "string") out[f] = dedupeSentences(out[f], seen);
  }
  if (out.expertInsight && typeof out.expertInsight.reason === "string") {
    out.expertInsight = { ...out.expertInsight, reason: dedupeSentences(out.expertInsight.reason, seen) };
  }
  return out;
}
