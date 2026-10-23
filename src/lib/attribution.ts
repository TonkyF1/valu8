/**
 * Lightweight, cookie-free first-touch attribution.
 * On the first visit we keep utm_source/medium/campaign and the referring
 * domain (hostname only, never the full URL) in localStorage. It is attached to
 * the user's sign-up metadata and stored inside the valuation report JSON, so no
 * database migration is needed. No identifiers, no third parties.
 */
export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  landing_path?: string;
  first_seen?: string;
};

const KEY = "valu8_first_touch";
const clean = (s: string | null | undefined, max = 64) =>
  s ? s.replace(/[^\w.\-+ /]/g, "").slice(0, max).trim() || undefined : undefined;

export function parseAttribution(search: string, referrer: string, ownHost: string, path = "/"): Attribution | null {
  const p = new URLSearchParams(search);
  let refHost: string | undefined;
  try {
    const h = referrer ? new URL(referrer).hostname.replace(/^www\./, "") : "";
    if (h && h !== ownHost.replace(/^www\./, "")) refHost = h;
  } catch { /* ignore bad referrer */ }
  const a: Attribution = {
    utm_source: clean(p.get("utm_source")),
    utm_medium: clean(p.get("utm_medium")),
    utm_campaign: clean(p.get("utm_campaign")),
    referrer: clean(refHost, 100),
  };
  if (!a.utm_source && !a.utm_medium && !a.utm_campaign && !a.referrer) return null;
  return { ...a, landing_path: clean(path.split("?")[0], 100) };
}

export function captureFirstTouch(): void {
  try {
    if (typeof window === "undefined" || localStorage.getItem(KEY)) return;
    const a = parseAttribution(window.location.search, document.referrer, window.location.hostname, window.location.pathname);
    localStorage.setItem(KEY, JSON.stringify(a ? { ...a, first_seen: new Date().toISOString().slice(0, 10) } : { direct: true }));
  } catch { /* storage blocked */ }
}

export function getAttribution(): Attribution | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const a = JSON.parse(raw);
    if (a?.direct) return undefined;
    return a as Attribution;
  } catch { return undefined; }
}
