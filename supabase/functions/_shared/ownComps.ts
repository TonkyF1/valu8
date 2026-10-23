// Own-comparables pricing engine (offline, no external deps).
// Prices a UK used car from our own collected asking-price listings:
//   log(price) = segment curve (age, mileage) + seller/condition terms + local offset,
// where the local offset is a year/mileage-weighted mean of nearest comparables'
// residuals, shrunk hierarchically: make+model(+perf variant) -> model family ->
// make+segment -> 0 (global curve). All parameters are fitted from training rows only.
import { detectPerformanceVariant } from "./performance.ts";

export interface CompListing {
  make: string; model: string; variant?: string; year: number; mileage: number;
  fuel?: string; gearbox?: string; seller?: "private" | "dealer" | string; price: number;
  cat_sn?: boolean; non_runner?: boolean; no_mot?: boolean; desc?: string;
  /** Comp weight: 1 = asking price; sold prices (sale feedback) should use 3. */
  weight?: number;
}
export interface CompQuery {
  make: string; model: string; variant?: string; year: number; mileage: number;
  fuel?: string; gearbox?: string; adText?: string; cat_sn?: boolean; non_runner?: boolean; no_mot?: boolean;
  currentYear?: number;
}
export type OwnSegment = "perf" | "premium" | "mainstream";
export interface OwnCompsParams {
  version: string; refYear: number;
  seg: Record<OwnSegment, { a: number; age: number; age2: number; mi: number }>;
  dealer: number; privOld: number; hiMi: number; cond: number; auto: number; diesel: number;
  sigma: number; trim: Record<string, number>; k: { model: number; family: number; makeSeg: number }; bw: { year: number; lnMi: number };
}
export interface OwnCompsResult {
  privatePrice: number; dealerPrice: number; low: number; high: number;
  level: "model" | "family" | "make_segment" | "global";
  confidence: "High" | "Medium" | "Low" | "Very Low"; confidenceScore: number;
  nComps: number; nearest: { year: number; mileage: number; price: number; seller: string }[];
  segment: OwnSegment; perfKey: string | null; trimUpliftPct: number;
}

const PREMIUM = /^(bmw|audi|mercedes-benz|land rover|jaguar|volvo|lexus|porsche|tesla|genesis|alfa romeo|maserati|infiniti|ds)$/;
const PERF_MAKES = /^(porsche|lotus|abarth|alpine|tvr|morgan|caterham)$/;
const PERF_MODELS = /^(gt86|brz|gr86|mx-5|mx5|mr2|s2000|z4|tt|370z|350z|supra|m2|m3|m4|m5|m6|rs3|rs4|rs5|rs6|s3|s4|s5|impreza|wrx|lancer|evo|boxster|cayman|911|elise|exige|focus rs|86|rc ?f|type r)$/;

export const normMake = (s: string) => {
  const m = String(s ?? "").toLowerCase().trim().replace(/\s+/g, " ").replace("mercedes benz", "mercedes-benz");
  return m === "vw" ? "volkswagen" : m === "mercedes" ? "mercedes-benz" : m;
};
export function normModel(make: string, model: string): string {
  const mk = normMake(make);
  let m = String(model ?? "").toLowerCase().trim().replace(/-class/g, " class").replace(/[_]+/g, " ").replace(/\s+/g, " ");
  if (mk === "mini" && /^(hatchback|hatch|cooper|one|convertible)$/.test(m)) m = "hatch";
  if (mk === "vauxhall" && m === "gtc") m = "astra gtc";
  if (mk === "bmw" && /^[1-5]\d\d[a-z]{0,2}$/.test(m)) m = `${m[0]} series`;
  if (mk === "mercedes-benz" && /^[a-z]\d{3}[a-z]?$/.test(m)) m = `${m[0]} class`;
  return m.replace("mx5", "mx-5");
}
const family = (model: string) => model.split(" ")[0].replace(/^(rs|s)(\d)$/, "a$2").replace(/^m(\d)$/, "$1 series");

function perfInfo(make: string, model: string, variant?: string, text?: string): string | null {
  const p = detectPerformanceVariant(make, model, variant ?? "", text ?? "");
  if (p) return p.specific ? `${p.key}:${p.specific.label}` : p.key;
  return null;
}
export function segmentOf(make: string, model: string, perf: string | null): OwnSegment {
  const mk = normMake(make), md = normModel(make, model);
  if (perf || PERF_MAKES.test(mk) || PERF_MODELS.test(md)) return "perf";
  return PREMIUM.test(mk) ? "premium" : "mainstream";
}

interface Row { mk: string; md: string; fam: string; perf: string | null; seg: OwnSegment; age: number; lnMi: number; dealer: number; cond: number; auto: number; diesel: number; lp: number; w: number; toks: string[]; year: number; mileage: number; price: number; seller: string; res?: number }

