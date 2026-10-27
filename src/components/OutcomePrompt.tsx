import { useState } from "react";
import { HandCoins, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { parseMoney } from "@/lib/advertCheck";
import { peekGuestToken } from "@/lib/guest";
import { posthog } from "@/lib/posthog";

/**
 * Prominent "Bought it? What did you pay?" on the price-check result. Saves straight
 * to check_outcomes via advert-followup (same path as the 7-day follow-up), so a
 * buyer who already knows can answer now. Guests use their device token.
 */
export function CheckOutcomePrompt({ checkId, signedIn }: { checkId: string | null; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!checkId) return null;
  const box = "mt-5 rounded-2xl border-2 border-primary/50 bg-primary/10 p-4 sm:p-5";
  if (done) return <div className={box} role="status"><p className="font-semibold">Thanks, that really helps.</p><p className="text-sm text-muted-foreground mt-1">Real prices are how we keep Valu8's numbers honest.</p></div>;

  const send = async (outcome: "bought" | "still_looking") => {
    const paid = parseMoney(price);
    if (outcome === "bought" && !Number.isFinite(paid)) { toast.error("Enter the price you paid"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("advert-followup", {
        body: { action: "answer", checkId, outcome, price: outcome === "bought" ? paid : undefined, guestToken: signedIn ? undefined : peekGuestToken() ?? undefined },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || "Couldn't save that, please try again.");
      try { posthog.capture?.("check_outcome_now", { outcome }); } catch { /* optional */ }
      setDone(true);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className={box}>
      <div className="flex items-start gap-3">
        <HandCoins className="h-6 w-6 text-primary shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1">
          <p className="text-base font-semibold">Bought it? What did you pay?</p>
          <p className="text-sm text-muted-foreground mt-0.5">Tell us the price you agreed (takes 10 seconds). Real prices keep our numbers honest. Not yet? We'll ask you in a week.</p>
          {open ? (
            <form className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-end" onSubmit={(e) => { e.preventDefault(); void send("bought"); }}>
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="paid-now">Price you paid (£)</Label>
                <Input id="paid-now" inputMode="numeric" autoFocus value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 8,450" className="h-11" />
              </div>
              <Button type="submit" variant="hero" className="min-h-[44px]" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save price"}</Button>
            </form>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="hero" className="min-h-[44px]" onClick={() => setOpen(true)}>I bought it</Button>
              <Button type="button" variant="outline" className="min-h-[44px]" disabled={busy} onClick={() => void send("still_looking")}>Still deciding</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
