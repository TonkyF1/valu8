import { useEffect, useState } from "react";
import { HandCoins, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getGuestCheckIds, peekGuestToken } from "@/lib/guest";
import { parseMoney } from "@/lib/advertCheck";

type Item = { id: string; make: string; model: string; year: number; askingPrice: number };

/** "Did you buy it?" — asked in-app 7+ days after an advert check. Works for guests and signed-in users. */
export function AdvertFollowupCard({ guest = false }: { guest?: boolean }) {
  const [item, setItem] = useState<Item | null>(null);
  const [mode, setMode] = useState<"ask" | "bought">("ask");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  const token = guest ? peekGuestToken() : null;
  useEffect(() => {
    if (guest && (!token || getGuestCheckIds().length === 0)) return;
    supabase.functions.invoke("advert-followup", { body: { action: "due", guestToken: token ?? undefined } })
      .then(({ data }) => {
        const items: Item[] = Array.isArray((data as any)?.items) ? (data as any).items : [];
        if (items[0]) setItem(items[0]);
      }).catch(() => { /* optional */ });
  }, [guest, token]);

  if (!item || hidden) return null;

  const answer = async (outcome: "bought" | "not_bought" | "still_looking") => {
    const paid = parseMoney(price);
    if (outcome === "bought" && !Number.isFinite(paid)) { toast.error("Enter the price you paid"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("advert-followup", {
        body: { action: "answer", checkId: item.id, outcome, price: outcome === "bought" ? paid : undefined, date: date || undefined, guestToken: token ?? undefined },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || "Couldn't save that — please try again.");
      toast.success(outcome === "still_looking" ? "Thanks — we'll ask again in a couple of weeks." : "Thanks — that helps keep our prices honest.");
      setHidden(true);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border border-primary/40 bg-primary/5 p-4 sm:p-5" aria-label="Advert follow-up">
      <div className="flex items-start gap-3">
        <HandCoins className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">Did you buy the {item.year} {item.make} {item.model}?</p>
          <p className="text-xs text-muted-foreground mt-0.5">You checked it at £{item.askingPrice.toLocaleString("en-GB")}. Your answer helps us measure how accurate we are.</p>
          {mode === "ask" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="hero" className="min-h-[44px]" disabled={busy} onClick={() => setMode("bought")}>Bought it</Button>
              <Button size="sm" variant="outline" className="min-h-[44px]" disabled={busy} onClick={() => answer("not_bought")}>Didn't buy</Button>
              <Button size="sm" variant="ghost" className="min-h-[44px]" disabled={busy} onClick={() => answer("still_looking")}>Still looking</Button>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
              <div className="space-y-1.5">
                <Label htmlFor={`paid-${item.id}`}>Price paid (£)</Label>
                <Input id={`paid-${item.id}`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 11,500" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`date-${item.id}`}>Date (optional)</Label>
                <Input id={`date-${item.id}`} type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="h-11" />
              </div>
              <Button variant="hero" className="min-h-[44px]" disabled={busy} onClick={() => answer("bought")}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Save"}
              </Button>
            </div>
          )}
        </div>
        <button type="button" aria-label="Hide for now" className="text-muted-foreground hover:text-foreground p-1" onClick={() => setHidden(true)}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
