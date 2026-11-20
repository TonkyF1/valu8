import { describe, it, expect } from "vitest";
import { quickReportFrom, shownBand } from "@/lib/quickEstimate";

describe("price-first quick estimate", () => {
  it("accepts a quick report and keeps only the private-sale headline", () => {
    const r = quickReportFrom({ quick: true, report: { values: { privateSale: 8200, dealerRetail: 9900, tradeIn: 7000 }, valueRange: { privateSaleLow: 7800, privateSaleHigh: 8600, extra: 1 }, priceRange: { low: 7800, high: 8600 }, honestAnalysis: "x" } });
    expect(r.values).toEqual({ privateSale: 8200 });
    expect(r.valueRange).toEqual({ privateSaleLow: 7800, privateSaleHigh: 8600 });
    expect(JSON.stringify(r)).not.toMatch(/dealer|trade|honestAnalysis/);
  });
  it("falls back (null) when quick is declined, missing, old deployment or malformed", () => {
    expect(quickReportFrom({ quick: false })).toBeNull();
    expect(quickReportFrom(null)).toBeNull();
    expect(quickReportFrom({ report: { values: { privateSale: 5000 } } })).toBeNull(); // old function: ignores quick flag
    expect(quickReportFrom({ quick: true, report: { values: { privateSale: 0 } } })).toBeNull();
    expect(quickReportFrom({ quick: true })).toBeNull();
  });
  it("shows the early estimate only while estimating, and the final band always wins", () => {
    const q = { t: "q" }, f = { t: "f" };
    expect(shownBand(null, q, "estimating")).toEqual({ band: q, early: true });
    expect(shownBand(f, q, "estimating")).toEqual({ band: f, early: false });
    expect(shownBand(null, q, "estimate")).toEqual({ band: null, early: false }); // full call failed / limit: no stray estimate
    expect(shownBand(null, null, "estimating")).toEqual({ band: null, early: false });
  });
});
