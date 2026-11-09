// Rare / performance variant pricing (rare-cars-1). Replaces the eng-4 "refuse" outcome with a tiered search for
// like-for-like evidence, then an AI estimate grounded on the adverts we do hold. The guard is unchanged in spirit:
// a rare variant is NEVER priced against its standard siblings — every tier uses only adverts of the same variant,
// and an AI figure can never drop below the standard-model figure.
import { optionRegex, MIN_VARIANT_COMPS, type PerfCompRow } from "./variantGuard.ts";
import { normText, type PerfVariant } from "./performance.ts";

const titleCase = (s: string) => s.replace(/\b([a-z])([a-z]*)/g, (_m, a: string, b: string) => a.toUpperCase() + b);
const BADGE_UPPER = /^(rs ?q?\d*|s\d|sq\d|m\d|amg|gti|gtd|st|vxr|vrs|jcw|gt|gsi|sti|wrx|gt-?r|r\d{2}|c\d{2}|e\d{2}|a\d{2}|cla|gla|n)$/i;

/** SQL ILIKE patterns for a badge token: "type r" -> "%type%r%", "rs6" -> "%rs%6%". */
export function variantLikePatterns(token: string): string[] {
  const parts = normText(token).match(/[a-z]+|\d+/g) ?? [];
  if (!parts.length) return [];
  return [`%${parts.join("%")}%`];
}

/** Display name for a variant: "Civic Type R", "Integra Type R", "RS6", "M3", "C63 AMG", "Golf R". */
export function canonicalVariantName(model: string | null | undefined, token: string | null | undefined): string | null {
  const t = normText(token);
  if (!t) return null;
  const word = (w: string) => (BADGE_UPPER.test(w) ? w.toUpperCase() : titleCase(w));
  // Badges that are model names in their own right (RS6, M3, C63 AMG, A45, TT RS) don't take the base model.
  if (/^(rs ?q?\d|s\d|sq\d|m\d|tt rs|[a-z]{1,3} ?(35|43|45|53|55|63|65)\b)/i.test(t)) {
    return t.replace(/^([a-z]+) (\d)/, "$1$2").split(" ").map(word).join(" ");
  }
  const md = normText(model);
  const tokRx = optionRegex(t);
  if (md && tokRx.test(md)) return md.split(" ").slice(0, 4).map(word).join(" ");
  const base = md.split(" ")[0];
  const pretty = t.split(" ").map(word).join(" ");
  return base ? `${word(base)} ${pretty}` : pretty;
}

export type RareTier = "same" | "nearby" | "generations";
export interface RareRef { tier: RareTier; n: number; private: number; low: number; high: number; years: [number, number] }

const TIERS: { tier: RareTier; span: number; min: number; capYears: number; perYear: number; widen: number }[] = [
  { tier: "same", span: 4, min: MIN_VARIANT_COMPS, capYears: 4, perYear: 0.08, widen: 0 },
  { tier: "nearby", span: 8, min: 4, capYears: 8, perYear: 0.07, widen: 0.15 },
];

/**
 * Like-for-like reference from our own adverts of the same variant, widening step by step:
 *   same     — same variant within ±4 years (the original eng-4 reference), >= 8 adverts
 *   nearby   — same variant within ±8 years (neighbouring generations), wider mileage, >= 4 adverts
 * Returns null when even the widest tier is too thin (the caller then asks the AI, with these adverts as evidence).
 */
export function tieredVariantReference(perf: PerfVariant, rows: PerfCompRow[], q: { year: number; mileage: number; token?: string | null; base?: string | null }): RareRef | null {
  const rx = perf.specific ? perf.specific.comp : perf.broad;
  const tok = q.token ? optionRegex(q.token) : null;
  const needBase = !!q.token && !/^(rs ?q?\d|s\d|sq\d|m\d|tt rs|[a-z]{1,3} ?(35|43|45|63)\b)/i.test(q.token) && !!q.base;
  const like = rows.filter((r) => {
    const t = normText(`${r.model ?? ""} ${r.variant ?? ""}`);
    if (!(r.price > 500 && r.year > 1950 && rx.test(t))) return false;
    if (tok && !tok.test(t)) return false;
    if (needBase && !normText(r.model).includes(normText(q.base))) return false;
    return true;
  });
  for (const T of TIERS) {
    const m = like.filter((r) => Math.abs(r.year - q.year) <= T.span);
    if (m.length < T.min) continue;
    const adj = m.map((r) => {
      let p = r.price / (r.seller === "dealer" ? 1.12 : 1);
      p *= Math.pow(1 + T.perYear, Math.max(-T.capYears, Math.min(T.capYears, q.year - r.year)));
      p *= Math.max(0.6, Math.min(1.35, 1 - 0.003 * ((q.mileage - r.mileage) / 1000)));
      return p;
    }).sort((a, b) => a - b);
    const at = (f: number) => adj[Math.min(adj.length - 1, Math.max(0, Math.round(f * (adj.length - 1))))];
    const mid = at(0.5);
    return {
      tier: T.tier, n: m.length, private: mid,
      low: Math.min(at(0.25), mid * (1 - T.widen)), high: Math.max(at(0.75), mid * (1 + T.widen)),
      years: [Math.min(...m.map((r) => r.year)), Math.max(...m.map((r) => r.year))],
    };
  }
  return null;
}

