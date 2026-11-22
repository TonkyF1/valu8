/**
 * PostHog Project API key (publishable — safe to ship in the frontend).
 *
 * Set VITE_POSTHOG_KEY (PostHog → Settings → Project → Project API Key).
 * It starts with `phc_`. Leave empty to disable analytics in this build.
 *
 * Performance: posthog-js (~150KB min) is NOT in the initial bundle. It is only downloaded by
 * initPostHog(), which runs after cookie consent AND only when a key is configured. Until then
 * `posthog` is a tiny stand-in with the same methods the app uses; calls made before the real
 * library loads are dropped (nothing is captured without consent anyway).
 */
import type { PostHog } from "posthog-js";

const POSTHOG_KEY: string = import.meta.env.VITE_POSTHOG_KEY ?? "";

const POSTHOG_HOST: string = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

let real: PostHog | null = null;
let loading: Promise<void> | null = null;

type Lite = {
  readonly __loaded: boolean;
  capture: (event: string, props?: Record<string, unknown>) => void;
  identify: (id: string, props?: Record<string, unknown>) => void;
  reset: () => void;
  opt_in_capturing: () => void;
  opt_out_capturing: () => void;
  has_opted_out_capturing: () => boolean;
};

/** Same surface the app uses; forwards to the real client once it has loaded. */
export const posthog: Lite = {
  get __loaded() { return !!real?.__loaded; },
  capture: (event, props) => { try { real?.capture(event, props); } catch { /* optional */ } },
  identify: (id, props) => { try { real?.identify(id, props); } catch { /* optional */ } },
  reset: () => { try { real?.reset(); } catch { /* optional */ } },
  opt_in_capturing: () => { try { real?.opt_in_capturing(); } catch { /* optional */ } },
  opt_out_capturing: () => { try { real?.opt_out_capturing(); } catch { /* optional */ } },
  has_opted_out_capturing: () => { try { return !!real?.has_opted_out_capturing(); } catch { return false; } },
};

export function posthogConfigured(): boolean {
  return !!POSTHOG_KEY;
}

/** Loads and starts PostHog (consent already given by the caller). Resolves when ready; no-op without a key. */
export function initPostHog(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!POSTHOG_KEY) {
    if (import.meta.env.DEV) console.info("[PostHog] disabled: set VITE_POSTHOG_KEY in your environment");
    return Promise.resolve();
  }
  if (loading) return loading;
  loading = import("posthog-js").then(({ default: ph }) => {
    ph.init(POSTHOG_KEY, {
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
      loaded: (client) => {
        if (import.meta.env.DEV) client.debug(false);
      },
    });
    real = ph;
  }).catch(() => { loading = null; });
  return loading;
}
