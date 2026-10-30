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
  cat_sn?: boolean; non_runner?: boolean; no_mot?: boolean; desc?: string; body?: string;
  /** Comp weight: 1 = asking price; sold prices (sale feedback) should use 3. */
  weight?: number;
}
export interface CompQuery {
  make: string; model: string; variant?: string; year: number; mileage: number;
  fuel?: string; gearbox?: string; adText?: string; cat_sn?: boolean; non_runner?: boolean; no_mot?: boolean;
  currentYear?: number;
}
export type OwnSegment = "perf" | "premium" | "mainstream" | "van";
export interface OwnCompsParams {
  version: string; refYear: number;
  seg: Record<OwnSegment, { a: number; age: number; h3: number; h8: number; h15: number; mi: number }>;
  dealer: number; privOld: number; hiMi: number; cond: number; auto: number; diesel: number;
  /** Dealer normalisation: dealer ask = private * (1 + m) + F (fixed prep/warranty cost + margin). null = dummy-variable model. */
  dn: DealerNorm | null;
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
  if (/^mg( motors?( uk)?)?$/.test(m)) return "mg";
  return m === "vw" ? "volkswagen" : m === "mercedes" ? "mercedes-benz" : m;
};
/** DVLA/VDG truncate model names to fit their field ("R Rover Evoque Dyn SE D Mhev A", "Disc Sport HSE TD4 A").
 * Expand the common truncations so the string starts with the advert model name; trailing trim/fuel tokens
 * (Dyn, SE, D, Mhev, A ...) are then dropped by longest-known-prefix matching (resolveModel / pm lookup).
 * Only leading tokens are rewritten, so already-clean names are unchanged. */
