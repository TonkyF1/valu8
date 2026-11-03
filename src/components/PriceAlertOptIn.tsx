import { useEffect, useState } from "react";
import { z } from "zod";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { peekGuestToken } from "@/lib/guest";
import { track } from "@/lib/funnel";

const emailSchema = z.string().trim().email().max(254);

/**
 * One-tap "Email me if this price changes" under the headline price (owner only).
 * Saves the existing follow-up opt-in; guests without an email on file add one first.
 */
export function PriceAlertOptIn({ valuationId, isGuest }: { valuationId: string; isGuest: boolean }) {
  const guestToken = isGuest ? peekGuestToken() : null;
  const [ready, setReady] = useState(false);
  const [on, setOn] = useState(false);
  const [hasEmail, setHasEmail] = useState(!isGuest);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isGuest && !guestToken) return;
    (supabase as any).rpc("get_valuation_feedback", { p_valuation_id: valuationId, p_guest_token: guestToken })
      .then(({ data }: any) => {
        if (data?.feedback?.followup_opt_in) setOn(true);
        if (typeof data?.has_email === "boolean") setHasEmail(data.has_email);
      })
      .finally(() => setReady(true));
  }, [valuationId, guestToken, isGuest]);

  if ((isGuest && !guestToken) || !ready) return null;

  const optIn = async () => {
    const needEmail = isGuest && !hasEmail;
    let parsed: string | null = null;
    if (needEmail) {
      const r = emailSchema.safeParse(email);
      if (!r.success) { toast.error("Enter a valid email"); return; }
      parsed = r.data.toLowerCase();
    }
    setBusy(true);
    if (parsed) {
      const { error } = await supabase.functions.invoke("guest-consent", { body: { email: parsed, guestToken } });
      if (error) { setBusy(false); toast.error("Couldn't save that", { description: "Please try again." }); return; }
      setHasEmail(true);
    }
    const { error } = await (supabase as any).rpc("submit_valuation_feedback", {
      p_valuation_id: valuationId, p_verdict: null, p_user_estimate: null, p_followup_opt_in: true, p_guest_token: guestToken,
    });
    setBusy(false);
    if (error) { toast.error("Couldn't save that", { description: "Please try again." }); return; }
    setOn(true);
    track("price_alert_opt_in");
  };

  if (on) {
    return (
      <p className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground" role="status">
        <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
        We'll email you if this price changes.
      </p>
    );
  }

  const needEmail = isGuest && !hasEmail;
  return (
    <form
      className="mt-4 flex flex-wrap items-center gap-2"
      onSubmit={(e) => { e.preventDefault(); if (!busy) optIn(); }}
      aria-label="Price change alert"
    >
      {needEmail && (
        <Input
          type="email" autoComplete="email" required placeholder="you@example.com" aria-label="Your email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          className="h-9 w-full sm:w-56 rounded-full border-border/70 bg-card/40 text-[13px]"
        />
      )}
      <button
        type="submit" disabled={busy}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/[0.06] px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-primary/10 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <Bell className="h-3.5 w-3.5 text-primary" aria-hidden />
        {busy ? "Saving…" : "Email me if this price changes"}
      </button>
      {needEmail && <p className="w-full text-[11px] text-muted-foreground/80">Only for updates on this valuation. Unsubscribe any time.</p>}
    </form>
  );
}
