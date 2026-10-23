import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccuracyDisclaimer } from "@/components/AccuracyDisclaimer";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useSeo } from "@/lib/seo";

interface Result {
  verdict: "great" | "fair" | "high" | "overpriced" | "unknown";
  low: number; mid: number; high: number; diffPct: number | null; sample: number; basis: string; asking: number;
  comparables?: { price: number; mileage?: number; year?: number; url?: string; trim?: string }[];
}

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
const VERDICT: Record<Result["verdict"], { label: string; cls: string; tip: string }> = {
  great: { label: "Great price", cls: "text-emerald-400", tip: "At or below the lower quartile of similar cars. Check why it's cheap: history, condition, write-off status." },
  fair: { label: "Fair price", cls: "text-primary", tip: "Within the typical range for similar cars." },
  high: { label: "On the high side", cls: "text-amber-400", tip: "Slightly above the typical range. There's room to negotiate." },
  overpriced: { label: "Overpriced", cls: "text-red-400", tip: "Well above similar listings. Negotiate hard or keep looking." },
  unknown: { label: "Not enough data", cls: "text-muted-foreground", tip: "Too few comparable listings to judge this one." },
};

export default function Buyer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ make: "", model: "", year: "", mileage: "", askingPrice: "" });
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  useSeo({ title: "Is this used car a fair price? Valu8 buyer check", description: "Check whether a used car asking price is fair against live UK listings where available and MOT history.", path: "/buyer" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate("/auth"); return; }
    setBusy(true); setRes(null);
    try {
      const { data, error } = await supabase.functions.invoke("fair-price", {
        body: { make: f.make, model: f.model, year: Number(f.year), mileage: Number(f.mileage), askingPrice: Number(f.askingPrice) },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || "Could not check the price right now.");
      setRes(data as Result);
    } catch (err: any) {
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`b-${k}`}>{label}</Label>
      <Input id={`b-${k}`} required value={f[k]} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))} {...props} />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container max-w-2xl py-10">
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Scale className="h-6 w-6 text-primary" aria-hidden /> Buyer fair-price check</h1>
        <p className="text-sm text-muted-foreground mt-2">See how an advert's asking price compares with similar cars listed for sale in the UK right now.</p>

        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 mt-6">
          {field("make", "Make", { placeholder: "Ford", autoComplete: "off" })}
          {field("model", "Model", { placeholder: "Focus", autoComplete: "off" })}
          {field("year", "Year", { inputMode: "numeric", pattern: "\\d{4}", placeholder: "2018" })}
          {field("mileage", "Mileage", { inputMode: "numeric", pattern: "\\d+", placeholder: "45000" })}
          <div className="sm:col-span-2">{field("askingPrice", "Asking price (£)", { inputMode: "numeric", pattern: "\\d+", placeholder: "9995" })}</div>
          <div className="sm:col-span-2">
            <Button type="submit" variant="hero" size="lg" disabled={busy} className="w-full sm:w-auto">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking…</> : user ? "Check price" : "Sign in to check"}
            </Button>
          </div>
        </form>

        {res && (
          <section className="mt-8 rounded-xl border border-border bg-card/60 p-5" aria-live="polite">
            <p className={`text-xl font-semibold ${VERDICT[res.verdict].cls}`}>{VERDICT[res.verdict].label}</p>
            <p className="text-sm text-muted-foreground mt-1">{VERDICT[res.verdict].tip}</p>
            {res.verdict !== "unknown" && (
              <dl className="grid grid-cols-3 gap-3 mt-4 text-center">
                <div><dt className="text-[11px] text-muted-foreground">Typical low</dt><dd className="font-semibold">{gbp(res.low)}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Typical (median)</dt><dd className="font-semibold">{gbp(res.mid)}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Typical high</dt><dd className="font-semibold">{gbp(res.high)}</dd></div>
              </dl>
            )}
            {res.diffPct != null && (
              <p className="text-sm mt-4">Asking {gbp(res.asking)} is <strong>{Math.abs(res.diffPct)}% {res.diffPct >= 0 ? "above" : "below"}</strong> the median.</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-3">Based on {res.sample} listings ({res.basis}), mileage-adjusted. These are asking prices, not sold prices.</p>
          </section>
        )}

        <div className="mt-8"><AccuracyDisclaimer /></div>
      </main>
      <Footer />
    </div>
  );
}
