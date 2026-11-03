import { describe, it, expect } from "vitest";
import { showPremiumReport, canUse } from "@/lib/entitlements";

describe("showPremiumReport", () => {
  it("is off for everyone while charging is off", () => {
    expect(showPremiumReport({ enforced: false, isAdmin: true, subscriptionActive: true, itemId: "a", reportItemIds: ["a"] })).toBe(false);
    expect(showPremiumReport()).toBe(false);
    expect(canUse("premium_report", { enforced: false })).toBe(true); // feature access unchanged
  });
  it("needs a real entitlement once enforced", () => {
    expect(showPremiumReport({ enforced: true })).toBe(false);
    expect(showPremiumReport({ enforced: true, itemId: "a", reportItemIds: ["b"] })).toBe(false);
    expect(showPremiumReport({ enforced: true, itemId: "a", reportItemIds: ["a"] })).toBe(true);
    expect(showPremiumReport({ enforced: true, subscriptionActive: true })).toBe(true);
    expect(showPremiumReport({ enforced: true, isAdmin: true })).toBe(true);
  });
});
