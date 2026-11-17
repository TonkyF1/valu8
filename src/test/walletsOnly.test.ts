import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const fn = readFileSync("supabase/functions/create-checkout-session/index.ts", "utf8");
const ui = readFileSync("src/components/ReportCheckout.tsx", "utf8");

describe("£2.99 checkout: card + Apple Pay / Google Pay only", () => {
  it("session is card-only (no Link, Klarna, Amazon Pay)", () => {
    expect(fn).toMatch(/"payment_method_types\[0\]": "card"/);
    expect(fn).not.toMatch(/payment_method_types\[1\]/);
  });
  it("price is unchanged", () => {
    expect(fn).toMatch(/price_1UYCy92Eh7OGTq97k6YAUz9I/);
    expect(fn).toMatch(/"line_items\[0\]\[quantity\]": "1"/);
  });
  it("express element requests Apple Pay and Google Pay and hides the rest", () => {
    expect(ui).toMatch(/applePay: "always", googlePay: "always", link: "never", klarna: "never", amazonPay: "never", paypal: "never"/);
  });
  it("payment element is the card form only", () => {
    expect(ui).toMatch(/wallets: \{ applePay: "never", googlePay: "never", link: "never" \}/);
  });
});
