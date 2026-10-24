/**
 * Valu8 entitlements — which features need which purchase.
 *
 * Pure, side-effect-free mapping used by future lock UI. NOT wired into any page yet.
 *
 * Safety: while premium enforcement is off (default), EVERY feature is unlocked for
 * everyone. Enforcement is only on when VITE_PREMIUM_ENFORCED === "true" (mirrors the
 * server-side PREMIUM_ENFORCED flag in supabase/functions/_shared/guard.ts). This file is
 * cosmetic only: real gating must always happen server-side in edge functions.
 *
 * Prices are placeholders — see docs/monetisation/copy.md.
 */

export type Plan = "free" | "report" | "subscription" | "seller_pack";

export type Feature =
  // Free forever
  | "basic_valuation"
  | "mot_summary"
  | "advert_check"
  // Full Report (per car) — also included with the buyer subscription
  | "mot_red_flags"
  | "recall_check"
  | "fair_price_verdict"
  | "offer_guidance"
  | "seller_questions"
  // Buyer subscription
  | "unlimited_advert_checks"
  | "saved_cars"
  | "price_alerts"
  // Seller pack (per car)
  | "asking_price"
  | "advert_text";

/** Which plan unlocks a feature. "free" = never locked. */
export const FEATURE_PLAN: Readonly<Record<Feature, Plan>> = Object.freeze({
  basic_valuation: "free",
  mot_summary: "free",
  advert_check: "free",
  mot_red_flags: "report",
  recall_check: "report",
  fair_price_verdict: "report",
  offer_guidance: "report",
  seller_questions: "report",
  unlimited_advert_checks: "subscription",
  saved_cars: "subscription",
  price_alerts: "subscription",
  asking_price: "seller_pack",
  advert_text: "seller_pack",
});

/** Placeholder prices in pence (GBP). Display only — Stripe Price IDs are the source of truth. */
export const PLAN_PRICE_PENCE: Readonly<Record<Exclude<Plan, "free">, number>> = Object.freeze({
  report: 499,
  subscription: 799, // per month
  seller_pack: 499,
});

/** Free daily allowances (mirror the server caps; server is authoritative). */
export const FREE_LIMITS = Object.freeze({
  guestValuationsPerDay: 3,
  advertChecksPerDay: 10,
});

/**
 * Open decision (placeholder): does the buyer subscription also unlock the Full Report
 * sections on every car? Default yes — subscribers are buyers checking several cars.
 */
export const SUBSCRIPTION_INCLUDES_REPORT = true;

export interface EntitlementContext {
  /** Override enforcement (tests / admin preview). Defaults to VITE_PREMIUM_ENFORCED. */
  enforced?: boolean;
  isAdmin?: boolean;
  /** Active or trialing buyer subscription. */
  subscriptionActive?: boolean;
  /** The car (valuation id or advert-check id) being viewed, for per-car purchases. */
  itemId?: string | null;
  /** Ids with a purchased Full Report. */
  reportItemIds?: ReadonlyArray<string>;
  /** Ids with a purchased Seller pack. */
  sellerPackItemIds?: ReadonlyArray<string>;
}

export interface Entitlement {
  allowed: boolean;
  /** The plan that unlocks it (also set when allowed, for badges). */
  plan: Plan;
  reason: "free" | "not_enforced" | "admin" | "subscription" | "purchased" | "locked";
}

export function premiumEnforced(): boolean {
  try {
    return String(import.meta.env?.VITE_PREMIUM_ENFORCED ?? "").toLowerCase() === "true";
  } catch {
    return false;
  }
}

const has = (ids: ReadonlyArray<string> | undefined, id: string | null | undefined) =>
  !!id && !!ids && ids.includes(id);

export function entitlementFor(feature: Feature, ctx: EntitlementContext = {}): Entitlement {
  const plan = FEATURE_PLAN[feature] ?? "free";
  if (plan === "free") return { allowed: true, plan, reason: "free" };
  const enforced = ctx.enforced ?? premiumEnforced();
  if (!enforced) return { allowed: true, plan, reason: "not_enforced" };
  if (ctx.isAdmin) return { allowed: true, plan, reason: "admin" };

  switch (plan) {
    case "subscription":
      return ctx.subscriptionActive
        ? { allowed: true, plan, reason: "subscription" }
        : { allowed: false, plan, reason: "locked" };
    case "report":
      if (ctx.subscriptionActive && SUBSCRIPTION_INCLUDES_REPORT) return { allowed: true, plan, reason: "subscription" };
      return has(ctx.reportItemIds, ctx.itemId)
        ? { allowed: true, plan, reason: "purchased" }
        : { allowed: false, plan, reason: "locked" };
    case "seller_pack":
      return has(ctx.sellerPackItemIds, ctx.itemId)
        ? { allowed: true, plan, reason: "purchased" }
        : { allowed: false, plan, reason: "locked" };
  }
}

export function canUse(feature: Feature, ctx?: EntitlementContext): boolean {
  return entitlementFor(feature, ctx).allowed;
}

/** All features a plan unlocks (for pricing tables / matrices). */
export function featuresForPlan(plan: Plan): Feature[] {
  return (Object.keys(FEATURE_PLAN) as Feature[]).filter((f) => FEATURE_PLAN[f] === plan);
}

/** "£4.99" style label from pence. */
export function formatPence(p: number): string {
  return `£${(p / 100).toFixed(2)}`;
}
