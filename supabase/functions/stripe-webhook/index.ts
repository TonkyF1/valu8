// Valu8 — Stripe webhook (verify_jwt = false; authenticated by signature).
// Inactive until STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set.
// Syncs billing_customers and profiles.is_premium/plan via the service role.
import { adminClient, json, premiumEnforced } from "../_shared/guard.ts";
import { stripe, verifyStripeSignature } from "../_shared/stripe.ts";

const ACTIVE = new Set(["active", "trialing"]);

async function setPremium(userId: string, on: boolean) {
  // Sandbox: while PREMIUM_ENFORCED is off, never downgrade anyone.
  if (!on && !premiumEnforced()) return;
  await adminClient()!.from("profiles").update({ is_premium: on, plan: on ? "premium" : "free" }).eq("user_id", userId);
}

async function userForCustomer(customer: string): Promise<string | null> {
  const { data } = await adminClient()!.from("billing_customers").select("user_id").eq("stripe_customer_id", customer).maybeSingle();
  return (data?.user_id as string) ?? null;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret || !Deno.env.get("STRIPE_SECRET_KEY")) return json({ error: "billing inactive" }, 503);
  const payload = await req.text();
  if (!(await verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret))) return json({ error: "bad signature" }, 400);
  const event = JSON.parse(payload);
  const obj = event?.data?.object ?? {};
  try {
    const db = adminClient()!;
    switch (event.type) {
      case "checkout.session.completed": {
        const userId = obj.client_reference_id || obj.metadata?.user_id;
        if (!userId) break;
        let status = obj.mode === "payment" ? "active" : "incomplete";
        let periodEnd: string | null = null, priceId: string | null = null;
        if (obj.subscription) {
          const sub = await stripe(`subscriptions/${obj.subscription}`, undefined, "GET");
          status = sub.status; priceId = sub.items?.data?.[0]?.price?.id ?? null;
          const end = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
          periodEnd = end ? new Date(end * 1000).toISOString() : null;
        }
        await db.from("billing_customers").upsert({ user_id: userId, stripe_customer_id: obj.customer, stripe_subscription_id: obj.subscription ?? null, status, price_id: priceId, current_period_end: periodEnd });
        await setPremium(userId, ACTIVE.has(status));
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const userId = await userForCustomer(obj.customer);
        if (!userId) break;
        const status = event.type.endsWith("deleted") ? "canceled" : obj.status;
        const end = obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end;
        await db.from("billing_customers").update({ stripe_subscription_id: obj.id, status, price_id: obj.items?.data?.[0]?.price?.id ?? null, current_period_end: end ? new Date(end * 1000).toISOString() : null }).eq("user_id", userId);
        await setPremium(userId, ACTIVE.has(status));
        break;
      }
    }
    return json({ received: true });
  } catch (e) {
    console.error("stripe-webhook", e);
    return json({ error: "handler error" }, 500);
  }
});
