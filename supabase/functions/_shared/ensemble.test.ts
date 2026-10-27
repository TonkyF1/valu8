import { assert, assertEquals } from "jsr:@std/assert@1";
import { ensemble } from "./ensemble.ts";
const pm = { private: 5000, low: 3500, high: 6600 };
Deno.test("pm + oc uses fixed 0.7/0.3 geometric blend", () => {
  const e = ensemble({ pm, ownComps: { privatePrice: 4000 } })!;
  assertEquals(e.private, Math.round(Math.exp(0.7 * Math.log(5000) + 0.3 * Math.log(4000)) / 50) * 50); assertEquals(e.weights, { pm: 0.7, oc: 0.3, ai: 0 });
  assert(e.low < e.private && e.private < e.high); assert(!e.lessCertain); assertEquals(e.widen, 1);
});
Deno.test("AI weight: 0.8 under £5k, 0.5 above", () => {
  const cheap = ensemble({ pm: { private: 1500, low: 900, high: 2300 }, ownComps: { privatePrice: 1500 }, ai: 1000 })!;
  assertEquals(cheap.weights.ai, 0.8); assert(cheap.private < 1150 && cheap.private > 1000, String(cheap.private));
  const dear = ensemble({ pm: { private: 12000, low: 10000, high: 14000 }, ownComps: { privatePrice: 12000 }, ai: 13000 })!;
  assertEquals(dear.weights.ai, 0.5); assertEquals(Math.round((dear.weights.pm + dear.weights.oc + dear.weights.ai) * 100), 100);
});
Deno.test("big disagreement widens the range and flags less certain", () => {
  const calm = ensemble({ pm, ownComps: { privatePrice: 4800 }, ai: 5200 })!;
  const wild = ensemble({ pm, ownComps: { privatePrice: 4800 }, ai: 9500 })!;
  assert(wild.lessCertain && !calm.lessCertain); assertEquals(wild.widen, 1.85);
  assert((wild.high - wild.low) / wild.private > (calm.high - calm.low) / calm.private);
});
Deno.test("missing sources degrade gracefully", () => {
  assertEquals(ensemble({ pm: null, ownComps: null, ai: null }), null);
  assertEquals(ensemble({ pm: null, ai: 3000 })!.private, 3000);
  assertEquals(ensemble({ pm, ownComps: { privatePrice: 4000, unavailable: true } })!.private, 5000);
});
Deno.test("ens-2: confidence-weighted pm/oc blend, perf uplift, retail figure", () => {
  const ctx = { year: 2018, currentYear: 2026, pmNModel: 300, ocConfidence: 0.7, ocLevel: "model", perf: false, pmDealer: 6200, ocDealer: 6000 };
  const e = ensemble({ pm, ownComps: { privatePrice: 4600 }, ctx })!;
  assertEquals(e.version, "ens-2"); assert(e.weights.pm > 0.5 && e.weights.pm < 0.75, String(e.weights.pm));
  assert(e.private > 4600 && e.private < 5000, String(e.private));
  assert(e.retail && e.retail.price > e.private && e.retail.low < e.retail.price && e.retail.price < e.retail.high);
  const thin = ensemble({ pm, ownComps: { privatePrice: 4600 }, ctx: { ...ctx, pmNModel: 3 } })!;
  assert(thin.weights.pm < e.weights.pm, "fewer pm training examples -> lean on own-comps");
  const perf = ensemble({ pm, ownComps: { privatePrice: 4600 }, ctx: { ...ctx, perf: true } })!;
  assert(perf.private > e.private * 1.05, "perf cars get the fitted ~8% uplift");
  assertEquals(ensemble({ pm, ownComps: { privatePrice: 4000 } })!.version, "ens-1"); // no ctx -> unchanged ens-1
});
