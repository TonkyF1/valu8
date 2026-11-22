// Guest valuation caps: per device token first, with a looser per-IP ceiling as a backstop.
//
// Before (audit, 21 Nov 2026): the 3-a-day free cap was applied to the IP AND the device token at the same
// number, so everyone behind one IP (mobile carrier NAT, an office, a household, a café) shared 3 valuations.
// Now the device token carries the real cap (GUEST_DAILY_CAP, default 3) and the IP only gets a ceiling
// high enough for shared connections (GUEST_IP_DAILY_CAP, default 15) that still stops one person clearing
// localStorage over and over. When Turnstile is switched on (TURNSTILE_SECRET_KEY set and TURNSTILE_MODE not
// "off"), minting fresh tokens costs a human check, so the IP ceiling relaxes further (GUEST_IP_DAILY_CAP_TS,
// default 60). GUEST_CAP_MODE=ip restores the old behaviour without a code change.
//
// Pure (env is passed in) so it's unit-tested from the frontend test runner.

export type Env = (name: string) => string | undefined;

const int = (env: Env, name: string, fallback: number) => {
  const n = Number.parseInt(env(name) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export type TurnstileMode = "off" | "guests" | "all";

/**
 * Whether Turnstile is enforced for this caller.
 *  - No TURNSTILE_SECRET_KEY: never (inactive until keys exist).
 *  - TURNSTILE_MODE=off: never (kill switch, e.g. if Cloudflare has an outage).
 *  - TURNSTILE_MODE=all: everyone.
 *  - default "guests": only signed-out callers (signed-in users are already capped per account, and some
 *    signed-in pages don't render the widget).
 */
export function turnstileMode(env: Env): TurnstileMode {
  if (!env("TURNSTILE_SECRET_KEY")) return "off";
  const m = (env("TURNSTILE_MODE") ?? "").trim().toLowerCase();
  return m === "off" || m === "all" ? m : "guests";
}
export function turnstileRequired(env: Env, signedIn: boolean): boolean {
  const m = turnstileMode(env);
  return m === "all" || (m === "guests" && !signedIn);
}

export interface GuestCaps {
  /** Free valuations per device token per day. */
  token: number;
  /** Free valuations per IP per day (shared-connection ceiling). */
  ip: number;
  /** Paid (Premium intent) valuations per token / per IP per day once the free cap is used. */
  premiumToken: number;
  premiumIp: number;
  mode: "token" | "ip";
}

export function guestCaps(env: Env): GuestCaps {
  const token = int(env, "GUEST_DAILY_CAP", 3);
  const premiumToken = int(env, "GUEST_PREMIUM_CAP", 8);
  const legacy = (env("GUEST_CAP_MODE") ?? "").trim().toLowerCase() === "ip";
  if (legacy) return { token, ip: token, premiumToken, premiumIp: premiumToken * 2, mode: "ip" };
  const ts = turnstileMode(env) !== "off";
  const ip = Math.max(token, ts ? int(env, "GUEST_IP_DAILY_CAP_TS", 60) : int(env, "GUEST_IP_DAILY_CAP", 15));
  return { token, ip, premiumToken, premiumIp: Math.max(premiumToken * 2, ip), mode: "token" };
}

export type GuestDecision = "free" | "premium" | "blocked";

/** Combine the limit-counter results into one decision. */
export function guestDecision(r: { okToken: boolean; okIp: boolean; premiumIntent: boolean; okPremiumToken?: boolean; okPremiumIp?: boolean }): GuestDecision {
  if (r.okToken && r.okIp) return "free";
  if (!r.premiumIntent) return "blocked";
  return r.okPremiumToken !== false && r.okPremiumIp !== false ? "premium" : "blocked";
}
