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
Deno.test("vans get their own segment; perf queries never pool with other perf families", () => {
  assertEquals(segmentOf("Ford", "Transit Custom", null), "van");
  assertEquals(segmentOf("Citroen", "Berlingo Multispace", null), "mainstream");
  const o = valueWithOwnComps({ make: "Skoda", model: "Octavia", variant: "vRS 2.0 TSI Estate", year: 2023, mileage: 14100 });
  assertEquals(o.segment, "perf"); assert(o.level === "model" || o.level === "family", o.level);
  assert(o.finalPrivate > 15000 && o.finalPrivate < 32000, String(o.finalPrivate));
});
Deno.test("unseen model strings resolve to a known model", () => {
  const v = valueWithOwnComps({ make: "Skoda", model: "Octavia Estate", year: 2018, mileage: 60000 });
  assertEquals(v.level, "model");
});
Deno.test("depreciation curve is monotone in age for nearly-new cars", () => {
  let prev = Infinity;
  for (const y of [2026, 2025, 2024, 2023, 2021, 2018, 2014]) {
    const p = valueWithOwnComps({ make: "Zzz", model: "Nothing", year: y, mileage: (2026 - y) * 8000 + 1000 }).privatePrice;
    assert(p <= prev, `${y}: ${p} > ${prev}`); prev = p;
  }
});
Deno.test("embedded data decodes to the original tuple shape", async () => {
  const { OWN_COMPS_ROWS } = await import("./ownCompsData.ts");
  assert(OWN_COMPS_ROWS.length > 20000);
  const r = OWN_COMPS_ROWS[0];
  assertEquals(r.length, 10); assert(typeof r[0] === "string" && typeof r[1] === "string" && typeof r[2] === "string" && r[8] > 0);
});
Deno.test("dealer add-on ramps in for cheap cars", async () => {
  const { dealerFromPrivate, DEALER_NORM } = await import("./ownComps.ts");
  assertEquals(Math.round(dealerFromPrivate(700, DEALER_NORM)), 770);
  assertEquals(Math.round(dealerFromPrivate(1900, DEALER_NORM)), 2840); // 1900*1.1 + 1500*0.5
  assertEquals(Math.round(dealerFromPrivate(8000, DEALER_NORM)), 10300);
});
