import { describe, expect, it } from "vitest";
import { aiSafetyCap } from "../../supabase/functions/_shared/aiCap";
import { coherentPricing } from "../../supabase/functions/_shared/coherentPricing";

const own = { privatePrice: 2000, level: "model", nComps: 120, confidenceScore: 0.7 };
describe("AI safety cap", () => {
  it("does not fire within the trigger", () => {
    expect(aiSafetyCap({ aiPrivate: 3500, own }).applied).toBe(false);
  });
  it("does not fire when own-comps is not confident", () => {
    expect(aiSafetyCap({ aiPrivate: 9000, own: { ...own, nComps: 20 } }).applied).toBe(false);
    expect(aiSafetyCap({ aiPrivate: 9000, own: { ...own, confidenceScore: 0.4 } }).applied).toBe(false);
    expect(aiSafetyCap({ aiPrivate: 9000, own: { ...own, level: "make_segment" } }).applied).toBe(false);
    expect(aiSafetyCap({ aiPrivate: 9000, own: null }).applied).toBe(false);
  });
  it("caps a clear blowup to 1.6x own-comps and keeps the price model coherent", () => {
    const c = aiSafetyCap({ aiPrivate: 9000, own });
    expect(c.applied).toBe(true);
    expect(c.capped).toBe(3200);
    const k = c.capped / 9000;
    const p = coherentPricing({ privateSale: c.capped, tradeIn: 7600 * k, retail: 11000 * k, privateLow: 8200 * k, privateHigh: 9800 * k });
    expect(p.privateLow).toBeLessThanOrEqual(p.privateSale);
    expect(p.privateHigh).toBeGreaterThanOrEqual(p.privateSale);
    expect(p.tradeIn).toBeLessThan(p.privateLow);
    expect(p.retail).toBeGreaterThanOrEqual(p.askHigh);
  });
});
