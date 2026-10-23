import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, BadgePoundSterling, Camera, Check, FileCheck2, Gauge, SearchCheck, ShieldAlert, Sparkles, Target, Wind } from "lucide-react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { AccuracyDisclaimer } from "@/components/AccuracyDisclaimer";
import { useAuth } from "@/contexts/AuthContext";
import { CAR_MODELS } from "@/data/carModels";
import { useSeo } from "@/lib/seo";

const FAQS = [
  { q: "How accurate is the valuation?", a: "Prices are estimated from thousands of real UK adverts in our database for your make and model, corrected for your car's exact age and mileage. Every report shows its confidence level and how the figure was built." },
  { q: "Where does the data come from?", a: "MOT history comes from the official DVSA database. Market prices are estimates built from thousands of real UK adverts in our database plus an AI market estimate, and are clearly labelled as estimates. Photo condition checks are done by AI. Tax and ULEZ figures are estimates with links to the official checkers." },
  { q: "Is it really free?", a: "Yes. All features are free during early access and no card is needed." },
  { q: "Do I need photos?", a: "No, but adding a few lets us spot condition issues and selling points that move the price, and gives you better advert copy." },
  { q: "Who can see my valuation?", a: "Your valuations are private to your account unless you choose to share a report link. See our privacy policy for how data is handled." },
  { q: "Should I sell privately or part-exchange?", a: "Your report shows both. Private sale usually gets more money; part-exchange is quicker. We show the gap so you can decide if it's worth it." },
];

const FEATURES = [
  { icon: BadgePoundSterling, title: "Market-based pricing", body: "Private-sale, trade-in and dealer estimates built from thousands of real UK adverts in our database for your make, model, year and mileage." },
  { icon: Camera, title: "Photo condition check", body: "Upload a few photos and AI flags visible wear, damage and selling points that move the price." },
  { icon: FileCheck2, title: "Official DVSA MOT history", body: "Every test, advisory and failure, plus indicative repair-cost bands for current advisories." },
  { icon: Gauge, title: "Mileage consistency", body: "MOT mileage charted over time, with any drops flagged for a closer look." },
  { icon: ShieldAlert, title: "Safety recalls", body: "A direct link to the official GOV.UK recall check for your exact car." },
  { icon: Wind, title: "Tax & ULEZ estimates", body: "Estimated annual VED and ULEZ/Clean Air Zone compliance, with links to the official checkers." },
];

