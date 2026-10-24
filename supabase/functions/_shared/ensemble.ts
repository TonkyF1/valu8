// Ensemble of pm-1 (trained model), own-comps and the AI estimate (after the AI safety cap). SHADOW ONLY (ensembleShadow).
// Tuned 2026-10-24 (scripts/pricemodel/ensemble_tune.py; docs/own-comps-pricing.md "Ensemble"):
//  * pm vs own-comps: segment-specific weights (price band x seller x pm-known x own-comps-confident x has-text, hierarchical
//    shrinkage, 10x repeated 2-fold cross-fitting on the 4,784-row stratified held-out set) did NOT beat one fixed geometric
//    weight (best 14.91% vs 14.98%, within noise; worst stratum +0.5-1pt). So the weight is fixed: pm^0.7 * oc^0.3.
//    Held-out median abs error: pm-1 (body filled) 15.56%, own-comps 16.98%, blend 14.98%.
//  * AI weight: only 32 labelled AI-path cases (cheap private cars, median £1,250). AI+cap 29.6%, pm 43.0%, blend 43.3%;
//    w_ai 0.8 -> 30.7%, leave-one-out-chosen weight 35.5%. So for <£5k we lean on the AI (0.8); above £5k there is no
//    labelled AI data and we use a neutral prior 0.5. Revisit when sale feedback arrives.
//  * Uncertainty: the pm-1 conformal ~80% range is re-centred on the ensemble and widened by disagreement d (max abs log
//    ratio between sources). Held-out coverage of the unwidened range by pm/oc disagreement: d<0.3 80-84%; 0.3-0.5 78%
//    (x1.05 restores 80%); >0.5 56% (x1.85 restores 80%, n=121). d>0.5 also sets lessCertain.
export interface EnsembleInput {
  pm: { private: number; low: number; high: number } | null;          // pm-1 private (with MOT adj if used)
  ownComps?: { privatePrice: number; unavailable?: boolean } | null;  // own-comps base private price
  ai?: number | null;                                                  // AI private after aiSafetyCap
}
export interface EnsembleResult {
  version: string; private: number; low: number; high: number; weights: { pm: number; oc: number; ai: number };
  disagreement: number; widen: number; lessCertain: boolean; sources: string[];
}
export const ENSEMBLE = { PM_OC: 0.7, AI_CHEAP: 0.8, AI_DEFAULT: 0.5, CHEAP: 5000, WIDEN: [[0.3, 1.0], [0.5, 1.05], [Infinity, 1.85]] as [number, number][], LESS_CERTAIN: 0.5 } as const;
const r50 = (x: number) => Math.round(x / 50) * 50;
const ok = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x > 0;

export function ensemble(x: EnsembleInput): EnsembleResult | null {
  const pm = x.pm && ok(x.pm.private) ? x.pm : null; const oc = x.ownComps && !x.ownComps.unavailable && ok(x.ownComps.privatePrice) ? x.ownComps.privatePrice : null;
  const ai = ok(x.ai) ? x.ai : null;
  if (!pm && !oc && !ai) return null;
  const sources: string[] = [];
  // model leg: pm^0.7 * oc^0.3 (or whichever exists)
  let wpm = 0, woc = 0; let model: number | null = null;
  if (pm && oc) { wpm = ENSEMBLE.PM_OC; woc = 1 - ENSEMBLE.PM_OC; model = Math.exp(wpm * Math.log(pm.private) + woc * Math.log(oc)); sources.push("pm", "oc"); }
  else if (pm) { wpm = 1; model = pm.private; sources.push("pm"); }
  else if (oc) { woc = 1; model = oc; sources.push("oc"); }
  let wai = 0; let mid: number;
  if (ai && model) { wai = model < ENSEMBLE.CHEAP ? ENSEMBLE.AI_CHEAP : ENSEMBLE.AI_DEFAULT; mid = Math.exp(wai * Math.log(ai) + (1 - wai) * Math.log(model)); sources.push("ai"); }
  else if (ai) { wai = 1; mid = ai; sources.push("ai"); }
  else mid = model!;
  const L = [pm?.private, oc, ai].filter(ok).map(Math.log);
  const d = L.length > 1 ? Math.max(...L) - Math.min(...L) : 0;
  const widen = ENSEMBLE.WIDEN.find(([t]) => d < t)![1];
  // range shape from pm-1's conformal range (fallback +-30% when pm missing)
  const ql = pm ? Math.log(pm.low / pm.private) : Math.log(0.74), qh = pm ? Math.log(pm.high / pm.private) : Math.log(1.3);
  const k = 1 - wai, scale = (k * (wpm + woc)) + wai; // weights renormalised into the final mix
  return {
    version: "ens-1", private: r50(mid), low: r50(mid * Math.exp(widen * Math.min(0, ql))), high: r50(mid * Math.exp(widen * Math.max(0, qh))),
    weights: { pm: Math.round((k * wpm / scale) * 100) / 100, oc: Math.round((k * woc / scale) * 100) / 100, ai: Math.round((wai / scale) * 100) / 100 },
    disagreement: Math.round(d * 100) / 100, widen, lessCertain: d > ENSEMBLE.LESS_CERTAIN, sources,
  };
}
