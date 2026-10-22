// Cookie / analytics consent (UK GDPR + PECR). Analytics only runs after an
// explicit "Accept". Stored locally; no server round-trip.
export type ConsentState = "granted" | "denied" | null;
const KEY = "valu8_consent_v1";
const EVENT = "valu8:consent";

export function getConsent(): ConsentState {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(v: Exclude<ConsentState, null>) {
  try { localStorage.setItem(KEY, v); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: v }));
}

export function resetConsent() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: null }));
}

export function onConsentChange(cb: (v: ConsentState) => void): () => void {
  const h = (e: Event) => cb((e as CustomEvent).detail as ConsentState);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}
