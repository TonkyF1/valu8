import { describe, expect, it } from "vitest";
import {
  median, percentile, mentionsUnnegated, isUltraRare, baseValue, roundToGrain, clamp, sanitizeNarrativeYears,
  isEnthusiastCar, getExoticAnchor, isClearlyBadMarketData, computeMarketRange, CURRENT_YEAR,
} from "../../supabase/functions/_shared/valuation-math";

describe("stats", () => {
  it("median & percentile", () => {
    expect(median([])).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(percentile([10, 20, 30, 40, 50], 25)).toBe(20);
    expect(percentile([10, 20, 30, 40, 50], 100)).toBe(50);
  });
  it("rounding & clamp", () => {
    expect(roundToGrain(12345)).toBe(12350);
    expect(roundToGrain(45260)).toBe(45500);
    expect(roundToGrain(123000)).toBe(125000);
    expect(clamp(5, 0, 3)).toBe(3);
  });
});

describe("text heuristics", () => {
  it("respects negation", () => {
    expect(mentionsUnnegated(/leak/i, "no leaks")).toBe(false);
    expect(mentionsUnnegated(/leak/i, "never had rust, but small oil leak")).toBe(true);
    expect(mentionsUnnegated(/due/i, "service isn't due")).toBe(false);
  });
  it("sanitises hallucinated years", () => {
    expect(sanitizeNarrativeYears("Bought in 1999, serviced 2014", 2014, 2026)).toBe("Bought in 2014, serviced 2014");
  });
  it("classifies cars", () => {
    expect(isUltraRare("Bugatti", "Chiron")).toBe(true);
    expect(isUltraRare("Ferrari", "LaFerrari")).toBe(true);
    expect(isUltraRare("Ford", "Focus")).toBe(false);
    expect(isEnthusiastCar("Volkswagen", "Golf", "GTI")).toBe(true);
    expect(getExoticAnchor("Ferrari", "488 GTB")?.low).toBe(130000);
  });
});

describe("market sanity", () => {
  it("rejects implausible exotic medians", () => {
    expect(isClearlyBadMarketData({ make: "Ferrari", model: "F8", median: 20000, count: 30, ultraRare: false })).toBe(true);
    expect(isClearlyBadMarketData({ make: "Ford", model: "Focus", median: 9000, count: 30, ultraRare: false })).toBe(false);
    expect(isClearlyBadMarketData({ make: "Ford", model: "Focus", median: 0, count: 30, ultraRare: false })).toBe(true);
  });
});

describe("baseValue", () => {
  it("depreciates with age and tiers by make", () => {
    expect(baseValue("Ford", CURRENT_YEAR)).toBe(18000);
    expect(baseValue("BMW", CURRENT_YEAR)).toBeGreaterThan(baseValue("Dacia", CURRENT_YEAR));
    expect(baseValue("Ford", CURRENT_YEAR - 5)).toBeLessThan(baseValue("Ford", CURRENT_YEAR - 1));
  });
});

describe("computeMarketRange", () => {
  const base = { make: "Ford", model: "Focus", year: CURRENT_YEAR - 5, mileage: 40000, photoCount: 5, conditionScore: 7.5, aiPrivateValue: 10000 };
  it("produces an ordered range around the AI figure", () => {
    const r = computeMarketRange(base);
    expect(r.low).toBeLessThanOrEqual(r.center);
    expect(r.high).toBeGreaterThanOrEqual(r.center);
    expect(r.center).toBeGreaterThan(9000);
    expect(r.center).toBeLessThan(10500);
    expect(r.confidence).toBe("High");
  });
  it("penalises high mileage and problems", () => {
    const hi = computeMarketRange({ ...base, mileage: 90000 });
    const bad = computeMarketRange({ ...base, serviceNotes: "oil leak, warning light" });
    expect(hi.center).toBeLessThan(computeMarketRange(base).center);
    expect(bad.center).toBeLessThan(computeMarketRange(base).center);
    expect(computeMarketRange({ ...base, serviceNotes: "no leaks, no issues" }).center).toBe(computeMarketRange(base).center);
  });
});
