// Optional error monitoring. Completely inactive unless VITE_SENTRY_DSN is set.
// Loads Sentry's official CDN loader on demand, so there is no npm dependency
// or bundle cost when disabled. Free tier: https://sentry.io/pricing/
const DSN: string = import.meta.env.VITE_SENTRY_DSN ?? "";

declare global {
  interface Window { Sentry?: { init: (o: Record<string, unknown>) => void; captureException: (e: unknown) => void } }
}

let started = false;

export function initSentry() {
  if (started || !DSN || typeof document === "undefined") return;
  started = true;
  // DSN format: https://<publicKey>@oXXXX.ingest.sentry.io/<projectId>
  const publicKey = DSN.match(/^https?:\/\/([^@]+)@/)?.[1];
  if (!publicKey) {
    console.warn("[Sentry] VITE_SENTRY_DSN looks invalid; skipping");
    return;
  }
  (window as any).sentryOnLoad = () => {
    window.Sentry?.init({
      dsn: DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0,
      // Never send typed values.
      sendDefaultPii: false,
    });
  };
  const s = document.createElement("script");
  s.src = `https://js.sentry-cdn.com/${publicKey}.min.js`;
  s.crossOrigin = "anonymous";
  s.async = true;
  document.head.appendChild(s);
}

export function captureError(e: unknown) {
  try { window.Sentry?.captureException(e); } catch { /* ignore */ }
}
