// Valu8 — "Share with a friend. When they value their car, your full report is free."
// POST { action: "link", valuationId, guestToken? }      -> { code, redeemed }   (owner only)
// POST { action: "complete", code, valuationId, guestToken? } -> { ok, reason? } (friend's own valuation)
// Ownership = signed-in user id, or the guest token whose SHA-256 is stored on the valuation.
// Writes only referral_shares (service role). Pricing is never touched.
import { adminClient, clientIp, corsHeaders, guard, json } from "../_shared/guard.ts";
import { GUEST_TOKEN_RE, sha256Hex } from "../_shared/adverts.ts";
import { newShareCode, redeemBlock, SHARE_CODE_RE, type Owned } from "../_shared/referral.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLS = "id, user_id, guest_token_hash, registration, created_at";

async function ownedValuation(db: any, id: string, userId: string | null, guestToken: unknown): Promise<Owned | null> {
  const { data } = await db.from("valuations").select(COLS).eq("id", id).maybeSingle();
  if (!data) return null;
  if (userId && data.user_id === userId) return data as Owned;
  if (!data.user_id && typeof guestToken === "string" && GUEST_TOKEN_RE.test(guestToken) && data.guest_token_hash === await sha256Hex(guestToken)) return data as Owned;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const g = await guard(req, { feature: "referral", perMinute: 20, perDay: 200, ipPerHour: 60 });
  if (g.response) return g.response;
  const db = adminClient();
  if (!db) return json({ error: "unavailable" }, 503);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const valuationId = String(body?.valuationId ?? "");
  if (!UUID.test(valuationId)) return json({ error: "Invalid valuation." }, 400);
  const ipHash = await sha256Hex(`valu8-ref:${clientIp(req)}`);

  try {
    if (body?.action === "link") {
      const v = await ownedValuation(db, valuationId, g.userId, body?.guestToken);
      if (!v) return json({ error: "Not your valuation." }, 403);
      const { data: existing } = await db.from("referral_shares").select("code, redeemed_at").eq("valuation_id", v.id).maybeSingle();
      if (existing) return json({ code: existing.code, redeemed: !!existing.redeemed_at });
      for (let i = 0; i < 3; i++) {
        const code = newShareCode();
        const { error } = await db.from("referral_shares").insert({ code, valuation_id: v.id, ip_hash: ipHash });
        if (!error) return json({ code, redeemed: false });
        // Lost a race on valuation_id: return the row that won.
        const { data: again } = await db.from("referral_shares").select("code, redeemed_at").eq("valuation_id", v.id).maybeSingle();
        if (again) return json({ code: again.code, redeemed: !!again.redeemed_at });
      }
      return json({ error: "Could not create a link." }, 500);
    }

    if (body?.action === "complete") {
      const code = String(body?.code ?? "").toLowerCase();
      if (!SHARE_CODE_RE.test(code)) return json({ ok: false, reason: "bad_code" });
      const friend = await ownedValuation(db, valuationId, g.userId, body?.guestToken);
      if (!friend) return json({ ok: false, reason: "not_owner" });
      const { data: share } = await db.from("referral_shares").select("code, valuation_id, ip_hash, created_at, redeemed_at").eq("code", code).maybeSingle();
      if (!share) return json({ ok: false, reason: "unknown_code" });
      const { data: sharer } = await db.from("valuations").select(COLS).eq("id", share.valuation_id).maybeSingle();
      if (!sharer) return json({ ok: false, reason: "unknown_code" });
      // A friend's valuation must have a real price (a failed lookup doesn't count).
      const { data: priced } = await db.from("valuations").select("id").eq("id", friend.id).gt("private_value", 0).maybeSingle();
      if (!priced) return json({ ok: false, reason: "not_priced" });
      const reason = redeemBlock({ share, sharer: sharer as Owned, friend, ipHash });
      if (reason) return json({ ok: false, reason });
      const { data: done, error } = await db.from("referral_shares")
        .update({ friend_valuation_id: friend.id, redeemed_at: new Date().toISOString() })
        .eq("code", code).is("redeemed_at", null).select("code");
      if (error) return json({ ok: false, reason: "used_friend_valuation" });
      return json({ ok: !!(done && done.length), reason: done && done.length ? undefined : "already_redeemed" });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    console.error("referral", e);
    return json({ error: "Something went wrong." }, 500);
  }
});
