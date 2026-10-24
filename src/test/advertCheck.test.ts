import { describe, it, expect } from "vitest";
import { checkAdvert, parseMoney } from "@/lib/advertCheck";

const m = { low: 11000, mid: 12000, high: 13500 };
const ordered = (r: NonNullable<ReturnType<typeof checkAdvert>>) =>
  r.privateLow <= r.privateSale && r.privateSale <= r.privateHigh && r.privateHigh < r.retailLow &&
  r.retailLow <= r.retailMid && r.retailMid <= r.retailHigh;

describe("checkAdvert", () => {
  it("flags overpriced above retail high", () => expect(checkAdvert(14500, m)?.verdict).toBe("overpriced"));
  it("fair inside the range", () => expect(checkAdvert(12000, m)?.verdict).toBe("fair"));
  it("bargain below private low", () => {
    const r = checkAdvert(8000, m)!;
    expect(r.verdict).toBe("bargain");
    expect(r.privateSale).toBe(9550); // (12000 − 1500) / 1.1
    expect(r.privateLow).toBeLessThan(r.privateSale);
  });
  it("dealer range sits above the private range (wide own-comps band)", () => {
    // Real /check output that showed dealer £5,100–£10,300 under private £5,750–£6,300.
    const r = checkAdvert(6500, { low: 5100, mid: 7250, high: 10300 })!;
    expect(ordered(r)).toBe(true);
    expect(r.retailHigh / r.retailMid).toBeLessThanOrEqual(1.16);
    expect(r.retailLow / r.retailMid).toBeGreaterThanOrEqual(0.84);
  });
  it("stays ordered across prices and band shapes", () => {
    for (const mid of [1200, 2500, 4800, 9000, 25000, 60000, 150000])
      for (const [lo, hi] of [[0.99, 1.01], [0.9, 1.1], [0.6, 1.5], [1, 1]]) {
        const r = checkAdvert(mid, { low: mid * lo, mid, high: mid * hi })!;
        expect(ordered(r), JSON.stringify({ mid, lo, hi, r })).toBe(true);
      }
  });
  it("rejects bad input", () => expect(checkAdvert(NaN, m)).toBeNull());
  it("parses money", () => { expect(parseMoney("£12,995")).toBe(12995); expect(parseMoney("abc")).toBeNaN(); });
});
