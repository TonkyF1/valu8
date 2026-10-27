// Valu8 — guest marketing consent: one row per email (upsert), rate-limited, linked to the guest token hash.
import { corsHeaders, json, adminClient, checkLimit, clientIp } from "../_shared/guard.ts";
import { sha256Hex, GUEST_TOKEN_RE } from "../_shared/adverts.ts";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const ip = clientIp(req);
    if (!(await checkLimit(`guest-consent:ip:${ip}:h`, 3600, 5))) return json({ error: "Too many attempts — try again later." }, 429);
    const b = await req.json().catch(() => null);
    const email = typeof b?.email === "string" ? b.email.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: "Enter a valid email." }, 400);
    if (!(await checkLimit(`guest-consent:email:${email}:d`, 86400, 3))) return json({ ok: true });
    const admin = adminClient();
    if (!admin) return json({ error: "Please try again later." }, 500);
    const hash = typeof b?.guestToken === "string" && GUEST_TOKEN_RE.test(b.guestToken) ? await sha256Hex(b.guestToken) : null;
    const now = new Date().toISOString();
    const row: Record<string, unknown> = { email, marketing_opt_in: true, consented_at: now, updated_at: now };
    if (hash) row.guest_token_hash = hash;
    const { error } = await admin.from("guest_marketing_consents").upsert(row, { onConflict: "email" });
    if (error) { console.error("guest consent", error.message); return json({ error: "Couldn't save that." }, 500); }
    // Unauthenticated form: never lift an earlier unsubscribe here, or anyone could re-subscribe someone else's address.
    return json({ ok: true });
  } catch (e) {
    console.error("guest consent", e);
    return json({ error: "Please try again later." }, 500);
  }
});
