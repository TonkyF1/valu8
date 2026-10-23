import { describe, it, expect } from "vitest";
import { priceBandGeometry, MIN_PILL_PCT } from "@/lib/priceBand";

const within = (g: ReturnType<typeof priceBandGeometry>) => {
  expect(g.marker).toBeGreaterThanOrEqual(g.pill.left - 1e-9);
  expect(g.marker).toBeLessThanOrEqual(g.pill.left + g.pill.width + 1e-9);
  expect(g.pill.left).toBeGreaterThanOrEqual(0);
  expect(g.pill.left + g.pill.width).toBeLessThanOrEqual(100 + 1e-9);
};

describe("priceBandGeometry", () => {
  it("owner example 69000 / 80000 / 82000", () => {
    const g = priceBandGeometry({ scaleLow: 60000, scaleHigh: 90000, privateLow: 69000, privateHigh: 82000, askLow: 82000, askHigh: 85000, privateSale: 80000 });
    within(g);
    expect(g.marker).toBeCloseTo(((80000 - 60000) / 30000) * 100, 6);
  });
  it("price == high and price == low", () => {
    within(priceBandGeometry({ scaleLow: 5000, scaleHigh: 10000, privateLow: 7000, privateHigh: 8000, askLow: 8000, askHigh: 8500, privateSale: 8000 }));
    within(priceBandGeometry({ scaleLow: 5000, scaleHigh: 10000, privateLow: 7000, privateHigh: 8000, askLow: 8000, askHigh: 8500, privateSale: 7000 }));
  });
  it("very narrow and zero-width ranges, including at the track edges", () => {
    for (const [lo, hi, p] of [[7999, 8001, 8000], [8000, 8000, 8000], [5000, 5000, 5000], [10000, 10000, 10000], [9990, 10000, 10000]]) {
      const g = priceBandGeometry({ scaleLow: 5000, scaleHigh: 10000, privateLow: lo, privateHigh: hi, askLow: hi, askHigh: hi + 100, privateSale: p });
      within(g);
      expect(g.pill.width).toBeGreaterThanOrEqual(MIN_PILL_PCT - 1e-9);
    }
  });
  it("random value sets always keep the marker in the pill", () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < 2000; n++) {
      const scaleLow = 1000 + rnd() * 50000;
      const scaleHigh = scaleLow + rnd() * 40000;
      const a = scaleLow + rnd() * (scaleHigh - scaleLow), b = scaleLow + rnd() * (scaleHigh - scaleLow);
      const privateLow = Math.min(a, b), privateHigh = Math.max(a, b);
      const privateSale = rnd() < 0.2 ? privateHigh : privateLow + rnd() * (privateHigh - privateLow);
      within(priceBandGeometry({ scaleLow, scaleHigh, privateLow, privateHigh, askLow: privateHigh, askHigh: privateHigh * 1.05, privateSale }));
    }
  });
  it("out-of-range sale price is clamped into the pill", () => {
    within(priceBandGeometry({ scaleLow: 0, scaleHigh: 100, privateLow: 40, privateHigh: 50, askLow: 50, askHigh: 60, privateSale: 90 }));
  });
});
