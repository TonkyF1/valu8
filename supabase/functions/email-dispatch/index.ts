// Valu8 — scheduled email sender (Resend).
//  mode "report"    (DB trigger on insert/update): one "report ready" email per completed valuation / advert check of a signed-in user.
//  mode "followups" (daily): "did you buy / sell it?" 7 days after a report, only to opted-in accounts or consenting guests.
//                   Re-asks every 14 days while unanswered, "still looking" or "not sold yet", max 3 sends per item.
//                   One-tap answers (no price) go through signed links → /email-answer page → email-answer function.
// Every email carries a signed one-click unsubscribe link; suppressed addresses are never emailed.
// Safe to call repeatedly: email_log (template,item_id) and email_followups make sends idempotent.
import { corsHeaders, json, adminClient, checkLimit } from "../_shared/guard.ts";
import { sendEmail, makeUnsubToken, unsubUrl } from "../_shared/email.ts";
import { buildReportEmail, buildFollowupEmail } from "../_shared/emailTemplates.ts";

const DAY = 86400_000;
const MAX_ASKS = 3;
const REASK_DAYS = 14;
const admin = adminClient()!;

const emailCache = new Map<string, string | null>();
async function userEmail(uid: string): Promise<string | null> {
  if (emailCache.has(uid)) return emailCache.get(uid)!;
  const { data } = await admin.auth.admin.getUserById(uid);
  const e = data?.user?.email?.toLowerCase() ?? null;
  emailCache.set(uid, e);
  return e;
}
async function suppressed(email: string): Promise<boolean> {
  const { data } = await admin.from("email_suppressions").select("email").eq("email", email).maybeSingle();
  return !!data;
}
async function sendReport(kind: "valuation" | "advert", item: any, to: string, uid: string): Promise<boolean> {
  const template = `report-${kind}`;
  const { error: claim } = await admin.from("email_log").insert({ template, item_id: item.id, recipient: to });
  if (claim) return false; // already sent (or being sent)
  const token = await makeUnsubToken({ e: to, u: uid });
  const unsubscribe = unsubUrl(token);
  const m = buildReportEmail(kind, item, unsubscribe);
  const r = await sendEmail({ to, subject: m.subject, html: m.html, text: m.text, unsubscribe, idempotencyKey: `${template}-${item.id}` });
  if (!r.ok) { await admin.from("email_log").delete().eq("template", template).eq("item_id", item.id); return false; }
  if (r.id) await admin.from("email_log").update({ provider_id: r.id }).eq("template", template).eq("item_id", item.id);
  return true;
}

async function runReports(windowHours: number, only?: { kind: "valuation" | "advert"; id: string }) {
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();
  let sent = 0;
  for (const kind of ["valuation", "advert"] as const) {
    if (only && only.kind !== kind) continue;
    let q = kind === "valuation"
      ? admin.from("valuations").select("id, user_id, make, model, year, mileage, registration, private_value, report, photo_urls, mot_expiry").gt("private_value", 0)
      : admin.from("advert_checks").select("id, user_id, make, model, year, mileage, asking_price, estimate_private, estimate_dealer_low, estimate_dealer_high").gt("estimate_private", 0);
    q = q.not("user_id", "is", null).gte("created_at", since);
    if (only) q = q.eq("id", only.id);
    const { data: rows } = await q.limit(100);
    for (const it of (rows ?? []) as any[]) {
      const { data: done } = await admin.from("email_log").select("item_id").eq("template", `report-${kind}`).eq("item_id", it.id).maybeSingle();
      if (done) continue;
      const to = await userEmail(it.user_id);
      if (!to || await suppressed(to)) continue;
      if (await sendReport(kind, it, to, it.user_id)) sent++;
    }
  }
  return sent;
}

async function answered(kind: "advert" | "valuation", item: any): Promise<boolean> {
  const { data } = await admin.from("check_outcomes").select("outcome_type, seller_type").eq("kind", kind).eq("item_id", item.id).eq("source", "user");
  // "Still looking" and "Not sold yet" keep the re-ask going; anything else is a final answer.
  const open = (o: any) => o.outcome_type === "still_looking" || (o.outcome_type === "seller" && o.seller_type === "not_sold");
  if ((data ?? []).some((o: any) => !open(o))) return true;
  if (kind === "valuation" && (item.report?.saleFeedback || item.report?.followupDeclined)) return true;
  return false;
}

