// Variant resolution + report-consistency guards (eng-4, after the WD15HTZ RS6 incident:
// DVLA said "A6", the engine priced a 4.0 V8 RS6 off 216 plain A6 adverts at £6,100 while
// the AI tip said "List at £25,995").
//  1. resolveVariant: infer the true performance trim from engine size + seller text.
//  2. perfCompReference: like-for-like reference price from our own adverts of that variant.
//  3. reconcileProsePrices: AI-written £ figures must match the shown numbers.
//  4. sanityVerdict: refuse a confident number when the sources disagree wildly.
import { inferPerformanceTrim, type TrimHint } from "./perfTrim.ts";
import { detectPerformanceVariant, normText, type PerfVariant } from "./performance.ts";

export interface VariantResolution {
  variant?: string;            // variant to price with (undefined = none / unchanged)
  source: "provider" | "text" | "engine" | null;
  hint: TrimHint | null;
  /** Engine size says performance version but we can't tell which (e.g. RS6 vs S6). */
  ambiguousPerf: boolean;
  /** Display name for the report, e.g. "RS6" or "Golf GTI". */
  displayModel?: string;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** "RS6" matches "RS6", "RS 6", "rs-6"; "C63 AMG" matches "C63" / "C 63". */
export function optionRegex(opt: string): RegExp {
  const core = opt.split(/\s*\/\s*/)[0].replace(/\bAMG\b/i, "").trim() || opt;
  const parts = core.match(/[a-z]+|\d+/gi) ?? [core];
  return new RegExp(`(?:^|[^a-z0-9])${parts.map(esc).join("[\\s-]?")}(?![a-z0-9])`, "i");
}

const MODEL_NAME_OPT = /^(?:rs ?q?\d|s\d|sq\d|m\d|tt rs|[a-z]{1,3} ?(?:35|43|45|63)\b)/i;

export function resolveVariant(v: {
  make?: string | null; model?: string | null; variant?: string | null; fuel?: string | null;
  cc?: number | null; year?: number | null; gearbox?: string | null; text?: string | null;
}): VariantResolution {
  if (normText(v.variant)) return { variant: v.variant ?? undefined, source: "provider", hint: null, ambiguousPerf: false };
  const hint = inferPerformanceTrim({ make: v.make, model: v.model, fuel: v.fuel, cc: v.cc, year: v.year, gearbox: v.gearbox });
  const text = String(v.text ?? "");
  const pick = (opt: string): VariantResolution => ({
    variant: opt.split(/\s*\/\s*/)[0], source: "engine", hint, ambiguousPerf: false,
    displayModel: MODEL_NAME_OPT.test(opt) ? opt.split(/\s*\/\s*/)[0] : `${v.model ?? ""} ${opt.split(/\s*\/\s*/)[0]}`.trim(),
  });
  if (hint) {
    const named = hint.options.find((o) => optionRegex(o).test(text));
    if (named) return { ...pick(named), source: "text" };
    if (hint.confident) return pick(hint.variant);
    return { source: null, hint, ambiguousPerf: hint.allPerf };
  }
  return { source: null, hint: null, ambiguousPerf: false };
}

// ---------- like-for-like reference from our own adverts ----------
export interface PerfCompRow { model?: string | null; variant?: string | null; year: number; mileage: number; price: number; seller?: string | null; source_url?: string | null }
export interface PerfRef { n: number; private: number; low: number; high: number }
export const MIN_VARIANT_COMPS = 8;

/** Year/mileage-normalised private-equivalent median of adverts that match the variant. */
/** The exact badge to match comps on, e.g. "rs6" from "RS6 Avant Performance". */
export function variantToken(perf: PerfVariant, model?: string | null, variant?: string | null): string | null {
  const t = normText(`${model ?? ""} ${variant ?? ""}`);
  const m = t.match(perf.specific?.comp ?? perf.broad) ?? t.match(perf.broad);
  return m ? m[0].trim() : null;
}

export function perfCompReference(perf: PerfVariant, rows: PerfCompRow[], q: { year: number; mileage: number; token?: string | null; base?: string | null }): PerfRef {
  const rx = perf.specific ? perf.specific.comp : perf.broad;
  const tok = q.token ? optionRegex(q.token) : null;
  const needBase = !!q.token && !MODEL_NAME_OPT.test(q.token) && !!q.base;
  const m = rows.filter((r) => {
    const t = normText(`${r.model ?? ""} ${r.variant ?? ""}`);
    if (!(r.price > 500 && Math.abs(r.year - q.year) <= 4 && rx.test(t))) return false;
    if (tok && !tok.test(t)) return false;
    if (needBase && !normText(r.model).includes(normText(q.base))) return false;
    return true;
  });
  if (!m.length) return { n: 0, private: 0, low: 0, high: 0 };
  const adj = m.map((r) => {
    let p = r.price / (r.seller === "dealer" ? 1.12 : 1);
    p *= Math.pow(1.08, Math.max(-4, Math.min(4, q.year - r.year)));
    p *= Math.max(0.7, Math.min(1.3, 1 - 0.003 * ((q.mileage - r.mileage) / 1000)));
    return p;
  }).sort((a, b) => a - b);
  const at = (f: number) => adj[Math.min(adj.length - 1, Math.max(0, Math.round(f * (adj.length - 1))))];
  return { n: m.length, private: at(0.5), low: at(0.25), high: at(0.75) };
}

// ---------- AI prose price reconciliation ----------
export interface ShownPrices { privateSale: number; tradeIn: number; retail: number; askLow?: number; askHigh?: number; rangeLow?: number; rangeHigh?: number }
const fmt = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
const MONEY = /£\s?(\d{1,3}(?:,\d{3})+|\d{3,7})(?:\.\d{2})?(\s?k\b)?/gi;
const amount = (s: string, k?: string) => Number(s.replace(/,/g, "")) * (k ? 1000 : 1);

function roleFor(before: string, shown: ShownPrices): number {
  const ctx = before.slice(-70).toLowerCase();
  const roles: [RegExp, number][] = [
    [/(trade|part[- ]?ex|dealer (?:would |will )?(?:offer|pay)|webuyanycar|instant)/g, shown.tradeIn],
    [/(retail|forecourt|dealers? (?:ask|charge|sell|list))/g, shown.retail],
    [/(list|advertis|ask(?:ing)?\b|price (?:it|the car)|start(?:ing)? at|put it up)/g, shown.askHigh || shown.privateSale],
    [/(floor|walk away|below|under|minimum|bottom)/g, shown.rangeLow || shown.privateSale],
    [/(offer|settle|accept|agreed|sale around|sell for|worth|value)/g, shown.privateSale],
  ];
  let best = -1, val = shown.privateSale; // nearest keyword wins
  for (const [rx, v] of roles) for (const m of ctx.matchAll(rx)) if ((m.index ?? -1) > best && v > 0) { best = m.index!; val = v; }
  return val;
}

/** Replaces AI £ figures that disagree (>tol) with every shown number; small sums (repairs) are left alone. */
export function reconcileProsePrices(text: string | undefined | null, shown: ShownPrices | null, tol = 0.10): string {
  const t = String(text ?? "");
  if (!t) return t;
  if (!shown || !(shown.privateSale > 0)) return stripPriceSentences(t);
  const allowed = [shown.privateSale, shown.tradeIn, shown.retail, shown.askLow, shown.askHigh, shown.rangeLow, shown.rangeHigh].filter((x): x is number => !!x && x > 0);
  const floor = Math.max(1000, shown.privateSale * 0.3);
  // Ranges first: "£8,450–£8,795" -> ask range (or private range).
  let out = t.replace(new RegExp(`${MONEY.source}\\s?(?:–|-|to)\\s?${MONEY.source}`, "gi"), (all, a, ak, b, bk, off: number) => {
    const A = amount(a, ak), B = amount(b, bk);
    if (Math.max(A, B) < floor) return all;
    const ok = (x: number) => allowed.some((y) => Math.abs(x / y - 1) <= tol);
    if (ok(A) && ok(B)) return all;
    const role = roleFor(t.slice(0, off), shown);
    if (role === shown.askHigh && shown.askLow && shown.askHigh) return `${fmt(shown.askLow)}–${fmt(shown.askHigh)}`;
    if (shown.rangeLow && shown.rangeHigh) return `${fmt(shown.rangeLow)}–${fmt(shown.rangeHigh)}`;
    return fmt(shown.privateSale);
  });
  const privSet = [shown.privateSale, shown.askLow, shown.askHigh, shown.rangeLow, shown.rangeHigh].filter((x): x is number => !!x && x > 0);
  out = out.replace(MONEY, (all, a, k, off: number, whole: string) => {
    const A = amount(a, k);
    if (A < floor) return all;
    const ctx = whole.slice(Math.max(0, off - 60), off).toLowerCase();
    const set = /(settle|accept|offer|take|walk away|haggl|negotiat)/.test(ctx) && !/(trade|part[- ]?ex|retail|forecourt)/.test(ctx) ? privSet : allowed;
    if (set.some((y) => Math.abs(A / y - 1) <= tol)) return all;
    return fmt(roleFor(whole.slice(0, off), shown));
  });
  return out;
}

/** No shown price (valuation unavailable): drop sentences carrying a car-price figure. */
export function stripPriceSentences(t: string): string {
  const parts = t.split(/(?<=[.!?])\s+/);
  const keep = parts.filter((p) => ![...p.matchAll(MONEY)].some((m) => amount(m[1], m[2]) >= 1000));
  return keep.join(" ").trim();
}

export function proseRatio(texts: (string | undefined | null)[], shownPrivate: number): number | null {
  if (!(shownPrivate > 0)) return null;
  let worst: number | null = null;
  for (const t of texts) for (const m of String(t ?? "").matchAll(MONEY)) {
    const a = amount(m[1], m[2]);
    if (a < Math.max(1000, shownPrivate * 0.3)) continue;
    const r = a / shownPrivate;
    if (worst == null || Math.abs(Math.log(r)) > Math.abs(Math.log(worst))) worst = r;
  }
  return worst;
}

// ---------- sanity verdict ----------
export interface SanityIn { shown: number; aiPrivate?: number | null; disagreement?: number | null; proseRatio?: number | null; perfMismatch?: boolean }
export interface SanityOut { verdict: "ok" | "lessCertain" | "unavailable"; reasons: string[] }
export function sanityVerdict(s: SanityIn): SanityOut {
  const reasons: string[] = [];
  if (!(s.shown > 0)) return { verdict: "ok", reasons };
  const ai = s.aiPrivate && s.aiPrivate > 0 ? s.aiPrivate / s.shown : null;
  const pr = s.proseRatio ?? null;
  if (s.perfMismatch) reasons.push("photos/description indicate a performance variant the comps did not cover");
  if (ai != null && (ai > 2.5 || ai < 0.4)) reasons.push(`AI estimate ${ai.toFixed(2)}x the engine figure`);
  if (pr != null && (pr > 2.5 || pr < 0.4)) reasons.push(`AI prose price ${pr.toFixed(2)}x the engine figure`);
  if (reasons.length) return { verdict: "unavailable", reasons };
  if ((s.disagreement ?? 0) > 0.5) reasons.push(`sources disagree (d=${s.disagreement})`);
  if (ai != null && (ai > 1.8 || ai < 0.55)) reasons.push(`AI estimate ${ai.toFixed(2)}x the engine figure`);
  if (pr != null && (pr > 2 || pr < 0.5)) reasons.push(`AI prose price ${pr.toFixed(2)}x the engine figure`);
  return { verdict: reasons.length ? "lessCertain" : "ok", reasons };
}

export function aiTextVariant(make: string, model: string, texts: (string | undefined | null)[]): PerfVariant | null {
  return detectPerformanceVariant(make, model, "", texts.filter(Boolean).join(" ").slice(0, 600));
}
