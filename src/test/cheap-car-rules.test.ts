import { describe, it, expect } from "vitest";
import {
  applyCheapCarRules, aiPathAdjustments, finalisePricing, motPenaltyItems, declaredStatusItems,
  BUDGET_CAP_LABEL, BUDGET_STACK_CAP, type LedgerItem,
} from "../../supabase/functions/_shared/pricing";
import { compSearchModels } from "../../supabase/functions/_shared/vehicle-text";

const A = (label: string, impactPct: number): LedgerItem => ({ label, impactPct, scope: "anchor" });
const R = (label: string, impactPct: number): LedgerItem => ({ label, impactPct, scope: "retail" });
const budget = A("Budget market: priced on lower-middle of comparables", -9);
const sumAll = (items: LedgerItem[]) => items.filter((i) => i.scope !== "private").reduce((s, i) => s + i.impactPct, 0);

describe("cheap-car stacking cap (v2.2 rerun: DE61HGL -37%, CU08ZZK -30%)", () => {
  it("caps budget anchor + soft MOT/description deductions at -12% (Peugeot 3008 DE61HGL)", () => {
    const items = [budget, R("Recent MOT failure(s)", -6), R("6 current advisories", -3), R("Issues noted in description", -4)];
    const out = applyCheapCarRules(items, { anchor: 1800, correctedMedian: 2000 });
    expect(out.find((i) => i.label === BUDGET_CAP_LABEL)?.impactPct).toBe(10);
    expect(sumAll(out)).toBe(BUDGET_STACK_CAP);
  });
  it("never undoes the budget anchor itself (Golf NL61TWY: anchor -17)", () => {
    const items = [A("Budget market: priced on lower-middle of comparables", -17), R("Serious corrosion on MOT (1)", -7), R("Recent MOT failure(s)", -5)];
    const out = applyCheapCarRules(items, { anchor: 1700, correctedMedian: 2050 });
    expect(out.find((i) => i.label === BUDGET_CAP_LABEL)?.impactPct).toBe(12);
    expect(sumAll(out)).toBe(-17);
  });
  it("leaves declared write-off / spares / no-MOT / condition deductions uncapped", () => {
    const items = [budget, R("Recent MOT failure(s)", -6), R("Failed latest MOT — no valid MOT", -20), R("Sold as spares or repair", -30), R("Insurance write-off (Cat S)", -25), R("Condition deductions (5.0/10)", -17)];
    const out = applyCheapCarRules(items, { anchor: 1800, correctedMedian: 2000 });
    expect(out.find((i) => i.label === BUDGET_CAP_LABEL)?.impactPct).toBe(3);
  });
  it("does nothing without a budget anchor or above £3k corrected median", () => {
    const items = [R("Recent MOT failure(s)", -6), R("6 current advisories", -3), R("Issues noted in description", -4)];
    expect(applyCheapCarRules(items, { anchor: 1800, correctedMedian: 2000 })).toEqual(items);
    expect(applyCheapCarRules([budget, ...items], { anchor: 3400, correctedMedian: 3600 })).toEqual([budget, ...items]);
  });
  it("does nothing when the stack is already within the cap", () => {
    const items = [budget, R("Recent MOT failure(s)", -3)];
    expect(applyCheapCarRules(items, { anchor: 1800, correctedMedian: 2000 })).toEqual(items);
  });
});

describe("no history / recent-work uplift under ~£2k private (Sandero SD16SYC +59%)", () => {
  const items = [A("Budget market: priced on lower-middle of comparables", -13), R("Recent MOT failure(s)", -6), R("Full service history", 6), R("Recent major mechanical work", 5), R("Desirable spec / options", 3)];
  it("drops service-history and recent-work uplifts when private value < £2k", () => {
    const out = applyCheapCarRules(items, { anchor: 2150, correctedMedian: 2450 });
    expect(out.map((i) => i.label)).not.toContain("Full service history");
    expect(out.map((i) => i.label)).not.toContain("Recent major mechanical work");
    expect(out.map((i) => i.label)).toContain("Desirable spec / options");
    const l = finalisePricing({ anchor: 2150, miles: 110727, items: out });
    const before = finalisePricing({ anchor: 2150, miles: 110727, items });
    expect(l.privateSale).toBeLessThan(before.privateSale);
  });
  it("keeps them on dearer cars", () => {
    const out = applyCheapCarRules(items, { anchor: 6000, correctedMedian: 6000 });
    expect(out.map((i) => i.label)).toContain("Full service history");
  });
});

describe("AI-only path gets the same post-adjustments", () => {
  const failTests = [{ date: "2026-09-01", result: "Fail", advisories: ["Nearside sill corroded but not seriously weakened"], failures: ["Brake pipe excessively corroded"] }];
  it("applies a declared write-off from the ad text (VW Up GU13EKO)", () => {
    const declared = declaredStatusItems("This vehicle was bumped and written off ... fully repaired");
    const p = aiPathAdjustments({ motItems: [], failedNoMot: false, declared, clocking: false, privateEstimate: 2500 });
    expect(p.netPct).toBe(-18);
    expect(p.factor).toBeCloseTo(0.82);
  });
  it("applies MOT penalties, failed-MOT-no-MOT and spares", () => {
    const p = aiPathAdjustments({
      motItems: motPenaltyItems(failTests, "2026-10-23"), failedNoMot: true,
      declared: declaredStatusItems("spares or repair"), clocking: false, privateEstimate: 3000,
    });
    expect(p.items.map((i) => i.label)).toEqual(expect.arrayContaining(["Recent MOT failure(s)", "Failed latest MOT — no valid MOT", "Sold as spares or repair"]));
    expect(p.netPct).toBe(-45); // capped at RETAIL_NET_MIN
  });
  it("applies the clocking penalty", () => {
    expect(aiPathAdjustments({ motItems: [], failedNoMot: false, declared: [], clocking: true, motMax: 88959, privateEstimate: 3000 }).netPct).toBe(-15);
  });
  it("caps soft MOT deductions at -12% for sub-£2k cars", () => {
    const motItems = [R("Recent MOT failure(s)", -6), R("Minor corrosion advisories (3)", -5), R("7 current advisories", -3)];
    expect(aiPathAdjustments({ motItems, failedNoMot: false, declared: [], clocking: false, privateEstimate: 1500 }).netPct).toBe(-12);
    expect(aiPathAdjustments({ motItems, failedNoMot: false, declared: [], clocking: false, privateEstimate: 4000 }).netPct).toBe(-14);
  });
  it("never adds value and is a no-op with no signals", () => {
    const p = aiPathAdjustments({ motItems: [], failedNoMot: false, declared: [], clocking: false, privateEstimate: 2000 });
    expect(p).toMatchObject({ netPct: 0, factor: 1, items: [] });
  });
});

describe("listing-feed model aliases (no-comps cars in batch 5)", () => {
  it("Ford Grand C-Max tries C-MAX spellings and never bare 'Grand'", () => {
    const m = compSearchModels("FORD", "Grand C-Max");
    expect(m).toEqual(["Grand C-Max", "Grand C-MAX", "C-MAX"]);
  });
  it("VW Up tries up!", () => {
    expect(compSearchModels("VOLKSWAGEN", "Up")).toEqual(["Up", "up!"]);
  });
});
