import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, BadgePoundSterling, Camera, FileCheck2, Gauge, Scale, ShieldAlert, Sparkles, Wind } from "lucide-react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { AccuracyDisclaimer } from "@/components/VehicleInsights";
import { useAuth } from "@/contexts/AuthContext";

const FEATURES = [
  { icon: BadgePoundSterling, title: "Live market pricing", body: "Private-sale, trade-in and dealer figures anchored to current UK listings for your make, model, year and mileage." },
  { icon: Camera, title: "Photo condition check", body: "Upload a few photos and AI flags visible wear, damage and selling points that move the price." },
  { icon: FileCheck2, title: "Official DVSA MOT history", body: "Every test, advisory and failure, plus indicative repair-cost bands for current advisories." },
  { icon: Gauge, title: "Mileage consistency", body: "MOT mileage charted over time, with any drops flagged for a closer look." },
  { icon: ShieldAlert, title: "Safety recalls", body: "Published DVSA recalls for your model and build year." },
  { icon: Wind, title: "Tax & ULEZ estimates", body: "Estimated annual VED and ULEZ/Clean Air Zone compliance, with links to the official checkers." },
];

export default function Landing() {
  const { user, loading } = useAuth();
  useEffect(() => { document.title = "Valu8: what's my car worth? Free UK car valuation"; }, []);

  // Returning from sign-in with an unfinished valuation: carry on where they left off.
  let pending = false;
  try { pending = !!sessionStorage.getItem("valu8_pending_intent"); } catch { /* ignore */ }
  if (!loading && user && pending) return <Navigate to="/valuation/new" replace />;

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1">
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 -top-32 h-96 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]" aria-hidden />
          <div className="container relative pt-16 pb-10 md:pt-24 md:pb-14 text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary mb-5">
              <Sparkles className="h-3 w-3" aria-hidden /> UK car valuations for private sellers and buyers
            </div>
            <h1 className="text-[2.1rem] md:text-[3.2rem] font-semibold tracking-tight text-gradient leading-[1.05]">
              Know what your car is really worth
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mt-5 max-w-xl mx-auto leading-relaxed">
              Enter a reg. Valu8 pulls the official DVSA record, checks live UK listings and reads your photos,
              then gives you a price you can defend.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="hero" size="xl">
                <Link to="/valuation/new">Value my car <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              </Button>
              <Button asChild variant="outline" size="xl">
                <Link to="/buyer"><Scale className="h-4 w-4" aria-hidden /> Check an asking price</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/70 mt-4">Free during early access. No card needed.</p>
          </div>
        </section>

        <section className="container max-w-5xl pb-12" aria-labelledby="features-h">
          <h2 id="features-h" className="sr-only">What you get</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-xl border border-border bg-card/60 p-5">
                <f.icon className="h-5 w-5 text-primary mb-3" aria-hidden />
                <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="container max-w-3xl pb-12" aria-labelledby="how-h">
          <h2 id="how-h" className="text-xl font-semibold text-center mb-6">How it works</h2>
          <ol className="grid gap-4 sm:grid-cols-3 text-sm">
            {["Enter your registration and mileage", "Add a few photos (optional)", "Get your valuation, report and a ready-to-post advert"].map((s, i) => (
              <li key={s} className="rounded-xl border border-border p-4">
                <span className="text-primary font-semibold">{i + 1}.</span> {s}
              </li>
            ))}
          </ol>
          <div className="text-center mt-8">
            <Button asChild variant="hero" size="lg"><Link to="/valuation/new">Start free valuation <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
          </div>
        </section>

        <section className="container max-w-3xl pb-8">
          <AccuracyDisclaimer />
        </section>
      </main>
      <Footer />
    </div>
  );
}
