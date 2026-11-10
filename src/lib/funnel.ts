/**
 * Anonymous drop-off funnel. No cookies, no localStorage, no personal data.
 * One random id per page load, kept in memory only; each step is sent once per load.
 * Campaign tags (utm_source/medium/campaign) from the landing URL are kept in
 * sessionStorage for this tab only, sent with the landed step and saved with each valuation.
 */
const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export type FunnelStep =
  | "landed" | "reg_typed" | "lookup_success" | "lookup_fail"
  | "step_reg" | "step_details" | "step_photos" | "submitted" | "result_seen" | "price_alert_opt_in"
  | "offer_view" | "offer_click" | "checkout_start"
  | "valuation_started" | "valuation_completed" | "report_checkout" | "report_purchased"
  | "share_click" | "referral_unlocked" | "embed_submit";

function uuid(): string {
  try { return crypto.randomUUID(); } catch {
    return "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
  }
}
const SESSION = uuid();
/** This page load's anonymous funnel id (sent to checkout so the server can log report_purchased). */
export const funnelSessionId = () => SESSION;

export type Utm = { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null };
const UTM_KEY = "valu8_utm";
const EMPTY_UTM: Utm = { utm_source: null, utm_medium: null, utm_campaign: null };
/** Same rule as the DB check: lowercase letters, digits, _ . - + only, max 64. */
export const cleanUtm = (v: string | null | undefined): string | null => {
  const s = (v ?? "").toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_.+-]/g, "").slice(0, 64);
  return s || null;
};
export function parseUtm(search: string): Utm | null {
  const p = new URLSearchParams(search);
  const u: Utm = { utm_source: cleanUtm(p.get("utm_source")), utm_medium: cleanUtm(p.get("utm_medium")), utm_campaign: cleanUtm(p.get("utm_campaign")) };
  return u.utm_source || u.utm_medium || u.utm_campaign ? u : null;
}
/** Landing: a tagged URL replaces this tab's tags; an untagged one keeps them. */
export function captureUtm(search = typeof window !== "undefined" ? window.location.search : ""): Utm {
  const fresh = parseUtm(search);
  try {
    if (fresh) { sessionStorage.setItem(UTM_KEY, JSON.stringify(fresh)); return fresh; }
  } catch { /* storage blocked */ }
  return fresh ?? getUtm();
}
export function getUtm(): Utm {
  try {
    const raw = sessionStorage.getItem(UTM_KEY);
    if (!raw) return EMPTY_UTM;
    const j = JSON.parse(raw);
    return { utm_source: cleanUtm(j?.utm_source), utm_medium: cleanUtm(j?.utm_medium), utm_campaign: cleanUtm(j?.utm_campaign) };
  } catch { return EMPTY_UTM; }
}
const sent = new Set<string>();

export const funnelDevice = () => device();
function device(): "mobile" | "tablet" | "desktop" {
  const w = typeof window !== "undefined" ? window.innerWidth : 1280;
  return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

/** Coarse traffic source only: never the full referrer or URL. */
export function sourceCategory(search: string, referrer: string): string {
  const utm = new URLSearchParams(search).get("utm_source")?.toLowerCase() ?? "";
  if (utm === "v8qa") return "qa";
  if (utm === "share") return "share";
  if (utm === "embed") return "embed";
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

type Listener = (step: FunnelStep) => void;
const listeners = new Set<Listener>();
/** Consent-gated extras (Meta Pixel) subscribe here; nothing is listening until consent. */
export function onTrack(cb: Listener): () => void { listeners.add(cb); return () => { listeners.delete(cb); }; }

export function track(step: FunnelStep, detail?: string, extra?: Partial<Utm>) {
  if (!URL_BASE || !KEY || sent.has(step)) return;
  sent.add(step);
  listeners.forEach((cb) => { try { cb(step); } catch { /* ignore */ } });
  try {
    fetch(`${URL_BASE}/rest/v1/funnel_events`, {
      method: "POST",
      keepalive: true,
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ session_id: SESSION, step, detail: detail ?? null, device: device(), ...(extra ?? {}) }),
    }).catch(() => { /* never block the user */ });
  } catch { /* ignore */ }
}

export function trackLanded() {
  if (typeof window === "undefined") return;
  const utm = captureUtm(window.location.search);
  track("landed", sourceCategory(window.location.search, document.referrer || ""), utm.utm_source || utm.utm_medium || utm.utm_campaign ? utm : undefined);
}
