// Valu8 — is the Full Report for this valuation unlocked? Reads report_purchases (written only by
// stripe-webhook) and referral_shares (written only by the referral function) via the service role.
// The report unlocks from THIS, never from a return URL.
// Public: the valuation UUID is unguessable and only a boolean (plus how) is returned.
import { adminClient, corsHeaders, json } from "../_shared/guard.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const valuationId = String(body?.valuationId ?? "");
  if (!UUID.test(valuationId)) return json({ paid: false });
  const db = adminClient();
  if (!db) return json({ paid: false });
  const [{ data }, { data: ref }] = await Promise.all([
    db.from("report_purchases").select("id").eq("valuation_id", valuationId).eq("status", "paid").limit(1),
    db.from("referral_shares").select("code").eq("valuation_id", valuationId).not("redeemed_at", "is", null).limit(1),
  ]);
  if (data && data.length) return json({ paid: true, via: "purchase" });
  if (ref && ref.length) return json({ paid: true, via: "referral" });
  return json({ paid: false });
});
