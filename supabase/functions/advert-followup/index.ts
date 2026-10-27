// Valu8 — "Did you buy it?" follow-ups for advert checks (in-app only).
// Signed-in users match on user_id; guests match on the SHA-256 hash of their guest token.
// actions: "due" → list checks that need asking (and stamp followup_sent_at)
//          "answer" → record bought / not_bought / still_looking
import { corsHeaders, guard, json, adminClient } from "../_shared/guard.ts";
import { sha256Hex, GUEST_TOKEN_RE } from "../_shared/adverts.ts";

const DAY = 86400_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ASKS = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const g = await guard(req, { feature: "advert-followup", requireUser: false, perMinute: 20, ipPerHour: 120 });
  if (g.response) return g.response;
  try {
    const b = await req.json().catch(() => null);
    const admin = adminClient();
    if (!admin) return json({ error: "Please try again later." }, 500);
    let hash: string | null = null;
    if (!g.userId) {
      if (typeof b?.guestToken !== "string" || !GUEST_TOKEN_RE.test(b.guestToken)) return json({ items: [] });
      hash = await sha256Hex(b.guestToken);
    }
    const scope = (q: any) => (g.userId ? q.eq("user_id", g.userId) : q.eq("guest_token_hash", hash).is("user_id", null));

    if (b?.action === "due") {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 7 * DAY).toISOString();
      const { data, error } = await scope(admin.from("advert_checks")
        .select("id, make, model, year, asking_price, followup_sent_at, followup_answered_at, followup_next_at, created_at"))
        .or(`and(followup_answered_at.is.null,created_at.lte.${cutoff}),followup_next_at.lte.${now.toISOString()}`)
        .order("created_at", { ascending: false }).limit(3);
      if (error) { console.error("followup due", error.message); return json({ items: [] }); }
      const items = data ?? [];
      const unsent = items.filter((r: any) => !r.followup_sent_at).map((r: any) => r.id);
      if (unsent.length) await scope(admin.from("advert_checks").update({ followup_sent_at: now.toISOString() }).in("id", unsent));
      return json({ items: items.map((r: any) => ({ id: r.id, make: r.make, model: r.model, year: r.year, askingPrice: r.asking_price })) });
    }

    if (b?.action === "answer") {
      const id = String(b?.checkId ?? "");
      const outcome = b?.outcome;
      if (!UUID_RE.test(id) || !["bought", "not_bought", "still_looking"].includes(outcome)) return json({ error: "Invalid answer." }, 400);
      let price: number | null = null;
      if (outcome === "bought") {
        price = Math.round(Number(b?.price));
        if (!(price >= 100 && price < 2_000_000)) return json({ error: "Enter the price you paid." }, 400);
      }
      let date: string | null = null;
      if (outcome === "bought" && typeof b?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
        const d = new Date(b.date + "T00:00:00Z");
        if (!isNaN(d.getTime()) && d.getTime() <= Date.now() + DAY && d.getUTCFullYear() > 2000) date = b.date;
      }
      const { data: row } = await scope(admin.from("advert_checks").select("id, seller_type, followup_snoozes")).eq("id", id).maybeSingle();
      if (!row) return json({ error: "Not found." }, 404);
      const now = new Date();
      {
        // One user outcome per check (partial unique index): update it, or insert the first one.
        const { data: existing } = await admin.from("check_outcomes").select("id").eq("kind", "advert").eq("item_id", id).eq("source", "user").maybeSingle();
        const rec = { outcome_type: outcome, outcome_price: price, outcome_date: date, seller_type: row.seller_type, recorded_at: now.toISOString() };
        const { error } = existing
          ? await admin.from("check_outcomes").update(rec).eq("id", existing.id)
          : await admin.from("check_outcomes").insert({ kind: "advert", item_id: id, source: "user", ...rec });
        if (error) { console.error("followup outcome", error.message); return json({ error: "Couldn't save that — please try again." }, 500); }
      }
      const snoozes = outcome === "still_looking" ? (row.followup_snoozes ?? 0) + 1 : row.followup_snoozes ?? 0;
      const next = outcome === "still_looking" && snoozes < MAX_ASKS ? new Date(now.getTime() + 14 * DAY).toISOString() : null;
      await scope(admin.from("advert_checks").update({
        followup_answered_at: now.toISOString(), followup_snoozes: snoozes, followup_next_at: next,
      })).eq("id", id);
      return json({ ok: true });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    console.error("advert-followup error", e);
    return json({ error: "Please try again later." }, 500);
  }
});
