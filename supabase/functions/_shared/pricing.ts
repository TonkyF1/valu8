// Valu8 pricing calibration — pure functions, unit-tested and backtested
// (scripts/backtest.ts). Rationale for every constant is documented inline and in
// docs/pricing-calibration.md.

import { clamp, roundToGrain } from "./valuation-math.ts";

export type Comp = { price: number; miles?: number | null; year?: number | null };

/**
 * Mileage elasticity of used-car prices. -0.18 means a car with 2x the miles of a
 * comparable is worth ~12% less (2^-0.18 = 0.88). Applied per comparable so a
 * 180k-mile car is not priced off 60k-mile listings.
 */
export const MILEAGE_ELASTICITY = -0.18;
/** Typical UK used depreciation per year of age for 3–12 year-old cars. */
export const AGE_FACTOR_PER_YEAR = 0.88;

export function compAdjustmentFactor(carMiles: number, carYear: number, comp: Comp): number {
  let f = 1;
  if (comp.miles != null && Number.isFinite(comp.miles) && comp.miles > 0) {
    const m = Math.pow(Math.max(carMiles, 5000) / Math.max(comp.miles, 5000), MILEAGE_ELASTICITY);
    f *= clamp(m, 0.7, 1.15);
  }
  if (comp.year != null && Number.isFinite(comp.year) && comp.year > 1900) {
    const dy = clamp(comp.year - carYear, -4, 4);
    f *= Math.pow(AGE_FACTOR_PER_YEAR, dy);
  }
  return f;
}

