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
//
// ens-2 (2026-10-27, used when `ctx` is given; scripts/ensemble2/ens2_fit.py): own-comps refitted on the full harvest made
// it much stronger, so the pm/own-comps weight is now confidence-weighted instead of fixed:
//    w_pm = sigmoid(z), z = w0 + oc_conf*(ocConf-0.6) + n_model*(ln(1+pm n_model)-4) + near_new*[age<=2] + perf + dealer + oc_not_model
//    log(blend) = w_pm*log(pm) + (1-w_pm)*log(oc) + c0 + c_dealer + c_perf          (perf cars: both legs under-price ~8%)
// Fitted on held-out split A only (4,733 harvest rows never seen by pm-1/own-comps training; 2-fold cross-fit 15.07 -> 15.0),
// confirmed on a fresh time holdout B (1,779 rows): 13.99% -> 13.83% (dealer 8.89 -> 8.40). w_pm lands 0.57-0.66 (5-95%).
// Tested and dropped (inconsistent sign between A and B): mileage-for-age credit/penalty, near-new level correction.
// ens-2 also returns `retail`: the same blend of pm-1's dealer figure and own-comps' dealer figure (dealer weights/corrections).
export interface EnsembleCtx {
  year: number; pmNModel?: number | null; ocConfidence?: number | null; ocLevel?: string | null; perf?: boolean;
  pmDealer?: number | null; ocDealer?: number | null; currentYear?: number;
}
export interface EnsembleInput {
  pm: { private: number; low: number; high: number } | null;          // pm-1 private (with MOT adj if used)
  ownComps?: { privatePrice: number; unavailable?: boolean } | null;  // own-comps base private price
  ai?: number | null;                                                  // AI private after aiSafetyCap
  ctx?: EnsembleCtx | null;                                            // enables ens-2 (confidence weights + retail)
}
export interface EnsembleResult {
  version: string; private: number; low: number; high: number; weights: { pm: number; oc: number; ai: number };
  disagreement: number; widen: number; lessCertain: boolean; sources: string[];
  retail?: { price: number; low: number; high: number; wPm: number } | null;
}
export const ENS2 = {
  W: { w0: 0.3698, ocConf: -0.0882, nModel: 0.1245, nearNew: -0.0711, perf: 0.048, dealer: -0.1247, ocNotModel: 0.0146 },
  C: { c0: 0.0019, dealer: -0.0112, perf: 0.0833 },
} as const;
/** ens-2 pm weight and log-correction for one seller type. */
export function ens2Weight(ctx: EnsembleCtx, dealer: boolean): { wPm: number; corr: number } {
  const age = Math.max(0, (ctx.currentYear ?? 2026) - ctx.year), W = ENS2.W, C = ENS2.C;
  const z = W.w0 + W.ocConf * ((ctx.ocConfidence ?? 0.6) - 0.6) + W.nModel * (Math.log1p(Math.max(0, ctx.pmNModel ?? 0)) - 4) + W.nearNew * (age <= 2 ? 1 : 0)
    + W.perf * (ctx.perf ? 1 : 0) + W.dealer * (dealer ? 1 : 0) + W.ocNotModel * (ctx.ocLevel && ctx.ocLevel !== "model" ? 1 : 0);
  return { wPm: 1 / (1 + Math.exp(-z)), corr: C.c0 + (dealer ? C.dealer : 0) + (ctx.perf ? C.perf : 0) };
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
  const e2 = x.ctx ? ens2Weight(x.ctx, false) : null;
  if (pm && oc) { wpm = e2 ? e2.wPm : ENSEMBLE.PM_OC; woc = 1 - wpm; model = Math.exp(wpm * Math.log(pm.private) + woc * Math.log(oc) + (e2?.corr ?? 0)); sources.push("pm", "oc"); }
  else if (pm) { wpm = 1; model = pm.private * Math.exp(e2?.corr ?? 0); sources.push("pm"); }
  else if (oc) { woc = 1; model = oc * Math.exp(e2?.corr ?? 0); sources.push("oc"); }
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
  // Retail (dealer asking) figure, ens-2 only: model legs only (the AI gives no dealer figure we have validated).
  let retail: EnsembleResult["retail"] = null;
  if (x.ctx) {
    const pd = ok(x.ctx.pmDealer) ? x.ctx.pmDealer : null, od = oc && ok(x.ctx.ocDealer) ? x.ctx.ocDealer : null, rw = ens2Weight(x.ctx, true);
    const w = pd && od ? rw.wPm : pd ? 1 : 0;
    if (pd || od) {
      const rm = Math.exp((pd ? w * Math.log(pd) : 0) + (od ? (1 - w) * Math.log(od) : 0) + rw.corr);
      retail = { price: r50(rm), low: r50(rm * Math.exp(widen * Math.min(0, ql))), high: r50(rm * Math.exp(widen * Math.max(0, qh))), wPm: Math.round(w * 100) / 100 };
    }
  }
  return {
    version: x.ctx ? "ens-2" : "ens-1", retail, private: r50(mid), low: r50(mid * Math.exp(widen * Math.min(0, ql))), high: r50(mid * Math.exp(widen * Math.max(0, qh))),
    weights: { pm: Math.round((k * wpm / scale) * 100) / 100, oc: Math.round((k * woc / scale) * 100) / 100, ai: Math.round((wai / scale) * 100) / 100 },
    disagreement: Math.round(d * 100) / 100, widen, lessCertain: d > ENSEMBLE.LESS_CERTAIN, sources,
  };
}
