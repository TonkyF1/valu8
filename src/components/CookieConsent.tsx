import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getConsent, onConsentChange, setConsent } from "@/lib/consent";

/** Analytics consent banner. PostHog never loads until the user accepts. */
export function CookieConsent() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Only ask if analytics is actually configured.
    if (!import.meta.env.VITE_POSTHOG_KEY) return;
    setOpen(getConsent() === null);
    return onConsentChange((v) => setOpen(v === null));
  }, []);
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card/95 backdrop-blur p-4 shadow-xl flex flex-col sm:flex-row gap-3 sm:items-center">
        <p className="text-sm text-muted-foreground flex-1">
          We use essential cookies to keep you signed in. With your permission we'd also use analytics
          (PostHog, incl. masked session replay) to improve Valu8.{" "}
          <Link to="/privacy" className="underline hover:text-primary">Privacy policy</Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setConsent("denied")}>Reject</Button>
          <Button variant="hero" size="sm" onClick={() => setConsent("granted")}>Accept analytics</Button>
        </div>
      </div>
    </div>
  );
}
