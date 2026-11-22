/**
 * Anonymous, cookieless first-party usage analytics (table public.site_events).
 *
 * What it never does: set a cookie; use localStorage/sessionStorage/IndexedDB; store an IP address or user agent;
 * fingerprint; record sessions; capture typed text; or send a registration plate, email or any personal data.
 * The session id is a random UUID that lives in this page load's memory only. A reload is a new visit.
 * It sends: event name, route path (no query string, ids replaced), referrer hostname, campaign tags, coarse
 * device/browser/viewport buckets, and a few non-personal properties.
 */
const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

function uuid(): string {
  try { return crypto.randomUUID(); } catch {
    return "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
  }
}
const SESSION = uuid();

const UUID_SEG = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATE = /\b[A-Z]{2}\d{2}\s?[A-Z]{3}\b|\b[A-Z]\d{1,3}\s?[A-Z]{3}\b|\b[A-Z]{3}\s?\d{1,3}[A-Z]\b/i;

/** Route only: no query or hash; uuids/long tokens become :id. */
export function cleanPath(p: string): string {
  const base = (p || "/").split(/[?#]/)[0];
  const out = base.split("/").map((s) => (UUID_SEG.test(s) ? ":id" : /^[A-Za-z0-9_-]{24,}$/.test(s) ? ":token" : s)).join("/");
  return (PLATE.test(out) ? out.replace(PLATE, ":x") : out).slice(0, 120) || "/";
}

const cleanTag = (v: string | null | undefined): string | null => {
  const s = (v ?? "").toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_.+-]/g, "").slice(0, 64);
  return s || null;
};

/** Hostname only, own site and empty values dropped. */
export function referrerDomain(ref: string, own: string): string | null {
  try {
    if (!ref) return null;
    const h = new URL(ref).hostname.toLowerCase().replace(/^www\./, "");
    return !h || h === own.replace(/^www\./, "") || h.endsWith(".valu8.uk") ? null : h.slice(0, 80);
  } catch { return null; }
}

const device = (w: number): "mobile" | "tablet" | "desktop" => (w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop");
const viewport = (w: number): "xs" | "sm" | "md" | "lg" | "xl" => (w < 400 ? "xs" : w < 640 ? "sm" : w < 1024 ? "md" : w < 1440 ? "lg" : "xl");
/** Coarse browser family from the user agent; the string itself is never kept. */
export function browserFamily(ua: string): "chrome" | "safari" | "firefox" | "edge" | "samsung" | "other" {
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/Edg\//i.test(ua)) return "edge";
  if (/Firefox|FxiOS/i.test(ua)) return "firefox";
  if (/Chrome|CriOS/i.test(ua)) return "chrome";
  if (/Safari/i.test(ua)) return "safari";
  return "other";
}
/** Local builds (npm run dev/preview, QA runs) must never write into the live analytics tables. */
export const isLocalHost = () => typeof window !== "undefined" && /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(window.location.hostname);
const isBot = (ua: string) => /bot|crawl|spider|headless|lighthouse|prerender|slurp|facebookexternalhit|preview/i.test(ua);

/** Property values: short strings/numbers/booleans only; nothing that looks like an email or a plate. */
export function cleanProps(p?: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!p) return out;
  for (const [k, v] of Object.entries(p).slice(0, 12)) {
    if (!/^[a-z0-9_]{1,30}$/.test(k) || v == null) continue;
    if (typeof v === "number") { if (Number.isFinite(v)) out[k] = Math.round(v * 100) / 100; }
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") { out[k] = v.includes("@") ? "[x]" : v.replace(PLATE, "[x]").slice(0, 60); }
  }
  return out;
}

type Row = Record<string, unknown>;
const ctx: { ref: string | null; utm: { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null }; ready: boolean; off: boolean } =
  { ref: null, utm: { utm_source: null, utm_medium: null, utm_campaign: null }, ready: false, off: false };

function init() {
  if (ctx.ready || typeof window === "undefined") return;
  ctx.ready = true;
  const ua = navigator.userAgent || "";
  ctx.off = isBot(ua) || (navigator as any).webdriver === true || isLocalHost();
  ctx.ref = referrerDomain(document.referrer || "", window.location.hostname);
  const q = new URLSearchParams(window.location.search);
  ctx.utm = { utm_source: cleanTag(q.get("utm_source")), utm_medium: cleanTag(q.get("utm_medium")), utm_campaign: cleanTag(q.get("utm_campaign")) };
}

let queue: Row[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let sentCount = 0;
const MAX_PER_LOAD = 400;
let currentPath = () => cleanPath(typeof window !== "undefined" ? window.location.pathname : "/");

/** Record one anonymous event. Never throws and never blocks the page. */
export function ev(event: string, props?: Record<string, unknown>, path?: string) {
  try {
    if (!URL_BASE || !KEY || typeof window === "undefined") return;
    init();
    if (ctx.off || sentCount >= MAX_PER_LOAD || !/^[a-z0-9_]{1,40}$/.test(event)) return;
    sentCount++;
    const w = window.innerWidth;
    queue.push({
      session_id: SESSION, event, path: path ?? currentPath(), referrer_domain: ctx.ref, ...ctx.utm,
      device: device(w), browser: browserFamily(navigator.userAgent || ""), viewport: viewport(w), props: cleanProps(props),
    });
    if (queue.length >= 12) flush(); else if (!timer) timer = setTimeout(flush, 2500);
  } catch { /* analytics must never break the app */ }
}

export function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!queue.length || !URL_BASE || !KEY) return;
  const batch = queue; queue = [];
  try {
    fetch(`${URL_BASE}/rest/v1/site_events`, {
      method: "POST", keepalive: true,
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(batch),
    }).catch(() => { /* ignore */ });
  } catch { /* ignore */ }
}

/** Send an event once per page load (e.g. purchase_completed). */
const once = new Set<string>();
export function evOnce(key: string, event: string, props?: Record<string, unknown>) {
  if (once.has(key)) return; once.add(key); ev(event, props);
}

export const analyticsSessionId = () => SESSION;
