import { describe, expect, it } from "vitest";
import { shrinkThinAnchor, aiAgeFactor, OLD_CAR_FLOOR, LIMITED_EDITION_PREMIUM, THIN_COMP_FULL_WEIGHT } from "../../supabase/functions/_shared/calibration";
import { detectPerformanceVariant, filterCompsByPerformance } from "../../supabase/functions/_shared/performance";
import { calibrateAiPrivate } from "../../supabase/functions/_shared/pricing";

describe("thin-comp shrinkage", () => {
  it("single comp is mostly replaced by the prior (GL-Class case)", () => {
    const r = shrinkThinAnchor(24000, 4000, 1);
    expect(r.weight).toBeCloseTo(0.2);
    expect(r.anchor).toBeGreaterThan(4000);
    expect(r.anchor).toBeLessThan(6000);
  });
  it("no change at or above full weight", () => {
    expect(shrinkThinAnchor(10000, 4000, THIN_COMP_FULL_WEIGHT).anchor).toBe(10000);
    expect(shrinkThinAnchor(10000, 4000, 40).anchor).toBe(10000);
  });
  it("monotone in n and bounded by anchor/prior", () => {
    let prev = 0;
    for (let n = 0; n < 5; n++) {
      const a = shrinkThinAnchor(10000, 5000, n).anchor;
      expect(a).toBeGreaterThanOrEqual(prev); expect(a).toBeGreaterThanOrEqual(5000); expect(a).toBeLessThanOrEqual(10000);
      prev = a;
    }
  });
  it("missing prior keeps the comp anchor", () => {
    expect(shrinkThinAnchor(9000, 0, 1).anchor).toBe(9000);
  });
});

describe("AI fallback calibration", () => {
  const base = { make: "Ford", year: 2010, miles: 100_000, currentYear: 2026, motValid: true };
  it("old-car floor is £1,000, not £1,500", () => {
    expect(OLD_CAR_FLOOR).toBe(1000);
    expect(calibrateAiPrivate({ ...base, aiPrivate: 600 }).privateSale).toBe(1000);
    expect(calibrateAiPrivate({ ...base, aiPrivate: 1300 }).privateSale).toBe(1300);
  });
  it("age factor is neutral until evidence supports it", () => {
    expect(aiAgeFactor(5)).toBe(1); expect(aiAgeFactor(20)).toBe(1);
  });
});

describe("limited editions (Trophy-R)", () => {
  const p = detectPerformanceVariant("Renault", "Megane", "R.S. Trophy-R");
  const trophy = (n: number) => Array.from({ length: n }, (_, i) => ({ trim: "R.S. Trophy", url: `https://x/${i}` }));
  const tr = (n: number) => Array.from({ length: n }, (_, i) => ({ trim: "R.S. Trophy-R", url: `https://y/${i}` }));
  it("uses own comps with just 2", () => {
    const f = filterCompsByPerformance([...trophy(10), ...tr(2)], p);
    expect(f.match).toBe("specific"); expect(f.comps.length).toBe(2);
  });
  it("falls back to Trophy (not Trophy-R) comps with premium", () => {
    const f = filterCompsByPerformance([...trophy(6), ...tr(1), { trim: "GT Line" }], p);
    expect(f.match).toBe("parent"); expect(f.comps.length).toBe(6);
    expect(f.premium).toBe(LIMITED_EDITION_PREMIUM["Trophy-R"]);
  });
  it("plain Trophy unaffected", () => {
    const t = detectPerformanceVariant("Renault", "Megane", "R.S. Trophy");
    const f = filterCompsByPerformance([...trophy(2), { trim: "RS 280" }, { trim: "RS 280" }, { trim: "RS 300" }], t);
    expect(f.match).toBe("broad"); expect(f.premium).toBeUndefined();
  });
});

describe("Trophy-R vs 'Trophy R.S.' comps", () => {
  const p = detectPerformanceVariant("Renault", "Megane", "R.S. 300 Trophy-R");
  it("does not treat 'Trophy R.S. 300' as Trophy-R", () => {
    const comps = [{ trim: "Trophy R.S. 300" }, { trim: "R.S. Trophy RS 300" }, { trim: "Trophy-RS" }, { trim: "Rs Trophy-r Tce" }, { trim: "RS Trophy R" }];
    const f = filterCompsByPerformance(comps, p, 4);
    expect(f.match).toBe("specific");
    expect(f.comps.map((c) => c.trim)).toEqual(["Rs Trophy-r Tce", "RS Trophy R"]);
  });
  it("still detects Trophy-R variants", () => {
    expect(detectPerformanceVariant("Renault", "Megane", "RS Trophy-R")?.specific?.label).toBe("Trophy-R");
    expect(detectPerformanceVariant("Renault", "Megane", "R.S. Trophy R.S. 300")?.specific?.label).toBe("Trophy");
  });
});
