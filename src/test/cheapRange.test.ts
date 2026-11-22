import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { headlinePrivateText, reportPriceRange, rangeReasonCopy, RANGE_COPY, CHEAP_RANGE, OLD_RANGE } from "../../supabase/functions/_shared/cheapRange";
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

describe("range reason copy", () => {
  it("matches the rule that produced the range", () => {
    expect(rangeReasonCopy({ low: 700, high: 1500, mid: 1000, rule: CHEAP_RANGE.RULE })).toBe(RANGE_COPY.cheap);
    expect(rangeReasonCopy({ low: 800_000, high: 2_500_000, mid: 1_000_000, rule: OLD_RANGE.RULE })).toBe(RANGE_COPY.old);
    expect(rangeReasonCopy({ low: 8_000, high: 12_000, mid: 10_000, rule: "future-rule" })).toBe(RANGE_COPY.fallback);
    // Stored under-£5,000 range with a legacy rule still gets the cheap-car wording.
    expect(rangeReasonCopy({ low: 700, high: 1500, mid: 1000, rule: "x" })).toBe(RANGE_COPY.cheap);
  });
  it("is used on the report, emails, Premium report and PDF (not under the homepage price, by owner request)", () => {
    expect(readFileSync("src/components/tesla/TeslaFlow.tsx", "utf8")).not.toContain("rangeReasonCopy");
    const files = [
      "src/pages/Report.tsx",
      "supabase/functions/_shared/emailTemplates.ts",
      "src/components/report/PremiumView.tsx",
      "src/lib/pdf.ts",
    ];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toContain("rangeReasonCopy");
      expect(src, f).not.toMatch(/Prices vary more for cars under £5,000, so we show a range rather than one figure/);
      expect(src, f).not.toMatch(/Prices vary more under £5,000, so we show a range/);
    }
  });
});
