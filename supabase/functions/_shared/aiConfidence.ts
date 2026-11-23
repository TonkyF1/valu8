// conf-ai-1: AI-assisted "how sure are we" rating (marketConfidence). Trial, behind AI_CONFIDENCE.
//
// The rule-based level worked out by analyse-vehicle is kept as the DATA LEVEL. A small AI call then looks at all the
// evidence (comps, how close they are, dispersion, source disagreement, sanity verdict, model popularity, age, mileage,
// MOT history, import/performance flags) plus its own UK market knowledge and proposes {level, reason}.
// Guardrails here, in code, decide what is shown:
//   * the final level moves at most ONE step from the data level;
//   * never "High" when the sanity verdict is lessCertain/unavailable, fewer than 10 comps, an import, or 20+ years old;
//   * invalid / failed / slow AI output keeps the data level and its reason.
// This NEVER touches a price, a range or valuationUnavailable: confidenceFields() only returns the four confidence keys.
import type { ConfidenceLevel } from "./valuation-math.ts";

export const CONF_LEVELS: ConfidenceLevel[] = ["Very Low", "Low", "Medium", "High"];
export const CONF_AI_VERSION = "conf-ai-1";
export type ConfMode = "off" | "shadow" | "on";

/** AI_CONFIDENCE env: "off" (no call), "shadow" (call + store, show the data level), "on" (default: show the guarded AI level). */
export function confidenceMode(raw: string | undefined | null): ConfMode {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "off" || v === "0" || v === "false" || v === "no") return "off";
  if (v === "shadow") return "shadow";
  return "on";
}

export interface ConfEvidence {
  make: string; model: string; variant?: string | null; year: number; ageYears: number; mileage: number;
  fuel?: string | null; gearbox?: string | null;
  pricingSource: string;                 // valu8_comps | marketcheck | ai_estimate
  dataLevel: ConfidenceLevel; dataReason: string;
  ownComps?: { level: string | null; nComps: number; score: number | null } | null;
  nearest?: { n: number; medianYearGap: number; medianMileageGapPct: number } | null;
  marketListings?: number | null;        // MarketCheck count, when that path priced it
  pmModelExamples?: number | null;       // pm-1 n_model (null = model not in the trained model)
  rangeWidthPct?: number | null;         // (high-low)/price of the shown private range
  disagreement?: number | null;          // ensemble max |log ratio| between sources
  sourcesAgreeWithinPct?: number | null; // spread between pm / own comps / AI figures, as % of price
  sanity: "ok" | "lessCertain" | "unavailable" | "unknown";
  sanityReasons?: string[];
  importStatus?: string | null; perf?: boolean; rareVariant?: string | null; ccImplausible?: boolean;
  mot?: { tests: number; cleanHistory: boolean; mileageAnomaly: boolean; advisoriesLatest: number; noValidMot: boolean } | null;
  mileageCheck?: string | null;
  photos?: { count: number; trusted: boolean } | null;
}

export interface AiConfidence { level: ConfidenceLevel; reason: string }

const idx = (l: string) => CONF_LEVELS.indexOf(l as ConfidenceLevel);

export function confidencePrompt(e: ConfEvidence): string {
  return `You are a senior UK used-car valuer. A valuation has ALREADY been priced; you are NOT changing the price.
Decide how confident a careful valuer would be that the shown private-sale figure is right for THIS car, from the evidence below and your own knowledge of the UK used-car market (how common the model is, how predictable its prices are, how much trims/condition swing it).

Levels:
- High: lots of close, consistent evidence for this exact model; a popular, predictable car; sources agree.
- Medium: decent evidence, or a common predictable car where the evidence is thinner or a bit spread.
- Low: thin or loosely matched evidence, sources noticeably apart, or a car whose value swings a lot on condition/spec.
- Very Low: little relevant evidence, sources disagree badly, or something odd about the car (import, odd engine, very old, clocking).

Our rule-based "data level" is ${e.dataLevel} (reason shown today: "${e.dataReason.replace(/"/g, "'").slice(0, 240)}").
It is deliberately cautious and can never say High. Agree with it unless the evidence clearly supports one level up or down.

Evidence (JSON):
${JSON.stringify(e)}

Reply by calling rate_confidence with:
- level: one of "High", "Medium", "Low", "Very Low"
- reason: ONE plain-English sentence for the car's owner (max 25 words) saying why. No £ amounts, no jargon (no "ensemble", "comps", "model n"), don't mention AI or the data level.`;
}

export const CONFIDENCE_TOOL = {
  type: "function",
  function: {
    name: "rate_confidence",
    description: "How confident we are in this valuation.",
    parameters: {
      type: "object",
      properties: {
        level: { type: "string", enum: CONF_LEVELS },
        reason: { type: "string", description: "One plain customer-facing sentence, max 25 words, no £ amounts." },
      },
      required: ["level", "reason"],
    },
  },
};

