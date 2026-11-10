// Valu8 — is the Full Report for this valuation unlocked? Reads report_purchases (written only by
// stripe-webhook) and referral_shares (written only by the referral function) via the service role.
// The report unlocks from THIS, never from a return URL.
// Public: the valuation UUID is unguessable and only a boolean (plus how) is returned.
import { adminClient, corsHeaders, json } from "../_shared/guard.ts";
import { reportEntitlement } from "../_shared/entitlement.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const db = adminClient();
  if (!db) return json({ paid: false });
  return json(await reportEntitlement(db, String(body?.valuationId ?? "")));
});
