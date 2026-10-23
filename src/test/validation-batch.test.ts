import { describe, it, expect } from "vitest";
import {
  dedupeReportText, filterCompsBySpec, finalisePricing, inferScope, marketConfidenceTier, reconcileMileage,
  residualHighMileagePenalty, retailNetFromAdjustments, highMileagePenalty,
} from "../../supabase/functions/_shared/pricing";
import { fixableUpside, validatePhotoInsights } from "../../supabase/functions/_shared/photo-insights";
import { motConsistentBullets } from "../../supabase/functions/_shared/mot";
import { displayModel, vehicleTitle } from "../../supabase/functions/_shared/vehicle-text";
import { isFoundVehicle, isPlausibleUkReg } from "@/lib/registration";

describe("1. clocking tolerance", () => {
  it("A4: 169,000 declared vs 171,007 MOT is a note, priced on the MOT reading", () => {
    const c = reconcileMileage(169000, 171007);
    expect(c.status).toBe("note");
    expect(c.miles).toBe(171007);
  });
  it("round advert figures a little under the MOT are rounding", () => {
    expect(reconcileMileage(100000, 104600).status).toBe("note");
  });
  it("a large, non-round gap is still flagged", () => {
    const c = reconcileMileage(120345, 171007);
    expect(c.status).toBe("clocking");
  });
  it("declared above MOT is fine", () => {
    expect(reconcileMileage(42500, 40026)).toMatchObject({ status: "ok", miles: 42500 });
  });
});

describe("2/5. pricing ledger — one source of truth, no stacking", () => {
  const l = finalisePricing({
    anchor: 6750, miles: 171007, compMedianMiles: 156000,
    items: [
      { label: "Higher mileage / older than comparables", impactPct: -3, scope: "anchor" },
      { label: "Condition deductions", impactPct: -3, scope: "retail" },
      { label: "MOT expires in 3 weeks", impactPct: -2, scope: "private" },
    ],
  });
  it("net % equals the sum of the listed retail adjustments", () => {
    expect(l.retailNetPct).toBe(l.items.filter((i) => i.scope === "retail").reduce((s, i) => s + i.impactPct, 0));
    expect(retailNetFromAdjustments(l.items)).toBe(l.retailNetPct);
  });
  it("retail = the anchor after adjustments", () => {
    expect(l.dealerRetail).toBe(Math.round((l.baseRetail * (1 + l.retailNetPct / 100)) / 50) * 50);
  });
  it("anchor-scope comp correction is not applied twice", () => {
    expect(l.dealerRetail).toBe(Math.round((6750 * 0.97) / 50) * 50);
  });
  it("high mileage is only charged beyond what the comps already carry", () => {
    expect(residualHighMileagePenalty(158581, 157000)).toBeLessThan(0.02);
    expect(residualHighMileagePenalty(180000, null)).toBe(highMileagePenalty(180000));
    expect(residualHighMileagePenalty(150000, 170000)).toBe(0);
  });
  it("caps are visible as a line item so the sum still matches", () => {
    const capped = finalisePricing({ anchor: 5000, miles: 50000, items: [{ label: "x", impactPct: -30, scope: "retail" }, { label: "y", impactPct: -30, scope: "retail" }] });
    expect(capped.retailNetPct).toBe(-45);
    expect(retailNetFromAdjustments(capped.items)).toBe(-45);
  });
  it("infers scope on old reports", () => {
    expect(inferScope("Higher mileage / older than comparables")).toBe("anchor");
    expect(inferScope("Very high mileage (narrow private buyer pool)")).toBe("private");
    expect(inferScope("Multiple corrosion advisories (3)")).toBe("retail");
  });
});

describe("4. confidence thresholds", () => {
  it("267 comps is not Low", () => {
    expect(marketConfidenceTier({ sampleSize: 267 })).toBe("High");
    expect(marketConfidenceTier({ sampleSize: 267, outlierMileage: true })).toBe("Medium");
  });
  it("thin samples stay low", () => {
    expect(marketConfidenceTier({ sampleSize: 22 })).toBe("Low");
    expect(marketConfidenceTier({ sampleSize: 5 })).toBe("Very Low");
    expect(marketConfidenceTier({ sampleSize: 40 })).toBe("Medium");
  });
});

