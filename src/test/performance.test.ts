import { describe, expect, it } from "vitest";
import { detectPerformanceVariant as d, filterCompsByPerformance, isPerformanceComp, downgradeConfidence } from "../../supabase/functions/_shared/performance";

const key = (mk: string, model: string, v?: string, ad?: string) => d(mk, model, v, ad)?.key ?? null;
const lab = (mk: string, model: string, v?: string) => d(mk, model, v)?.label ?? null;

describe("detectPerformanceVariant: positives", () => {
  it.each([
    ["Renault", "Megane", "R.S. 300 Trophy", "renault-rs"],
    ["RENAULT", "Megane Renaultsport Trophy S/s", undefined, "renault-rs"],
    ["Renault", "Megane", "Renaultsport 275 Trophy", "renault-rs"],
    ["Renault", "Megane", "RS 250 Cup", "renault-rs"],
    ["Renault", "Clio", "Renault Sport 200 Cup", "renault-rs"],
    ["Renault", "Megane R.S.", "", "renault-rs"],
    ["Volkswagen", "Golf", "GTI Performance", "vw-perf"],
    ["VOLKSWAGEN", "Golf R", undefined, "vw-perf"],
    ["Volkswagen", "Golf", "2.0 TSI R 4Motion", "vw-perf"],
    ["Volkswagen", "Golf", "GTD", "vw-perf"],
    ["Volkswagen", "Golf", "GTI Clubsport", "vw-perf"],
    ["Ford", "Focus", "ST-3", "ford-st-rs"],
    ["Ford", "Fiesta", "ST", "ford-st-rs"],
    ["Ford", "Focus RS", undefined, "ford-st-rs"],
    ["Honda", "Civic", "Type R GT", "honda-type-r"],
    ["SEAT", "Leon", "Cupra 300", "cupra"],
    ["Mercedes-Benz", "A Class", "A45 AMG", "amg"],
    ["Mercedes-Benz", "C Class", "AMG C63 S", "amg"],
    ["BMW", "M3", "Competition", "bmw-m"],
    ["BMW", "4 Series", "M4 Competition", "bmw-m"],
    ["Audi", "RS3", "Sportback", "audi-rs"],
    ["Audi", "A4", "RS 4 Avant", "audi-rs"],
    ["Vauxhall", "Astra", "VXR", "vauxhall-vxr"],
    ["MINI", "Hatch", "John Cooper Works", "mini-jcw"],
    ["Abarth", "595", "Competizione", "abarth"],
    ["Hyundai", "i30", "N Performance", "hyundai-n"],
    ["Peugeot", "308", "GTi 270", "peugeot-gti"],
    ["Skoda", "Octavia", "vRS", "skoda-vrs"],
    ["Toyota", "GR Yaris", "Circuit", "toyota-gr"],
  ])("%s %s %s", (mk, model, v, want) => {
    expect(key(mk, model, v as string | undefined)).toBe(want);
  });
  it("picks the most specific Renault tier", () => {
    expect(lab("Renault", "Megane", "R.S. 300 Trophy-R")).toMatch(/Trophy-R$/);
    expect(lab("Renault", "Megane", "R.S. 300 Trophy")).toMatch(/— Trophy$/);
    expect(lab("Renault", "Megane", "RS 280")).toBe("Renault Sport (RS)");
  });
  it("uses ad title only when variant/model have no signal", () => {
    expect(key("Renault", "Megane", "", "2019 Renault Megane RS 300 Trophy manual")).toBe("renault-rs");
    expect(key("Renault", "Megane", "Dynamique", "Lovely car. ".repeat(20) + "Trophy")).toBeNull();
  });
});

describe("detectPerformanceVariant: false positives", () => {
  it.each([
    ["BMW", "3 Series", "320d M Sport"],
    ["BMW", "1 Series", "118i M Sport Shadow"],
    ["Ford", "Focus", "ST-Line X"],
    ["Ford", "Fiesta", "ST Line"],
    ["Renault", "Clio", "RS Line TCe 140"],
    ["Renault", "Megane", "R.S. Line"],
    ["Renault", "Megane", "GT Line TCe"],
    ["Volkswagen", "Golf", "R-Line"],
    ["Volkswagen", "Tiguan", "R Line Edition"],
    ["Volkswagen", "Polo", "SE"],
    ["Peugeot", "208", "GT Line"],
    ["Kia", "Ceed", "GT-Line S"],
    ["Mercedes-Benz", "C Class", "C220d AMG Line"],
    ["Audi", "A3", "S line"],
    ["Hyundai", "i30", "N Line"],
    ["Vauxhall", "Corsa", "SRi VX-Line"],
    ["Toyota", "Corolla", "GR Sport"],
    ["Honda", "Civic", "Sport"],
    ["SEAT", "Leon", "FR Sport"],
    ["Renault", "Megane", "Dynamique Nav dCi"],
  ])("%s %s %s", (mk, model, v) => {
    expect(d(mk, model, v)).toBeNull();
  });
});

describe("filterCompsByPerformance", () => {
  const perf = d("Renault", "Megane", "R.S. 300 Trophy")!;
  const gt = { trim: "Gt Line Tce", url: "https://x.co.uk/used/renault-megane-13-tce-gt-line" };
  const rs = { trim: "Renault Sport", url: "https://cinch.co.uk/used-cars/renault/megane%20r.s./details/1" };
  const tr = { trim: "Renault Sport Trophy", url: "https://cars2.co.uk/renault-megane-18t-rs300-trophy" };
  it("matches comps by trim or URL", () => {
    expect(isPerformanceComp(perf, gt)).toBe(false);
    expect(isPerformanceComp(perf, rs)).toBe(true);
    expect(isPerformanceComp(perf, { url: "https://a.uk/renault-megane-2-0-t-renaultsport-trophy-rs-275/" }, true)).toBe(true);
  });
  it("prefers specific, then broad, then flags fallback", () => {
    expect(filterCompsByPerformance([tr, tr, tr, tr, rs, gt], perf).match).toBe("specific");
    const b = filterCompsByPerformance([tr, rs, rs, rs, gt, gt], perf);
    expect(b.match).toBe("broad"); expect(b.comps).toHaveLength(4);
    const f = filterCompsByPerformance([tr, rs, gt, gt, gt], perf);
    expect(f.match).toBe("fallback"); expect(f.comps).toHaveLength(5); expect(f.matchedCount).toBe(2);
  });
  it("is a no-op for non-performance cars", () => {
    expect(filterCompsByPerformance([gt], null)).toEqual({ comps: [gt], match: null, matchedCount: 0 });
  });
  it("downgrades confidence one notch", () => {
    expect(downgradeConfidence("High")).toBe("Medium");
    expect(downgradeConfidence("Very Low")).toBe("Very Low");
  });
});
