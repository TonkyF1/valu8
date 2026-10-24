// pm-1: trained price model (LightGBM on log price, harvested Gumtree listings). Pure TS, no deps, no network.
// Mirrors scripts/pricemodel/features.py exactly; trees + target-encoding tables live in priceModelData.ts.
// SHADOW ONLY until promoted — see docs/own-comps-pricing.md "Trained price model (pm-1)".
import { PM_MODEL } from "./priceModelData.ts";

export interface PmInput {
  make: string; model: string; variant?: string | null; year: number; mileage: number;
  fuel?: string | null; gearbox?: string | null; body?: string | null; engine_cc?: number | null;
  seller?: "private" | "dealer" | string | null; desc?: string | null; // desc = advert text if the user gave one
}
export interface PmResult { version: string; price: number; low: number; high: number; n_model: number; n_trim: number; known: "trim" | "model" | "make" | "none" }

const REF_YEAR = 2026; // ages are relative to the harvest year; retrain rather than change this
const FUELS = ["petrol", "diesel", "hybrid", "electric", "other"];
const BODIES = ["hatchback", "estate", "saloon", "mpv", "suv", "coupe", "convertible", "pick up", "van", "other"];
const PERF = /\b(?:st(?:-?[23])?|rs\d?|gti|gtd|r32|type ?r|amg|m[2-8]\b|m ?performance|vrs|cupra|n performance|gr|svr|sv|quadrifoglio|abarth|nismo|s[3-8]|rs[3-7]|john cooper works|jcw|renaultsport|gsi|vxr|opc|sti|evo|wrx)\b/;
const TEXT: [string, RegExp][] = [
  ["t_spares", /spares (?:or|and|\/) repair|non[- ]?runner|not running|won.t start|breaking|needs (?:a )?(?:new )?(?:clutch|engine|gearbox|turbo)|engine (?:fault|problem|issue)|gearbox (?:fault|problem|issue)/],
  ["t_cat", /\bcat(?:egory)?[\s.:-]+[snbcd]\b|write[- ]?off|written[- ]off/],
  ["t_nomot", /no mot|mot expired|without mot|mot ran out/],
  ["t_longmot", /(?:12|11|10|full|fresh|new|long) ?(?:months?)? ?mot|mot (?:until|till|to|expires?) (?:\w+ )?202[7-9]/],
  ["t_fsh", /\bfsh\b|full (?:service|dealer) history|fdsh/],
  ["t_ulez", /ulez/],
  ["t_lowmiles", /low (?:miles|mileage)/],
  ["t_warranty", /warranty/],
  ["t_finance", /finance|part ex|px welcome/],
  ["t_urgent", /urgent|quick sale|need gone|cheap|bargain/],
  ["t_damage", /damage|dent|scratch|rust|needs work|project|repair/],
  ["t_oneowner", /one owner|1 owner/],
];
const s = (x: unknown) => (x === null || x === undefined ? "" : String(x));
export function normFuel(f: unknown): string {
  const v = s(f).toLowerCase();
  if (v.includes("hybrid")) return "hybrid"; if (v.includes("electric")) return "electric";
  if (v.includes("diesel")) return "diesel"; if (v.includes("petrol") || v === "") return "petrol"; return "other";
}
export function normBody(b: unknown): string {
  const v = s(b).toLowerCase();
  if (v.includes("van")) return "van"; if (v.includes("4x4") || v.includes("suv")) return "suv"; if (v.includes("pick")) return "pick up";
  return BODIES.includes(v) ? v : "other";
}
const normTrim = (v: unknown) => s(v).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
type Tab = Record<string, readonly [number, number]>;
const TE = PM_MODEL.te as unknown as { g: number; make: Tab; model: Tab; trim: Tab };

