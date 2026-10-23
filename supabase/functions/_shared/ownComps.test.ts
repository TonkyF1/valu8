import { assert, assertEquals } from "jsr:@std/assert@1";
import { valueWithOwnComps, writeOffAdj, conditionAdj, rarity, photoAdj, marketTrend } from "./ownCompsAdjust.ts";
import { segmentOf } from "./ownComps.ts";
Deno.test("prices a common car from own comps", () => {
  const v = valueWithOwnComps({ make: "Ford", model: "Fiesta", variant: "Zetec", year: 2016, mileage: 70000 });
  assert(v.finalPrivate > 2000 && v.finalPrivate < 9000, String(v.finalPrivate));
  assertEquals(v.level, "model");
  assert(v.finalLow <= v.finalPrivate && v.finalHigh >= v.finalPrivate);
});
Deno.test("performance variant uses perf comps and segment", () => {
  const st = valueWithOwnComps({ make: "Ford", model: "Fiesta", variant: "ST-2", year: 2016, mileage: 50000 });
  const z = valueWithOwnComps({ make: "Ford", model: "Fiesta", variant: "Zetec", year: 2016, mileage: 50000 });
  assertEquals(st.segment, "perf"); assert(st.finalPrivate > z.finalPrivate);
  assertEquals(segmentOf("Ford", "Fiesta", null), "mainstream");
});
Deno.test("older/higher mileage is cheaper", () => {
  const a = valueWithOwnComps({ make: "Volkswagen", model: "Golf", variant: "SE", year: 2018, mileage: 40000 });
  const b = valueWithOwnComps({ make: "Volkswagen", model: "Golf", variant: "SE", year: 2012, mileage: 120000 });
  assert(a.finalPrivate > b.finalPrivate);
});
Deno.test("unknown model falls back hierarchically", () => {
  const v = valueWithOwnComps({ make: "Zzz", model: "Nothing", year: 2015, mileage: 80000 });
  assertEquals(v.level, "global"); assertEquals(v.confidence, "Very Low"); assert(v.finalPrivate > 0);
});
Deno.test("write-off: Cat S/N -25..-40%, Cat A/B/stolen blocks", () => {
  const s = writeOffAdj("Cat S", -0.2); assert(s.pct <= -25 && s.pct >= -40);
  assert(writeOffAdj("category B", -0.2).blocksValuation); assert(writeOffAdj("reported stolen", -0.2).blocksValuation);
  assertEquals(writeOffAdj("", -0.2).pct, 0);
  assertEquals(valueWithOwnComps({ make: "Ford", model: "Focus", year: 2015, mileage: 60000, declaredStatus: "Cat B" }).finalPrivate, 0);
});
Deno.test("condition, photo stub, rarity, trend", () => {
  assertEquals(conditionAdj(7).pct, 0); assert(conditionAdj(3).pct < 0); assertEquals(conditionAdj(null).pct, 0);
  assertEquals(photoAdj([]).pct, 0); assert(photoAdj([{ severity: "notable" }]).pct < 0);
  assert(rarity(1, "perf").rangeWiden > 1); assertEquals(rarity(10, "mainstream").pct, 0);
  assertEquals(marketTrend([], "perf", "2026-10").pct, 0);
});
Deno.test("sold-price feedback comps pull the price (weighted)", () => {
  const q = { make: "Kia", model: "Picanto", variant: "1", year: 2015, mileage: 60000 };
  const base = valueWithOwnComps(q);
  const sold = Array.from({ length: 3 }, () => ({ ...q, seller: "private", price: Math.round(base.privatePrice * 1.6), weight: 3 }));
  assert(valueWithOwnComps(q, sold).finalPrivate > base.finalPrivate);
});