export default function Landing() {
  const { user, loading } = useAuth();
  // Sticky mobile CTA only once the hero CTA has scrolled away, so the first screen has one clear action.
  const heroCta = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  useEffect(() => {
    const el = heroCta.current;
    if (!el || typeof IntersectionObserver === "undefined") { setShowSticky(true); return; }
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el); return () => io.disconnect();
  }, []);
  useSeo({ title: "Valu8: what's my car worth? Free UK car valuation", description: "Free UK car valuation for private sellers. Thousands of real UK adverts, DVSA MOT history and photo checks give you a realistic private sale price and asking price.", path: "/" });

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
          <div className="container relative pt-8 pb-8 sm:pt-12 md:pt-24 md:pb-14 text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-4 sm:mb-5">
              <Sparkles className="h-3 w-3" aria-hidden /> Free UK car valuations for sellers and buyers
            </div>
            <h1 className="text-[2.25rem] sm:text-[2.6rem] md:text-[3.2rem] font-semibold tracking-tight text-gradient leading-[1.05] text-balance">
              Know what your car is really worth
            </h1>
            <p className="text-[15px] sm:text-base md:text-lg text-muted-foreground mt-4 sm:mt-5 max-w-xl mx-auto leading-relaxed text-pretty">
              Enter a reg. We check the official DVSA record, thousands of real UK adverts in our database and your photos, then give you a price you can defend.
            </p>
            <div ref={heroCta} className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 justify-center max-w-sm sm:max-w-none mx-auto">
              <Button asChild variant="hero" size="xl" className="w-full sm:w-auto min-h-[52px]">
                <Link to="/valuation/new">Value my car free <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              </Button>
              <Button asChild variant="outline" size="xl" className="w-full sm:w-auto min-h-[52px]">
                <Link to="/check"><SearchCheck className="h-4 w-4" aria-hidden /> Is this advert fair?</Link>
              </Button>
            </div>
            <ul className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              {["Free during early access", "No card needed", "Official DVSA MOT data"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-primary" aria-hidden /> {t}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs">
              <Link to="/accuracy" className="inline-flex items-center gap-1 text-primary/90 hover:text-primary underline-offset-2 hover:underline min-h-[32px]">
                <Target className="h-3.5 w-3.5" aria-hidden /> See how accurate we are
              </Link>
            </p>
          </div>
        </section>

        <section className="container max-w-3xl pb-16" aria-labelledby="sample-h">
          <h2 id="sample-h" className="text-xl md:text-2xl font-semibold tracking-tight text-center mb-2">What a report looks like</h2>
          <p className="text-xs text-muted-foreground text-center mb-5">Illustrative example only, not a real vehicle or valuation.</p>
          <div className="rounded-2xl border border-primary/25 bg-card/60 p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <p className="font-semibold">2018 Ford Fiesta 1.0 EcoBoost · 42,000 mi</p>
              <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">Medium confidence</span>
            </div>
            <dl className="grid grid-cols-3 gap-2 mt-5 text-center">
              {[["Part-exchange", "£6,400"], ["Private sale", "£7,700"], ["Dealer retail", "£9,100"]].map(([k, val], i) => (
                <div key={k} className={i === 1 ? "rounded-xl bg-primary/10 border border-primary/30 p-3" : "rounded-xl border border-border p-3"}>
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-semibold tabular-nums mt-1">{val}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-5 space-y-1.5 text-sm text-muted-foreground">
              <li>• Priced from comparable UK adverts in our database, each corrected to this car's age and mileage</li>
              <li>• MOT: 6 passes, 2 minor advisories, mileage consistent</li>
              <li>• Photos: light scuff on rear bumper (−1%)</li>
              <li>• Suggested asking price, negotiation buffer and a ready-to-post advert</li>
            </ul>
            <div className="mt-5 text-center">
              <Button asChild variant="hero" size="lg"><Link to="/valuation/new">Get my report <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
            </div>
          </div>
        </section>

        <section className="container max-w-4xl pb-16" aria-labelledby="how-h">
          <h2 id="how-h" className="text-xl md:text-2xl font-semibold tracking-tight text-center mb-8">How it works</h2>
          <ol className="grid gap-3 sm:grid-cols-4 text-sm">
            {[["Reg", "Enter your registration and mileage"], ["Details", "Confirm the car and add service notes"], ["Photos", "Add a few photos (optional) for a condition score"], ["Report", "Get your valuation, report and a ready-to-post advert"]].map(([t, d], i) => (
              <li key={t} className="flex sm:flex-col gap-3 rounded-xl border border-border/70 bg-card/40 p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-sm font-semibold text-primary">{i + 1}</span>
                <div><p className="font-semibold">{t}</p><p className="text-muted-foreground mt-0.5 leading-relaxed">{d}</p></div>
              </li>
            ))}
          </ol>
          <div className="text-center mt-8">
            <Button asChild variant="hero" size="lg"><Link to="/valuation/new">Start free valuation <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
          </div>
        </section>

        <section className="container max-w-5xl pb-16" aria-labelledby="features-h">
          <h2 id="features-h" className="text-xl md:text-2xl font-semibold tracking-tight text-center mb-2">What's in every report</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">Market data where available, official records always.</p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4 sm:block rounded-xl border border-border/70 bg-card/50 p-4 sm:p-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 sm:mb-3"><f.icon className="h-[18px] w-[18px] text-primary" aria-hidden /></span>
                <div>
                  <h3 className="font-semibold text-[15px] mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* TODO(social-proof): add a "What sellers say" section here once we have REAL, consented
            customer quotes or a review-platform widget (e.g. Trustpilot). Never add invented testimonials. */}

        <section className="container max-w-3xl pb-12" aria-labelledby="faq-h">
          <h2 id="faq-h" className="text-xl font-semibold text-center mb-6">Questions</h2>
          <div className="space-y-2">
            {FAQS.map((f) => (
              <details key={f.q} className="rounded-xl border border-border bg-card/40 p-4">
                <summary className="font-medium cursor-pointer min-h-[28px]">{f.q}</summary>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="container max-w-3xl pb-12" aria-labelledby="models-h">
          <h2 id="models-h" className="text-base font-semibold text-center mb-4">Popular valuations</h2>
          <ul className="flex flex-wrap justify-center gap-2 text-sm">
            {CAR_MODELS.slice(0, 16).map((m) => (
              <li key={m.makeSlug + m.slug}>
                <Link to={`/car-values/${m.makeSlug}/${m.slug}`} className="inline-flex min-h-[44px] items-center rounded-full border border-border px-4 hover:border-primary/50">{m.make} {m.model}</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="container max-w-3xl pb-28 sm:pb-8">
          <AccuracyDisclaimer />
        </section>
      </main>
      <Footer />
      {/* Sticky mobile CTA */}
      <div aria-hidden={!showSticky} className={`sm:hidden fixed inset-x-0 bottom-0 z-40 transition-transform duration-200 ${showSticky ? "translate-y-0" : "translate-y-full pointer-events-none"} border-t border-border bg-background/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]`}>
        <Button asChild variant="hero" size="lg" className="w-full min-h-[48px]">
          <Link to="/valuation/new" tabIndex={showSticky ? 0 : -1}>Value my car free <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </Button>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }) }} />
    </div>
  );
}
