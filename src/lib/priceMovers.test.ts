import { describe, expect, it } from "vitest";
import { priceMovers, fmtPct, motExpiredOn } from "./priceMovers";
import { priceFactorsFrom } from "../../supabase/functions/_shared/priceFactors";
import { pricePm, inferenceTrimKey, featurize } from "../../supabase/functions/_shared/priceModel";

const NOW = new Date("2026-11-21T12:00:00Z");
// Shape of the audit's test valuation (BD67 USJ, 2017 Fiesta, 99,500 miles, MOT expired 28 Oct 2026).
const fiesta = {
  priceAdjustments: [
    { label: "No valid MOT", impactPct: -20 },
    { label: "Several MOT advisories", impactPct: -0.7 },
    { label: "Serious MOT items (corrosion, leaks, brakes or suspension)", impactPct: -1.5 },
  ],
  motHistory: [{ date: "2025-10-17", expiryDate: "2026-10-28" }],
  factorsUp: ["Wet belt / cambelt replaced at 92k with receipt", "Full Ford main-dealer history (7 stamps)", "Perennially strong UK demand"],
  conditionScore: 7.2, conditionLabel: "Good", pricingSource: "valu8_comps",
  vehicle: { firstRegistered: "2017-12-22" },
};
const car = { year: 2017, mileage: 99500, model: "Fiesta · Zetec 1.0 EcoBoost", hasPhotos: true, modelName: "Fiesta" };

describe("priceMovers", () => {
  it("leads with the expired MOT and its real −20%", () => {
    const m = priceMovers(fiesta, car, NOW);
    expect(m[0]).toMatchObject({ key: "mot-expired", tone: "down", pct: -20 });
    expect(m[0].detail).toContain("28 Oct 2026");
  });
  it("groups the smaller MOT items into one line with their summed %", () => {
    const m = priceMovers(fiesta, car, NOW).find((x) => x.key === "mot-findings")!;
    expect(m.pct).toBe(-2.2);
  });
  it("explains high mileage for the age without inventing a %", () => {
    const m = priceMovers(fiesta, car, NOW).find((x) => x.key === "mileage")!;
    expect(m.tone).toBe("down"); expect(m.pct).toBeNull(); expect(m.detail).toMatch(/typical 2017/);
  });
  it("never leaves added details silent: names them and says they don't move the figure (legacy report)", () => {
    const m = priceMovers(fiesta, car, NOW).find((x) => x.key === "details")!;
    expect(m.detail).toContain("Wet belt"); expect(m.detail).not.toContain("demand"); expect(m.pct).toBeNull();
  });
  it("uses pf-1 trim and details effects when the engine stored them", () => {
    const m = priceMovers({ ...fiesta, priceFactors: { version: "pf-1", trimPct: -4.2, trimLabel: "Zetec", detailsPct: 2.1 } }, car, NOW);
    expect(m.find((x) => x.key === "trim")).toMatchObject({ label: "Trim: Zetec", tone: "down", pct: -4.2 });
    expect(m.find((x) => x.key === "details")).toMatchObject({ tone: "up", pct: 2.1 });
  });
  it("says photos didn't change an engine-priced figure", () => {
    expect(priceMovers(fiesta, car, NOW).find((x) => x.key === "photos")!.detail).toMatch(/didn't change/);
  });
  it("no MOT line when the MOT is valid; nothing for an unpriced car", () => {
    expect(motExpiredOn({ motHistory: [{ expiryDate: "2027-05-01" }] }, null, NOW)).toBeNull();
    expect(priceMovers({ ...fiesta, priceAdjustments: [], motHistory: [{ expiryDate: "2027-05-01" }] }, car, NOW).some((x) => x.key === "mot-expired")).toBe(false);
    expect(priceMovers({ valuationUnavailable: true }, car, NOW)).toEqual([]);
  });
  it("formats signed percentages", () => { expect(fmtPct(-20)).toBe("\u221220%"); expect(fmtPct(3.5)).toBe("+3.5%"); });
});

describe("pf-1 price factors", () => {
  it("null when the seller gave neither trim nor details", () => {
    expect(priceFactorsFrom({ full: 3000, noTrim: 3000, noDetails: 3000 })).toBeNull();
  });
  it("blends pm-1 and own-comps trim effects and scales details to pm-1's share", () => {
    const f = priceFactorsFrom({ full: 2900, noTrim: 3000, noDetails: 2800, ocTrimPct: -8, variant: "Zetec", details: "fsh" })!;
    expect(f.trimPct).toBeCloseTo(0.6 * -3.3 + 0.4 * -8, 1);
    expect(f.detailsPct).toBeCloseTo(0.6 * 3.6, 1);
  });
});

describe("pm-1 inference trim lookup (pm-trim-1)", () => {
  const base = { make: "FORD", model: "Fiesta", year: 2017, mileage: 99500, fuel: "Petrol", gearbox: "Manual", engine_cc: 998, seller: "private" as const };
  it("a blank trim is unknown (model average), not a one-advert bucket", () => {
    expect(inferenceTrimKey("ford|fiesta", "")).toBeNull();
    expect(pricePm({ ...base, variant: null }).known).toBe("model");
  });
  it("a typed trim with extra words finds its trim bucket", () => {
    expect(inferenceTrimKey("ford|fiesta", "Zetec 1.0 EcoBoost")).toBe("ford|fiesta|zetec");
    expect(pricePm({ ...base, variant: "Zetec 1.0 EcoBoost" }).known).toBe("trim");
  });
  it("adding trim and genuine history no longer drops the price vs a bare lookup", () => {
    const bare = pricePm({ ...base, variant: null }).price;
    const full = pricePm({ ...base, variant: "Zetec 1.0 EcoBoost", desc: "Full Ford service history, 7 stamps. Cambelt replaced at 92k." }).price;
    expect(full).toBeGreaterThanOrEqual(bare * 0.97);
  });
  it("training/parity featurize is unchanged without the inference flag", () => {
    const a = featurize({ ...base, variant: "" }); expect(a.known).toBe("trim");
  });
});
