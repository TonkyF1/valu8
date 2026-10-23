// Modular adjustment layer for the own-comps engine. Each function is pure and
// returns { pct, label, basis } where basis says whether the weight is FITTED
// from our data or a documented HEURISTIC (to be refitted as data grows).
import { fitOwnComps, priceOwnComps, type CompListing, type CompQuery, type OwnCompsModel, type OwnCompsResult } from "./ownComps.ts";
import { OWN_COMPS_ROWS } from "./ownCompsData.ts";

export interface Adj { key: string; label: string; pct: number; basis: "fitted" | "heuristic" | "declared" | "stub"; blocksValuation?: boolean }

/** UK market trend by segment+month from listing dates: median residual of that month vs all, shrunk (k=20). */
export function marketTrend(rows: { month: string; segment: string; residual: number }[], segment: string, month: string): Adj {
  const seg = rows.filter((r) => r.segment === segment), cur = seg.filter((r) => r.month === month);
  const months = new Set(seg.map((r) => r.month));
  if (months.size < 2 || cur.length < 20) return { key: "trend", label: "Market trend (not enough monthly history yet)", pct: 0, basis: "heuristic" };
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
  const d = (mean(cur.map((r) => r.residual)) - mean(seg.map((r) => r.residual))) * cur.length / (cur.length + 20);
  return { key: "trend", label: `Market trend ${segment} ${month}`, pct: Math.round((Math.exp(d) - 1) * 1000) / 10, basis: "fitted" };
}

/** Rarity: thin comps or low-volume/performance cars widen the range; no price change (avoids hype premiums). */
export function rarity(nComps: number, segment: string): Adj & { rangeWiden: number } {
  const thin = nComps < 3, perf = segment === "perf";
  return { key: "rarity", label: thin ? `Only ${nComps} comparable listings` : "Comparable volume OK", pct: 0, basis: "heuristic",
    rangeWiden: thin ? (perf ? 1.6 : 1.4) : perf && nComps < 8 ? 1.2 : 1 };
}

/** Condition from the user's/AI 1-10 score: 7 = neutral, ±3%/point, capped ±15%. */
export function conditionAdj(score?: number | null): Adj {
  if (score == null || !Number.isFinite(score)) return { key: "condition", label: "Condition not scored", pct: 0, basis: "heuristic" };
  const pct = Math.max(-15, Math.min(9, (Math.max(1, Math.min(10, score)) - 7) * 3));
  return { key: "condition", label: `Condition ${score}/10`, pct, basis: "heuristic" };
}

/** Photo condition score in [-1, 1] from an existing provider; neutral when none. No paid API. */
export interface PhotoConditionProvider { score(insights: { severity?: string }[]): number }
export const photoInsightProvider: PhotoConditionProvider = {
  score: (ins) => Math.max(-1, Math.min(1, ins.reduce((a, i) => a + (i.severity === "notable" ? -0.25 : i.severity === "minor" ? -0.08 : i.severity === "positive" ? 0.08 : 0), 0))),
};
export function photoAdj(insights: { severity?: string }[] = [], provider: PhotoConditionProvider = photoInsightProvider): Adj {
  const s = insights.length ? provider.score(insights) : 0;
  return { key: "photos", label: insights.length ? "Photo condition" : "No photo signal (neutral)", pct: Math.round(s * 8 * 10) / 10, basis: insights.length ? "heuristic" : "stub" };
}

/** Write-off / stolen. Not available from free DVLA/MOT data, so uses the user's own declaration.
 * Cat S/N: fitted listing effect (cond coef) clamped to -25..-40%. Cat A/B or stolen: no valuation. */
export function writeOffAdj(declared: string | null | undefined, fittedCondLog: number): Adj {
  const t = String(declared ?? "").toLowerCase();
  if (/\bstolen\b|\bcat(egory)?\s*[ab]\b/.test(t)) return { key: "writeoff", label: "Cat A/B or stolen declared — no valuation", pct: -100, basis: "declared", blocksValuation: true };
  if (/\bcat(egory)?\s*[sn]\b|\bcat ?[cd]\b|write.?off/.test(t)) {
    const pct = Math.max(-40, Math.min(-25, Math.round((Math.exp(fittedCondLog) - 1) * 100)));
    return { key: "writeoff", label: "Insurance write-off (Cat S/N) declared", pct, basis: "declared" };
  }
  return { key: "writeoff", label: "No write-off declared", pct: 0, basis: "declared" };
}

// ---- Shared model (fitted once per isolate) + extra comps from our DB ----
export function embeddedListings(): CompListing[] {
  return OWN_COMPS_ROWS.map(([make, model, variant, year, mileage, fuel, auto, dealer, price, cond]) => ({
    make, model, variant, year, mileage, fuel: ["petrol", "diesel", "hybrid"][fuel], gearbox: auto ? "automatic" : "manual",
    seller: dealer ? "dealer" : "private", price, cat_sn: !!cond,
  }));
}
let cached: OwnCompsModel | null = null;
/** extra: rows from market_listings / sale_feedback (sold prices weight 3). */
export function ownCompsModel(extra: CompListing[] = []): OwnCompsModel {
  if (!extra.length && cached) return cached;
  const m = fitOwnComps([...embeddedListings(), ...extra]);
  if (!extra.length) cached = m;
  return m;
}

export interface OwnValuation extends OwnCompsResult { adjustments: Adj[]; finalPrivate: number; finalLow: number; finalHigh: number; unavailable: boolean }
export function valueWithOwnComps(q: CompQuery & { conditionScore?: number; photoInsights?: { severity?: string }[]; declaredStatus?: string }, extra: CompListing[] = []): OwnValuation {
  const m = ownCompsModel(extra);
  const base = priceOwnComps(m, { ...q, cat_sn: false, no_mot: false, non_runner: false });
  const rar = rarity(base.nComps, base.segment);
  const adjs: Adj[] = [conditionAdj(q.conditionScore), photoAdj(q.photoInsights), writeOffAdj(q.declaredStatus, m.params.cond), rar];
  const unavailable = adjs.some((a) => a.blocksValuation);
  const f = unavailable ? 0 : adjs.reduce((x, a) => x * (1 + a.pct / 100), 1);
  const r50 = (n: number) => Math.round(n / 50) * 50;
  const mid = base.privatePrice * f;
  const wl = (base.privatePrice - base.low) * rar.rangeWiden * f, wh = (base.high - base.privatePrice) * rar.rangeWiden * f;
  return { ...base, adjustments: adjs, unavailable, finalPrivate: r50(mid), finalLow: r50(Math.max(0, mid - wl)), finalHigh: r50(mid + wh) };
}