/** Clean one customer-facing sentence; null when unusable. */
export function cleanReason(r: unknown): string | null {
  if (typeof r !== "string") return null;
  let s = r.replace(/\s+/g, " ").trim();
  if (!s || /£|\$|€|\bAI\b|data level|ensemble|\bcomps?\b|n_model|pm-1|json/i.test(s)) return null;
  if (s.length > 220) return null;
  if (!/[.!]$/.test(s)) s += ".";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Parse the AI reply (tool call arguments, a JSON string, or an object). Null when invalid. */
export function parseAiConfidence(raw: unknown): AiConfidence | null {
  try {
    let o: any = raw;
    if (typeof o === "string") {
      const m = o.match(/\{[\s\S]*\}/);
      if (!m) return null;
      o = JSON.parse(m[0]);
    }
    if (!o || typeof o !== "object") return null;
    const level = CONF_LEVELS.find((l) => l.toLowerCase() === String(o.level ?? "").trim().toLowerCase());
    const reason = cleanReason(o.reason);
    if (!level || !reason) return null;
    return { level, reason };
  } catch { return null; }
}

export interface GuardIn {
  dataLevel: ConfidenceLevel; dataReason: string; ai: AiConfidence | null;
  sanity: ConfEvidence["sanity"]; nComps: number; isImport: boolean; ageYears: number;
}
export interface GuardOut { level: ConfidenceLevel; reason: string; source: "data" | "ai"; capped: string[] }

/** The guardrails. Pure; the only thing that decides what level is shown. */
export function guardConfidence(g: GuardIn): GuardOut {
  const d = idx(g.dataLevel);
  if (d < 0 || !g.ai) return { level: g.dataLevel, reason: g.dataReason, source: "data", capped: g.ai ? [] : ["no_ai"] };
  const capped: string[] = [];
  let a = idx(g.ai.level);
  if (a > d + 1) { a = d + 1; capped.push("one_step"); }
  if (a < d - 1) { a = d - 1; capped.push("one_step"); }
  const noHigh: string[] = [];
  if (g.sanity === "lessCertain" || g.sanity === "unavailable") noHigh.push("sanity");
  if (!(g.nComps >= 10)) noHigh.push("few_comps");
  if (g.isImport) noHigh.push("import");
  if (g.ageYears > 20) noHigh.push("age");
  if (a === 3 && noHigh.length) { a = 2; capped.push(...noHigh.map((x) => "no_high_" + x)); }
  const level = CONF_LEVELS[a];
  // Reason must match the level shown: the AI's sentence only when the AI's own level is what we show.
  if (level === g.dataLevel) return { level, reason: g.dataReason, source: "data", capped };
  if (level === g.ai.level) return { level, reason: g.ai.reason, source: "ai", capped };
  return { level, reason: genericReason(level), source: "ai", capped };
}

export function genericReason(l: ConfidenceLevel): string {
  return l === "High" ? "Plenty of closely matching cars back this figure up, so it should be a reliable guide."
    : l === "Medium" ? "There's a fair amount of evidence behind this figure, so treat it as a solid guide."
    : l === "Low" ? "There's only limited evidence for cars like this, so treat this figure as a useful guide rather than an exact price."
    : "There's very little reliable evidence for this car, so treat this figure as a rough guide only.";
}

/** The ONLY report keys this feature may set. Prices, ranges and valuationUnavailable are never returned. */
export interface ConfFields {
  marketConfidence: ConfidenceLevel; marketConfidenceReason: string;
  confidenceData: { level: ConfidenceLevel; reason: string };
  confidenceAi?: { version: string; mode: ConfMode; level: ConfidenceLevel | null; reason: string | null; guarded: ConfidenceLevel; capped: string[]; ms?: number } | null;
}
export function confidenceFields(mode: ConfMode, dataLevel: ConfidenceLevel, dataReason: string, g: GuardOut | null, ai: AiConfidence | null, ms?: number): ConfFields {
  const show = mode === "on" && g ? g : { level: dataLevel, reason: dataReason };
  return {
    marketConfidence: show.level, marketConfidenceReason: show.reason,
    confidenceData: { level: dataLevel, reason: dataReason },
    confidenceAi: mode === "off" ? null : { version: CONF_AI_VERSION, mode, level: ai?.level ?? null, reason: ai?.reason ?? null,
      guarded: g?.level ?? dataLevel, capped: g?.capped ?? ["no_ai"], ...(ms != null ? { ms } : {}) },
  };
}

/** Merge onto a report: copies only the confidence keys, so everything else is identical with the feature on or off. */
export function withConfidence<T extends Record<string, unknown>>(report: T, f: ConfFields): T {
  return { ...report, marketConfidence: f.marketConfidence, marketConfidenceReason: f.marketConfidenceReason,
    confidenceData: f.confidenceData, ...(f.confidenceAi ? { confidenceAi: f.confidenceAi } : {}) };
}

const med = (xs: number[]) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
export function nearestSummary(nearest: { year: number; mileage: number }[] | null | undefined, year: number, mileage: number) {
  const n = (nearest ?? []).filter((c) => c && Number(c.year) > 0);
  if (!n.length) return null;
  return { n: n.length, medianYearGap: med(n.map((c) => Math.abs(c.year - year))),
    medianMileageGapPct: Math.round(med(n.map((c) => Math.abs(c.mileage - mileage) / Math.max(5000, mileage))) * 100) };
}

/** Call the AI with a hard timeout. Never throws; null on any failure. */
export async function askAiConfidence(e: ConfEvidence, opts: { url: string; key: string; model: string; timeoutMs?: number; fetchImpl?: typeof fetch }): Promise<AiConfidence | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 6000);
  try {
    const r = await (opts.fetchImpl ?? fetch)(opts.url, {
      method: "POST", signal: ctl.signal,
      headers: { Authorization: `Bearer ${opts.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: opts.model, temperature: 0, messages: [{ role: "user", content: confidencePrompt(e) }],
        tools: [CONFIDENCE_TOOL], tool_choice: { type: "function", function: { name: "rate_confidence" } } }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const msg = j?.choices?.[0]?.message;
    return parseAiConfidence(msg?.tool_calls?.[0]?.function?.arguments ?? msg?.content ?? null);
  } catch { return null; } finally { clearTimeout(t); }
}
