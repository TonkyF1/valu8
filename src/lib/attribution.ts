/**
 * Lightweight, cookie-free first-touch attribution.
 * On the first visit we keep utm_source/medium/campaign and the referring
 * domain (hostname only, never the full URL) in localStorage. It is attached to
 * the user's sign-up metadata and stored inside the valuation report JSON, so no
 * database migration is needed. No identifiers, no third parties. A friend's
 * ?ref=code is kept too and recorded on the new profile (count only, no rewards).
 */
export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  landing_path?: string;
  first_seen?: string;
  ref?: string;
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

const REF_KEY = "valu8_ref";
/** Referral codes are 6-16 lowercase letters/digits (see public.my_referral). */
export const cleanRef = (s: string | null | undefined) => {
  const r = (s ?? "").toLowerCase().trim();
  return /^[a-z0-9]{6,16}$/.test(r) ? r : undefined;
};

export function captureFirstTouch(): void {
  try {
    if (typeof window === "undefined") return;
    const ref = cleanRef(new URLSearchParams(window.location.search).get("ref"));
    if (ref && !localStorage.getItem(REF_KEY)) localStorage.setItem(REF_KEY, ref);
    const stored = localStorage.getItem(KEY);
    // Keep the first real touch; a later UTM/referred visit may replace a bare "direct" one.
    if (stored && !stored.includes('"direct":true')) return;
    const a = parseAttribution(window.location.search, document.referrer, window.location.hostname, window.location.pathname);
    if (stored && !a && !ref) return;
    const touch = a ?? (ref ? { utm_source: "referral", utm_medium: "friend", landing_path: clean(window.location.pathname, 100) } : null);
    localStorage.setItem(KEY, JSON.stringify(touch ? { ...touch, first_seen: new Date().toISOString().slice(0, 10) } : { direct: true }));
  } catch { /* storage blocked */ }
}

export function getRef(): string | undefined {
  try { return cleanRef(localStorage.getItem(REF_KEY)); } catch { return undefined; }
}

export function getAttribution(): Attribution | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const a = JSON.parse(raw);
    const ref = getRef();
    if (a?.direct) return ref ? { ref } : undefined;
    return { ...(a as Attribution), ...(ref ? { ref } : {}) };
  } catch { return undefined; }
}

/**
 * Once per account on this device: tell the server where a new sign-up came from
 * (first-touch UTM + a friend's referral code). The RPC ignores accounts older than
 * three days and never overwrites, so calling it on every sign-in is harmless.
 */
export async function recordSignupSource(
  uid: string,
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }>,
): Promise<void> {
  const flag = `valu8_src_sent_${uid}`;
  try {
    if (localStorage.getItem(flag)) return;
    const a = getAttribution();
    const ref = getRef();
    if (!a && !ref) { localStorage.setItem(flag, "1"); return; }
    const { error } = await rpc("record_signup_source", { p_ref: ref ?? null, p_first_touch: a ?? null });
    if (!error) localStorage.setItem(flag, "1");
  } catch { /* best effort */ }
}