/** Adverts to show the AI as evidence: same variant first (any year), then the make's other performance adverts. */
export function rareEvidence(perf: PerfVariant, rows: PerfCompRow[], q: { year: number; token?: string | null; base?: string | null }, max = 25): PerfCompRow[] {
  const tok = q.token ? optionRegex(q.token) : null;
  const score = (r: PerfCompRow) => {
    const t = normText(`${r.model ?? ""} ${r.variant ?? ""}`);
    const sameBase = q.base ? normText(r.model).includes(normText(q.base)) : false;
    const sameTok = tok ? tok.test(t) : perf.broad.test(t);
    return (sameBase && sameTok ? 0 : sameTok ? 1000 : 2000) + Math.abs(r.year - q.year) * 10;
  };
  return rows.filter((r) => r.price > 500 && perf.broad.test(normText(`${r.model ?? ""} ${r.variant ?? ""}`)))
    .sort((a, b) => score(a) - score(b)).slice(0, max);
}

export interface RareAiEstimate { low: number; mid: number; high: number; rationale: string }

export function rareAiPrompt(v: { make: string; model: string; variantName: string; year: number; mileage: number; importNote?: string | null; variantFromEngineOnly?: boolean }, evidence: PerfCompRow[]): string {
  const ev = evidence.length
    ? evidence.map((r) => `- ${r.year} ${v.make} ${r.model ?? ""} ${String(r.variant ?? "").slice(0, 60)} | ${Number(r.mileage).toLocaleString("en-GB")} mi | £${Number(r.price).toLocaleString("en-GB")} (${r.seller === "dealer" ? "dealer" : "private"})`).join("\n")
    : "(none — we hold no adverts for this variant or its relatives)";
  return [
    `Estimate the realistic UK PRIVATE-SALE value today of a ${v.year} ${v.make} ${v.variantName} with ${Number(v.mileage).toLocaleString("en-GB")} miles, in average condition for its age.`,
    v.variantFromEngineOnly ? `The exact trim is inferred from the model and engine, not confirmed; value it as the ${v.variantName}.` : "",
    v.importNote ? `Note: ${v.importNote}` : "",
    "Real UK adverts we hold for this variant and related performance models (asking prices; dealer asks run ~10-15% above private sales; other generations/models differ in value, so use them as evidence of the market, not as direct comparables):",
    ev,
    "Rules: value THIS variant, never a standard model. Be realistic about age and mileage. Use whole pounds.",
    "Return only JSON: {\"low\": number, \"mid\": number, \"high\": number, \"rationale\": \"one short sentence, no £ figures\"}",
  ].filter(Boolean).join("\n");
}

export function parseRareAi(text: string | null | undefined): RareAiEstimate | null {
  const m = String(text ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const mid = Number(j.mid), low = Number(j.low), high = Number(j.high);
    if (!(mid > 300 && mid < 2_000_000)) return null;
    return {
      mid, low: low > 0 && low <= mid ? low : mid * 0.8, high: high >= mid ? high : mid * 1.25,
      rationale: String(j.rationale ?? "").replace(/£\s?[\d,]+k?/gi, "").slice(0, 240),
    };
  } catch { return null; }
}

/**
 * Final figure + range for an AI-estimated rare car. Never below the standard-model figure (a rare variant is worth
 * at least its everyday sibling); range at least ±25% (−20/+30) because no like-for-like adverts back it.
 */
export function rareAiFigures(est: RareAiEstimate, standardPrivate: number): { private: number; low: number; high: number } {
  const mid = Math.max(est.mid, standardPrivate > 0 ? standardPrivate : 0);
  return { private: mid, low: Math.min(est.low, mid * 0.8), high: Math.max(est.high, mid * 1.3) };
}

export interface RareText { reasoning: string; confidence: string; warning: string }
/** Three distinct texts (the report dedupes near-identical sentences across fields). No accuracy claims. */
export function rareNote(kind: RareTier | "ai", name: string, n: number, years?: [number, number]): RareText {
  const span = years ? (years[0] === years[1] ? ` from ${years[0]}` : ` from ${years[0]}–${years[1]}`) : "";
  const confidence = "Limited market data for this car, so treat the figure as a guide.";
  if (kind === "ai") return {
    reasoning: `${name}s rarely come up for sale, so this figure is estimated from the wider market for cars like this rather than from direct comparables.`,
    confidence,
    warning: "Cars like this sell on condition, originality and history, and we hold no direct comparables — treat the figure as a rough guide.",
  };
  return {
    reasoning: `Based on ${n} ${name} adverts${kind === "same" ? "" : span}, each adjusted to this car's age and mileage.`,
    confidence,
    warning: `Few ${name}s come up for sale, so the figure rests on a small number of adverts. Compare it with any similar cars for sale before you list.`,
  };
}
