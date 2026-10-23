import { describe, it, expect } from "vitest";
import { checkAdvert, parseMoney } from "@/lib/advertCheck";

const m = { low: 11000, mid: 12000, high: 13500 };
describe("checkAdvert", () => {
  it("flags overpriced above retail high", () => expect(checkAdvert(14500, m)?.verdict).toBe("overpriced"));
  it("fair inside the range", () => expect(checkAdvert(12000, m)?.verdict).toBe("fair"));
  it("bargain below private low", () => {
    const r = checkAdvert(8000, m)!;
    expect(r.verdict).toBe("bargain");
    expect(r.privateSale).toBe(10000);
    expect(r.privateLow).toBeLessThan(r.privateSale);
  });
  it("rejects bad input", () => expect(checkAdvert(NaN, m)).toBeNull());
  it("parses money", () => { expect(parseMoney("£12,995")).toBe(12995); expect(parseMoney("abc")).toBeNaN(); });
});
