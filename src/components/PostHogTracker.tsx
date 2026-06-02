import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { initPostHog, posthog } from "@/lib/posthog";

/**
 * Initialises PostHog once, identifies the signed-in user, and
 * captures SPA pageviews on route changes.
 */
export function PostHogTracker() {
  const location = useLocation();
  const { user } = useAuth();
  const identifiedRef = useRef<string | null>(null);

  useEffect(() => {
    initPostHog();
  }, []);

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
  }, [user]);

  // SPA pageviews
  useEffect(() => {
    if (!posthog.__loaded) return;
    posthog.capture("$pageview", {
      $current_url: window.location.href,
      path: location.pathname,
    });
  }, [location.pathname, location.search]);

  return null;
}
