import { describe, it, expect } from "vitest";
import { FEATURE_PLAN, entitlementFor, canUse, featuresForPlan, formatPence, premiumEnforced, type Feature } from "@/lib/entitlements";

const ALL = Object.keys(FEATURE_PLAN) as Feature[];

describe("entitlements", () => {
  it("is off by default: env flag unset means not enforced", () => {
    expect(premiumEnforced()).toBe(false);
  });

  it("unlocks every feature for everyone while enforcement is off", () => {
    for (const f of ALL) {
      expect(canUse(f)).toBe(true);
      expect(canUse(f, { enforced: false })).toBe(true);
    }
  });

  it("keeps free features free when enforced", () => {
    for (const f of featuresForPlan("free")) {
      expect(entitlementFor(f, { enforced: true })).toEqual({ allowed: true, plan: "free", reason: "free" });
    }
    expect(featuresForPlan("free")).toEqual(expect.arrayContaining(["basic_valuation", "mot_summary", "advert_check"]));
  });

  it("locks paid features for a free user when enforced", () => {
    for (const f of ALL.filter((x) => FEATURE_PLAN[x] !== "free")) {
      expect(entitlementFor(f, { enforced: true }).reason).toBe("locked");
    }
  });

  it("admins see everything", () => {
    for (const f of ALL) expect(canUse(f, { enforced: true, isAdmin: true })).toBe(true);
  });

  it("a Full Report unlocks report sections for that car only", () => {
    const ctx = { enforced: true, itemId: "car-1", reportItemIds: ["car-1"] };
    expect(entitlementFor("mot_red_flags", ctx)).toEqual({ allowed: true, plan: "report", reason: "purchased" });
    expect(canUse("offer_guidance", { ...ctx, itemId: "car-2" })).toBe(false);
    expect(canUse("saved_cars", ctx)).toBe(false);
    expect(canUse("advert_text", ctx)).toBe(false);
  });

  it("subscription unlocks buyer tools and report sections, not the seller pack", () => {
    const ctx = { enforced: true, subscriptionActive: true, itemId: "car-9" };
    expect(canUse("unlimited_advert_checks", ctx)).toBe(true);
    expect(canUse("price_alerts", ctx)).toBe(true);
    expect(canUse("recall_check", ctx)).toBe(true);
    expect(canUse("asking_price", ctx)).toBe(false);
  });

  it("seller pack is per car", () => {
    const ctx = { enforced: true, itemId: "v1", sellerPackItemIds: ["v1"] };
    expect(canUse("asking_price", ctx)).toBe(true);
    expect(canUse("advert_text", { ...ctx, itemId: "v2" })).toBe(false);
  });

  it("formats prices", () => {
    expect(formatPence(499)).toBe("£4.99");
    expect(formatPence(799)).toBe("£7.99");
  });
});
