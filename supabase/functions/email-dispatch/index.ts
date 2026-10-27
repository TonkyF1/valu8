// Valu8 — scheduled email sender (Resend).
//  mode "reports"   (every 5 min): one "report ready" email per completed valuation / advert check of a signed-in user.
//  mode "followups" (daily): "did you buy / sell it?" 7 days after a report, only to opted-in accounts or consenting guests.
//                   Re-asks every 14 days while unanswered or "still looking", max 3 sends per item.
// Every email carries a signed one-click unsubscribe link; suppressed addresses are never emailed.
// Safe to call repeatedly: email_log (template,item_id) and email_followups make sends idempotent.
import { corsHeaders, json, adminClient, checkLimit } from "../_shared/guard.ts";
import { layout, sendEmail, makeUnsubToken, unsubUrl, gbp, SITE } from "../_shared/email.ts";

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
const title = (v: { registration?: string | null; make: string; model: string }) =>
  v.registration?.trim() ? v.registration.trim().toUpperCase() : `${v.make} ${v.model}`;

async function sendReport(kind: "valuation" | "advert", item: any, to: string, uid: string): Promise<boolean> {
  const template = `report-${kind}`;
  const { error: claim } = await admin.from("email_log").insert({ template, item_id: item.id, recipient: to });
  if (claim) return false; // already sent (or being sent)
  const token = await makeUnsubToken({ e: to, u: uid });
  const name = title(item);
  const price = kind === "valuation" ? item.private_value : item.estimate_private;
  const low = kind === "valuation" ? item.report?.valueRange?.privateSaleLow : item.estimate_dealer_low;
  const high = kind === "valuation" ? item.report?.valueRange?.privateSaleHigh : item.estimate_dealer_high;
  const lines = [
    `${kind === "valuation" ? "Private sale value" : "Fair private price"}: ${gbp(price)}`,
    ...(low > 0 && high > 0 ? [`${kind === "valuation" ? "Realistic range" : "Dealer range"}: ${gbp(low)} – ${gbp(high)}`] : []),
    ...(kind === "advert" ? [`Asking price: ${gbp(item.asking_price)}`] : []),
    "Your full report is saved in your account.",
  ];
  const url = kind === "valuation" ? `${SITE}/valuation/${item.id}` : `${SITE}/dashboard`;
  const r = await sendEmail({
    to, subject: `Your Valu8 report for ${name} is ready`, unsubscribe: unsubUrl(token), idempotencyKey: `${template}-${item.id}`,
    html: layout({ preview: `${name}: ${gbp(price)} private value`, heading: `Your report for ${name} is ready`, lines,
      buttons: [{ label: "View your report", url }], unsubscribe: unsubUrl(token) }),
  });
  if (!r.ok) { await admin.from("email_log").delete().eq("template", template).eq("item_id", item.id); return false; }
  if (r.id) await admin.from("email_log").update({ provider_id: r.id }).eq("template", template).eq("item_id", item.id);
  return true;
}

async function runReports(windowHours = 2) {
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();
  let sent = 0;
  const { data: vals } = await admin.from("valuations").select("id, user_id, make, model, registration, private_value, report")
    .not("user_id", "is", null).gt("private_value", 0).gte("created_at", since).limit(100);
  const { data: ads } = await admin.from("advert_checks").select("id, user_id, make, model, asking_price, estimate_private, estimate_dealer_low, estimate_dealer_high")
    .not("user_id", "is", null).gt("estimate_private", 0).gte("created_at", since).limit(100);
  for (const [kind, rows] of [["valuation", vals ?? []], ["advert", ads ?? []]] as const) {
    for (const it of rows as any[]) {
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
  const { data } = await admin.from("check_outcomes").select("outcome_type").eq("kind", kind).eq("item_id", item.id).eq("source", "user");
  if ((data ?? []).some((o: any) => o.outcome_type !== "still_looking")) return true;
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
      ? admin.from("advert_checks").select("id, user_id, guest_token_hash, make, model, year, asking_price, created_at")
      : admin.from("valuations").select("id, user_id, guest_token_hash, make, model, year, registration, report, created_at").gt("private_value", 0);
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
      const name = kind === "valuation" ? title(it) : `${it.year} ${it.make} ${it.model}`;
      const advert = kind === "advert";
      const url = advert ? `${SITE}${it.user_id ? "/dashboard" : "/check"}` : `${SITE}/valuation/${it.id}`;
      const r = await sendEmail({
        to, unsubscribe: unsubUrl(token), idempotencyKey: `followup-${kind}-${it.id}-${count}`,
        subject: advert ? `Did you buy the ${name}? What did you pay?` : `Did you sell or part-ex your ${name}? What did you get?`,
        html: layout({
          preview: advert ? "Tell us what you paid — it takes 10 seconds." : "Tell us what you got — it takes 10 seconds.",
          heading: advert ? `Did you buy the ${name}?` : `Did you sell or part-ex your ${name}?`,
          lines: [
            advert ? `You checked this car${it.asking_price ? ` at ${gbp(it.asking_price)}` : ""}. What did you end up paying?`
                   : "If you've sold it or traded it in, what did you get?",
            "Real prices help us keep every Valu8 valuation honest. Still looking? Just say so and we'll check back later.",
          ],
          buttons: [{ label: advert ? "Tell us what you paid" : "Tell us what you got", url }],
          unsubscribe: unsubUrl(token),
        }),
      });
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
    const mode = b?.mode === "followups" ? "followups" : "reports";
    if (!(await checkLimit(`email-dispatch:${mode}`, 60, 2))) return json({ skipped: "rate_limited" });
    const sent = mode === "followups" ? await runFollowups() : await runReports();
    return json({ mode, sent });
  } catch (e) {
    console.error("email-dispatch", e);
    return json({ error: String(e) }, 500);
  }
});
