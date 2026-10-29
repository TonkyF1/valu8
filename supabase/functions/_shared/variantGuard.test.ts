import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { variantToken, resolveVariant, reconcileProsePrices, sanityVerdict, perfCompReference, aiTextVariant } from "./variantGuard.ts";
import { detectPerformanceVariant } from "./performance.ts";

Deno.test("RS6 from A6 4.0 petrol + seller/AI text", () => {
  const amb = resolveVariant({ make: "AUDI", model: "A6", fuel: "Petrol", cc: 3993, year: 2015, text: "Carbon Pack Night Vision" });
  assert(amb.ambiguousPerf && !amb.variant);
  const r = resolveVariant({ make: "AUDI", model: "A6", fuel: "Petrol", cc: 3993, year: 2015, text: "lovely Audi rs 6 avant" });
  assertEquals(r.variant, "RS6"); assertEquals(r.displayModel, "RS6");
  const p = detectPerformanceVariant("AUDI", "A6", r.variant, "");
  assert(p && p.key === "audi-rs");
  assert(aiTextVariant("AUDI", "A6", ["Priced to an enthusiast seeking a well-serviced RS6."]));
  assertEquals(resolveVariant({ make: "AUDI", model: "A6", fuel: "Diesel", cc: 2967, year: 2015 }).hint, null);
});
Deno.test("confident + other makes", () => {
  assertEquals(resolveVariant({ make: "BMW", model: "3 Series", fuel: "Petrol", cc: 3999, year: 2010 }).variant, "M3");
  assertEquals(resolveVariant({ make: "MERCEDES-BENZ", model: "C Class", fuel: "Petrol", cc: 6208, year: 2012 }).variant, "C63 AMG");
  assertEquals(resolveVariant({ make: "AUDI", model: "A3", fuel: "Petrol", cc: 2480, year: 2017 }).variant, "RS3");
  assertEquals(resolveVariant({ make: "FORD", model: "Focus", fuel: "Petrol", cc: 2261, year: 2017 }).variant, "RS");
  assertEquals(resolveVariant({ make: "AUDI", model: "A6", variant: "S line", fuel: "Petrol", cc: 3993, year: 2015 }).source, "provider");
});
Deno.test("prose prices reconciled", () => {
  const shown = { privateSale: 5450, tradeIn: 4900, retail: 7700, askLow: 5800, askHigh: 6150, rangeLow: 5100, rangeHigh: 5800 };
  const t = reconcileProsePrices("List at £8,795, highlight the low mileage, and leave yourself room to settle around £8,450.", shown);
  assertEquals(t, "List at £6,150, highlight the low mileage, and leave yourself room to settle around £5,450.");
  assertEquals(reconcileProsePrices("Budget £300 for tyres. Worth £5,500.", shown), "Budget £300 for tyres. Worth £5,500.");
  assertEquals(reconcileProsePrices("Ask £9,000–£9,500 then settle.", shown), "Ask £5,800–£6,150 then settle.");
  assertEquals(reconcileProsePrices("Great car. List at £25,995 to leave room.", null), "Great car.");
});
Deno.test("sanity verdict", () => {
  assertEquals(sanityVerdict({ shown: 6100, aiPrivate: 24000, disagreement: 0.74 }).verdict, "unavailable");
  assertEquals(sanityVerdict({ shown: 6100, disagreement: 0.74 }).verdict, "lessCertain");
  assertEquals(sanityVerdict({ shown: 5450, aiPrivate: 7900, disagreement: 0.08 }).verdict, "ok");
});
Deno.test("perf comp reference", () => {
  const perf = detectPerformanceVariant("audi", "a6", "RS6", "")!;
  const rows = [{ model: "Rs6", variant: "C7 Avant", year: 2015, mileage: 100000, price: 25000, seller: "private" }, { model: "A6", variant: "S line", year: 2015, mileage: 100000, price: 9000 }];
  const r = perfCompReference(perf, [...rows, { model: "Rs3", variant: "", year: 2016, mileage: 50000, price: 22000 }], { year: 2015, mileage: 128300, token: "rs6" });
  assertEquals(r.n, 1); assert(r.private > 20000 && r.private < 25000);
});
Deno.test("variant token", () => {
  const perf = detectPerformanceVariant("audi", "a6", "RS6", "")!;
  assertEquals(variantToken(perf, "A6", "RS6"), "rs6");
});
