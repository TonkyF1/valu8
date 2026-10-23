import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useSeo } from "@/lib/seo";

// Paid checkout stays hidden until billing is switched on (set VITE_BILLING_ENABLED=true).
const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === "true";

const INCLUDED = [
  "Unlimited valuations with live UK market data where available",
  "AI photo condition analysis",
  "DVSA MOT history, mileage check and a GOV.UK recall-check link",
  "Tax and ULEZ estimates and advisory repair costs",
  "Marketplace-ready adverts and buyer fair-price checks",
];

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  useSeo({ title: "Pricing — Valu8", description: "Valu8 is free during early access: valuations using live UK market data where available, MOT history, photo condition analysis and ready-to-post adverts.", path: "/pricing" });
  useEffect(() => { if (params.get("billing") === "cancelled") toast("Checkout cancelled"); }, [params]);

  const go = async (fn: "stripe-checkout" | "stripe-portal") => {
    if (!user) { navigate("/auth"); return; }
    setBusy(fn === "stripe-checkout" ? "checkout" : "portal");
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body: {} });
      const d = data as any;
      if (d?.url) { window.location.href = d.url; return; }
      // functions.invoke surfaces non-2xx as error; inspect the body when present.
      let body: any = d;
      if (error && (error as any).context?.json) { try { body = await (error as any).context.json(); } catch { /* ignore */ } }
      if (body?.code === "billing_inactive") toast("Payments aren't switched on yet. Everything is free during early access.");
      else toast.error(body?.error || "Couldn't open billing right now.");
    } finally { setBusy(null); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container max-w-xl py-12">
        <h1 className="text-3xl font-semibold text-center">Pricing</h1>
        <p className="text-center text-muted-foreground mt-2">All features are free during early access.</p>
        <section className="mt-8 rounded-2xl border border-primary/30 bg-card/60 p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">{BILLING_ENABLED ? "Valu8 Premium" : "Everything included"}</h2>
            {!BILLING_ENABLED && <span className="text-sm font-semibold text-primary">Free</span>}
          </div>
          <ul className="mt-4 space-y-2">
            {INCLUDED.map((i) => (
              <li key={i} className="flex gap-2 text-sm"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />{i}</li>
            ))}
          </ul>
          {!BILLING_ENABLED ? (
            <div className="mt-6">
              <Button asChild variant="hero" size="lg" className="w-full sm:w-auto"><Link to="/valuation/new">Start free valuation</Link></Button>
              <p className="text-xs text-muted-foreground mt-3">No card needed. If paid plans arrive later, we'll tell you before anything changes.</p>
            </div>
          ) : (
          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            <Button variant="hero" size="lg" onClick={() => go("stripe-checkout")} disabled={!!busy}>
              {busy === "checkout" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Upgrade
            </Button>
            {user && (
              <Button variant="outline" size="lg" onClick={() => go("stripe-portal")} disabled={!!busy}>
                {busy === "portal" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Manage billing
              </Button>
            )}
          </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
