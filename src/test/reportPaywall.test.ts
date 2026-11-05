import { describe, expect, it } from "vitest";
import { FREE_TEASER_COMPS, stripPaidReportFields } from "@/lib/reportPaywall";

describe("stripPaidReportFields", () => {
  it("keeps private sale and teases comps", () => {
    const r = stripPaidReportFields({
      values: { privateSale: 5000 },
      comparableListings: [
        { price: 1 }, { price: 2 }, { price: 3 }, { price: 4 }, { price: 5 },
      ],
      recommendedAskingPrice: 6000,
      conditionScore: 82,
      advert: { title: "x" },
      photoInsights: [{ slot: "front" }],
      recommendations: { listingPrice: 6100, highlights: ["a"] },
    });
    expect(r.values.privateSale).toBe(5000);
    expect(r.comparableListings).toHaveLength(FREE_TEASER_COMPS);
    expect(r.recommendedAskingPrice).toBeUndefined();
    expect(r.conditionScore).toBeUndefined();
    expect(r.advert).toBeUndefined();
    expect(r.photoInsights).toBeUndefined();
    expect((r.recommendations as any).listingPrice).toBeUndefined();
    expect((r.recommendations as any).highlights).toEqual(["a"]);
  });
});
