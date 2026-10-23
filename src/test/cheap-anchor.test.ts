import { describe, it, expect } from "vitest";
import { compAdjustedAnchor, anchorQuantile, quantileSorted } from "../../supabase/functions/_shared/pricing";

const at = (prices: number[]) => prices.map((price) => ({ price, miles: 100_000, year: 2014 }));

describe("cheap-market anchor quantile", () => {
  it("interpolates quantiles", () => {
    expect(quantileSorted([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantileSorted([1, 2, 3, 4, 5], 0.25)).toBe(2);
    expect(quantileSorted([1000, 2000], 0.35)).toBeCloseTo(1350, 6);
  });
  it("is 0.35 below £3k, 0.5 above £5k, monotonic between", () => {
    expect(anchorQuantile(1500)).toBeCloseTo(0.35, 9);
    expect(anchorQuantile(6000)).toBeCloseTo(0.5, 9);
    let prev = 0;
    for (let m = 1000; m <= 8000; m += 100) { const q = anchorQuantile(m); expect(q).toBeGreaterThanOrEqual(prev); prev = q; }
  });
  it("keeps the median for normal-priced markets", () => {
    expect(compAdjustedAnchor(at([6000, 6500, 7000, 7500, 8000]), 100_000, 2014)).toBeCloseTo(7000, 6);
  });
  it("uses a lower quantile for a dispersed cheap market (Sandero SD16SYC-like)", () => {
    const a = compAdjustedAnchor(at([1250, 1594, 1800, 2400, 2800, 2890, 3200]), 100_000, 2014)!;
    expect(a).toBeLessThan(2400);
    expect(a).toBeCloseTo(1800 + (2400 - 1800) * 0.1, 6); // q=0.35 over 7 values -> position 2.1
  });
});

describe("explicit quantile override", () => {
  it("returns the plain median when asked for q=0.5", () => {
    expect(compAdjustedAnchor(at([1250, 1594, 1800, 2400, 2800, 2890, 3200]), 100_000, 2014, 0.5)).toBeCloseTo(2400, 6);
  });
});