describe("6. comp filtering by fuel and transmission", () => {
  const comps = [
    ...Array.from({ length: 6 }, () => ({ fuelType: "Petrol", transmission: "Manual" })),
    ...Array.from({ length: 4 }, () => ({ fuelType: "Diesel", transmission: "Automatic" })),
  ];
  it("filters when enough match", () => {
    const r = filterCompsBySpec(comps, "PETROL", "Manual");
    expect(r.comps).toHaveLength(6);
    expect(r.matched).toEqual(["petrol", "manual"]);
  });
  it("falls back when too few match", () => {
    expect(filterCompsBySpec(comps, "Diesel", "Auto").comps).toHaveLength(10);
  });
});

describe("7. registration validation", () => {
  it("accepts real formats and rejects junk", () => {
    for (const r of ["AB12 CDE", "a123bcd", "K1", "ABC 123A"]) expect(isPlausibleUkReg(r)).toBe(true);
    for (const r of ["HELLO", "1234", "", "AB12CDEFG"]) expect(isPlausibleUkReg(r)).toBe(false);
  });
  it("only make+model counts as found", () => {
    expect(isFoundVehicle({ make: "Ford", model: "Fiesta" })).toBe(true);
    expect(isFoundVehicle({ make: "Ford" })).toBe(false);
    expect(isFoundVehicle(null)).toBe(false);
  });
});

describe("8. fuzzy cross-section dedupe", () => {
  it("drops a near-duplicate sentence and bullet repeated across sections", () => {
    const out = dedupeReportText({
      headline: "Priced fairly for a 169k-mile A4.",
      honestAnalysis: "The car has covered 169,000 miles, which limits the buyer pool.",
      valueReasoning: "It has covered 169,000 miles which limits the pool of buyers. Service history helps.",
      strengths: ["Full service history"],
      factorsUp: ["Full service history", "Clean interior"],
    } as Record<string, any>);
    expect(out.valueReasoning).not.toMatch(/169,000 miles/);
    expect(out.valueReasoning).toMatch(/Service history helps/);
    expect(out.factorsUp).toEqual(["Clean interior"]);
  });
});

describe("9. vision line items", () => {
  const items = [
    { observation: "Front tyres close to legal limit per MOT advisory", severity: "minor", priceImpact: -100, fixable: true, fixCost: 120 },
    { observation: "Light scuff on rear bumper corner", severity: "minor", priceImpact: -80, fixable: true, fixCost: 60 },
    { observation: "ok", severity: "neutral", priceImpact: -50 },
    { observation: "Clean, well kept interior with no wear", severity: "positive", priceImpact: 100, fixable: true },
  ];
  it("strips non-photo evidence, drops zero-evidence items, upside computed in code", () => {
    const v = validatePhotoInsights(items);
    expect(v.find((i) => /tyres/.test(i.observation))?.priceImpact ?? 0).toBe(0);
    expect(v.some((i) => i.observation === "ok")).toBe(false);
    expect(v.find((i) => /Clean/.test(i.observation))?.fixable).toBeFalsy();
    expect(fixableUpside(v)).toBe(80);
  });
});

describe("10. titles", () => {
  it("title-cases Hyundai models and adds engine data", () => {
    expect(displayModel("HYUNDAI", "I20")).toBe("i20");
    expect(vehicleTitle({ year: 2014, make: "HYUNDAI", model: "I20", engineCapacity: 1248, fuelType: "Petrol" })).toBe("2014 Hyundai i20 1.2 Petrol");
  });
});

describe("11. MOT wording", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  it("rewrites a clean-pass strength when the MOT expires within 2 months", () => {
    const out = motConsistentBullets(["Clean MOT pass with no advisories", "Two keys"], "2026-12-22", now)!;
    expect(out[0]).toMatch(/expires on 22 Dec 2026/);
    expect(out).toContain("Two keys");
  });
  it("leaves it alone when the MOT is long", () => {
    expect(motConsistentBullets(["Clean MOT pass with no advisories"], "2027-08-13", now)).toEqual(["Clean MOT pass with no advisories"]);
  });
});
