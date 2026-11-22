import { describe, it, expect } from "vitest";
import { guestCaps, guestDecision, turnstileMode, turnstileRequired } from "../../supabase/functions/_shared/guestCap";

const envOf = (o: Record<string, string>) => (k: string) => o[k];

describe("guestCaps", () => {
  it("defaults: 3 per device, 15 per IP so a shared connection isn't capped at 3", () => {
    expect(guestCaps(envOf({}))).toMatchObject({ token: 3, ip: 15, premiumToken: 8, premiumIp: 16, mode: "token" });
  });
  it("relaxes the IP ceiling when Turnstile is on", () => {
    expect(guestCaps(envOf({ TURNSTILE_SECRET_KEY: "x" })).ip).toBe(60);
    expect(guestCaps(envOf({ TURNSTILE_SECRET_KEY: "x", TURNSTILE_MODE: "off" })).ip).toBe(15);
  });
  it("respects env overrides and never sets the IP ceiling below the token cap", () => {
    expect(guestCaps(envOf({ GUEST_DAILY_CAP: "5", GUEST_IP_DAILY_CAP: "2" })).ip).toBe(5);
    expect(guestCaps(envOf({ GUEST_IP_DAILY_CAP: "40" })).ip).toBe(40);
    expect(guestCaps(envOf({ GUEST_DAILY_CAP: "nope" })).token).toBe(3);
  });
  it("GUEST_CAP_MODE=ip restores the old per-IP behaviour", () => {
    expect(guestCaps(envOf({ GUEST_CAP_MODE: "ip" }))).toMatchObject({ token: 3, ip: 3, premiumIp: 16, mode: "ip" });
  });
});

describe("turnstile flag", () => {
  it("is off without a secret, whatever the mode", () => {
    expect(turnstileMode(envOf({ TURNSTILE_MODE: "all" }))).toBe("off");
    expect(turnstileRequired(envOf({}), false)).toBe(false);
  });
  it("defaults to guests only once a secret exists", () => {
    const e = envOf({ TURNSTILE_SECRET_KEY: "x" });
    expect(turnstileRequired(e, false)).toBe(true);
    expect(turnstileRequired(e, true)).toBe(false);
  });
  it("supports all and off", () => {
    expect(turnstileRequired(envOf({ TURNSTILE_SECRET_KEY: "x", TURNSTILE_MODE: "all" }), true)).toBe(true);
    expect(turnstileRequired(envOf({ TURNSTILE_SECRET_KEY: "x", TURNSTILE_MODE: "OFF" }), false)).toBe(false);
  });
});

describe("guestDecision", () => {
  it("free while both counters are under", () => {
    expect(guestDecision({ okToken: true, okIp: true, premiumIntent: false })).toBe("free");
  });
  it("blocks a used-up device unless they chose Premium", () => {
    expect(guestDecision({ okToken: false, okIp: true, premiumIntent: false })).toBe("blocked");
    expect(guestDecision({ okToken: false, okIp: true, premiumIntent: true, okPremiumToken: true, okPremiumIp: true })).toBe("premium");
    expect(guestDecision({ okToken: false, okIp: true, premiumIntent: true, okPremiumToken: false, okPremiumIp: true })).toBe("blocked");
  });
});
