import { describe, it, expect } from "vitest";
import { declaredStatusItems } from "../../supabase/functions/_shared/pricing";
import { currentMotExpiry, failedWithoutValidMot } from "../../supabase/functions/_shared/mot";

describe("declaredStatusItems", () => {
  it("flags Cat S from the advert text (Kia Carens LC17BZF)", () => {
    const it = declaredStatusItems("Cat S (Low-speed parking scrape to the rear passenger door - fully repaired)");
    expect(it).toEqual([{ label: "Insurance write-off (Cat S)", impactPct: -25, scope: "retail" }]);
  });
  it("Cat N is a lighter hit", () => {
    expect(declaredStatusItems("category N, repaired")[0].impactPct).toBe(-18);
  });
  it("flags spares or repair (Golf NL61TWY)", () => {
    expect(declaredStatusItems("Selling spares or repair due to mot failure")[0].label).toBe("Sold as spares or repair");
  });
  it("ignores negations and unrelated words", () => {
    expect(declaredStatusItems("Not a cat S or N, never written off")).toEqual([]);
    expect(declaredStatusItems("catalytic converter replaced, cats fine")).toEqual([]);
    expect(declaredStatusItems("")).toEqual([]);
  });
});

describe("MOT validity from DVSA entries", () => {
  const now = new Date("2026-10-23");
  const golf = [
    { date: "2026-10-20", result: "Fail", expiryDate: null },
    { date: "2025-05-08", result: "Pass", expiryDate: "2026-05-16" },
  ];
  it("takes expiry from the latest pass, not a failed test", () => {
    expect(currentMotExpiry(golf)).toBe("2026-05-16");
  });
  it("detects a failed latest test with no MOT left", () => {
    expect(failedWithoutValidMot(golf, now)).toBe(true);
  });
  it("a pre-expiry fail with MOT still running is not flagged", () => {
    expect(failedWithoutValidMot([{ result: "Fail", expiryDate: null }, { result: "Pass", expiryDate: "2026-12-01" }], now)).toBe(false);
  });
  it("fail then retest pass is not flagged", () => {
    expect(failedWithoutValidMot([{ result: "Advisory", expiryDate: "2027-05-09" }, { result: "Fail", expiryDate: null }], now)).toBe(false);
  });
});

describe("declaredStatusItems write-off without category", () => {
  it("flags 'was bumped and written off'", () => {
    const it0 = declaredStatusItems("This vehicle was bumped and written off");
    expect(it0).toHaveLength(1);
    expect(it0[0].impactPct).toBe(-18);
  });
  it("ignores 'never been written off'", () => {
    expect(declaredStatusItems("Never been written off, full history")).toHaveLength(0);
  });
  it("does not double count with a declared category", () => {
    expect(declaredStatusItems("Cat N, written off for a scratch")).toHaveLength(1);
  });
});
