import { assert, assertEquals } from "jsr:@std/assert@1";
import { similarAdverts, anchorBlock, anchorPrice, anchorDeviation, anchorArm, DEVIATION_REASON_PROPERTY } from "./aiAnchor.ts";
Deno.test("similar adverts: same model, nearest year/miles, max 5", () => {
  const s = similarAdverts({ make: "Ford", model: "Fiesta", variant: "Zetec", year: 2017, mileage: 40000, fuel: "Petrol", gearbox: "Manual" });
  assert(s.length > 0 && s.length <= 5); assert(s.every((x) => /fiesta/i.test(x.title))); assert(s.every((x) => Math.abs(x.year - 2017) <= 3), JSON.stringify(s));
  assertEquals(similarAdverts({ make: "Zzz", model: "Nope", year: 2017, mileage: 1 }).length, 0);
});
Deno.test("anchor block + price", () => {
  const a = { pm: { private: 5350, dealer: 7150, low: 3750, high: 7450, known: "model" }, ownComps: { privatePrice: 4600, nComps: 152, level: "model" }, similar: similarAdverts({ make: "Ford", model: "Fiesta", year: 2017, mileage: 40000 }), motAdjPct: 2 };
  const p = anchorPrice(a); assert(p < 5350 && p > 4600, String(p));
  const t = anchorBlock(a); assert(t.includes("£5,350") && t.includes("152 adverts") && t.includes("+2%") && t.includes("deviationReason"));
  assert(t.length < 1600, String(t.length));
  assertEquals(anchorPrice({ ...a, ownComps: null }), 5350);
});
Deno.test("deviation + arms", () => {
  assert(anchorDeviation(6500, 5000).large); assert(!anchorDeviation(5600, 5000).large); assertEquals(anchorDeviation(4000, 5000).pct, -20);
  assertEquals(anchorArm("on", "x"), "anchor"); assertEquals(anchorArm(undefined, "x"), "control"); assertEquals(anchorArm("off", "x"), "control");
  const arms = Array.from({ length: 400 }, (_, i) => anchorArm("split", `car${i}`)); const n = arms.filter((x) => x === "anchor").length;
  assert(n > 160 && n < 240, String(n)); assertEquals(anchorArm("split", "car7"), anchorArm("split", "car7"));
  assert(DEVIATION_REASON_PROPERTY.deviationReason.type === "string");
});
