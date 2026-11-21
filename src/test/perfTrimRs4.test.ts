import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { inferPerformanceTrim } from "@/lib/perfTrim";
import { resolveVariant } from "../../supabase/functions/_shared/variantGuard";

const A = (model: string, cc: number, year: number, fuel = "Petrol") => ({ make: "AUDI", model, cc, year, fuel });

describe("RS4 / RS5 / S5 year splits (LL13 JRX: 2013 A4 4,163cc reported as plain A4)", () => {
  it("2013 4,163cc petrol A4 is confidently the RS4", () => {
    for (const y of [2012, 2013, 2015, 2016]) {
      const h = inferPerformanceTrim(A("A4", 4163, y))!;
      expect(h.variant).toBe("RS4"); expect(h.confident).toBe(true); expect(h.options).toEqual(["RS4"]);
    }
    const r = resolveVariant({ ...A("A4", 4163, 2013), make: "AUDI" });
    expect(r.variant).toBe("RS4"); expect(r.ambiguousPerf).toBe(false); expect(r.displayModel).toBe("RS4");
  });
  it("2003-2011 4,163cc A4 stays ambiguous (B6/B7 S4 vs B7 RS4) and asks", () => {
    for (const y of [2003, 2006, 2008, 2011]) {
      const h = inferPerformanceTrim(A("A4", 4163, y))!;
      expect(h.confident).toBe(false); expect(h.allPerf).toBe(true); expect(h.options).toEqual(["RS4", "S4"]);
      expect(resolveVariant({ ...A("A4", 4163, y) }).ambiguousPerf).toBe(true);
    }
  });
  it("A4 rules elsewhere are untouched", () => {
    expect(inferPerformanceTrim(A("A4", 2995, 2016))?.variant).toBe("S4");
    expect(inferPerformanceTrim(A("A4", 2894, 2019))?.variant).toBe("RS4");
    expect(inferPerformanceTrim(A("A4", 1968, 2015))).toBeNull();
    expect(inferPerformanceTrim(A("A4", 4163, 2013, "Diesel"))).toBeNull();
    expect(inferPerformanceTrim({ make: "AUDI", model: "RS4", cc: 4163, year: 2013, fuel: "Petrol" })).toBeNull();
  });
  it("A5 4.2 V8: S5 before the RS5 existed, RS5 after the S5 went supercharged, ambiguous between", () => {
    expect(inferPerformanceTrim(A("A5", 4163, 2008))).toMatchObject({ variant: "S5", confident: true });
    expect(inferPerformanceTrim(A("A5", 4163, 2013))).toMatchObject({ variant: "RS5", confident: true });
    expect(inferPerformanceTrim(A("A5", 4163, 2010))).toMatchObject({ confident: false, allPerf: true, options: ["S5", "RS5"] });
  });
  it("genuinely ambiguous rules are left alone (RS6/S6, M5/550i, STI/WRX)", () => {
    expect(inferPerformanceTrim(A("A6", 3993, 2015))).toMatchObject({ confident: false, options: ["RS6", "S6"] });
    expect(inferPerformanceTrim({ make: "BMW", model: "5 Series", cc: 4395, year: 2014, fuel: "Petrol" })).toMatchObject({ confident: false });
    expect(inferPerformanceTrim({ make: "Subaru", model: "Impreza", cc: 2457, year: 2010, fuel: "Petrol" })).toMatchObject({ confident: false });
  });
  it("frontend and edge-function perfTrim copies stay identical", () => {
    expect(readFileSync("src/lib/perfTrim.ts", "utf8")).toBe(readFileSync("supabase/functions/_shared/perfTrim.ts", "utf8"));
  });
  it("hero flow offers a one-tap 'Which is it?' pick that re-runs the valuation", () => {
    const flow = readFileSync("src/components/tesla/TeslaFlow.tsx", "utf8");
    expect(flow).toContain('data-testid="pick-variant"');
    expect(flow).toContain("refine(undefined, false, o)");
  });
});
