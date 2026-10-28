import { describe, it, expect } from "vitest";
import { validateEstimate, pctDifference, normaliseFeedback, VERDICT_LABELS } from "@/lib/valuationFeedback";

describe("valuation feedback", () => {
  it("accepts sensible whole-pound estimates", () => {
    expect(validateEstimate("8500")).toEqual({ ok: true, value: 8500 });
    expect(validateEstimate("£8,500")).toEqual({ ok: true, value: 8500 });
    expect(validateEstimate(" 100 ")).toEqual({ ok: true, value: 100 });
    expect(validateEstimate("500000")).toEqual({ ok: true, value: 500000 });
  });
  it("rejects empty, decimals, negatives and out-of-range values", () => {
    for (const bad of ["", "abc", "85.5", "-200", "99", "500001", "1e5"]) expect(validateEstimate(bad).ok).toBe(false);
  });
  it("computes % difference vs the Valu8 value", () => {
    expect(pctDifference(8030, 7300)).toBe(10);
    expect(pctDifference(6570, 7300)).toBe(-10);
    expect(pctDifference(null, 7300)).toBeNull();
    expect(pctDifference(5000, 0)).toBeNull();
  });
  it("normalises RPC rows", () => {
    expect(normaliseFeedback(null)).toBeNull();
    expect(normaliseFeedback({ verdict: "too_low", user_estimate: 9000, followup_opt_in: true })).toEqual({ verdict: "too_low", user_estimate: 9000, followup_opt_in: true });
    expect(normaliseFeedback({ verdict: "bogus" })).toEqual({ verdict: null, user_estimate: null, followup_opt_in: false });
  });
  it("uses the agreed button labels", () => {
    expect(Object.values(VERDICT_LABELS)).toEqual(["Too low", "About right", "Too high"]);
  });
});