/** Linear-interpolated quantile of an ascending-sorted array. */
export function quantileSorted(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = clamp(q, 0, 1) * (sorted.length - 1);
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Quantile of the corrected comps used as the dealer anchor. Sub-£4k markets
 * are about twice as dispersed (log-sd 0.27 vs 0.13 across 22 live tests):
 * tidy, prepped forecourt cars at £2.5–3.5k sit beside £800–1,500 ones of the
 * same age and mileage, so the median overstates what an ordinary example
 * fetches. Cheap markets use the 35th percentile (leave-one-out tuned), blended
 * linearly back to the median between a £3k and £5k median.
 */
export const CHEAP_ANCHOR_QUANTILE = 0.35;
export function anchorQuantile(medianPrice: number): number {
  const t = clamp((medianPrice - 3000) / 2000, 0, 1);
  return CHEAP_ANCHOR_QUANTILE + (0.5 - CHEAP_ANCHOR_QUANTILE) * t;
}

/** Comps corrected to this car's mileage and year; median, or lower quantile in cheap markets. */
export function compAdjustedAnchor(comps: Comp[], carMiles: number, carYear: number, quantile?: number): number | null {
  const vals = comps
    .filter((c) => Number.isFinite(c.price) && c.price > 0)
    .map((c) => c.price * compAdjustmentFactor(carMiles, carYear, c))
    .sort((a, b) => a - b);
  if (!vals.length) return null;
  const med = quantileSorted(vals, 0.5);
  return quantileSorted(vals, quantile ?? anchorQuantile(med));
}

/**
 * High-mileage penalty on top of normal mileage depreciation: above ~140k miles
 * the private buyer pool shrinks sharply (finance/warranty unavailable), so values
 * fall faster than the elasticity curve. Up to -35% by 200k.
 */
export function highMileagePenalty(miles: number): number {
  return 0.35 * clamp((miles - 140_000) / 60_000, 0, 1);
}

/**
 * Private-sale value from a dealer-retail figure. MarketCheck listings are
 * overwhelmingly dealer forecourt prices, which carry a roughly fixed cost
 * (prep, warranty, margin ≈ £500) plus a proportional margin (~20%). A fixed+
 * proportional model naturally widens the gap on cheap cars, where dealer
 * margin is a bigger share of the price.
 */
export function privateFromRetail(retail: number, miles: number): number {
  // Condition is already applied to retail via the condition multiplier.
  const p = dealerToPrivate(retail);
  return p * (1 - highMileagePenalty(miles));
}

export function tradeFrom(retail: number, privateSale: number): number {
  return Math.min(retail * 0.74, privateSale * 0.9);
}

const DURABLE_MAKES = /^(toyota|honda|lexus|mazda|suzuki)$/i;

/**
 * Calibrate the AI fallback (no live comps) estimate.
 * - Models anchor on dealer listings in their training data, so newer cars come
 *   out high: <=5y -12%, 5–10y -3%, older cars get no discount (their market is
 *   mostly private already).
 * - Same high-mileage penalty as the comps path.
 * - Old/cheap floor: a running, MOT'd car at or below average mileage rarely
 *   trades privately for under ~£1,500; durable makes hold ~15% more at 10+ years.
 */
export function calibrateAiPrivate(params: {
  aiPrivate: number;
  make: string;
  year: number;
  miles: number;
  currentYear: number;
  motValid: boolean;
}): { privateSale: number; notes: string[] } {
  const { aiPrivate, make, year, miles, currentYear, motValid } = params;
  const age = Math.max(0, currentYear - year);
  const notes: string[] = [];
  const dealerBias = age <= 5 ? 0.12 : age <= 10 ? 0.03 : 0;
  let p = aiPrivate * (1 - dealerBias);
  if (dealerBias) notes.push(`dealer-bias -${Math.round(dealerBias * 100)}%`);
  const hm = highMileagePenalty(miles);
  if (hm > 0) { p *= 1 - hm; notes.push(`high-mileage -${Math.round(hm * 100)}%`); }
  const expected = Math.max(age * 8000, 3000);
  const durable = DURABLE_MAKES.test(make.trim());
  if (age >= 10 && durable) { p *= 1.15; notes.push("durable make +15%"); }
  if (age >= 10 && motValid && miles / expected <= 1.1 && miles < 140_000) {
    const floor = 1500 * (durable ? 1.15 : 1);
    if (p < floor) { p = floor; notes.push(`old-car floor £${Math.round(floor)}`); }
  }
  return { privateSale: p, notes };
}

/**
 * Suggested asking range shown to the seller. Guarantees the realistic private
 * figure sits at or below the low end, so we never tell someone to ask less than
 * the car is worth.
 */
export function askRange(privateSale: number, askBase: number): { low: number; high: number; base: number } {
  const base = Math.max(askBase || 0, privateSale);
  const spread = Math.max(250, Math.round((base * 0.035) / 50) * 50);
  const low = Math.max(Math.ceil(privateSale / 50) * 50, Math.round((base - spread) / 50) * 50);
  const high = Math.max(low + 2 * Math.max(100, Math.round((spread / 2) / 50) * 50), Math.round((base + spread) / 50) * 50);
  return { low, high, base };
}

/** Private-sale range around the realistic figure; always contains it. */
export function privateRange(privateSale: number, spread: number): { low: number; high: number } {
  const low = roundToGrain(privateSale * (1 - spread * 0.8));
  const high = roundToGrain(privateSale * (1 + spread));
  return { low: Math.min(low, privateSale), high: Math.max(high, privateSale) };
}

export type PhotoImpact = { priceImpact?: number | string | null };

/** Net photo impact = exact sum of the line items shown (coerced to numbers). */
export function sumPhotoImpacts(items: PhotoImpact[] | null | undefined): number {
  return (items ?? []).reduce((s, i) => {
    const n = Number(i?.priceImpact);
    return s + (Number.isFinite(n) ? Math.round(n) : 0);
  }, 0);
}

const STOP = new Set(["the","a","an","and","or","of","to","in","on","for","with","is","are","was","its","it","this","that","at","as","by","be","has","have","your","you","will","which","from","than","but","so","very","just","also","any","all","into","out","up","over","under","there","their","they","our","we"]);
const MONTHS: Record<string, string> = { jan: "january", feb: "february", mar: "march", apr: "april", jun: "june", jul: "july", aug: "august", sep: "september", sept: "september", oct: "october", nov: "november", dec: "december" };

function normSentence(s: string): string {
  return s.toLowerCase().replace(/(\d),(\d{3})/g, "$1$2").replace(/[^a-z0-9£%]+/g, " ").trim();
}

/** Content tokens with light stemming ("advisories"→"advisor", "cleanly"→"clean", "Oct"→"october", "169k"→"169000"). */
export function contentTokens(s: string): string[] {
  return normSentence(s).split(" ").map((w) => {
    if (MONTHS[w]) return MONTHS[w];
    const k = w.match(/^(\d+)k$/); if (k) return String(Number(k[1]) * 1000);
    return w.replace(/(ies|ily|ly|es|s|ed|ing)$/, (m) => (m === "ies" || m === "ily" ? "y" : "")).replace(/y$/, "");
  }).filter((w) => w.length > 1 && !STOP.has(w));
}

/** True when two sentences say the same thing (normalised equality, containment, or high token overlap). */
export function isNearDuplicate(a: string, b: string): boolean {
  const na = normSentence(a); const nb = normSentence(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 25 && nb.length >= 25 && (na.includes(nb) || nb.includes(na))) return true;
  const A = new Set(contentTokens(a)); const B = new Set(contentTokens(b));
  if (A.size < 3 || B.size < 3) return false;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  const jac = inter / (A.size + B.size - inter);
  const overlap = inter / Math.min(A.size, B.size);
  return inter >= 3 && (jac >= 0.6 || overlap >= 0.8);
}

export function splitSentences(text: string): string[] {
  return String(text ?? "").split(/(?<=[.!?])\s+(?=[A-Z0-9£"'(])/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Remove sentences that repeat (exactly or near-exactly — see isNearDuplicate)
 * anything already in `seen`, within a field and across fields in order. `seen`
 * is shared so callers can dedupe a whole report. Fragments under 20 chars are
 * never treated as duplicates.
 */
export function dedupeSentences(text: string, seen: Set<string> = new Set()): string {
  if (!text) return text;
  const out: string[] = [];
  for (const s of splitSentences(text)) {
    const k = normSentence(s);
    if (k.length >= 20) {
      let dup = seen.has(k);
      if (!dup) for (const prev of seen) { if (isNearDuplicate(prev, k)) { dup = true; break; } }
      if (dup) continue;
      seen.add(k);
    }
    out.push(s);
  }
  return out.join(" ");
}

/** Dedupe a bullet list against itself and `seen`; never empties a non-empty list. */
export function dedupeList(items: string[] | undefined, seen: Set<string>): string[] | undefined {
  if (!Array.isArray(items)) return items;
  const out: string[] = [];
  for (const it of items) {
    if (typeof it !== "string") continue;
    const k = normSentence(it);
    if (k.length >= 12 && ([...seen].some((p) => p === k || isNearDuplicate(p, k)))) continue;
    if (k.length >= 12) seen.add(k);
    out.push(it);
  }
  return out.length || !items.length ? out : [items[0]];
}

/** Prose fields, deduped in this order (earlier fields win). */
export const NARRATIVE_FIELDS = [
  "headline", "honestAnalysis", "marketPositioning", "valueReasoning", "marketContext",
  "photoObservations", "marketConfidenceReason", "rareCarWarning", "sellerTip",
] as const;
/** Bullet lists, deduped after the prose (and against each other). */
export const LIST_FIELDS = ["strengths", "factorsUp", "watchPoints", "factorsDown"] as const;

/** Dedupe sentences/bullets across the report's narrative sections (returns a shallow copy). */
export function dedupeReportText<T extends Record<string, any>>(report: T): T {
  const seen = new Set<string>();
  const out: any = { ...report };
  for (const f of NARRATIVE_FIELDS) {
    if (typeof out[f] === "string") out[f] = dedupeSentences(out[f], seen);
  }
  if (out.expertInsight && typeof out.expertInsight.reason === "string") {
    out.expertInsight = { ...out.expertInsight, reason: dedupeSentences(out.expertInsight.reason, seen) };
  }
  // Positives and negatives are deduped in separate pools so a bullet never
  // disappears just because the prose mentioned the same topic with a different
  // sentiment; both pools start from the prose.
  const prose = [...seen];
  const pos = new Set(prose); const neg = new Set(prose);
  out.strengths = dedupeList(out.strengths, pos);
  out.factorsUp = dedupeList(out.factorsUp, pos);
  out.watchPoints = dedupeList(out.watchPoints, neg);
  out.factorsDown = dedupeList(out.factorsDown, neg);
  for (const f of LIST_FIELDS) if (out[f] === undefined && !(f in report)) delete out[f];
  return out;
}

// ---------------------------------------------------------------------------
// Pricing ledger — ONE source of truth for the comps path. The adjustments the
// report lists are exactly the ones that move the numbers: retail-scope items
// sum (additively) to the net % applied to the anchor, private-scope items
// apply to the private figure only, and anchor-scope items are informational
// (already inside the comp-corrected anchor).
// ---------------------------------------------------------------------------

export type AdjustmentScope = "anchor" | "retail" | "private";
export type LedgerItem = { label: string; impactPct: number; scope: AdjustmentScope };

export const RETAIL_NET_MIN = -45;
export const RETAIL_NET_MAX = 28;

/** Private-sale value from retail WITHOUT any mileage penalty. */
// Recalibrated on 22 live-tested private adverts (batches 2–5, outliers
// excluded: dealer-like asks, declared/undeclared defects, clocked car)
// subject to the 12-car backtest staying <= 10.0%. In-sample and leave-one-out MAE 22.0%
// vs 22.2% for 0.80R−£500. Age/mileage terms gave no held-out gain
// (mileage is priced by highMileagePenalty). Effective ratio: 0.68× below
// £4,000 retail, rising to ~0.71× at £6k and ~0.76× at £20k.
export const PRIVATE_RATIO = 0.78;
export const PRIVATE_FIXED = 400;
export const PRIVATE_FLOOR = 0.68;
export function dealerToPrivate(retail: number): number {
  return clamp(retail * PRIVATE_RATIO - PRIVATE_FIXED, retail * PRIVATE_FLOOR, retail * 0.9);
}
/** Inverse of dealerToPrivate (ignoring the 0.9 cap). */
export function retailFromPrivate(privateSale: number): number {
  return Math.min((privateSale + PRIVATE_FIXED) / PRIVATE_RATIO, privateSale / PRIVATE_FLOOR);
}

/**
 * High-mileage penalty beyond what the comparables already carry. Comps at
 * 160k are already priced as 160k cars, so only the curve above their median
 * mileage is applied — mileage is priced once.
 */
export function residualHighMileagePenalty(miles: number, compMedianMiles?: number | null): number {
  const full = highMileagePenalty(miles);
  if (compMedianMiles == null || !(compMedianMiles > 0)) return full;
  return Math.max(0, full - highMileagePenalty(compMedianMiles));
}

export function finalisePricing(p: {
  anchor: number;
  miles: number;
  compMedianMiles?: number | null;
  items: LedgerItem[];
}) {
  const items = p.items.filter((i) => Number.isFinite(i.impactPct)).map((i) => ({ ...i, impactPct: Math.round(i.impactPct) }));
  const hm = residualHighMileagePenalty(p.miles, p.compMedianMiles);
  const hmPct = Math.round(hm * 100);
  if (hmPct > 0) items.push({ label: "Very high mileage (narrow private buyer pool)", impactPct: -hmPct, scope: "private" });
  const rawRetail = items.filter((i) => i.scope === "retail").reduce((s, i) => s + i.impactPct, 0);
  const retailNetPct = clamp(rawRetail, RETAIL_NET_MIN, RETAIL_NET_MAX);
  if (retailNetPct !== rawRetail) {
    items.push({ label: "Combined adjustments capped", impactPct: retailNetPct - rawRetail, scope: "retail" });
  }
  const privateNetPct = items.filter((i) => i.scope === "private").reduce((s, i) => s + i.impactPct, 0);
  const baseRetail = roundToGrain(p.anchor);
  const dealerRetail = roundToGrain(baseRetail * (1 + retailNetPct / 100));
  const privateSale = roundToGrain(dealerToPrivate(dealerRetail) * Math.max(0.3, 1 + privateNetPct / 100));
  const dealerTradeIn = roundToGrain(tradeFrom(dealerRetail, privateSale));
  return { items, baseRetail, dealerRetail, privateSale, dealerTradeIn, retailNetPct, privateNetPct };
}

/** Old reports carry no scope — infer it from the label. */
export function inferScope(label: string): AdjustmentScope {
  if (/than comparables|budget market/i.test(label)) return "anchor";
  if (/\bMOT\b.*(expir|valid|months?|days?)|expir|very high mileage|narrow private/i.test(label) && !/advisor|corrosion|fail/i.test(label)) return "private";
  return "retail";
}

/** Net retail % from a stored adjustment list (scope-aware, works on old reports). */
export function retailNetFromAdjustments(adjs: { label: string; impactPct: number; scope?: AdjustmentScope }[] | undefined): number {
  return (adjs ?? []).filter((a) => (a.scope ?? inferScope(a.label)) === "retail").reduce((s, a) => s + (Number(a.impactPct) || 0), 0);
}

// ---------------------------------------------------------------------------
// Mileage reconciliation against DVSA odometer readings.
// ---------------------------------------------------------------------------

export type MileageCheck = {
  /** Mileage to price on. */
  miles: number;
  status: "ok" | "note" | "clocking";
  gap: number;
  motMax: number;
};

export function reconcileMileage(declared: number, motMax: number): MileageCheck {
  const gap = motMax > 0 ? motMax - declared : 0;
  if (gap <= 0) return { miles: declared, status: "ok", gap: 0, motMax };
  const tolerance = Math.max(3000, motMax * 0.03);
  // A round advert figure ("100,000 miles") a little under the MOT is rounding, not clocking.
  const roundingLike = declared % 1000 === 0 && gap <= Math.max(5000, motMax * 0.05);
  if (gap <= tolerance || roundingLike) return { miles: motMax, status: "note", gap, motMax };
  return { miles: motMax, status: "clocking", gap, motMax };
}

export function mileageNoteText(c: MileageCheck): string | undefined {
  if (c.status !== "note") return undefined;
  return `Mileage priced on the last MOT reading (${c.motMax.toLocaleString("en-GB")} mi) — make sure your advert shows the up-to-date figure.`;
}

// ---------------------------------------------------------------------------
// Market confidence — driven by how much comparable data there is.
// ---------------------------------------------------------------------------

export type ConfidenceTier = "High" | "Medium" | "Low" | "Very Low";

export function marketConfidenceTier(p: { sampleSize: number; outlierMileage?: boolean }): ConfidenceTier {
  const n = Number(p.sampleSize) || 0;
  let tier: ConfidenceTier = n >= 150 ? "High" : n >= 30 ? "Medium" : n >= 10 ? "Low" : "Very Low";
  if (p.outlierMileage && tier === "High") tier = "Medium";
  return tier;
}

// ---------------------------------------------------------------------------
// Comparable filtering by fuel type and transmission.
// ---------------------------------------------------------------------------

export function normFuel(s?: string | null): string | undefined {
  const t = String(s ?? "").toLowerCase();
  if (!t.trim()) return undefined;
  if (/hybrid|phev|hev/.test(t)) return "hybrid";
  if (/electric|\bev\b|bev/.test(t)) return "electric";
  if (/diesel/.test(t)) return "diesel";
  if (/petrol|gasoline|unleaded/.test(t)) return "petrol";
  return undefined;
}

export function normTransmission(s?: string | null): string | undefined {
  const t = String(s ?? "").toLowerCase();
  if (!t.trim()) return undefined;
  if (/manual/.test(t)) return "manual";
  if (/auto|cvt|dsg|dct|tiptronic|s.?tronic|steptronic|semi|pdk|e-?cvt/.test(t)) return "automatic";
  return undefined;
}

export const MIN_SPEC_MATCHED_COMPS = 5;

/**
 * Keep only comps with the same fuel (and transmission) as this car, but only
 * when at least MIN_SPEC_MATCHED_COMPS match — otherwise fall back gracefully.
 */
export function filterCompsBySpec<T extends { fuelType?: string; transmission?: string }>(
  comps: T[], fuel?: string | null, transmission?: string | null,
): { comps: T[]; matched: string[] } {
  let out = comps;
  const matched: string[] = [];
  const f = normFuel(fuel);
  if (f) {
    const m = out.filter((c) => normFuel(c.fuelType) === f);
    if (m.length >= MIN_SPEC_MATCHED_COMPS) { out = m; matched.push(f); }
  }
  const tr = normTransmission(transmission);
  if (tr) {
    const m = out.filter((c) => normTransmission(c.transmission) === tr);
    if (m.length >= MIN_SPEC_MATCHED_COMPS) { out = m; matched.push(tr); }
  }
  return { comps: out, matched };
}

// ---------------------------------------------------------------------------
// MOT penalty (DVSA signals from the LATEST test + recent failures).
// Calibrated on batches 3–4: routine "corroded but not seriously weakened"
// advisories are near-universal on 10+ year-old UK cars and buyers barely
// discount them, so they are mild. Serious/structural corrosion (seriously
// weakened, excessive, perforated, within 30cm of a mounting) or corrosion on a
// failure item stays strong, as does a failure in the last 12 months.
// The total MOT deduction is capped.
export const MOT_PENALTY_CAP = -15;
const CORROSION_RE = /corro|rust/i;
const SERIOUS_CORROSION_RE = /(?<!not\s)seriously\s+weakened|excessive(ly)?\s+(corro|rust)|perforat|structur|load[- ]bearing|within\s+30\s*cm|prescribed\s+area|severe(ly)?\s+(corro|rust)/i;

export type MotTestLite = { date?: string; result?: string; advisories?: string[]; failures?: string[] };

export function classifyCorrosion(advisories: string[], failures: string[] = []): { routine: number; serious: number } {
  let routine = 0; let serious = 0;
  for (const a of advisories) if (CORROSION_RE.test(a)) { if (SERIOUS_CORROSION_RE.test(a)) serious++; else routine++; }
  for (const f of failures) if (CORROSION_RE.test(f)) serious++;
  return { routine, serious };
}

/** Months between two ISO dates (b − a). */
function monthsBetween(a: string, b: string): number {
  const da = new Date(a).getTime(); const db = new Date(b).getTime();
  return (db - da) / (1000 * 60 * 60 * 24 * 30.44);
}

export function motPenaltyItems(tests: MotTestLite[], today: string): LedgerItem[] {
  const items: LedgerItem[] = [];
  const latest = tests[0];
  if (!latest) return items;
  const adv = latest.advisories ?? [];
  const { routine, serious } = classifyCorrosion(adv, latest.failures ?? []);
  if (serious > 0) items.push({ label: `Serious corrosion on MOT (${serious})`, impactPct: -8 - 4 * Math.min(serious - 1, 2), scope: "retail" });
  if (routine > 0) items.push({ label: routine > 1 ? `Minor corrosion advisories (${routine})` : "Minor corrosion advisory on MOT", impactPct: -Math.min(2 * routine, 5), scope: "retail" });
  const recentFail = tests.slice(0, 3).some((t) => t.result === "Fail" && (!t.date || monthsBetween(t.date, today) <= 12));
  if (recentFail) items.push({ label: "Recent MOT failure(s)", impactPct: -6, scope: "retail" });
  if (adv.length >= 6) items.push({ label: `${adv.length} current advisories`, impactPct: -3, scope: "retail" });
  const total = items.reduce((s, i) => s + i.impactPct, 0);
  if (total < MOT_PENALTY_CAP) {
    // Scale down proportionally so the listed items still sum to the cap.
    const k = MOT_PENALTY_CAP / total; let acc = 0;
    items.forEach((i, idx) => { i.impactPct = idx === items.length - 1 ? MOT_PENALTY_CAP - acc : Math.round(i.impactPct * k); acc += i.impactPct; });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Seller-declared status in free text (service notes / advert description).
// Insurance write-off categories and spares-or-repair sales trade at a steep
// discount to clean comps (MarketCheck comps are overwhelmingly clean cars).
const NEGATED = /\b(no|not|never|isn'?t|wasn'?t|non)[\s-]+(an?\s+)?(cat(egory)?|write[- ]?off|spares)/i;
export function declaredStatusItems(text: string | null | undefined): LedgerItem[] {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return [];
  const items: LedgerItem[] = [];
  const cat = t.match(/\bcat(?:egory)?(?:\s+|\s*[-:]\s*)([sncd])\b/i);
  if (cat && !NEGATED.test(t)) {
    const c = cat[1].toUpperCase();
    items.push({ label: `Insurance write-off (Cat ${c})`, impactPct: c === "S" || c === "C" ? -25 : -18, scope: "retail" });
  } else if (/\b(written[- ]off|write[- ]off|insurance\s+loss)\b/i.test(t) && !/\b(never|not|no)\s+(been\s+)?(written|write|insurance)/i.test(t)) {
    // Write-off declared without a category: treat as the milder Cat N.
    items.push({ label: "Declared insurance write-off", impactPct: -18, scope: "retail" });
  }
  if (/\b(spares\s*(or|\/|&)\s*repairs?|non[- ]runner|for\s+spares)\b/i.test(t) && !/not\s+(a\s+)?(spares|non[- ]runner)/i.test(t)) {
    items.push({ label: "Sold as spares or repair", impactPct: -30, scope: "retail" });
  }
  return items;
}
