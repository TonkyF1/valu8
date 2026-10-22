// Valu8 — create a Stripe Checkout session for Premium. Inactive (503) until
// STRIPE_SECRET_KEY and STRIPE_PRICE_ID are set.
import { adminClient, corsHeaders, guard, json } from "../_shared/guard.ts";
import { siteUrl, stripe, stripeConfigured } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const g = await guard(req, { feature: "checkout", requireUser: true, perMinute: 5, perDay: 20 });
  if (g.response) return g.response;
  const price = Deno.env.get("STRIPE_PRICE_ID");
  if (!stripeConfigured() || !price) return json({ error: "Payments are not enabled yet.", code: "billing_inactive" }, 503);
  try {
    const db = adminClient()!;
    const { data: u } = await db.auth.admin.getUserById(g.userId!);
    const { data: existing } = await db.from("billing_customers").select("stripe_customer_id").eq("user_id", g.userId!).maybeSingle();
    let customer = existing?.stripe_customer_id as string | undefined;
    if (!customer) {
      const c = await stripe("customers", { email: u?.user?.email ?? undefined, "metadata[user_id]": g.userId! });
      customer = c.id;
      await db.from("billing_customers").upsert({ user_id: g.userId!, stripe_customer_id: customer });
    }
    const base = siteUrl(req);
    const session = await stripe("checkout/sessions", {
      mode: Deno.env.get("STRIPE_MODE") === "payment" ? "payment" : "subscription",
      customer,
      client_reference_id: g.userId!,
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      success_url: `${base}/dashboard?billing=success`,
      cancel_url: `${base}/pricing?billing=cancelled`,
      allow_promotion_codes: "true",
      "metadata[user_id]": g.userId!,
    });
    return json({ url: session.url });
  } catch (e) {
    console.error("stripe-checkout", e);
    return json({ error: "Could not start checkout." }, 500);
  }
});
