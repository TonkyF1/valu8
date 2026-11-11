import { Link, Navigate } from "react-router-dom";
import { ArrowRight, BadgePoundSterling, Check, Camera, FileCheck2, Gauge, ShieldAlert, Wind } from "lucide-react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { AccuracyDisclaimer } from "@/components/AccuracyDisclaimer";
import { useAuth } from "@/contexts/AuthContext";
import { CAR_MODELS } from "@/data/carModels";
import { useSeo } from "@/lib/seo";
import { TeslaFlow } from "@/components/tesla/TeslaFlow";
import { getRouteMeta } from "@/data/routeMeta";

const FAQS = [
  { q: "How is the valuation worked out?", a: "Prices are estimated from comparable UK adverts for your make and model, adjusted for your car's age and mileage. Every report shows its confidence level and how the figure was built." },
  { q: "Where does the data come from?", a: "MOT history comes from the official DVSA database. Market prices are estimates built from comparable UK adverts plus an AI market estimate, and are clearly labelled as estimates. Photo condition checks are done by AI. Tax and ULEZ figures are estimates with links to the official checkers." },
  { q: "Is it really free?", a: "The valuation (Essentials) is free. The Full seller report is a one-off £2.99 — no subscription. Pay by card, Apple Pay or Google Pay." },
  { q: "Do I need photos?", a: "No, but adding a few lets us spot condition issues and selling points that move the price, and gives you better advert copy." },
  { q: "Who can see my valuation?", a: "Your valuations are private to your account unless you choose to share a report link. See our privacy policy for how data is handled." },
  { q: "Should I sell privately or part-exchange?", a: "Your report shows both. Private sale usually gets more money; part-exchange is quicker. We show the gap so you can decide if it's worth it." },
];

const TRUST = [
  "Independent: we don't buy, sell or broker cars",
  "Three prices, not one: private sale, part-ex and dealer",
  "Official DVSA MOT history and mileage records",
  "Optional photo condition score",
  "Free, no account needed",
];

const FEATURES = [
  { icon: BadgePoundSterling, title: "Market-based pricing", body: "Private-sale, trade-in and dealer estimates based on comparable UK adverts for your make, model, year and mileage." },
  { icon: Camera, title: "Photo condition check", body: "Upload a few photos and AI flags visible wear, damage and selling points that move the price." },
  { icon: FileCheck2, title: "Official DVSA MOT history", body: "Every test, advisory and failure, plus indicative repair-cost bands for current advisories." },
  { icon: Gauge, title: "Mileage consistency", body: "MOT mileage charted over time, with any drops flagged for a closer look." },
  { icon: ShieldAlert, title: "Safety recalls", body: "A direct link to the official GOV.UK recall check for your exact car." },
  { icon: Wind, title: "Tax & ULEZ estimates", body: "Estimated annual VED and ULEZ/Clean Air Zone compliance, with links to the official checkers." },
];

export default function Landing() {
  const { user, loading } = useAuth();
  useSeo(getRouteMeta("/"));

  // Returning from sign-in with an unfinished valuation: carry on where they left off.
  let pending = false;
  try { pending = !!sessionStorage.getItem("valu8_pending_intent"); } catch { /* ignore */ }
  if (!loading && user && pending) return <Navigate to="/valuation/new" replace />;

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1">
        <TeslaFlow />

        <section className="container max-w-xl pt-12 pb-10" aria-label="Why Valu8">
          <p className="text-center text-[15px] font-medium text-foreground/90 text-balance">We don't buy cars, so we've no reason to nudge your number up or down.</p>
          <ul className="mt-5 grid gap-2 text-left text-[14px] text-foreground/85">
            {TRUST.map((t) => (
              <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{t}</li>
            ))}
          </ul>
        </section>

        <section className="container max-w-xl pb-14" aria-labelledby="get-h">
          <div className="border-t border-border/70 pt-10">
            <h2 id="get-h" className="text-center text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">What you get</h2>
            <ul className="mt-6 divide-y divide-border/70 border-b border-border/70 text-center">
              <li className="py-6">
                <p className="text-[17px] font-medium">Essentials valuation</p>
                <p className="mt-1 text-sm text-muted-foreground">Price estimates · DVSA MOT history</p>
                <p className="mt-2 text-lg font-semibold text-primary">Free</p>
              </li>
              <li className="py-6">
                <p className="text-[17px] font-medium">Full seller report</p>
                <p className="mt-1 text-sm text-muted-foreground">One-off, no subscription</p>
                <p className="mt-2 text-lg font-semibold">£2.99</p>
              </li>
            </ul>
            <p className="mt-6 text-center text-[13px] text-muted-foreground">
              Buying instead? <Link to="/check" className="text-primary hover:underline underline-offset-2">Check if an advert is fair →</Link>
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
            <Button asChild variant="hero" size="lg"><Link to="/valuation/new">Get my free valuation <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }) }} />
    </div>
  );
}
