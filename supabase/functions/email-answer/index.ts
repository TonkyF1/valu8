// Valu8 — one-tap follow-up answers from email ("Still looking", "Didn't buy it", "Not sold yet").
// The email links to https://valu8.uk/email-answer?t=<signed token>; that page POSTs the token here, so mail-scanner
// prefetches of the link never record an answer. The HMAC token (EMAIL_UNSUB_SECRET, "answer" purpose, 120-day life)
// is the only authority: it names the item and the answer, so no login is needed and nothing else can be changed.
//   still_looking / not_sold → recorded, and the email follow-up re-asks in 14 days (max 3 asks in total).
//   not_bought               → recorded; follow-ups for this item stop.
// An answer that already carries a price (bought / sold) is never overwritten by an old email tap.
import { corsHeaders, json, adminClient, checkLimit, clientIp } from "../_shared/guard.ts";
import { readAnswerToken } from "../_shared/email.ts";

const DAY = 86400_000;
const MAX_ASKS = 3;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const admin = adminClient();
    if (!admin) return json({ status: "error" }, 500);
    if (!(await checkLimit(`email-answer:ip:${clientIp(req)}`, 3600, 30))) return json({ status: "rate_limited" }, 429);
    const b = await req.json().catch(() => ({}));
    const p = await readAnswerToken(String(b?.token ?? ""));
    if (!p || !UUID.test(p.i)) return json({ status: "invalid" }, 400);
    const now = new Date();
    const table = p.k === "advert" ? "advert_checks" : "valuations";
    const { data: item } = await admin.from(table).select(p.k === "advert" ? "id, seller_type, followup_snoozes" : "id, report").eq("id", p.i).maybeSingle();
    if (!item) return json({ status: "invalid" }, 404);
    if (p.k === "advert" && p.a === "not_sold") return json({ status: "invalid" }, 400);
    if (p.k === "valuation" && p.a !== "not_sold") return json({ status: "invalid" }, 400);
    if (p.k === "valuation" && (item as any).report?.saleFeedback) return json({ status: "already", answer: p.a });

    const { data: existing } = await admin.from("check_outcomes").select("id, outcome_price")
      .eq("kind", p.k).eq("item_id", p.i).eq("source", "user").maybeSingle();
    if (existing?.outcome_price != null) return json({ status: "already", answer: p.a });
    const rec = p.k === "advert"
      ? { outcome_type: p.a, outcome_price: null, outcome_date: null, seller_type: (item as any).seller_type ?? null, recorded_at: now.toISOString() }
      : { outcome_type: "seller", seller_type: "not_sold", outcome_price: null, outcome_date: null, recorded_at: now.toISOString() };
    const { error } = existing
      ? await admin.from("check_outcomes").update(rec).eq("id", existing.id)
      : await admin.from("check_outcomes").insert({ kind: p.k, item_id: p.i, source: "user", ...rec });
    if (error) { console.error("email-answer outcome", error.message); return json({ status: "error" }, 500); }

    const reask = p.a !== "not_bought";
    if (p.k === "advert") {
      // Keep the in-app follow-up card in step (same rules as advert-followup "answer").
      const snoozes = reask ? ((item as any).followup_snoozes ?? 0) + 1 : (item as any).followup_snoozes ?? 0;
      await admin.from("advert_checks").update({
        followup_answered_at: now.toISOString(), followup_snoozes: snoozes,
        followup_next_at: reask && snoozes < MAX_ASKS ? new Date(now.getTime() + 14 * DAY).toISOString() : null,
      }).eq("id", p.i);
    }
    // Email follow-up schedule: re-ask in 14 days, or stop for "didn't buy".
    await admin.from("email_followups").update(reask
      ? { next_at: new Date(now.getTime() + 14 * DAY).toISOString() }
      : { next_at: null, sent_count: MAX_ASKS })
      .eq("kind", p.k).eq("item_id", p.i);
    return json({ status: "ok", answer: p.a });
  } catch (e) {
    console.error("email-answer", e);
    return json({ status: "error" }, 500);
  }
});
