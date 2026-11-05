/**
 * Report paywall helpers — strip paid fields for unpaid viewers and keep free
 * Essentials (headline private-sale figure, MOT summary, short teaser) intact.
 * Enforcement mirrors the FE checkout switch (PREMIUM_ENFORCED_DEFAULT / VITE_PREMIUM_ENFORCED);
 * do NOT flip the server PREMIUM_ENFORCED env (that 402s free analyse-vehicle).
 */
import { premiumEnforced } from "@/lib/entitlements";

export const FREE_TEASER_COMPS = 3;

/** Same FE switch as ReportCheckout; report-only (not analyse-vehicle). */
export function reportPaywallEnabled(): boolean {
  return premiumEnforced();
}

/** Placeholder skeleton rows — never real values blurred. */
export function placeholderLines(n = 3): string[] {
  return Array.from({ length: n }, (_, i) => `•••••••••••• ${i + 1}`);
}

/**
 * Deep-ish strip of paid report fields. Keeps private-sale headline values,
 * MOT history, strengths/watch, and up to FREE_TEASER_COMPS comps.
 * Mutates a shallow clone — safe to pass the result to React.
 */
export function stripPaidReportFields<T extends Record<string, any>>(report: T, opts?: { teaserComps?: number }): T {
  if (!report || typeof report !== "object") return report;
  const teaser = opts?.teaserComps ?? FREE_TEASER_COMPS;
  const r: any = { ...report };

  // Full comps list → teaser only
  if (Array.isArray(r.comparableListings)) {
    r.comparableListings = r.comparableListings.filter((c: any) => c && c.price > 0).slice(0, teaser);
  }

  // Asking / listing guidance
  delete r.recommendedAskingPrice;
  delete r.negotiationBuffer;
  if (r.recommendations && typeof r.recommendations === "object") {
    const rec = { ...r.recommendations };
    delete rec.recommendedAskingPrice;
    delete rec.negotiationBuffer;
    delete rec.listingPrice;
    r.recommendations = rec;
  }

  // Condition details (score stays gated in UI; strip numeric leak)
  delete r.conditionScore;
  delete r.conditionLabel;
  delete r.photoInsights;
  delete r.advert;

  // Repair / advisory cost bands often nested under insights payloads — strip common keys
  delete r.repairEstimate;
  delete r.repairEstimates;
  delete r.advisoryCosts;
  delete r.fixableUpside;

  // Price adjustments beyond the free narrative
  if (Array.isArray(r.priceAdjustments) && r.priceAdjustments.length > 4) {
    r.priceAdjustments = r.priceAdjustments.slice(0, 2);
  }

  return r as T;
}
