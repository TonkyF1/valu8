/**
 * Buying / Selling preference. Presentation only: the valuation, its figures and the £2.99 price
 * are identical either way. The current choice lives in sessionStorage (shared by the homepage
 * selector, the flow, the free result card and the checkout); once a valuation exists it is also
 * kept per valuation in localStorage and carried on the Stripe return URL (?intent=), so a paid
 * return lands on the same view of the report.
 */
import { useSyncExternalStore } from "react";

export type Intent = "buying" | "selling";
const KEY = "valu8_intent";
const subs = new Set<() => void>();

export function parseIntent(v: unknown): Intent | null {
  return v === "buying" || v === "selling" ? v : null;
}

function readSession(): Intent {
  try { return parseIntent(sessionStorage.getItem(KEY)) ?? "selling"; } catch { return "selling"; }
}

let current: Intent = typeof window === "undefined" ? "selling" : readSession();

export function getIntent(): Intent { return current; }

export function setIntent(i: Intent): void {
  if (!parseIntent(i) || i === current) return;
  current = i;
  try { sessionStorage.setItem(KEY, i); } catch { /* private mode */ }
  subs.forEach((f) => f());
}

const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };

export function useIntent(): [Intent, (i: Intent) => void] {
  const v = useSyncExternalStore(subscribe, getIntent, () => "selling" as Intent);
  return [v, setIntent];
}

const idKey = (id: string) => `valu8_intent:${id}`;
const askKey = (id: string) => `valu8_asking:${id}`;

export function saveIntentFor(id: string | null | undefined, i: Intent): void {
  if (!id || !parseIntent(i)) return;
  try { localStorage.setItem(idKey(id), i); } catch { /* ignore */ }
}

export function intentFor(id: string | null | undefined): Intent | null {
  if (!id) return null;
  try { return parseIntent(localStorage.getItem(idKey(id))); } catch { return null; }
}

/** Optional advertised asking price a buyer entered for this valuation (whole pounds). */
export function saveAskingFor(id: string | null | undefined, asking: number | null): void {
  if (!id) return;
  try {
    if (asking && Number.isFinite(asking) && asking > 0) localStorage.setItem(askKey(id), String(Math.round(asking)));
    else localStorage.removeItem(askKey(id));
  } catch { /* ignore */ }
}

export function askingFor(id: string | null | undefined): number | null {
  if (!id) return null;
  try {
    const n = Number(localStorage.getItem(askKey(id)));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}

/** The report view to open: an explicit ?intent= wins, then what was chosen for this valuation, then the session choice. */
export function initialReportIntent(id: string | null | undefined, search: string): Intent {
  let fromUrl: Intent | null = null;
  try { fromUrl = parseIntent(new URLSearchParams(search).get("intent")); } catch { /* ignore */ }
  return fromUrl ?? intentFor(id) ?? getIntent();
}
