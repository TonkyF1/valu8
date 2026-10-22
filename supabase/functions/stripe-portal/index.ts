// Valu8 — Stripe customer portal link. Inactive until STRIPE_SECRET_KEY is set.
import { adminClient, corsHeaders, guard, json } from "../_shared/guard.ts";
import { siteUrl, stripe, stripeConfigured } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const g = await guard(req, { feature: "portal", requireUser: true, perMinute: 5, perDay: 30 });
  if (g.response) return g.response;
  if (!stripeConfigured()) return json({ error: "Payments are not enabled yet.", code: "billing_inactive" }, 503);
  try {
    const { data } = await adminClient()!.from("billing_customers").select("stripe_customer_id").eq("user_id", g.userId!).maybeSingle();
    if (!data?.stripe_customer_id) return json({ error: "No billing account found." }, 404);
    const s = await stripe("billing_portal/sessions", { customer: data.stripe_customer_id, return_url: `${siteUrl(req)}/profile` });
    return json({ url: s.url });
  } catch (e) {
    console.error("stripe-portal", e);
    return json({ error: "Could not open billing portal." }, 500);
  }
});
