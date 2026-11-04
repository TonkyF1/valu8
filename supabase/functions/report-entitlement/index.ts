// Valu8 — is the Full Report for this valuation paid? Reads report_purchases (written only by
// stripe-webhook) via the service role. The report unlocks from THIS, never from a return URL.
// Public: the valuation UUID is unguessable and only a boolean is returned.
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
  const { data } = await db.from("report_purchases").select("id").eq("valuation_id", valuationId).eq("status", "paid").limit(1);
  return json({ paid: !!(data && data.length) });
});
