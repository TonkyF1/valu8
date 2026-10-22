import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { initPostHog, posthog } from "@/lib/posthog";
import { getConsent, onConsentChange } from "@/lib/consent";

/**
 * Initialises PostHog once, identifies the signed-in user, and
 * captures SPA pageviews on route changes.
 */
export function PostHogTracker() {
  const location = useLocation();
  const { user } = useAuth();
  const identifiedRef = useRef<string | null>(null);
  const openedRef = useRef(false);

  // Analytics only starts after explicit consent (see CookieConsent).
  const [consented, setConsented] = useState(() => getConsent() === "granted");
  useEffect(() => onConsentChange((v) => {
    setConsented(v === "granted");
    if (v !== "granted" && posthog.__loaded) posthog.opt_out_capturing();
  }), []);

  useEffect(() => {
    if (!consented) return;
    initPostHog();
    if (posthog.__loaded && posthog.has_opted_out_capturing?.()) posthog.opt_in_capturing();
    if (!openedRef.current && posthog.__loaded) {
      posthog.capture("App Opened", {
        path: window.location.pathname,
        referrer: document.referrer || undefined,
      });
      openedRef.current = true;
    }
  }, [consented]);


  // Identify / reset on auth changes
  useEffect(() => {
    if (!posthog.__loaded) return;
    if (user && identifiedRef.current !== user.id) {
      posthog.identify(user.id, { email: user.email });
      identifiedRef.current = user.id;
    } else if (!user && identifiedRef.current) {
      posthog.reset();
      identifiedRef.current = null;
    }
  }, [user, consented]);

  // SPA pageviews
  useEffect(() => {
    if (!posthog.__loaded) return;
    posthog.capture("$pageview", {
      $current_url: window.location.href,
      path: location.pathname,
    });
  }, [location.pathname, location.search, consented]);

  return null;
}
