import { describe, expect, it } from "vitest";
import { headlinePrivateText, reportPriceRange } from "../../supabase/functions/_shared/cheapRange";
import { normaliseReportPricing } from "@/lib/askingPrice";

describe("cheap-car headline range", () => {
  it("shows a range under £5,000 and a single figure above", () => {
    const cheap = { values: { privateSale: 1000, dealerTradeIn: 600, dealerRetail: 1500 } };
    expect(headlinePrivateText(normaliseReportPricing(cheap).privateSale, cheap)).toBe("£700–£1,500");
    const dear = { values: { privateSale: 9000, dealerTradeIn: 7000, dealerRetail: 11000 } };
    expect(reportPriceRange(dear, normaliseReportPricing(dear).privateSale)).toBeNull();
  });
  it("keeps the stored midpoint (privateSale) unchanged", () => {
    const r = { values: { privateSale: 3000, dealerTradeIn: 2000, dealerRetail: 4200 }, priceRange: { low: 2400, high: 4100, mid: 3000 } };
    expect(normaliseReportPricing(r).privateSale).toBe(3000);
    expect(reportPriceRange(r, 3000)).toMatchObject({ low: 2400, high: 4100, mid: 3000 });
  });
});
