// Valu8 — helpers for logging advert checks (no personal data, no IP, no location).

/** Sites we never fetch: their terms forbid it, or they are auctions. Subdomains included. */
export const FETCH_DENYLIST = [
  "autotrader.co.uk", "pistonheads.com", "motors.co.uk", "cargurus.co.uk", "exchangeandmart.co.uk",
  "ebay.co.uk", "ebay.com", "facebook.com", "fb.com", "m.facebook.com", "carandclassic.com",
  "carandclassic.co.uk", "carwow.co.uk", "heycar.com", "cinch.co.uk", "cazoo.co.uk",
  "bca.co.uk", "manheim.co.uk", "copart.co.uk", "synetiq.co.uk", "collectingcars.com", "ccauctions.com",
  "silverstoneauctions.com", "iconicauctioneers.com", "bonhams.com",
];

export function isDenylisted(domain: string): boolean {
  const d = domain.toLowerCase().replace(/\.$/, "");
  if (!d || d.includes("auction")) return true;
  return FETCH_DENYLIST.some((x) => d === x || d.endsWith("." + x));
}

/** Strip query string + fragment; only http(s). Returns null for anything unusable. */
export function sanitiseLink(raw: unknown): { url: string; domain: string; fetchable: boolean } | null {
  if (typeof raw !== "string" || !raw.trim() || raw.length > 2000) return null;
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host === "localhost") return null;
  const url = `${u.protocol}//${host}${u.port ? ":" + u.port : ""}${u.pathname}`.slice(0, 500);
  const domain = host.replace(/^www\./, "");
  return { url, domain, fetchable: !isDenylisted(domain) };
}

export function sellerTypeOf(v: unknown): "dealer" | "private" | "unknown" {
  return v === "dealer" || v === "private" ? v : "unknown";
}

/** Same inversion as src/lib/advertCheck.ts dealerToPrivate, rounded to £50. */
export function privateFromDealer(dealer: number): number {
  const p = Math.min(dealer / 1.08, Math.max(dealer * 0.6, (dealer - 1500) / 1.1));
  return Math.round(p / 50) * 50;
}

export async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const GUEST_TOKEN_RE = /^[a-f0-9]{64}$/;
