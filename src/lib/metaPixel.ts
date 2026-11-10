/**
 * Meta Pixel, consent-gated. Nothing loads (no script, no request to Meta) unless:
 *  1. a pixel ID is configured (src/config/metaPublic.ts or VITE_META_PIXEL_ID), and
 *  2. the visitor clicked "Accept" in the cookie banner.
 * Purchase is also sent server side (Conversions API, stripe-webhook) with the same
 * event id (the Stripe checkout session id) so Meta de-duplicates the two.
 */
import { META_PIXEL_ID } from "@/config/metaPublic";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
declare global { interface Window { fbq?: Fbq; _fbq?: Fbq } }

export function metaPixelId(): string {
  const id = ((import.meta.env.VITE_META_PIXEL_ID as string | undefined) || META_PIXEL_ID || "").trim();
  return /^\d{5,20}$/.test(id) ? id : "";
}
export const metaPixelConfigured = () => !!metaPixelId();

let loaded = false;
export const metaPixelLoaded = () => loaded;

/** Call only after consent. Injects Meta's standard loader once. */
export function loadMetaPixel(): boolean {
  const id = metaPixelId();
  if (!id || typeof window === "undefined") return false;
  if (loaded) { window.fbq?.("consent", "grant"); return true; }
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args); else n.queue!.push(args);
  } as Fbq;
  if (!window._fbq) window._fbq = n;
  n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
  window.fbq = n;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  s.id = "meta-pixel";
  document.head.appendChild(s);
  window.fbq("init", id);
  loaded = true;
  return true;
}

/** Withdrawn consent: tell the pixel to stop and send nothing further. */
export function revokeMetaPixel() {
  if (loaded) window.fbq?.("consent", "revoke");
  loaded = false;
}

export function metaEvent(name: string, params?: Record<string, unknown>, eventId?: string) {
  if (!loaded || !window.fbq) return;
  if (eventId) window.fbq("track", name, params ?? {}, { eventID: eventId });
  else window.fbq("track", name, params ?? {});
}

const purchases = new Set<string>();
/** Purchase once per checkout session per page load (paid-return polling calls this repeatedly). */
export function metaPurchaseOnce(sessionId: string) {
  if (!loaded || purchases.has(sessionId)) return;
  purchases.add(sessionId);
  metaEvent("Purchase", { value: 2.99, currency: "GBP" }, sessionId);
}
