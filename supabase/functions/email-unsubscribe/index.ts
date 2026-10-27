// Valu8 — one-click unsubscribe (no login). Token is HMAC-signed by _shared/email.ts.
import { corsHeaders, json, adminClient } from "../_shared/guard.ts";
import { readUnsubToken } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token") ?? "";
    let confirm = req.method === "POST";
    if (req.method === "POST") {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const b = await req.json().catch(() => null);
        if (typeof b?.token === "string") token = b.token;
        confirm = b?.action !== "check";
      }
    }
    const p = await readUnsubToken(token);
    if (!p) return json({ status: "invalid" }, 400);
    const admin = adminClient();
    if (!admin) return json({ error: "Please try again later." }, 500);
    const { data: existing } = await admin.from("email_suppressions").select("email").eq("email", p.e).maybeSingle();
    if (!confirm) return json({ status: existing ? "already" : "valid" });
    if (!existing) await admin.from("email_suppressions").upsert({ email: p.e, reason: "unsubscribe" });
    if (p.u) await admin.from("profiles").update({ marketing_opt_in: false, marketing_opt_in_at: null }).eq("user_id", p.u);
    await admin.from("guest_marketing_consents").update({ marketing_opt_in: false, updated_at: new Date().toISOString() }).eq("email", p.e);
    return json({ status: "done" });
  } catch (e) {
    console.error("unsubscribe", e);
    return json({ error: "Please try again later." }, 500);
  }
});
