// Data-calibrated pricing layer (dataset: /workspace/dataset, Gumtree Oct 2026).
// Every rule is a small, explainable config entry. Entries whose evidence is
// still too thin are kept here but DISABLED (factor 1 / null) with the data
// that motivated them, so they can be switched on once the held-out set grows.

/** Below this many usable comps the comp anchor is shrunk toward a prior. */
export const THIN_COMP_FULL_WEIGHT = 5;

/**
 * Thin-sample shrinkage. A single listing is not a market: weight the comp
 * anchor by n/THIN_COMP_FULL_WEIGHT in log space and the AI-implied retail
 * prior by the rest. (2006 GL-Class, 1 comp: anchor £24,000, asking £2,500.)
 */
export function shrinkThinAnchor(compAnchor: number, priorRetail: number, n: number): { anchor: number; weight: number } {
  if (!(compAnchor > 0)) return { anchor: priorRetail, weight: 0 };
  if (!(priorRetail > 0) || n >= THIN_COMP_FULL_WEIGHT) return { anchor: compAnchor, weight: 1 };
  const w = Math.max(0, n) / THIN_COMP_FULL_WEIGHT;
  return { anchor: Math.exp(w * Math.log(compAnchor) + (1 - w) * Math.log(priorRetail)), weight: w };
}

/**
 * AI-fallback correction by age (multiplier on the calibrated AI private value).
 * 32 Gumtree AI-path cars: median ask/pred 0.90 for 12y+, but held-out medAPE
 * got WORSE (17.9% -> 21.7%) with 0.8 — disabled until more data (n<50).
 */
export const AI_AGE_FACTORS: { minAge: number; factor: number }[] = [{ minAge: 12, factor: 1 }];
export function aiAgeFactor(age: number): number {
  let f = 1;
  for (const r of AI_AGE_FACTORS) if (age >= r.minAge) f = r.factor;
  return f;
}

/**
 * Private-sale floor for 10y+, MOT'd, average-mileage (<140k) cars. Was £1,500,
 * but that is the MEDIAN Gumtree private ask for exactly those cars (n=49,
 * p10 £720, p20 £995, p50 £1,500) — a floor should sit near p20, so £1,000.
 */
export const OLD_CAR_FLOOR = 1000;

/**
 * Limited editions whose own comps are usually too few (<4) to price on.
 * Premium is applied to the parent-trim anchor; confidence drops a level.
 * Trophy-R: ~500 built, new £51k vs Trophy £32k (1.6x); Sasso Trophy-R asking
 * £46,995 vs Trophy-comp retail £26,300 (1.79x). 1.6 is the conservative one.
 */
export const LIMITED_EDITION_PREMIUM: Record<string, number> = { "Trophy-R": 1.6 };
/** Own-trim comps needed before a limited edition is priced on its own comps. */
export const LIMITED_EDITION_MIN_COMPS = 2;
/** Durable makes (Toyota/Honda/Lexus/Mazda/Suzuki) keep the old £1,725 floor: no counter-evidence (n=2) and the Auris backtest needs it. */
export const OLD_CAR_FLOOR_DURABLE = 1725;
