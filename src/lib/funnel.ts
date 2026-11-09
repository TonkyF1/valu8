/**
 * Anonymous drop-off funnel. No cookies, no localStorage, no personal data.
 * One random id per page load, kept in memory only; each step is sent once per load.
 */
const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export type FunnelStep =
  | "landed" | "reg_typed" | "lookup_success" | "lookup_fail"
  | "step_reg" | "step_details" | "step_photos" | "submitted" | "result_seen" | "price_alert_opt_in"
  | "offer_view" | "offer_click" | "checkout_start";

function uuid(): string {
  try { return crypto.randomUUID(); } catch {
    return "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
  }
}
const SESSION = uuid();
const sent = new Set<string>();

function device(): "mobile" | "tablet" | "desktop" {
  const w = typeof window !== "undefined" ? window.innerWidth : 1280;
  return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

/** Coarse traffic source only: never the full referrer or URL. */
export function sourceCategory(search: string, referrer: string): string {
  const utm = new URLSearchParams(search).get("utm_source")?.toLowerCase() ?? "";
  if (utm === "v8qa") return "qa";
  const s = `${utm} ${referrer.toLowerCase()}`;
  if (/facebook|fb\b|^fb|meta/.test(s)) return "facebook";
  if (/instagram|\big\b/.test(s)) return "instagram";
  if (/t\.co|twitter|\bx\b/.test(s)) return "x";
  if (/google/.test(s)) return "google";
  if (/bing|duckduckgo|yahoo/.test(s)) return "search_other";
  if (/mail|gm\b|newsletter/.test(s)) return "email";
  if (!utm && (!referrer || referrer.includes("valu8"))) return "direct";
  return "other";
}

export function track(step: FunnelStep, detail?: string) {
  if (!URL_BASE || !KEY || sent.has(step)) return;
  sent.add(step);
  try {
    fetch(`${URL_BASE}/rest/v1/funnel_events`, {
      method: "POST",
      keepalive: true,
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ session_id: SESSION, step, detail: detail ?? null, device: device() }),
    }).catch(() => { /* never block the user */ });
  } catch { /* ignore */ }
}

export function trackLanded() {
  if (typeof window === "undefined") return;
  track("landed", sourceCategory(window.location.search, document.referrer || ""));
}
