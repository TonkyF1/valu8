import { dedupeReportText } from "../../supabase/functions/_shared/pricing";
import { fixOdometerWording } from "../../supabase/functions/_shared/vehicle-text";
import { isFalseLongMotClaim, motConsistentBullets, sanitizeMotClaim } from "../../supabase/functions/_shared/mot";
import { validatePhotoInsights } from "../../supabase/functions/_shared/photo-insights";

/** Old reports stored "54 live UK listings via MarketCheck"; reword to match the headline count. */
export function rewordSource(s: string): string {
  const m = s.match(/^([\d,]+) live UK listings via MarketCheck$/i);
  return m ? `Priced from the ${m[1]} closest-matching UK listings (MarketCheck)` : s;
}

/** "2,781 similar cars for sale in the UK · priced from the 54 closest matches" */
export function marketCountLine(totalForSale: number | null | undefined, sampleSize: number | null | undefined): string | null {
  const total = totalForSale && totalForSale > 0 ? totalForSale : null;
  const sample = sampleSize && sampleSize > 0 ? sampleSize : null;
  if (!total && !sample) return null;
  const parts: string[] = [];
  if (total) parts.push(`${total.toLocaleString("en-GB")} similar car${total === 1 ? "" : "s"} for sale in the UK`);
  if (sample) parts.push(`${total ? "priced" : "Priced"} from the ${sample.toLocaleString("en-GB")} closest match${sample === 1 ? "" : "es"}`);
  return parts.join(" · ");
}

type Textish = {
  honestAnalysis?: string; valueReasoning?: string; marketPositioning?: string; headline?: string;
  sellerTip?: string; marketContext?: string; strengths?: string[]; factorsUp?: string[];
  watchPoints?: string[]; factorsDown?: string[];
  recommendations?: { highlights?: string[]; documents?: string[] } & Record<string, unknown>;
  expertInsight?: { sources?: string[] } & Record<string, unknown>;
  photoInsights?: Array<{ observation?: string; priceImpact?: number; fixable?: boolean; fixCost?: number; photoIndex?: number; severity?: string; slot?: string }>;
};

/** Fixes stale "long MOT" claims and source wording in already-saved reports. */
export function cleanReportText<T extends Textish>(r: T, motExpiry: string | null | undefined, now: Date = new Date()): T {
  const fix = (t?: string) => (t ? sanitizeMotClaim(t, motExpiry, now) : t);
  const keep = (l?: string[]) => motConsistentBullets(Array.isArray(l) ? l.filter((x) => !isFalseLongMotClaim(x, motExpiry, now)) : l, motExpiry, now);
  return dedupeReportText({
    ...r,
    // Validated in the function too; re-run so reports saved before that are consistent.
    photoInsights: Array.isArray(r.photoInsights)
      ? validatePhotoInsights(r.photoInsights.map((p) => (p && typeof p.observation === "string" ? { ...p, observation: fixOdometerWording(p.observation) } : p)))
      : r.photoInsights,
    honestAnalysis: fix(r.honestAnalysis),
    valueReasoning: fix(r.valueReasoning),
    marketPositioning: fix(r.marketPositioning),
    headline: fix(r.headline),
    sellerTip: fix(r.sellerTip),
    marketContext: fix(r.marketContext),
    strengths: keep(r.strengths),
    factorsUp: keep(r.factorsUp),
    recommendations: r.recommendations
      ? { ...r.recommendations, highlights: keep(r.recommendations.highlights), documents: r.recommendations.documents?.map((d) => fix(d) as string) }
      : r.recommendations,
    expertInsight: r.expertInsight
      ? { ...r.expertInsight, sources: r.expertInsight.sources?.map(rewordSource) }
      : r.expertInsight,
  } as T);
}
