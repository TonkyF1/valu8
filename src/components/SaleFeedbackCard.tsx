import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { HandCoins, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { posthog } from "@/lib/posthog";
import {
  type SaleFeedback, type SoldTo, SOLD_TO_LABELS, getSaleFeedback, validateSaleFeedback, withSaleFeedback, saleAccuracy,
} from "@/lib/saleFeedback";

interface Props {
  valuationId: string;
  report: unknown;
  estimate: number | null | undefined;
  onSaved?: (report: Record<string, unknown>) => void;
}

/** Owner-only card: "Sold it? Tell us the price". Never render on buyer share views. */
export function SaleFeedbackCard({ valuationId, report, estimate, onSaved }: Props) {
  const existing = getSaleFeedback(report);
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(existing ? String(existing.salePrice) : "");
  const [soldOn, setSoldOn] = useState(existing?.soldOn ?? "");
  const [soldTo, setSoldTo] = useState<string>(existing?.soldTo ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dashboard links here with #sale-feedback; the report renders async so scroll once mounted.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#sale-feedback")
      document.getElementById("sale-feedback")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const save = async () => {
    const res = validateSaleFeedback({ salePrice: price, soldOn: soldOn || null, soldTo: soldTo || null });
    if (res.ok === false) { setError(res.error); return; }
    setError(null); setBusy(true);
    try {
      // Re-read the latest report so we never overwrite other fields with stale state.
      const { data, error: readErr } = await supabase.from("valuations").select("report").eq("id", valuationId).maybeSingle();
      if (readErr || !data) throw readErr ?? new Error("Valuation not found");
      const fb: SaleFeedback = { ...res.value, recordedAt: new Date().toISOString(), estimateAtTime: estimate ?? null };
      const next = withSaleFeedback((data.report ?? {}) as Record<string, unknown>, fb);
      const { error: upErr } = await supabase.from("valuations").update({ report: next as any }).eq("id", valuationId);
      if (upErr) throw upErr;
      try { posthog.capture?.("sale_feedback_saved", { sold_to: fb.soldTo ?? null, accuracy_pct: saleAccuracy(fb.salePrice, estimate) }); } catch { /* analytics optional */ }
      toast.success("Thanks — that really helps", { description: "Real sale prices help us make Valu8 more accurate." });
      setEditing(false);
      onSaved?.(next);
    } catch (e) {
      toast.error("Couldn't save the sale price", { description: (e as Error)?.message ?? "Please try again" });
    } finally { setBusy(false); }
  };

  if (existing && !editing) {
    const diff = saleAccuracy(existing.salePrice, existing.estimateAtTime ?? estimate);
    return (
      <section id="sale-feedback" className="premium-card p-5 sm:p-6 mt-6 scroll-mt-24" aria-label="Sale price feedback">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 grid place-items-center ring-1 ring-primary/20 shrink-0"><Check className="h-4 w-4 text-primary" aria-hidden /></div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold tracking-tight">Sold for £{existing.salePrice.toLocaleString("en-GB")}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {[existing.soldTo ? SOLD_TO_LABELS[existing.soldTo] : null, existing.soldOn ? format(new Date(`${existing.soldOn}T00:00:00`), "d MMM yyyy") : null].filter(Boolean).join(" · ") || "Thanks for telling us."}
              {diff !== null && <> · {Math.abs(diff) < 0.5 ? "right on our estimate" : `${Math.abs(diff)}% ${diff > 0 ? "above" : "below"} our estimate`}</>}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" aria-hidden /> Edit</Button>
        </div>
      </section>
    );
  }

  return (
    <section id="sale-feedback" className="relative rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6 mt-6 scroll-mt-24 shadow-[0_0_40px_-12px_hsl(var(--primary)/0.45)]" aria-label="Sale price feedback">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-11 w-11 rounded-xl bg-primary/15 grid place-items-center ring-1 ring-primary/30 shrink-0"><HandCoins className="h-5 w-5 text-primary" aria-hidden /></div>
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Sold it? Tell us what for</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Takes ten seconds. Real sale prices keep our valuations honest, and we publish the results on our <Link to="/accuracy" className="text-primary underline underline-offset-2">accuracy page</Link>. Your individual price is only visible to you and never shown on shared links.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="sf-price">Sale price (£)</Label>
          <Input id="sf-price" inputMode="numeric" placeholder="e.g. 8,500" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sf-date">Date sold <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input id="sf-date" type="date" max={new Date().toISOString().slice(0, 10)} value={soldOn} onChange={(e) => setSoldOn(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Sold to <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Select value={soldTo} onValueChange={setSoldTo}>
            <SelectTrigger aria-label="Sold to"><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>
              {(Object.keys(SOLD_TO_LABELS) as SoldTo[]).map((k) => <SelectItem key={k} value={k}>{SOLD_TO_LABELS[k]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {error && <p className="text-sm text-destructive mt-2" role="alert">{error}</p>}
      <div className="flex gap-2 mt-4">
        <Button variant="hero" onClick={save} disabled={busy} className="min-h-[44px]">{busy ? "Saving…" : "Save sale price"}</Button>
        {existing && <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</Button>}
      </div>
    </section>
  );
}
