import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { canonicalVariantName, variantLikePatterns, tieredVariantReference, rareAiFigures, parseRareAi, rareEvidence } from "./rareVariant.ts";
import { detectPerformanceVariant } from "./performance.ts";
import { aiTextVariant, variantToken } from "./variantGuard.ts";

Deno.test("Type R is named against its base model, never 'TYPER'", () => {
  assertEquals(canonicalVariantName("Integra", "type r"), "Integra Type R");
  assertEquals(canonicalVariantName("Civic", "type r"), "Civic Type R");
  assertEquals(canonicalVariantName("Civic Type R", "type r"), "Civic Type R");
  assertEquals(canonicalVariantName("A6", "rs6"), "RS6");
  assertEquals(canonicalVariantName("A6", "rs 6"), "RS6");
  assertEquals(canonicalVariantName("3 Series", "m3"), "M3");
  assertEquals(canonicalVariantName("Golf", "r"), "Golf R");
});

Deno.test("SQL patterns tolerate 'Type-R' / 'Type R' / 'RS 6'", () => {
  assertEquals(variantLikePatterns("type r"), ["%type%r%"]);
  assertEquals(variantLikePatterns("rs6"), ["%rs%6%"]);
});

const civic = (year: number, mileage: number, price: number, variant = "Type R GT", model = "Civic") => ({ model, variant, year, mileage, price, seller: "private" });
const typeR = detectPerformanceVariant("Honda", "Civic", "Type R")!;

Deno.test("tiers: same-variant within 4y first, then nearby years, never standard Civics", () => {
  const rows = [civic(2007, 110000, 3500), civic(2008, 120000, 4000), civic(2009, 90000, 4500), civic(2007, 100000, 3800),
    civic(2006, 130000, 3000), civic(2008, 95000, 5000), civic(2009, 80000, 4200), civic(2010, 115000, 3900),
    civic(2008, 100000, 1500, "1.4 i-VTEC SE")];
  const r1 = tieredVariantReference(typeR, rows, { year: 2007, mileage: 110000, token: "type r", base: "Civic" })!;
  assertEquals(r1.tier, "same"); assertEquals(r1.n, 8);
  const r2 = tieredVariantReference(typeR, rows.slice(0, 5), { year: 2014, mileage: 80000, token: "type r", base: "Civic" })!;
  assertEquals(r2.tier, "nearby"); assert(r2.private > 3000);
  // Integra Type R must not borrow Civic Type R adverts as direct comparables.
  assertEquals(tieredVariantReference(typeR, rows, { year: 2001, mileage: 155000, token: "type r", base: "Integra" }), null);
});

Deno.test("AI figure never below the standard-model figure, range at least -20/+30", () => {
  const f = rareAiFigures({ low: 9000, mid: 10000, high: 11000, rationale: "" }, 950);
  assertEquals(f.private, 10000); assertEquals(f.low, 8000); assertEquals(f.high, 13000);
  assertEquals(rareAiFigures({ low: 800, mid: 900, high: 1000, rationale: "" }, 2000).private, 2000);
  assertEquals(parseRareAi('x {"low":12000,"mid":15000,"high":19000,"rationale":"Rare £5k car"} y')?.rationale, "Rare  car");
});

Deno.test("AI-identified Type R on an Integra yields a usable token", () => {
  const v = aiTextVariant("HONDA", "Integra", ["Type R"]);
  assert(v);
  assertEquals(variantToken(v!, "Integra", " Type R"), "type r");
  const ev = rareEvidence(v!, [civic(2002, 120000, 6850, "Type-R"), civic(2002, 90000, 1500, "1.6 SE")], { year: 2001, token: "type r", base: "Integra" });
  assertEquals(ev.length, 1);
});

import { sameGeneration, generationOf, rareNote } from "./rareVariant.ts";
Deno.test("generations: FK8 never pools with FN2/FK2, E9x M3 with F80, B7 RS4 with B8", () => {
  const rows = [civic(2008, 100000, 4000), civic(2010, 90000, 4500), civic(2015, 50000, 15000), civic(2018, 30000, 24000), civic(2021, 17000, 29000)];
  assertEquals(sameGeneration("Honda", "Civic", "type r", 2018, rows).rows.map((r) => r.year), [2018, 2021]);
  assertEquals(sameGeneration("Honda", "Civic", "type r", 2007, rows).rows.map((r) => r.year), [2008, 2010]);
  assertEquals(sameGeneration("Honda", "Civic", "type r", 2017, rows).gen, "FK2/FK8");
  assertEquals(generationOf("BMW", "3 Series", "m3", 2009), ["E9x"]);
  assertEquals(generationOf("BMW", "3 Series", "m3", 2015), ["F80"]);
  assertEquals(generationOf("Audi", "A4", "rs4", 2007), ["B7"]);
  assertEquals(generationOf("Volkswagen", "Golf", "gti", 2016), ["Mk7"]);
  assertEquals(generationOf("Ford", "Focus", "rs", 2017), ["Mk3"]);
  assertEquals(generationOf("Ford", "Focus", "st 3", 2008), ["Mk2"]);
  assertEquals(sameGeneration("Honda", "Integra", "type r", 2001, rows).gen, null);
  assertEquals(rareNote("ai", "Honda Civic Type R (FK8)", 0).reasoning.startsWith("Honda Civic Type Rs (FK8) rarely"), true);
});
