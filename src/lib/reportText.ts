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

const GUMTREE_RE = /(?:\b[\w.]+(?:\s+[\w.]+)?\s*\/\s*)?\bgumtree(?:\.com)?\b(?:\s*\/\s*[\w.]+)?/gi;
/** Replaces named classified sites we must not mention with neutral wording. */
export function neutraliseSites(t: string): string {
  if (!/gumtree/i.test(t)) return t;
  return t
    .replace(GUMTREE_RE, "major UK car sites")
    .replace(/(major UK car sites)(?:\s*(?:,|and|or|&)\s*major UK car sites)+/gi, "$1");
}
/** Deep-walks AI-written text (skipping URLs/ids) and neutralises site names. */
function neutraliseDeep<T>(v: T, key = ""): T {
  if (typeof v === "string") return (/^(url|link|href|source|id)$/i.test(key) || /^https?:/i.test(v) ? v : neutraliseSites(v)) as T;
  if (Array.isArray(v)) return v.map((x) => neutraliseDeep(x, key)) as T;
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = neutraliseDeep(x, k);
    return o as T;
  }
  return v;
}

/** Fixes stale "long MOT" claims and source wording in already-saved reports. */
export function cleanReportText<T extends Textish>(r: T, motExpiry: string | null | undefined, now: Date = new Date()): T {
  const fix = (t?: string) => (t ? sanitizeMotClaim(t, motExpiry, now) : t);
  const keep = (l?: string[]) => motConsistentBullets(Array.isArray(l) ? l.filter((x) => !isFalseLongMotClaim(x, motExpiry, now)) : l, motExpiry, now);
  r = neutraliseDeep(r);
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
