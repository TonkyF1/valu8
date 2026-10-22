// Valu8 — minimal Stripe REST helpers (no SDK). Inactive unless
// STRIPE_SECRET_KEY (and STRIPE_PRICE_ID / STRIPE_WEBHOOK_SECRET) are set.

export function stripeConfigured(): boolean {
  return !!Deno.env.get("STRIPE_SECRET_KEY");
}

function form(data: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) if (v !== undefined) p.set(k, v);
  return p.toString();
}

export async function stripe(path: string, data?: Record<string, string | undefined>, method = "POST"): Promise<any> {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe not configured");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : form(data ?? {}),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error?.message ?? `Stripe ${res.status}`);
  return j;
}

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verify a Stripe-Signature header (v1 scheme, 5 min tolerance). */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSec = 300): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]).filter((x) => x.length === 2).map(([k, v]) => [k, v]));
  const sigs = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)));
  // Constant-time-ish compare.
  return sigs.some((s) => s.length === expected.length && [...s].reduce((acc, c, i) => acc | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}

export function siteUrl(req: Request): string {
  return Deno.env.get("SITE_URL") || req.headers.get("origin") || "https://valu8.lovable.app";
}
