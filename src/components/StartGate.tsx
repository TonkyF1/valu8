import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

/**
 * /valuation/new is the older step-by-step form. Plain visits (old links, guides, the embed box, bookmarks)
 * go to the homepage flow instead, keeping ?reg= and any utm tags. The older form is only shown for
 * "Enter details by hand" (?manual=1) and for a valuation the visitor started before signing in.
 */
export function shouldUseOldForm(search: string, pendingIntent: boolean): boolean {
  if (pendingIntent) return true;
  return new URLSearchParams(search).has("manual");
}

export function StartGate({ children }: { children: ReactNode }) {
  const { search } = useLocation();
  let pending = false;
  try { pending = !!sessionStorage.getItem("valu8_pending_intent"); } catch { /* ignore */ }
  if (shouldUseOldForm(search, pending)) return <>{children}</>;
  return <Navigate to={{ pathname: "/", search }} replace />;
}
