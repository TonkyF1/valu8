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
  it("screenshot regression: £4,850 trade / ~£5,400 private / £4,900–£5,900 range / £7,400 retail / £250 buffer (retail within the private × 1.5 bound)", () => {
    const c = coherentPricing({ privateSale: 5400, tradeIn: 4850, retail: 7400, privateLow: 4900, privateHigh: 5900, buffer: 250 });
    assertOrdered(c);
    expect(c.askLow).toBe(5650);           // realistic + £250 buffer
    expect(c.buffer).toBe(250);
    expect(c.privateHigh).toBe(5650);      // private range touches ask range
    expect(c.askLow).toBeLessThan(5700);   // no longer an unrelated +5..15% band
    expect(c.scaleLow).toBe(4850);
    expect(c.retail).toBe(7400);          // 7400 / 5400 = 1.37x, inside the 1.5x bound (measured dealer premium ~1.25x at £5-10k)
    expect(c.scaleHigh).toBe(7400);
  });

  it("caps shown dealer retail: MINI Cooper (private £5,650, stored retail £9,750)", () => {
    const c = coherentPricing({ privateSale: 5637, retail: 9750 });
    assertOrdered(c);
    expect(c.privateSale).toBe(5650);     // one rounded figure everywhere
    expect(c.retail).toBe(8450);          // ≤ 5650 × 1.5
  });

  it("uses × 1.7 under £5k, × 1.4 cap at £10k+ private and a × 1.08 floor", () => {
    expect(coherentPricing({ privateSale: 2000, retail: 5000 }).retail).toBe(3400);
    expect(coherentPricing({ privateSale: 12000, retail: 20000 }).retail).toBeLessThanOrEqual(16800);
    expect(coherentPricing({ privateSale: 8000, retail: 7000 }).retail).toBeGreaterThanOrEqual(8640);
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

describe("realistic sale inside private range", () => {
  it("£82,000 realistic with stored £69,000–£80,000 range is widened to include it", () => {
    const c = coherentPricing({ privateSale: 82000, tradeIn: 65000, retail: 95000, privateLow: 69000, privateHigh: 80000 });
    assertOrdered(c);
    expect(c.privateLow).toBe(69000);
    expect(c.privateHigh).toBeGreaterThanOrEqual(82000);
  });
  it("normaliseReportPricing keeps headline inside range for old saved reports", async () => {
    const { normaliseReportPricing } = await import("@/lib/askingPrice");
    for (const [p, lo, hi, t] of [[82000, 69000, 80000, 60000], [5000, 5200, 5300, 5100], [12000, 0, 0, 0]]) {
      const c = normaliseReportPricing({ values: { privateSale: p, dealerTradeIn: t }, valueRange: { privateSaleLow: lo || null, privateSaleHigh: hi || null } });
      assertOrdered(c);
      expect(c.privateSale).toBe(p);
    }
  });
});