async function runFollowups() {
  const now = Date.now();
  const due = new Date(now - 7 * DAY).toISOString();
  const oldest = new Date(now - 90 * DAY).toISOString();
  let sent = 0;
  const optIn = new Map<string, boolean>();
  const optedIn = async (uid: string) => {
    if (!optIn.has(uid)) {
      const { data } = await admin.from("profiles").select("marketing_opt_in").eq("user_id", uid).maybeSingle();
      optIn.set(uid, !!data?.marketing_opt_in);
    }
    return optIn.get(uid)!;
  };
  const guestEmail = new Map<string, string | null>();
  const consentFor = async (hash: string) => {
    if (!guestEmail.has(hash)) {
      const { data } = await admin.from("guest_marketing_consents").select("email").eq("guest_token_hash", hash).eq("marketing_opt_in", true)
        .order("consented_at", { ascending: false }).limit(1).maybeSingle();
      guestEmail.set(hash, data?.email ?? null);
    }
    return guestEmail.get(hash)!;
  };
  const mailedThisRun = new Set<string>();

  for (const kind of ["advert", "valuation"] as const) {
    const q = kind === "advert"
      ? admin.from("advert_checks").select("id, user_id, guest_token_hash, make, model, year, mileage, asking_price, created_at")
      : admin.from("valuations").select("id, user_id, guest_token_hash, make, model, year, mileage, registration, report, created_at").gt("private_value", 0);
    const { data: rows } = await q.lte("created_at", due).gte("created_at", oldest).order("created_at", { ascending: false }).limit(300);
    for (const it of (rows ?? []) as any[]) {
      let to: string | null = null;
      if (it.user_id) { if (await optedIn(it.user_id)) to = await userEmail(it.user_id); }
      else if (it.guest_token_hash) to = await consentFor(it.guest_token_hash);
      if (!to || mailedThisRun.has(to) || await suppressed(to)) continue;
      const { data: f } = await admin.from("email_followups").select("sent_count, next_at").eq("kind", kind).eq("item_id", it.id).maybeSingle();
      if (f && (f.sent_count >= MAX_ASKS || (f.next_at && new Date(f.next_at).getTime() > now))) continue;
      if (await answered(kind, it)) continue;
      const count = (f?.sent_count ?? 0) + 1;
      const token = await makeUnsubToken({ e: to, u: it.user_id ?? undefined });
      const unsubscribe = unsubUrl(token);
      const m = await buildFollowupEmail(kind, it, unsubscribe);
      const r = await sendEmail({ to, subject: m.subject, html: m.html, text: m.text, unsubscribe, idempotencyKey: `followup-${kind}-${it.id}-${count}` });
      if (!r.ok) continue;
      mailedThisRun.add(to);
      sent++;
      await admin.from("email_followups").upsert({
        kind, item_id: it.id, user_id: it.user_id ?? null, recipient: to, sent_count: count,
        last_sent_at: new Date().toISOString(), next_at: new Date(now + REASK_DAYS * DAY).toISOString(),
      }, { onConflict: "kind,item_id" });
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const b = await req.json().catch(() => ({}));
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (b?.mode === "report") {
      // Fired by a database trigger when a report row is saved. Only recent rows qualify, and email_log makes it once-only.
      if (!["valuation", "advert"].includes(b?.kind) || !UUID.test(String(b?.id))) return json({ error: "bad request" }, 400);
      return json({ mode: "report", sent: await runReports(1, { kind: b.kind, id: b.id }) });
    }
    if (b?.mode !== "followups") return json({ error: "bad request" }, 400);
    if (!(await checkLimit("email-dispatch:followups", 3600, 2))) return json({ skipped: "rate_limited" });
    // Daily: backstop for any report email a trigger missed in the last day, then follow-ups.
    const reports = await runReports(26);
    const sent = await runFollowups();
    return json({ mode: "followups", reports, sent });
  } catch (e) {
    console.error("email-dispatch", e);
    return json({ error: "internal error" }, 500);
  }
});
