import { describe, it, expect } from "vitest";
import { coherentPricing, type CoherentPricing } from "../../supabase/functions/_shared/coherentPricing";

function assertOrdered(c: CoherentPricing) {
  expect(c.tradeIn).toBeLessThan(c.privateLow);
  expect(c.privateLow).toBeLessThanOrEqual(c.privateSale);
  expect(c.privateSale).toBeLessThanOrEqual(c.privateHigh);
  expect(c.privateHigh).toBeLessThanOrEqual(c.askLow);
  expect(c.askLow).toBeLessThanOrEqual(c.askHigh);
  expect(c.askHigh).toBeLessThanOrEqual(c.retail);
  expect(c.buffer).toBe(c.askLow - c.privateSale);
  expect(c.scaleLow).toBeLessThanOrEqual(c.tradeIn);
  expect(c.scaleHigh).toBeGreaterThanOrEqual(c.retail);
}

describe("coherentPricing", () => {
  it("screenshot regression: £4,850 trade / ~£5,400 private / £4,900–£5,900 range / £7,400 retail / £250 buffer", () => {
    const c = coherentPricing({ privateSale: 5400, tradeIn: 4850, retail: 7400, privateLow: 4900, privateHigh: 5900, buffer: 250 });
    assertOrdered(c);
    expect(c.askLow).toBe(5650);           // realistic + £250 buffer
    expect(c.buffer).toBe(250);
    expect(c.privateHigh).toBe(5650);      // private range touches ask range
    expect(c.askLow).toBeLessThan(5700);   // no longer an unrelated +5..15% band
    expect(c.scaleLow).toBe(4850);
    expect(c.scaleHigh).toBe(7400);
  });

  it("dot sits inside private range", () => {
    const c = coherentPricing({ privateSale: 5400, privateLow: 5500, privateHigh: 5300 });
    assertOrdered(c);
  });

  it("fixes trade-in above the private low and retail below asking", () => {
    assertOrdered(coherentPricing({ privateSale: 3000, tradeIn: 3100, retail: 3050, buffer: 1000 }));
    assertOrdered(coherentPricing({ privateSale: 8000, tradeIn: 7900, privateLow: 7800 }));
  });

  it("holds across a sweep of inputs", () => {
    for (let p = 500; p <= 200000; p = Math.round(p * 1.37)) {
      for (const k of [0.5, 0.9, 1, 1.1, 1.5]) {
        assertOrdered(coherentPricing({ privateSale: p, tradeIn: p * 0.85 * k, retail: p * 1.2 * k, privateLow: p * 0.9 * k, privateHigh: p * 1.1 * k, buffer: p * 0.05 * k }));
      }
      assertOrdered(coherentPricing({ privateSale: p }));
    }
  });
});
