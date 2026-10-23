// Valu8 — shared request guard for edge functions.
//
// Provides, behind env flags so nothing changes until you opt in:
//  - Caller resolution from the Supabase JWT (never trust body.userId).
//  - Rate limiting + daily caps (Postgres-backed, see migration
//    20261023000000_launch_readiness.sql). Always on; limits are generous.
//  - Premium enforcement: only when PREMIUM_ENFORCED === "true".
//  - Cloudflare Turnstile verification: only when TURNSTILE_SECRET_KEY is set.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders as baseCors } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

/** Supabase default CORS headers plus the optional Turnstile token header. */
export const corsHeaders: Record<string, string> = {
  ...baseCors,
  "Access-Control-Allow-Headers": `${baseCors["Access-Control-Allow-Headers"]}, x-turnstile-token`,
};

export const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...extra } });
}

let _admin: SupabaseClient | null = null;
export function adminClient(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return (fwd.split(",")[0] || req.headers.get("cf-connecting-ip") || "unknown").trim();
}

export async function resolveUser(req: Request): Promise<string | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const admin = adminClient();
  if (!token || !admin) return null;
  try {
    const { data } = await admin.auth.getUser(token);
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

export interface LimitSpec {
  /** Bucket name, e.g. "analyse". */
  name: string;
  windowSeconds: number;
  max: number;
}

/** Returns true when the call is allowed. Fails OPEN if the DB is unreachable. */
export async function checkLimit(key: string, windowSeconds: number, max: number): Promise<boolean> {
  const admin = adminClient();
  if (!admin) return true;
  try {
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key, p_window_seconds: windowSeconds, p_max: max,
    });
    if (error) { console.warn("rate limit rpc error", error.message); return true; }
    return data !== false;
  } catch (e) {
    console.warn("rate limit check failed", e);
    return true;
  }
}

export function envInt(name: string, fallback: number): number {
  const n = Number(Deno.env.get(name));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function premiumEnforced(): boolean {
  return (Deno.env.get("PREMIUM_ENFORCED") ?? "").toLowerCase() === "true";
}

export async function isPremiumUser(userId: string): Promise<boolean> {
  const admin = adminClient();
  if (!admin) return false;
  const [{ data: prof }, { data: role }] = await Promise.all([
    admin.from("profiles").select("is_premium").eq("user_id", userId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
  ]);
  return !!prof?.is_premium || !!role;
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const admin = adminClient();
  if (!admin) return false;
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!data;
}

export async function verifyTurnstile(req: Request): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return true; // inactive until a key is configured
  const token = req.headers.get("x-turnstile-token") ?? "";
  if (!token) return false;
  try {
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    form.append("remoteip", clientIp(req));
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const j = await r.json();
    return !!j?.success;
  } catch (e) {
    console.warn("turnstile verify failed", e);
    return false;
  }
}

export interface GuardOptions {
  feature: string;
  requireUser?: boolean;
  /** Only enforced when PREMIUM_ENFORCED=true. */
  requirePremium?: boolean;
  /** Only enforced when TURNSTILE_SECRET_KEY is set. */
  turnstile?: boolean;
  perMinute?: number;
  perDay?: number;
  /** Per-IP limit per hour (applies to anonymous and signed-in callers). */
  ipPerHour?: number;
}

/**
 * Run all checks. Returns { userId } on success or { response } to return early.
 * Daily caps can be overridden per feature with env DAILY_CAP_<FEATURE> (e.g. DAILY_CAP_ANALYSE=30).
 */
export async function guard(req: Request, o: GuardOptions): Promise<{ userId: string | null; response?: Response }> {
  const userId = await resolveUser(req);
  if (o.requireUser && !userId) return { userId, response: json({ error: "Please sign in to continue." }, 401) };

  const ip = clientIp(req);
  const f = o.feature.toLowerCase();
  const dayCap = envInt(`DAILY_CAP_${f.toUpperCase().replace(/-/g, "_")}`, o.perDay ?? 0);

  const checks: Promise<boolean>[] = [];
  if (o.ipPerHour) checks.push(checkLimit(`${f}:ip:${ip}:h`, 3600, o.ipPerHour));
  if (userId && o.perMinute) checks.push(checkLimit(`${f}:u:${userId}:m`, 60, o.perMinute));
  if (userId && dayCap) checks.push(checkLimit(`${f}:u:${userId}:d`, 86400, dayCap));
  const results = await Promise.all(checks);
  if (results.some((ok) => !ok)) {
    return { userId, response: json({ error: "You've hit the usage limit for now — please try again later." }, 429, { "Retry-After": "60" }) };
  }

  if (o.turnstile && !(await verifyTurnstile(req))) {
    return { userId, response: json({ error: "Human verification failed — please refresh and try again." }, 403) };
  }

  if (o.requirePremium && premiumEnforced()) {
    if (!userId || !(await isPremiumUser(userId))) {
      return { userId, response: json({ error: "This feature needs a Valu8 Premium plan.", code: "premium_required" }, 402) };
    }
  }
  return { userId };
}
