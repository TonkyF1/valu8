import { assert, assertEquals } from "jsr:@std/assert@1";
import { confidenceMode, guardConfidence, parseAiConfidence, confidenceFields, withConfidence, askAiConfidence, nearestSummary, confidencePrompt, type ConfEvidence } from "./aiConfidence.ts";

const base = { dataReason: "Rule reason.", sanity: "ok" as const, nComps: 200, isImport: false, ageYears: 3 };
const ai = (level: any, reason = "Lots of similar cars are for sale and they agree closely.") => ({ level, reason });

Deno.test("mode flag: default on, off/shadow switch", () => {
  assertEquals(confidenceMode(undefined), "on"); assertEquals(confidenceMode("off"), "off"); assertEquals(confidenceMode("0"), "off");
  assertEquals(confidenceMode("SHADOW"), "shadow"); assertEquals(confidenceMode("on"), "on");
});

Deno.test("moves at most one step either way", () => {
  assertEquals(guardConfidence({ ...base, dataLevel: "Very Low", ai: ai("High") }).level, "Low");
  assertEquals(guardConfidence({ ...base, dataLevel: "Low", ai: ai("High") }).level, "Medium");
  assertEquals(guardConfidence({ ...base, dataLevel: "High" as any, ai: ai("Very Low") }).level, "Medium");
  assertEquals(guardConfidence({ ...base, dataLevel: "Medium", ai: ai("High") }).level, "High");
});

Deno.test("never High on lessCertain/unavailable sanity, <10 comps, import, 20+ years", () => {
  for (const x of [{ sanity: "lessCertain" as const }, { sanity: "unavailable" as const }, { nComps: 9 }, { isImport: true }, { ageYears: 21 }]) {
    const g = guardConfidence({ ...base, ...x, dataLevel: "Medium", ai: ai("High") });
    assertEquals(g.level, "Medium"); assertEquals(g.reason, "Rule reason."); assert(g.capped.some((c) => c.startsWith("no_high_")));
  }
});

Deno.test("failed/invalid AI keeps the data level and reason", () => {
  assertEquals(guardConfidence({ ...base, dataLevel: "Low", ai: null }), { level: "Low", reason: "Rule reason.", source: "data", capped: ["no_ai"] });
  assertEquals(parseAiConfidence("nonsense"), null);
  assertEquals(parseAiConfidence({ level: "Super", reason: "x." }), null);
  assertEquals(parseAiConfidence({ level: "High", reason: "Worth £20,000 for sure." }), null); // no £ in reasons
  assertEquals(parseAiConfidence('{"level":"medium","reason":"plenty of similar cars"}'), { level: "Medium", reason: "Plenty of similar cars." });
});

Deno.test("reason always matches the level shown", () => {
  const up = guardConfidence({ ...base, dataLevel: "Low", ai: ai("Medium", "Popular car with lots of close matches.") });
  assertEquals(up, { level: "Medium", reason: "Popular car with lots of close matches.", source: "ai", capped: [] });
  const same = guardConfidence({ ...base, dataLevel: "Low", ai: ai("Low", "Thin evidence.") });
  assertEquals(same.reason, "Rule reason.");
  const clipped = guardConfidence({ ...base, dataLevel: "Very Low", ai: ai("High", "Huge evidence.") });
  assertEquals(clipped.level, "Low"); assert(clipped.reason !== "Huge evidence." && /guide/.test(clipped.reason));
});

const report = {
  values: { dealerTradeIn: 9000, privateSale: 10500, dealerRetail: 12000 },
  valueRange: { privateSaleLow: 9800, privateSaleHigh: 11200 }, priceRange: { low: 9500, high: 11500 },
  askRange: { low: 10800, high: 11300 }, recommendedAskingPrice: 10800, negotiationBuffer: 400, valuationUnavailable: false,
  marketConfidence: "Low", marketConfidenceReason: "Rule reason.", headline: "Worth about £10,500.",
};
const PRICE_KEYS = ["values", "valueRange", "priceRange", "askRange", "recommendedAskingPrice", "negotiationBuffer", "valuationUnavailable", "headline"];

Deno.test("prices, ranges and valuationUnavailable are identical with the feature off, shadow or on", () => {
  const g = guardConfidence({ ...base, dataLevel: "Low", ai: ai("Medium") });
  const off = withConfidence(report, confidenceFields("off", "Low", "Rule reason.", null, null));
  const sh = withConfidence(report, confidenceFields("shadow", "Low", "Rule reason.", g, ai("Medium")));
  const on = withConfidence(report, confidenceFields("on", "Low", "Rule reason.", g, ai("Medium")));
  for (const k of PRICE_KEYS) { assertEquals((off as any)[k], (report as any)[k]); assertEquals((on as any)[k], (off as any)[k]); assertEquals((sh as any)[k], (off as any)[k]); }
  const changed = Object.keys(on).filter((k) => JSON.stringify((on as any)[k]) !== JSON.stringify((report as any)[k]));
  assertEquals(changed.sort(), ["confidenceAi", "confidenceData", "marketConfidence", "marketConfidenceReason"]);
  assertEquals(off.marketConfidence, "Low"); assertEquals(sh.marketConfidence, "Low"); assertEquals(on.marketConfidence, "Medium");
  assertEquals((sh as any).confidenceAi.guarded, "Medium"); assert(!("confidenceAi" in off));
  assertEquals(Object.keys(confidenceFields("on", "Low", "r", g, null)).sort(), ["confidenceAi", "confidenceData", "marketConfidence", "marketConfidenceReason"]);
});

const ev: ConfEvidence = { make: "Skoda", model: "Octavia", year: 2021, ageYears: 5, mileage: 40000, pricingSource: "valu8_comps", dataLevel: "Medium", dataReason: "r", sanity: "ok" };
Deno.test("askAiConfidence: parses tool call, null on HTTP error / timeout / junk", async () => {
  const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
  const r = await askAiConfidence(ev, { url: "x", key: "k", model: "m", fetchImpl: ok({ choices: [{ message: { tool_calls: [{ function: { arguments: '{"level":"High","reason":"Very common car with lots of close matches."}' } }] } }] }) });
  assertEquals(r, { level: "High", reason: "Very common car with lots of close matches." });
  assertEquals(await askAiConfidence(ev, { url: "x", key: "k", model: "m", fetchImpl: (async () => new Response("no", { status: 500 })) as any }), null);
  assertEquals(await askAiConfidence(ev, { url: "x", key: "k", model: "m", fetchImpl: ok({ choices: [{ message: { content: "dunno" } }] }) }), null);
  const slow = ((_u: string, i: RequestInit) => new Promise((_, rej) => i.signal?.addEventListener("abort", () => rej(new Error("aborted"))))) as any;
  assertEquals(await askAiConfidence(ev, { url: "x", key: "k", model: "m", timeoutMs: 20, fetchImpl: slow }), null);
});

Deno.test("nearestSummary and prompt", () => {
  assertEquals(nearestSummary([{ year: 2020, mileage: 30000 }, { year: 2021, mileage: 40000 }, { year: 2022, mileage: 60000 }], 2021, 40000),
    { n: 3, medianYearGap: 1, medianMileageGapPct: 25 });
  assertEquals(nearestSummary([], 2021, 1), null);
  assert(confidencePrompt(ev).includes('"model":"Octavia"'));
});
