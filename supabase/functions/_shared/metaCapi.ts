// Meta Conversions API (server side). Switched off unless BOTH secrets are set:
// META_PIXEL_ID and META_CAPI_TOKEN. Callers must only use it for visitors who
// accepted advertising cookies (checkout metadata.meta_consent = "1").
// Best effort: never throws, never blocks a payment or a report.

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function metaCapiConfigured(): boolean {
  return !!(Deno.env.get("META_PIXEL_ID") && Deno.env.get("META_CAPI_TOKEN"));
}

/** Build the CAPI payload (exported for tests). Email is normalised and SHA-256 hashed, never sent raw. */
export async function buildPurchaseEvent(opts: { eventId: string; value: number; currency: string; email?: string | null; sourceUrl: string; time?: number }) {
  const user_data: Record<string, unknown> = {};
  const em = (opts.email ?? "").trim().toLowerCase();
  if (em) user_data.em = [await sha256Hex(em)];
  return {
    data: [{
      event_name: "Purchase",
      event_time: opts.time ?? Math.floor(Date.now() / 1000),
      event_id: opts.eventId,
      action_source: "website",
      event_source_url: opts.sourceUrl,
      user_data,
      custom_data: { value: opts.value, currency: opts.currency.toUpperCase(), content_name: "Full Valuation Report" },
    }],
  };
}

export async function sendMetaPurchase(opts: { eventId: string; value: number; currency: string; email?: string | null; sourceUrl: string }): Promise<void> {
  const pixel = Deno.env.get("META_PIXEL_ID");
  const token = Deno.env.get("META_CAPI_TOKEN");
  if (!pixel || !token || !/^\d{5,20}$/.test(pixel)) return;
  try {
    const body = await buildPurchaseEvent(opts);
    const res = await fetch(`https://graph.facebook.com/v21.0/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error("meta-capi", res.status);
  } catch (e) {
    console.error("meta-capi", (e as Error)?.message);
  }
}
