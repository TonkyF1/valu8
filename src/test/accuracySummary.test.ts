import { describe, it, expect } from "vitest";
import { summariseSaleFeedback } from "@/lib/saleFeedback";

const row = (sale: number, est: number) => ({ report: { saleFeedback: { salePrice: sale, estimateAtTime: est } }, private_value: est });
describe("summariseSaleFeedback", () => {
  it("empty when no feedback", () => expect(summariseSaleFeedback([{ report: {} }]).count).toBe(0));
  it("aggregates", () => {
    const s = summariseSaleFeedback([row(11000, 10000), row(9500, 10000), row(10000, 10000)]);
    expect(s.count).toBe(3);
    expect(s.medianAbsPct).toBe(5);
    expect(s.within10Pct).toBe(100);
    expect(s.meanSignedPct).toBe(1.7);
  });
});