/** Feature vector in PM_MODEL.features order (NaN = missing). Exported for parity tests. */
export function featurize(x: PmInput): { vec: number[]; n_model: number; n_trim: number; known: PmResult["known"] } {
  const make = s(x.make).toLowerCase(), model = make + "|" + s(x.model).toLowerCase(), trim = model + "|" + normTrim(x.variant);
  const age = Math.min(45, Math.max(0, REF_YEAR - Number(x.year)));
  const mi = Math.min(400000, Math.max(0, Number(x.mileage)));
  const ccRaw = Number(x.engine_cc); const cc = Number.isFinite(ccRaw) && ccRaw > 500 && ccRaw < 8000 ? ccRaw : NaN;
  const txt = (s(x.variant) + " " + s(x.desc)).toLowerCase();
  const perf = PERF.test(s(x.model).toLowerCase() + " " + s(x.variant).toLowerCase()) ? 1 : 0;
  const f: Record<string, number> = {
    age, lmiles: Math.log1p(mi / 1000), mpy: mi / Math.max(age, 0.5) / 1000, cc,
    fuel: FUELS.indexOf(normFuel(x.fuel)), gear: s(x.gearbox).toLowerCase().startsWith("auto") ? 1 : 0,
    body: BODIES.indexOf(normBody(x.body)), dealer: x.seller === "dealer" ? 1 : 0, perf,
  };
  for (const [k, rx] of TEXT) f[k] = rx.test(txt) ? 1 : 0;
  const mk = TE.make[make] ?? [TE.g, 0];
  const md = TE.model[model] ?? [mk[0], 0];
  const tr = TE.trim[trim] ?? [md[0], 0];
  Object.assign(f, { te_make: mk[0], te_model: md[0], te_trim: tr[0], n_model: Math.log1p(md[1]), n_trim: Math.log1p(tr[1]) });
  const known = tr[1] > 0 ? "trim" : md[1] > 0 ? "model" : mk[1] > 0 ? "make" : "none";
  return { vec: (PM_MODEL.features as readonly string[]).map((k) => f[k]), n_model: md[1], n_trim: tr[1], known };
}

type Tree = { f: readonly number[]; t: readonly number[]; m: readonly number[]; l: readonly number[]; r: readonly number[]; v: readonly number[] };
/** Raw log-price score: sum of tree outputs (LightGBM numerical splits, `<=`, NaN handling per missing_type). */
export function score(vec: number[]): number {
  let sum = 0;
  for (const T of PM_MODEL.trees as unknown as Tree[]) {
    if (T.f.length === 0) { sum += T.v[0]; continue; }
    let i = 0;
    for (;;) {
      let x = vec[T.f[i]]; let left: boolean;
      if (Number.isNaN(x)) { if (T.m[i] === 0) { x = 0; left = x <= T.t[i]; } else left = T.m[i] === 1; }
      else left = x <= T.t[i];
      const nx = left ? T.l[i] : T.r[i];
      if (nx < 0) { sum += T.v[~nx]; break; }
      i = nx;
    }
  }
  return sum;
}
const BANDS: [number, string][] = [[2000, "<2k"], [5000, "2-5k"], [10000, "5-10k"], [20000, "10-20k"], [40000, "20-40k"]];
const bandOf = (p: number) => (BANDS.find(([b]) => p < b)?.[1] ?? "40k+");
const r50 = (x: number) => Math.round(x / 50) * 50;
/** Price one car for one seller type, with a calibrated ~80% range (conformal, from out-of-fold residuals). */
export function pricePm(x: PmInput): PmResult {
  const ft = featurize(x); const p = Math.exp(score(ft.vec));
  const R = PM_MODEL.range as unknown as Record<string, readonly [number, number, number]>;
  const q = R[bandOf(p) + "|" + (x.seller === "dealer" ? "dealer" : "private")] ?? R["*"];
  return { version: PM_MODEL.version, price: r50(p), low: r50(p * Math.exp(q[0])), high: r50(p * Math.exp(q[1])), n_model: ft.n_model, n_trim: ft.n_trim, known: ft.known };
}
/** Private + dealer in one call (what analyse-vehicle / fair-price shadow needs). */
export function pricePmBoth(x: Omit<PmInput, "seller">) {
  return { private: pricePm({ ...x, seller: "private" }), dealer: pricePm({ ...x, seller: "dealer" }) };
}
/** Recommended blend with own-comps (geometric 0.7 pm / 0.3 own-comps): 14.7% vs 15.2% pm alone on the held-out set. */
export const blendWithOwnComps = (pm: number, oc: number | null | undefined) => (oc && oc > 0 ? r50(Math.pow(pm, 0.7) * Math.pow(oc, 0.3)) : r50(pm));
