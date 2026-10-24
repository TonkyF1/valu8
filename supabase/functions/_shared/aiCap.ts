/**
 * Safety cap on the AI-only private-sale estimate, using our own-comps engine as a sanity check.
 * Fires ONLY on clear blowups: own-comps must be confident (exact-model match, >= MIN_COMPS comparables,
 * confidenceScore >= MIN_CONF) AND the AI figure must exceed own-comps by more than TRIGGER x.
 * When it fires, the private figure is pulled down to own-comps x CAP_MULT (still above own-comps).
 *
 * Calibrated 2026-10-24 on the own-comps tuning split (private adverts, model level, n>=50, conf>=0.6):
 * only ~3.5-4% of real asking prices sit above 1.6x the own-comps figure, so capping at 1.6x when the
 * AI is above 1.8x rarely hurts (sim: fires on ~14% of rows under the stored AI error distribution,
 * makes ~0.2% worse; median 36.7% -> 27.0% on the newest-10% benchmark). See docs/own-comps-pricing.md.
 */
export const AI_CAP = { MIN_COMPS: 50, MIN_CONF: 0.6, TRIGGER: 1.8, CAP_MULT: 1.6 } as const;

export interface AiCapInput {
  aiPrivate: number;
  own?: { privatePrice: number; level: string; nComps: number; confidenceScore: number; unavailable?: boolean } | null;
}
export interface AiCapResult { applied: boolean; aiRaw: number; ownComps: number | null; capped: number; ratio: number | null; reason: string }

export function aiSafetyCap({ aiPrivate, own }: AiCapInput): AiCapResult {
  const base = { aiRaw: Math.round(aiPrivate), ownComps: own ? Math.round(own.privatePrice) : null, capped: Math.round(aiPrivate) };
  if (!own || own.unavailable || !(own.privatePrice > 0) || !(aiPrivate > 0)) return { ...base, applied: false, ratio: null, reason: "no own-comps" };
  const ratio = Math.round((aiPrivate / own.privatePrice) * 100) / 100;
  if (own.level !== "model" || own.nComps < AI_CAP.MIN_COMPS || own.confidenceScore < AI_CAP.MIN_CONF) {
    return { ...base, applied: false, ratio, reason: "own-comps not confident" };
  }
  if (aiPrivate <= AI_CAP.TRIGGER * own.privatePrice) return { ...base, applied: false, ratio, reason: "within trigger" };
  const capped = Math.round((AI_CAP.CAP_MULT * own.privatePrice) / 50) * 50;
  return { ...base, applied: true, ratio, capped, reason: `AI ${ratio}x own-comps > ${AI_CAP.TRIGGER}x` };
}
