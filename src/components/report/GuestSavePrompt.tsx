import { useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dismissGuestSave, guestSaveDismissed, setReturnTo } from "@/lib/guest";
import { posthog } from "@/lib/posthog";

/**
 * Soft, dismissible "save this report" prompt for guests. Never a wall: the full
 * report stays visible whether or not they create an account.
 */
export function GuestSavePrompt({
  valuationId, variant = "card", reason,
}: { valuationId: string; variant?: "card" | "inline"; reason?: string }) {
  const [hidden, setHidden] = useState(() => variant === "card" && guestSaveDismissed(valuationId));
  if (hidden) return null;

  const go = (where: string) => {
    setReturnTo(`/valuation/${valuationId}`);
    try { posthog.capture?.("Guest Save Clicked", { where, valuation_id: valuationId }); } catch { /* optional */ }
  };

  return (
    <div className="premium-card relative p-5 sm:p-6 my-6 border-primary/25 animate-fade-in-up">
      {variant === "card" && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => { dismissGuestSave(valuationId); setHidden(true); }}
          className="absolute top-2 right-2 h-11 w-11 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
      <div className="flex items-start gap-3 pr-8">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 grid place-items-center">
          <Bookmark className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-foreground">Save this report — create a free account</p>
          <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
            {reason ?? "Keep it in your dashboard, track your car's value, write your advert and tell us what it sold for. Free, no card needed."}
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <Button asChild variant="hero" size="sm" className="min-h-[44px]">
              <Link to="/auth?mode=signup" onClick={() => go(`${variant}-signup`)}>Save my report</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="min-h-[44px]">
              <Link to="/auth" onClick={() => go(`${variant}-signin`)}>I have an account</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
