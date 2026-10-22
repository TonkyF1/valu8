import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/site";

// Cloudflare Turnstile (free). Renders nothing unless VITE_TURNSTILE_SITE_KEY is set.
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, o: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Turnstile failed to load"));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export const turnstileEnabled = () => !!TURNSTILE_SITE_KEY;

/** Headers to attach to edge-function calls that may verify Turnstile. */
export function turnstileHeaders(token: string | null | undefined): Record<string, string> {
  return token ? { "x-turnstile-token": token } : {};
}

export function Turnstile({ onToken, action }: { onToken: (t: string | null) => void; action?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !ref.current) return;
    let id: string | undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme: "dark",
          callback: (t: string) => onToken(t),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} className="flex justify-center my-3" aria-label="Human verification" />;
}
