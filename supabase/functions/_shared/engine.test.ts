import { assert, assertEquals } from "jsr:@std/assert@1";
import { engineValue, engineLedger } from "./engine.ts";
import { retailCapMultiplier } from "./coherentPricing.ts";

const ctx = (o: Record<string, unknown> = {}) => ({ year: 2016, currentYear: 2026, pmNModel: 200, ocConfidence: 0.7, ocLevel: "model", perf: false, pmDealer: 7000, ocDealer: 7200, ...o });

Deno.test("engine: confident blend, retail >= private and within bounds", () => {
  const e = engineValue({ pm: { private: 6000, low: 5000, high: 7000 }, ownComps: { privatePrice: 6200 }, ctx: ctx() })!;
  assert(e.confident);
  assert(e.private > 5900 && e.private < 6300);
  assert(e.retail >= e.private * 1.08 - 50 && e.retail <= e.private * retailCapMultiplier(e.private) + 50);
  assert(e.low <= e.private && e.high >= e.private);
});

Deno.test("engine: retail never below private even when the dealer legs are low (old retail<private bug)", () => {
  const e = engineValue({ pm: { private: 9000, low: 8000, high: 10000 }, ownComps: { privatePrice: 9000 }, ctx: ctx({ pmDealer: 6000, ocDealer: 6000 }) })!;
  assert(e.retail >= e.private * 1.08 - 50);
});

Deno.test("engine: not confident without same-model comps or for classics", () => {
  assertEquals(engineValue({ pm: { private: 3000, low: 2500, high: 3500 }, ownComps: { privatePrice: 3000 }, ctx: ctx({ ocLevel: "make_segment" }) })!.confident, false);
  assertEquals(engineValue({ pm: { private: 3000, low: 2500, high: 3500 }, ownComps: { privatePrice: 3000 }, ctx: ctx({ year: 1995 }) })!.confident, false);
  assertEquals(engineValue({ pm: { private: 3000, low: 2500, high: 3500 }, ownComps: { privatePrice: 3000, unavailable: true }, ctx: ctx() })!.confident, false);
  assertEquals(engineValue({ pm: null, ownComps: null, ctx: ctx() }), null);
});

Deno.test("engine ledger: MOT parts shown but not re-applied; declared items applied", () => {
  const l = engineLedger({ motParts: [{ key: "clean_history", pct: 2 }], motPct: 2, declared: [{ label: "Insurance write-off (Cat S)", impactPct: -25 }], clocking: false });
  assertEquals(l.factor, 0.75);
  assertEquals(l.items.length, 2);
  assertEquals(engineLedger({ motParts: [], motPct: 0, declared: [], clocking: true }).factor, 0.85);
});
