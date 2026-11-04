// Valu8 — Stripe Embedded Checkout session for the one-off £2.99 Full Valuation Report.
// Public (guests can buy; the valuation UUID is unguessable). Inactive (503) until
// PREMIUM_ENFORCED=true AND STRIPE_SECRET_KEY is set. Returns { clientSecret }.
// Entitlement is granted ONLY by stripe-webhook (checkout.session.completed).
import { adminClient, corsHeaders, guard, json, premiumEnforced } from "../_shared/guard.ts";
import { siteUrl, stripe, stripeConfigured } from "../_shared/stripe.ts";

// Live price "Full Valuation Report" £2.99 GBP one-off. Override with STRIPE_REPORT_PRICE_ID.
const DEFAULT_REPORT_PRICE = "price_1UYCy92Eh7OGTq97k6YAUz9I";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  // Checkout-only switch. The global PREMIUM_ENFORCED also gates analyse-vehicle/fair-price
  // (free valuations), so it is NOT required here. Flip REPORT_CHECKOUT_DEFAULT to true (or set
  // REPORT_CHECKOUT_ENABLED=true) once STRIPE_SECRET_KEY holds a real sk_live_/rk_live_ key.
  const REPORT_CHECKOUT_DEFAULT = "true";
  const checkoutOn = premiumEnforced() || (Deno.env.get("REPORT_CHECKOUT_ENABLED") ?? REPORT_CHECKOUT_DEFAULT).toLowerCase() === "true";
  if (!checkoutOn || !stripeConfigured()) {
    return json({ error: "Payments are not enabled yet.", code: "billing_inactive" }, 503);
  }
  const g = await guard(req, { feature: "report-checkout", perMinute: 5, perDay: 30, ipPerHour: 30 });
  if (g.response) return g.response;

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const valuationId = String(body?.valuationId ?? "");
  if (!UUID.test(valuationId)) return json({ error: "Invalid valuation." }, 400);

  try {
    const db = adminClient()!;
    const { data: v } = await db.from("valuations").select("id, registration").eq("id", valuationId).maybeSingle();
    if (!v) return json({ error: "Valuation not found." }, 404);
    const { data: paid } = await db.from("report_purchases").select("id").eq("valuation_id", valuationId).eq("status", "paid").limit(1);
    if (paid && paid.length) return json({ alreadyPaid: true });

    const reg = String(v.registration ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    const priceId = Deno.env.get("STRIPE_REPORT_PRICE_ID") || DEFAULT_REPORT_PRICE;
    const base = siteUrl(req).replace(/\/$/, "");
    const session = await stripe("checkout/sessions", {
      ui_mode: "embedded",
      mode: "payment",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      // No payment_method_types => Stripe "automatic payment methods" (card, Apple Pay,
      // Google Pay, Link…) as enabled in Dashboard → Settings → Payment methods.
      client_reference_id: valuationId,
      "metadata[kind]": "full_report",
      "metadata[valuation_id]": valuationId,
      "metadata[reg]": reg || undefined,
      "metadata[price_id]": priceId,
      "metadata[user_id]": g.userId ?? undefined,
      "payment_intent_data[metadata][valuation_id]": valuationId,
      "payment_intent_data[metadata][reg]": reg || undefined,
      return_url: `${base}/valuation/${valuationId}?session_id={CHECKOUT_SESSION_ID}`,
    });
    return json({ clientSecret: session.client_secret });
  } catch (e) {
    console.error("create-checkout-session", e);
    return json({ error: "Could not start checkout." }, 500);
  }
});
