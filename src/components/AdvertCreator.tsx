import { useState } from "react";
import { Sparkles, Copy, Download, RefreshCw, Bookmark, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Length = "short" | "medium" | "full";
type Adverts = Record<Length, string>;

interface Props {
  valuationId: string;
  vehicle: { make: string; model: string; year: number; mileage: number; registration?: string | null; mot_expiry?: string | null };
  report: {
    recommendations: { listingPrice: number; highlights: string[] };
    conditionScore: number; conditionLabel: string; honestAnalysis: string; strengths: string[];
  };
  initialAdvert?: { adverts: Adverts; location?: string } | null;
}

const LENGTHS: { key: Length; label: string; sub: string }[] = [
  { key: "short", label: "Short", sub: "Marketplace / Gumtree" },
  { key: "medium", label: "Medium", sub: "Balanced detail" },
  { key: "full", label: "Full", sub: "AutoTrader-style" },
];

export function AdvertCreator({ valuationId, vehicle, report, initialAdvert }: Props) {
  const [open, setOpen] = useState(!!initialAdvert);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adverts, setAdverts] = useState<Adverts | null>(initialAdvert?.adverts ?? null);
  const [active, setActive] = useState<Length>("medium");
  const [location, setLocation] = useState(initialAdvert?.location ?? "");
  const [edited, setEdited] = useState<Partial<Adverts>>({});

  const text = (edited[active] ?? adverts?.[active] ?? "");

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-advert", {
        body: {
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          mileage: vehicle.mileage,
          registration: vehicle.registration ?? undefined,
          motExpiry: vehicle.mot_expiry ?? undefined,
          location: location.trim() || undefined,
          price: report.recommendations.listingPrice,
          conditionScore: report.conditionScore,
          conditionLabel: report.conditionLabel,
          honestAnalysis: report.honestAnalysis,
          strengths: report.strengths,
          highlights: report.recommendations.highlights,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAdverts((data as any).advert as Adverts);
      setEdited({});
      setOpen(true);
      toast.success("Advert generated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate advert");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const download = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${vehicle.year}-${vehicle.make}-${vehicle.model}-advert-${active}.txt`.replace(/\s+/g, "-").toLowerCase();
    a.click();
    URL.revokeObjectURL(url);
  };

  const save = async () => {
    if (!adverts) return;
    setSaving(true);
    const merged: Adverts = { ...adverts, ...edited };
    const { data: row } = await supabase.from("valuations").select("report").eq("id", valuationId).maybeSingle();
    const report = (row?.report as any) || {};
    const newReport = { ...report, advert: { adverts: merged, location, savedAt: new Date().toISOString() } };
    const { error } = await supabase.from("valuations").update({ report: newReport }).eq("id", valuationId);
    setSaving(false);
    if (error) toast.error("Could not save advert");
    else { setAdverts(merged); setEdited({}); toast.success("Advert saved to valuation"); }
  };

  if (!open && !adverts) {
    return (
      <section className="premium-card p-6 mb-4 animate-fade-in-up text-center">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/15 text-primary grid place-items-center mb-3">
          <Sparkles className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold mb-1.5">Ready to sell?</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
          Generate a polished, ready-to-post advert for AutoTrader, Facebook Marketplace and Gumtree using your valuation data.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto mb-3">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Your location (optional, e.g. Manchester)"
            className="flex-1 h-11 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button variant="hero" size="lg" onClick={generate} disabled={loading} className="w-full sm:w-auto">
          {loading ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating...</> : <>✍️ Create Selling Advert</>}
        </Button>
      </section>
    );
  }

  return (
    <section className="premium-card p-5 sm:p-6 mb-4 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-primary/15 text-primary grid place-items-center"><Sparkles className="h-3.5 w-3.5" /></span>
          <h2 className="text-base font-semibold">Selling Advert</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {LENGTHS.map(l => (
          <button
            key={l.key}
            onClick={() => setActive(l.key)}
            className={cn(
              "rounded-lg border px-2 py-2.5 text-left transition-all",
              active === l.key
                ? "border-primary/60 bg-primary/10"
                : "border-border bg-muted/20 hover:border-border/80"
            )}
          >
            <div className="text-sm font-semibold flex items-center gap-1.5">
              {l.label}
              {edited[l.key] !== undefined && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </div>
            <div className="text-[10px] text-muted-foreground">{l.sub}</div>
          </button>
        ))}
      </div>

      <Textarea
        value={text}
        onChange={(e) => setEdited(prev => ({ ...prev, [active]: e.target.value }))}
        rows={active === "full" ? 16 : active === "medium" ? 10 : 6}
        className="font-mono text-sm leading-relaxed bg-muted/20"
      />

      <div className="flex flex-wrap gap-2 mt-3">
        <Button variant="premium" size="sm" onClick={copy}><Copy className="h-4 w-4" />Copy</Button>
        <Button variant="ghost" size="sm" onClick={download}><Download className="h-4 w-4" />Download .txt</Button>
        <Button variant="ghost" size="sm" onClick={generate} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />Regenerate
        </Button>
        <div className="flex-1" />
        <Button variant="hero" size="sm" onClick={save} disabled={saving || !adverts}>
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />}
          Save advert
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
        <Check className="h-3 w-3 text-primary" />
        Edit freely — your changes are kept when you switch tabs and saved with the valuation.
      </p>
    </section>
  );
}
