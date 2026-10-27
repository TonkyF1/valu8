import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getGuestToken } from "@/lib/guest";

export const MARKETING_CONSENT_LABEL = "Email me follow-ups and tips (unsubscribe any time)";

/** Account settings toggle. Stores marketing_opt_in + timestamp on the user's profile. */
export function MarketingConsentSetting() {
  const { user } = useAuth();
  const [checked, setChecked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("marketing_opt_in").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setChecked(!!data?.marketing_opt_in));
  }, [user]);

  const change = async (next: boolean) => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles")
      .update({ marketing_opt_in: next, marketing_opt_in_at: next ? new Date().toISOString() : null })
      .eq("user_id", user.id);
    setBusy(false);
    if (error) return toast.error("Couldn't update your email preference");
    setChecked(next);
    toast.success(next ? "You'll get follow-ups and tips" : "Follow-up emails turned off");
  };

  if (checked === null) return null;
  return (
    <label className="flex items-start gap-3 cursor-pointer text-sm">
      <Checkbox checked={checked} disabled={busy} onCheckedChange={(v) => change(v === true)} className="mt-0.5" aria-label={MARKETING_CONSENT_LABEL} />
      <span>{MARKETING_CONSENT_LABEL}</span>
    </label>
  );
}

const emailSchema = z.string().trim().email().max(254);

/** Guest version under a result: store the email + consent only. */
export function GuestMarketingConsent() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (user) return null;
  if (done) return <p className="text-sm text-muted-foreground">Thanks — we'll be in touch. Unsubscribe any time from any email.</p>;

  const save = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return toast.error("Enter a valid email");
    if (!checked) return toast.error("Tick the box to get follow-ups");
    setBusy(true);
    const { error } = await supabase.functions.invoke("guest-consent", { body: { email: parsed.data.toLowerCase(), guestToken: getGuestToken() } });
    setBusy(false);
    if (error) return toast.error("Couldn't save that — please try again");
    setDone(true);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="guest-consent-email">Your email</Label>
        <Input id="guest-consent-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-11" />
      </div>
      <label className="flex items-start gap-3 cursor-pointer text-sm">
        <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} className="mt-0.5" aria-label={MARKETING_CONSENT_LABEL} />
        <span>{MARKETING_CONSENT_LABEL}</span>
      </label>
      <Button size="sm" variant="outline" className="min-h-[44px]" disabled={busy || !checked || !email} onClick={save}>Save</Button>
    </div>
  );
}
