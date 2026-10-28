import { useEffect, useState } from "react";
import { z } from "zod";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { peekGuestToken } from "@/lib/guest";
import { posthog } from "@/lib/posthog";
import {
  type ValuationFeedbackState, type Verdict, VERDICTS, VERDICT_LABELS, normaliseFeedback, validateEstimate,
} from "@/lib/valuationFeedback";

interface Props {
  valuationId: string;
  /** Guest owner (no account): ownership is proven with the browser's guest token. */
  isGuest: boolean;
}

const emailSchema = z.string().trim().email().max(254);

/**
 * Optional "Does this sound right?" card under a valuation result (owner only, never on share links).
 * Feedback is a signal for the Valu8 team: it never changes the price shown.
 */
export function ValuationFeedbackCard({ valuationId, isGuest }: Props) {
  const guestToken = isGuest ? peekGuestToken() : null;
  const [fb, setFb] = useState<ValuationFeedbackState>({ verdict: null, user_estimate: null, followup_opt_in: false });
  const [hasEmail, setHasEmail] = useState(!isGuest);
  const [estimate, setEstimate] = useState("");
  const [editingEstimate, setEditingEstimate] = useState(true);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);
  const [busy, setBusy] = useState<null | "verdict" | "estimate" | "optin" | "email">(null);
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    if (isGuest && !guestToken) return;
    (supabase as any).rpc("get_valuation_feedback", { p_valuation_id: valuationId, p_guest_token: guestToken })
      .then(({ data, error }: any) => {
        if (error || !data) return;
        const f = normaliseFeedback(data.feedback);
        if (f) {
          setFb(f);
          if (f.user_estimate) { setEstimate(String(f.user_estimate)); setEditingEstimate(false); }
        }
        if (typeof data.has_email === "boolean") setHasEmail(data.has_email);
      });
  }, [valuationId, guestToken, isGuest]);

  if (isGuest && !guestToken) return null;

  const submit = async (patch: { verdict?: Verdict; user_estimate?: number; followup_opt_in?: boolean }, kind: NonNullable<typeof busy>) => {
    setBusy(kind);
    const { data, error } = await (supabase as any).rpc("submit_valuation_feedback", {
      p_valuation_id: valuationId,
      p_verdict: patch.verdict ?? null,
      p_user_estimate: patch.user_estimate ?? null,
      p_followup_opt_in: patch.followup_opt_in ?? null,
      p_guest_token: guestToken,
    });
    setBusy(null);
    if (error) { toast.error("Couldn't save that", { description: "Please try again." }); return false; }
    const next = normaliseFeedback(data);
    if (next) setFb(next);
    setThanks(true);
    try { posthog.capture?.("valuation_feedback_saved", { field: kind, verdict: next?.verdict ?? null }); } catch { /* analytics optional */ }
    return true;
  };

  const sendEstimate = async () => {
    const res = validateEstimate(estimate);
    if (res.ok === false) { setEstimateError(res.error); return; }
    setEstimateError(null);
    if (await submit({ user_estimate: res.value }, "estimate")) { setEstimate(String(res.value)); setEditingEstimate(false); }
  };

  const toggleOptIn = async (next: boolean) => {
    await submit({ followup_opt_in: next }, "optin");
  };

  // Guests without an email on file: reuse the existing follow-up consent (guest-consent → Resend follow-ups).
  const saveEmail = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) { toast.error("Enter a valid email"); return; }
    setBusy("email");
    const { error } = await supabase.functions.invoke("guest-consent", { body: { email: parsed.data.toLowerCase(), guestToken } });
    setBusy(null);
    if (error) { toast.error("Couldn't save that — please try again"); return; }
    setEmailSaved(true);
    setHasEmail(true);
  };

  const showEmailField = isGuest && fb.followup_opt_in && !hasEmail && !emailSaved;

  return (
    <section className="premium-card p-5 sm:p-6 mt-6" aria-labelledby="vf-title">
      <h3 id="vf-title" className="text-lg font-semibold tracking-tight">Does this sound right?</h3>
      <p className="text-sm text-muted-foreground mt-0.5">Optional. It helps us make Valu8 more accurate for everyone.</p>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4" role="group" aria-label="Does this valuation sound right?">
        {VERDICTS.map((v) => {
          const active = fb.verdict === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={active}
              disabled={busy !== null}
              onClick={() => submit({ verdict: v }, "verdict")}
              className={cn(
                "min-h-[48px] rounded-xl border px-2 text-sm sm:text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                active ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary font-semibold" : "border-border bg-card/40 hover:border-primary/50 hover:bg-accent/30",
              )}
            >
              {VERDICT_LABELS[v]}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <Label htmlFor="vf-estimate" className="text-sm">What do you think it's worth?</Label>
        {editingEstimate ? (
          <>
            <div className="flex gap-2 mt-1.5">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden>£</span>
                <Input
                  id="vf-estimate"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="e.g. 8,500"
                  value={estimate}
                  onChange={(e) => { setEstimate(e.target.value); setEstimateError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") sendEstimate(); }}
                  className="h-11 pl-7"
                  aria-invalid={!!estimateError}
                  aria-describedby={estimateError ? "vf-estimate-error" : undefined}
                />
              </div>
              <Button onClick={sendEstimate} disabled={busy !== null || !estimate.trim()} className="h-11 min-w-[84px]">
                {busy === "estimate" ? "Sending…" : "Send"}
              </Button>
            </div>
            {estimateError && <p id="vf-estimate-error" className="text-sm text-destructive mt-1.5" role="alert">{estimateError}</p>}
          </>
        ) : (
          <p className="text-sm mt-1.5 flex items-center gap-2">
            <span>You said <strong className="tabular-nums">£{(fb.user_estimate ?? 0).toLocaleString("en-GB")}</strong></span>
            <button type="button" className="text-primary underline-offset-4 hover:underline text-sm" onClick={() => setEditingEstimate(true)}>Change</button>
          </p>
        )}
      </div>

      <label className="flex items-start gap-3 cursor-pointer text-sm mt-5">
        <Checkbox
          checked={fb.followup_opt_in}
          disabled={busy !== null}
          onCheckedChange={(v) => toggleOptIn(v === true)}
          className="mt-0.5"
          aria-label="Email me later to ask what it sold for"
        />
        <span>Email me later to ask what it sold for</span>
      </label>

      {showEmailField && (
        <div className="mt-3 rounded-xl border border-border/60 bg-card/40 p-4 space-y-2">
          <Label htmlFor="vf-email">Your email</Label>
          <div className="flex gap-2">
            <Input id="vf-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-11 flex-1" />
            <Button variant="outline" onClick={saveEmail} disabled={busy !== null || !email.trim()} className="h-11">{busy === "email" ? "Saving…" : "Save"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">We'll use it to send you follow-up emails from the Valu8 team. Unsubscribe any time from any email.</p>
        </div>
      )}

      {thanks && (
        <p className="mt-4 text-sm text-primary font-medium flex items-center gap-1.5" role="status">
          <Check className="h-4 w-4" aria-hidden />
          {emailSaved ? "Thanks — we'll email you later to ask what it sold for." : "Thanks — your feedback has been saved."}
        </p>
      )}
    </section>
  );
}
