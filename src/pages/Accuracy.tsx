import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, HandCoins, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSeo } from "@/lib/seo";
import { getRouteMeta } from "@/data/routeMeta";
import { summariseSaleFeedback, type AccuracySummary } from "@/lib/saleFeedback";

/** Publish public stats only once the sample is big enough to mean something. */
const MIN_PUBLIC_SAMPLE = 20;
const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

function Stats({ s, title, note }: { s: AccuracySummary; title: string; note: string }) {
  return (
    <section className="premium-card p-5 sm:p-6 mt-6">
      <h2 className="font-semibold">{title}</h2>
      <dl className="grid grid-cols-3 gap-3 mt-4 text-center">
        <div><dt className="text-xs text-muted-foreground">Sales reported</dt><dd className="text-xl font-semibold tabular-nums">{s.count}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Median error</dt><dd className="text-xl font-semibold tabular-nums">{s.medianAbsPct ?? "–"}%</dd></div>
        <div><dt className="text-xs text-muted-foreground">Within 10%</dt><dd className="text-xl font-semibold tabular-nums">{s.within10Pct ?? "–"}%</dd></div>
      </dl>
      {s.meanSignedPct !== null && <p className="text-sm text-muted-foreground mt-3">On average cars sold {Math.abs(s.meanSignedPct)}% {s.meanSignedPct >= 0 ? "above" : "below"} our private-sale estimate.</p>}
      <p className="text-xs text-muted-foreground mt-2">{note}</p>
    </section>
  );
}

export default function Accuracy() {
  const { user } = useAuth();
  const [pub, setPub] = useState<AccuracySummary | null>(null);
  const [mine, setMine] = useState<AccuracySummary | null>(null);
  useSeo(getRouteMeta("/accuracy"));

  useEffect(() => {
    // Optional backend aggregate (see docs/backend/public_accuracy_stats.sql). Fails quietly if not deployed.
    (supabase as any).rpc("public_accuracy_stats").then(({ data, error }: any) => {
      const r = Array.isArray(data) ? data[0] : data;
      if (error || !r) return;
      setPub({ count: Number(r.count) || 0, medianAbsPct: r.median_abs_pct != null ? Number(r.median_abs_pct) : null, within10Pct: r.within_10_pct ?? null, meanSignedPct: r.mean_signed_pct != null ? Number(r.mean_signed_pct) : null });
    }, () => {});
  }, []);

  useEffect(() => {
    if (!user) { setMine(null); return; }
    supabase.from("valuations").select("report,private_value").eq("user_id", user.id).then(({ data }) => {
      if (data) setMine(summariseSaleFeedback(data as any));
    });
  }, [user]);

  const showPublic = pub !== null && pub.count >= MIN_PUBLIC_SAMPLE;

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container max-w-2xl py-8 sm:py-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2"><Target className="h-7 w-7 text-primary shrink-0" aria-hidden /> How accurate are we?</h1>
        <p className="text-sm text-muted-foreground mt-2">Most valuation sites never tell you. We compare our private-sale estimates with the prices our users actually sell for, and publish the results here.</p>

        {showPublic ? (
          <Stats s={pub} title="Predicted vs reported sale price" note="Self-reported by Valu8 users after selling. Compared with our private-sale estimate at the time of valuation." />
        ) : (
          <section className="premium-card p-5 sm:p-6 mt-6">
            <h2 className="font-semibold flex items-center gap-2"><HandCoins className="h-4 w-4 text-primary" aria-hidden /> Collecting results</h2>
            <p className="text-sm text-muted-foreground mt-2">We're still early. We'll publish real predicted-vs-sold figures here once at least {MIN_PUBLIC_SAMPLE} owners have told us what they sold for, so the numbers mean something. No cherry-picking: every reported sale counts.</p>
            <p className="text-sm mt-3">Sold a car you valued with us? Open its report and add the sale price. It takes ten seconds.</p>
            <Button asChild variant="hero" size="sm" className="mt-4 min-h-[44px]"><Link to={user ? "/dashboard" : "/auth"}>{user ? "Add a sale price" : "Sign in to add yours"}</Link></Button>
          </section>
        )}

        {mine && mine.count > 0 && <Stats s={mine} title="Your reported sales" note="Only visible to you." />}

        <section className="mt-8">
          <h2 className="font-semibold">Why our estimate is usually below dealer adverts</h2>
          <p className="text-sm text-muted-foreground mt-2">Dealer asking prices include preparation, warranty and margin, and are a starting point for negotiation. A private-sale estimate normally sits below them.</p>
          <p className="text-sm text-muted-foreground mt-2">We'll publish predicted-vs-sold results here once enough owners report their sale prices.</p>
        </section>

        <div className="mt-8 flex flex-col sm:flex-row gap-2">
          <Button asChild variant="hero" className="min-h-[48px]"><Link to="/valuation/new">Value my car free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
          <Button asChild variant="outline" className="min-h-[48px]"><Link to="/check">Is this advert fair?</Link></Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
