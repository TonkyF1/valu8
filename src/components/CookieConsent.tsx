import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getConsent, onConsentChange, setConsent } from "@/lib/consent";
import { metaPixelConfigured } from "@/lib/metaPixel";

/** Which optional tools this build actually has switched on. */
export function optionalTools(): { analytics: boolean; ads: boolean } {
  return { analytics: !!import.meta.env.VITE_POSTHOG_KEY, ads: metaPixelConfigured() };
}

/** QA only: ?consent_preview=1 shows the banner even when no optional tool is switched on. Loads nothing. */
function previewRequested(): boolean {
  try { return new URLSearchParams(window.location.search).get("consent_preview") === "1"; } catch { return false; }
}

/**
 * Cookie banner (UK GDPR + PECR). Optional analytics (PostHog) and advertising (Meta Pixel)
 * never load until the visitor clicks Accept. Reject is the same size and style as Accept.
 * Only shown when at least one optional tool is configured, so it never covers the page for nothing.
 */
export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const tools = optionalTools();
  useEffect(() => {
    const any = tools.analytics || tools.ads;
    if (!any && !previewRequested()) return;
    setOpen(getConsent() === null);
    return onConsentChange((v) => setOpen(v === null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!open) return null;
  const what = tools.analytics && tools.ads
    ? "analytics (PostHog) to improve Valu8, and Meta's advertising pixel to measure our Facebook and Instagram ads"
    : tools.analytics
      ? "analytics (PostHog) to improve Valu8"
      : "Meta's advertising pixel to measure our Facebook and Instagram ads";
  const btn = "inline-flex min-h-[44px] flex-1 sm:flex-none items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-semibold text-foreground hover:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie preferences"
      data-testid="cookie-consent"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card/95 backdrop-blur p-4 shadow-xl flex flex-col sm:flex-row gap-3 sm:items-center">
        <p className="text-sm text-muted-foreground flex-1">
          We use essential storage to make the site work. With your permission we'd also use {what}. Nothing optional loads unless you accept.{" "}
          <Link to="/privacy" className="underline hover:text-primary">Privacy policy</Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button type="button" className={btn} onClick={() => setConsent("denied")}>Reject</button>
          <button type="button" className={btn} onClick={() => setConsent("granted")}>Accept</button>
        </div>
      </div>
    </div>
  );
}