export const trimTokens = (v?: string) => Array.from(new Set(String(v ?? "").toLowerCase().replace(/[^a-z+ ]/g, " ").split(/\s+/).filter((t) => t.length >= 2)));
const lnMiles = (mi: number) => Math.log1p(Math.max(0, mi) / 10000);
const SEGS: OwnSegment[] = ["perf", "premium", "mainstream"];

function toRow(l: CompListing | CompQuery, refYear: number, price = 0, seller = "private"): Row {
  const mk = normMake(l.make), md = normModel(l.make, l.model);
  const text = (l as CompListing).desc ?? (l as CompQuery).adText ?? "";
  const perf = perfInfo(mk, md, l.variant, text);
  return {
    mk, md, fam: family(md), perf, seg: segmentOf(mk, md, perf),
    age: Math.max(0, refYear - l.year), lnMi: lnMiles(l.mileage), dealer: seller === "dealer" ? 1 : 0,
    cond: l.cat_sn || l.non_runner || l.no_mot ? 1 : 0,
    auto: /auto|dsg|cvt|semi/i.test(l.gearbox ?? "") ? 1 : 0, diesel: /diesel/i.test(l.fuel ?? "") ? 1 : 0,
    lp: price > 0 ? Math.log(price) : 0, w: (l as CompListing).weight ?? 1, toks: trimTokens(l.variant), year: l.year, mileage: l.mileage, price, seller,
  };
}

// Small dense ridge least-squares (normal equations + Gaussian elimination).
function ridge(X: number[][], y: number[], lambda: number[]): number[] {
  const p = X[0].length, A = Array.from({ length: p }, () => new Array(p + 1).fill(0));
  for (let i = 0; i < X.length; i++) for (let j = 0; j < p; j++) {
    A[j][p] += X[i][j] * y[i];
    for (let k = 0; k < p; k++) A[j][k] += X[i][j] * X[i][k];
  }
  for (let j = 0; j < p; j++) A[j][j] += lambda[j];
  for (let c = 0; c < p; c++) {
    let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < p; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k]; }
  }
  return A.map((r, j) => r[p] / r[j]);
}

function feats(r: Row): number[] {
  const f: number[] = [];
  for (const s of SEGS) { const on = r.seg === s ? 1 : 0; f.push(on, on * r.age, on * r.age * r.age / 10, on * r.lnMi); }
  f.push(r.dealer, r.cond, r.auto, r.diesel, (1 - r.dealer) * r.age, (1 - r.dealer) * r.lnMi);
  return f;
}

export interface OwnCompsModel { params: OwnCompsParams; rows: Row[] }

export function fitOwnComps(train: CompListing[], opts: Partial<Pick<OwnCompsParams, "k" | "bw">> & { refYear?: number; trimK?: number } = {}): OwnCompsModel {
  const refYear = opts.refYear ?? 2026;
  const rows = train.filter((l) => l.price > 0 && l.year > 1980).map((l) => toRow(l, refYear, l.price, String(l.seller ?? "private")));
  const X = rows.map(feats), y = rows.map((r) => r.lp);
  const lam = X[0].map((_, j) => (j % 4 === 0 && j < 12 ? 1e-3 : 1)); // light ridge on slopes
  const b = ridge(X, y, lam);
  const seg = {} as OwnCompsParams["seg"];
  SEGS.forEach((s, i) => (seg[s] = { a: b[i * 4], age: b[i * 4 + 1], age2: b[i * 4 + 2], mi: b[i * 4 + 3] }));
  const params: OwnCompsParams = {
    version: "owncomps-1", refYear, seg, dealer: b[12], cond: b[13], auto: b[14], diesel: b[15], privOld: b[16], hiMi: b[17], sigma: 0, trim: {},
    k: opts.k ?? { model: 2, family: 3, makeSeg: 6 }, bw: opts.bw ?? { year: 2.5, lnMi: 0.45 },
  };
  let ss = 0;
  rows.forEach((r) => { r.res = r.lp - curve(params, r); ss += r.res * r.res; });
  params.sigma = Math.sqrt(ss / Math.max(1, rows.length - 18));
  // Fitted trim uplift: token mean of residual vs its make+model mean, shrunk (k=10), min 8 uses.
  const mm = new Map<string, { s: number; n: number }>();
  rows.forEach((r) => { const k = r.mk + "|" + r.md; const v = mm.get(k) ?? { s: 0, n: 0 }; v.s += r.res!; v.n++; mm.set(k, v); });
  const tk = new Map<string, { s: number; n: number }>();
  rows.forEach((r) => { const m = mm.get(r.mk + "|" + r.md)!; const d = r.res! - m.s / m.n; for (const t of r.toks) { const v = tk.get(t) ?? { s: 0, n: 0 }; v.s += d; v.n++; tk.set(t, v); } });
  for (const [t, v] of tk) if (v.n >= 8 && opts.trimK !== 0) { const u = v.s / (v.n + (opts.trimK ?? 10)); if (Math.abs(u) >= 0.02) params.trim[t] = Math.round(u * 1000) / 1000; }
  return { params, rows };
}

