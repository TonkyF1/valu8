import { describe, expect, it, vi } from "vitest";
import { getConsent, onConsentChange, resetConsent, setConsent } from "@/lib/consent";

describe("consent", () => {
  it("defaults to null and persists choices", () => {
    resetConsent();
    expect(getConsent()).toBeNull();
    setConsent("granted");
    expect(getConsent()).toBe("granted");
    setConsent("denied");
    expect(getConsent()).toBe("denied");
  });
  it("notifies listeners", () => {
    const cb = vi.fn();
    const off = onConsentChange(cb);
    setConsent("granted");
    off();
    setConsent("denied");
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("granted");
  });
});
