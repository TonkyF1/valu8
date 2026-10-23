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

const FREE = [
  "Instant valuation from your reg and mileage",
  "Private sale, part-exchange and dealer figures",
  "DVSA MOT history and mileage check",
  "GOV.UK recall-check link, tax and ULEZ estimates",
  "\"Is this advert fair?\" checks when buying",
];

const PREMIUM = [
  "Priced against live UK listings where available",
  "AI photo condition score and what it does to the price",
  "Suggested asking price and negotiation buffer",
  "Ready-to-post marketplace advert",
  "Advisory repair-cost bands, compare and shareable report",
];

const FAQ = [
  { q: "Is it really free?", a: "Yes. During early access every feature, including the premium report, is free. No card needed." },
  { q: "Will that change?", a: "If paid plans arrive we'll tell you before anything changes. Valuations you've already made stay yours." },
  { q: "How accurate is it?", a: "It's an estimate. We publish how we measure accuracy on the Accuracy page." },
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
      <main id="main" className="flex-1 container max-w-4xl py-12 md:py-16">
        <div className="text-center max-w-xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Pricing</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">A price you can defend, without paying a dealer's margin</h1>
          <p className="mt-3 text-muted-foreground">Everything is free during early access. Here's what you get.</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-border/60 bg-card/50 p-6 flex flex-col">
            <h2 className="text-lg font-semibold">Essentials</h2>
            <p className="mt-1 text-sm text-muted-foreground">The facts about any car, in a minute.</p>
            <p className="mt-4 text-3xl font-bold">Free</p>
            <ul className="mt-5 space-y-2.5 flex-1">
              {FREE.map((i) => (
                <li key={i} className="flex gap-2.5 text-sm"><Check className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />{i}</li>
              ))}
            </ul>
            <Button asChild variant="outline" size="lg" className="mt-6 w-full"><Link to="/valuation/new">Value my car</Link></Button>
          </section>

          <section className="relative rounded-2xl border border-primary/40 bg-card/70 p-6 flex flex-col shadow-[0_0_60px_-30px_hsl(var(--primary)/0.6)]">
            <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">Free in early access</span>
            <h2 className="text-lg font-semibold">Full seller report</h2>
            <p className="mt-1 text-sm text-muted-foreground">Everything in Essentials, plus what helps you sell for more.</p>
            <p className="mt-4 text-3xl font-bold">{BILLING_ENABLED ? "Premium" : <>£0 <span className="text-base font-normal text-muted-foreground">for now</span></>}</p>
            <ul className="mt-5 space-y-2.5 flex-1">
              {PREMIUM.map((i) => (
                <li key={i} className="flex gap-2.5 text-sm"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />{i}</li>
              ))}
            </ul>
            {!BILLING_ENABLED ? (
              <Button asChild variant="hero" size="lg" className="mt-6 w-full"><Link to="/valuation/new">Get my full report</Link></Button>
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
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">No card needed. If paid plans arrive later, we'll tell you before anything changes.</p>

        <section className="mt-14 max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold text-center">Questions</h2>
          <dl className="mt-6 divide-y divide-border/60 border-y border-border/60">
            {FAQ.map((f) => (
              <div key={f.q} className="py-4">
                <dt className="font-medium">{f.q}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{f.a}{f.q.startsWith("How") && <> <Link to="/accuracy" className="text-primary hover:underline">See accuracy</Link>.</>}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <Footer />
    </div>
  );
}