const DVLA_MODEL_ABBREV: Record<string, [RegExp, string][]> = {
  "land rover": [
    [/^(?:r\.? ?rover|r\/rover|rr|range r|rng rover|range-rover)\b/, "range rover"],
    [/^range rover (?:evq|evoq)\b/, "range rover evoque"],
    [/^range rover spt\b/, "range rover sport"],
    [/^range rover vel\b/, "range rover velar"],
    [/^(?:disc|discov|discovry)\b(?!\w)/, "discovery"],
    [/^discovery spt\b/, "discovery sport"],
    [/^(?:freel|freelandr|f\/lander)\b/, "freelander"],
    [/^(?:def|dfndr)\b(?!\w)/, "defender"],
  ],
};
export function expandDvlaModel(mk: string, m: string): string {
  for (const [re, to] of DVLA_MODEL_ABBREV[mk] ?? []) m = m.replace(re, to);
  return m;
}
export function normModel(make: string, model: string): string {
  const mk = normMake(make);
  let m = String(model ?? "").toLowerCase().trim().replace(/-class/g, " class").replace(/[_]+/g, " ").replace(/\s+/g, " ");
  m = expandDvlaModel(mk, m);
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
// Light commercials: priced on their own curve (vans hold value far better than cars of the same age).
const VAN_MODELS = /^(transit( custom| connect| courier)?|ranger|transporter|caddy( maxi)?|crafter|amarok|vito|sprinter|citan|vivaro|combo( cargo)?|movano|trafic|master|kangoo|expert|partner|boxer|dispatch|relay|proace( city)?|hilux|primastar|nv200|nv300|navara|doblo|ducato|talento|daily|l200|d-max|berlingo van)$/;
export function segmentOf(make: string, model: string, perf: string | null, body?: string): OwnSegment {
  const mk = normMake(make), md = normModel(make, model);
  if (/\bvan\b|pick[- ]?up|panel|crew cab|double cab|chassis/i.test(body ?? "") || (VAN_MODELS.test(md) && !(mk === "citroen" && md === "berlingo" && !/van/i.test(body ?? "")))) return "van";
  if (perf || PERF_MAKES.test(mk) || PERF_MODELS.test(md)) return "perf";
  return PREMIUM.test(mk) ? "premium" : "mainstream";
}

interface Row { fu: number; mk: string; md: string; fam: string; perf: string | null; seg: OwnSegment; age: number; lnMi: number; dealer: number; cond: number; auto: number; diesel: number; lp: number; w: number; toks: string[]; year: number; mileage: number; price: number; seller: string; res?: number }

export const trimTokens = (v?: string) => Array.from(new Set(String(v ?? "").toLowerCase().replace(/[^a-z+ ]/g, " ").split(/\s+/).filter((t) => t.length >= 2)));
const lnMiles = (mi: number) => Math.log1p(Math.max(0, mi) / 10000);
const SEGS: OwnSegment[] = ["perf", "premium", "mainstream", "van"];
const NSEGF = 6;

function toRow(l: CompListing | CompQuery, refYear: number, price = 0, seller = "private"): Row {
  const mk = normMake(l.make), md = normModel(l.make, l.model);
  const text = (l as CompListing).desc ?? (l as CompQuery).adText ?? "";
  const perf = perfInfo(mk, md, l.variant, text);
  const body = `${l.variant ?? ""} ${(l as CompListing).body ?? ""}`;
  return {
    fu: /diesel/i.test(l.fuel ?? "") ? 1 : /hybrid/i.test(l.fuel ?? "") ? 2 : 0,
    mk, md, fam: family(md), perf, seg: segmentOf(mk, md, perf, body),
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
  // Piecewise-linear depreciation in age (hinges at 3, 8, 15 years): monotone-friendly and does not
  // explode when extrapolating to nearly-new cars the way a quadratic did.
  const h = (k: number) => Math.max(0, r.age - k);
  for (const s of SEGS) { const on = r.seg === s ? 1 : 0; f.push(on, on * r.age, on * h(3), on * h(8), on * h(15), on * r.lnMi); }
  f.push(r.dealer, r.cond, r.auto, r.diesel, (1 - r.dealer) * r.age, (1 - r.dealer) * r.lnMi);
  return f;
}

/** Fitted by grid search on held-in CV (scripts/owncomps): dealer ask ~ private x 1.10 + £1,500.
 * 2026-10-27: when PRICING a dealer figure the fixed add-on ramps in for cheap cars (0 at a £800 private value, full £1,500
 * from £3,000): harvest split A dealer asks run only ~+£230 over private x1.10 under £1.5k and ~+£800 at £1.5-2.5k.
 * Held-out B dealer<£5k (ens-2) 15.7% -> 13.6%; 40-car blind dealer<£5k 41.5% -> 28.0%. */
export const DEALER_NORM: DealerNorm = { F: 1500, m: 0.10, lo: 800, hi: 3000 };
export interface DealerNorm { F: number; m: number; lo?: number; hi?: number }
/** Dealer ask for a private-equivalent value p. */
export function dealerFromPrivate(p: number, dn: DealerNorm): number {
  const ramp = dn.lo != null && dn.hi != null ? Math.min(1, Math.max(0, (p - dn.lo) / (dn.hi - dn.lo))) : 1;
  return p * (1 + dn.m) + dn.F * ramp;
}
export interface OwnCompsModel { params: OwnCompsParams; rows: Row[] }

export function fitOwnComps(train: CompListing[], opts: Partial<Pick<OwnCompsParams, "k" | "bw">> & { refYear?: number; trimK?: number; priorK?: number; dn?: DealerNorm | null } = {}): OwnCompsModel {
  const refYear = opts.refYear ?? 2026;
  const dn = opts.dn === undefined ? DEALER_NORM : opts.dn;
  const rows = train.filter((l) => l.price > 0 && l.year > 1980).map((l) => {
    const seller = String(l.seller ?? "private");
    if (!dn || seller !== "dealer") return toRow(l, refYear, l.price, seller);
    // Dealer asks are converted to private-equivalent before fitting, so every comp speaks the same currency.
    const r = toRow(l, refYear, l.price, seller); r.dealer = 0; r.lp = Math.log(Math.max(250, (l.price - dn.F) / (1 + dn.m))); return r; // fixed F here: ramping it in training too was worse on the 40-car blind set
  });
  const X = rows.map(feats), y = rows.map((r) => r.lp);
  // Ridge: intercepts free; slopes shrunk toward a pooled "all cars" prior curve (fitted first) so thin
  // segments (vans, few new cars) borrow the market's depreciation shape instead of extrapolating noise.
  const S = SEGS.length * NSEGF;
  const pooledX = X.map((x) => { const o = [1, 0, 0, 0, 0, 0]; for (let si = 0; si < SEGS.length; si++) for (let j = 1; j < NSEGF; j++) o[j] += x[si * NSEGF + j]; return [...o, ...x.slice(S)]; });
  const pb = ridge(pooledX, y, pooledX[0].map((_, j) => (j === 0 ? 1e-3 : 1)));
  const prior = X[0].map((_, j) => (j < S ? (j % NSEGF === 0 ? 0 : pb[j % NSEGF]) : 0));
  const lamS = opts.priorK ?? 40;
  const lam = X[0].map((_, j) => (j < S ? (j % NSEGF === 0 ? 1e-3 : lamS) : 1));
  const yAdj = y.map((v, i) => v - X[i].reduce((a, x, j) => a + x * prior[j], 0));
  const b = ridge(X, yAdj, lam).map((v, j) => v + prior[j]);
  const seg = {} as OwnCompsParams["seg"];
  SEGS.forEach((s, i) => (seg[s] = { a: b[i * NSEGF], age: b[i * NSEGF + 1], h3: b[i * NSEGF + 2], h8: b[i * NSEGF + 3], h15: b[i * NSEGF + 4], mi: b[i * NSEGF + 5] }));
  const o = S;
  const params: OwnCompsParams = {
    version: "owncomps-2", refYear, seg, dn, dealer: b[o], cond: b[o + 1], auto: b[o + 2], diesel: b[o + 3], privOld: b[o + 4], hiMi: b[o + 5], sigma: 0, trim: {},
    k: opts.k ?? { model: 2, family: 3, makeSeg: 6 }, bw: opts.bw ?? { year: 2.5, lnMi: 0.45 },
  };
  let ss = 0;
  rows.forEach((r) => { r.res = r.lp - curve(params, r); ss += r.res * r.res; });
  params.sigma = Math.sqrt(ss / Math.max(1, rows.length - X[0].length));
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
  const h = (k: number) => Math.max(0, r.age - k);
  return s.a + s.age * r.age + s.h3 * h(3) + s.h8 * h(8) + s.h15 * h(15) + s.mi * r.lnMi + p.dealer * r.dealer + p.cond * r.cond + p.auto * r.auto + p.diesel * r.diesel + p.privOld * (1 - r.dealer) * r.age + p.hiMi * (1 - r.dealer) * r.lnMi;
}

// Kernel-weighted residual offset over a pool, shrunk toward `prior` with pseudo-count k. Comps with a
// different gearbox or fuel count at MISMATCH_W (the auto/diesel premium varies a lot by model, so a single
// global dummy mis-prices mixed pools). The offset is a weighted MEDIAN of residuals (robust to odd ads),
// with Huber-style down-weighting of comps far from the prior feeding the spread.
const MISMATCH_W = { gearbox: 0.3, fuel: 0.3 };
function pooled(pool: Row[], q: Row, p: OwnCompsParams, prior: number, k: number) {
  let sw = 0, swr = 0, sw2 = 0, gap = 99;
  const hub = 2 * p.sigma, ws: [number, number][] = [];
  for (const c of pool) {
    const w0 = Math.exp(-Math.abs(c.year - q.year) / p.bw.year - Math.abs(c.lnMi - q.lnMi) / p.bw.lnMi)
      * (c.auto !== q.auto ? MISMATCH_W.gearbox : 1) * (c.fu !== q.fu ? MISMATCH_W.fuel : 1);
    const d = Math.abs((c.res ?? 0) - prior), w = w0 * c.w * (d > hub ? hub / d : 1);
    sw += w; swr += w * (c.res ?? 0); sw2 += w * (c.res ?? 0) ** 2; gap = Math.min(gap, Math.abs(c.year - q.year));
    ws.push([c.res ?? 0, w0 * c.w]);
  }
  let off = (swr + k * prior) / (sw + k);
  if (ws.length >= 3) {
    ws.sort((a, b) => a[0] - b[0]);
    const tot = ws.reduce((a, x) => a + x[1], 0);
    let acc = 0, wm = ws[0][0];
    for (const [v, w] of ws) { acc += w; if (acc >= tot / 2) { wm = v; break; } }
    off = (wm * sw + k * prior) / (sw + k);
  }
  const sd = sw > 0 ? Math.sqrt(Math.max(0, sw2 / sw - (swr / sw) ** 2)) : p.sigma;
  return { off, neff: sw, sd, gap };
}

/** Map an unseen model string onto a known one: "octavia vrs estate" -> "octavia", "transit" -> "transit custom" only if nothing else. */
function resolveModel(rows: Row[], mk: string, md: string): string {
  const known = new Map<string, number>();
  for (const c of rows) if (c.mk === mk) known.set(c.md, (known.get(c.md) ?? 0) + 1);
  if (known.has(md) || !known.size) return md;
  let best = "", bn = 0;
  for (const [k, n] of known) if ((md.startsWith(k + " ") || md.replace(/[\s-]/g, "") === k.replace(/[\s-]/g, "")) && k.length > best.length) { best = k; bn = n; }
  if (best && bn >= 2) return best;
  for (const [k, n] of known) if (k.startsWith(md + " ") && n > bn) { best = k; bn = n; }
  return bn >= 2 ? best : md;
}

export function priceOwnComps(model: OwnCompsModel, q: CompQuery): OwnCompsResult {
  const p = model.params, r = toRow(q, q.currentYear ?? p.refYear, 0, "private");
  const rmd = resolveModel(model.rows, r.mk, r.md);
  if (rmd !== r.md) { r.md = rmd; r.fam = family(rmd); }
  const samePerf = (c: Row) => (r.perf ? c.perf?.split(":")[0] === r.perf.split(":")[0] : !c.perf);
  // Make+segment pool only holds the same kind of car (no pooling an Octavia vRS with random perf cars,
  // or a plain hatch with hot hatches); if that is empty we fall back to the segment depreciation curve.
  const makeSeg = model.rows.filter((c) => c.mk === r.mk && c.seg === r.seg && samePerf(c));
  const fam = makeSeg.filter((c) => c.fam === r.fam);
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
  const dealerPrice = p.dn ? Math.round(dealerFromPrivate(Math.exp(lpPriv), p.dn) / 50) * 50 : Math.round(Math.exp(curve(p, { ...r, dealer: 1 }) + off) / 50) * 50;
  // Confidence: effective comps at the most specific level, how scattered those comps are, and how far
  // (in years) the nearest comp is from this car. make_segment / global levels are capped at Low.
  const L = level === "model" ? L3 : level === "family" ? L2 : L1;
  const neff = level === "global" ? 0 : L.neff * (level === "make_segment" ? 0.3 : 1);
  const disp = Math.max(0, Math.min(1, (0.55 - L.sd) / 0.35));
  const gapF = Math.exp(-Math.max(0, L.gap - 1) / 2);
  let score = Math.max(0, Math.min(1, neff / (neff + 3))) * (0.4 + 0.6 * disp) * gapF * (r.age > 25 ? 0.6 : 1);
  if (level === "make_segment" || level === "global") score = Math.min(score, 0.3);
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
