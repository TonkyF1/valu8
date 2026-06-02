import posthog from "posthog-js";

/**
 * PostHog Project API key (publishable — safe to ship in the frontend).
 *
 * Paste your key here from PostHog → Settings → Project → Project API Key.
 * It starts with `phc_`. Leave empty to disable analytics in this build.
 */
const POSTHOG_KEY = "phc_CPtsdMVYmduf4Uk92SPeCwXgUyxieWp5GvrqcDDzRUNz";

const POSTHOG_HOST = "https://eu.i.posthog.com";

let initialised = false;

export function initPostHog() {
  if (initialised || typeof window === "undefined") return;
  if (!POSTHOG_KEY) {
    // No key configured — silently no-op so the app still works.
    if (import.meta.env.DEV) {
      console.info("[PostHog] disabled: set POSTHOG_KEY in src/lib/posthog.ts");
    }
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    // Session replay
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-private]",
    },
    // LLM / AI observability — captures $ai_* events sent from elsewhere.
    // Edge functions can send AI events to PostHog's /capture endpoint
    // using the same key for full LLM observability.
    loaded: (ph) => {
      if (import.meta.env.DEV) ph.debug(false);
    },
  });

  initialised = true;
}

export { posthog };