function curve(p: OwnCompsParams, r: Row): number {
  const s = p.seg[r.seg];
  return s.a + s.age * r.age + s.age2 * r.age * r.age / 10 + s.mi * r.lnMi + p.dealer * r.dealer + p.cond * r.cond + p.auto * r.auto + p.diesel * r.diesel + p.privOld * (1 - r.dealer) * r.age + p.hiMi * (1 - r.dealer) * r.lnMi;
}

// Kernel-weighted residual mean over a pool, shrunk toward `prior` with pseudo-count k.
function pooled(pool: Row[], q: Row, p: OwnCompsParams, prior: number, k: number) {
  let sw = 0, swr = 0;
  for (const c of pool) {
    const w = Math.exp(-Math.abs(c.year - q.year) / p.bw.year - Math.abs(c.lnMi - q.lnMi) / p.bw.lnMi);
    sw += w * c.w; swr += w * c.w * (c.res ?? 0);
  }
  return { off: (swr + k * prior) / (sw + k), neff: sw };
}

export function priceOwnComps(model: OwnCompsModel, q: CompQuery): OwnCompsResult {
  const p = model.params, r = toRow(q, q.currentYear ?? p.refYear, 0, "private");
  const samePerf = (c: Row) => (r.perf ? c.perf?.split(":")[0] === r.perf.split(":")[0] : !c.perf);
  const makeSeg = model.rows.filter((c) => c.mk === r.mk && c.seg === r.seg);
  const fam = makeSeg.filter((c) => c.fam === r.fam && samePerf(c));
  let mod = fam.filter((c) => c.md === r.md);
  if (r.perf?.includes(":")) { const spec = mod.filter((c) => c.perf === r.perf); if (spec.length >= 2) mod = spec; }
  const L1 = pooled(makeSeg, r, p, 0, p.k.makeSeg);
  const L2 = pooled(fam, r, p, L1.off, p.k.family);
  const L3 = pooled(mod, r, p, L2.off, p.k.model);
  const trimUplift = Math.max(-0.15, Math.min(0.15, r.toks.reduce((a, t) => a + (p.trim[t] ?? 0), 0)));
  const off = L3.off + trimUplift;
  const level: OwnCompsResult["level"] = mod.length >= 2 ? "model" : fam.length >= 2 ? "family" : makeSeg.length >= 3 ? "make_segment" : "global";
  const lpPriv = curve(p, r) + off;
  const privatePrice = Math.round(Math.exp(lpPriv) / 50) * 50;
  const dealerPrice = Math.round(Math.exp(curve(p, { ...r, dealer: 1 }) + off) / 50) * 50;
  // Confidence from effective sample size at the most specific level + age extrapolation.
  const neff = level === "model" ? L3.neff : level === "family" ? L2.neff : level === "make_segment" ? L1.neff * 0.3 : 0;
  const score = Math.max(0, Math.min(1, neff / (neff + 3))) * (r.age > 25 ? 0.6 : 1);
  const confidence = score >= 0.6 ? "High" : score >= 0.4 ? "Medium" : score >= 0.15 ? "Low" : "Very Low";
  const spread = p.sigma * (1.3 - 0.6 * score);
  const nearest = (mod.length ? mod : fam.length ? fam : makeSeg).slice()
    .sort((a, b) => Math.abs(a.year - r.year) + Math.abs(a.lnMi - r.lnMi) * 4 - (Math.abs(b.year - r.year) + Math.abs(b.lnMi - r.lnMi) * 4))
    .slice(0, 5).map((c) => ({ year: c.year, mileage: c.mileage, price: c.price, seller: c.seller }));
  return {
    privatePrice, dealerPrice, low: Math.round(Math.exp(lpPriv - spread) / 50) * 50, high: Math.round(Math.exp(lpPriv + spread) / 50) * 50,
    level, confidence, confidenceScore: Math.round(score * 100) / 100, nComps: mod.length || fam.length || makeSeg.length,
    nearest, segment: r.seg, perfKey: r.perf, trimUpliftPct: Math.round(trimUplift * 1000) / 10,
  };
}

/** Price for a specific seller type (used for evaluation against asking prices). */
export function priceFor(res: OwnCompsResult, seller: string) { return seller === "dealer" ? res.dealerPrice : res.privatePrice; }
