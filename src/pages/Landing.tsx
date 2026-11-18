import { Link, Navigate } from "react-router-dom";
import { BadgePoundSterling, Camera, FileCheck2, Gauge, ShieldAlert, Wind } from "lucide-react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { AccuracyDisclaimer } from "@/components/AccuracyDisclaimer";
import { useAuth } from "@/contexts/AuthContext";
import { CAR_MODELS } from "@/data/carModels";
import { useSeo } from "@/lib/seo";
import { TeslaFlow } from "@/components/tesla/TeslaFlow";
import { getRouteMeta } from "@/data/routeMeta";
import { ExampleReport, Faq, FAQS, FreeVsPremium, HowItWorks, PremiumSection, ValuationContext, WhyValu8 } from "@/components/home/BuyerSellerSections";

const FEATURES = [
  { icon: BadgePoundSterling, title: "Market-based pricing", body: "A private-sale estimate based on comparable UK adverts for the make, model, year and mileage, with part-exchange and dealer estimates in the £2.99 Full report." },
  { icon: Camera, title: "Photo condition check", body: "Upload a few photos and AI flags visible wear, damage and selling points that move the price." },
  { icon: FileCheck2, title: "Official DVSA MOT history", body: "Every test, advisory and failure, plus indicative repair-cost bands for current advisories." },
  { icon: Gauge, title: "Mileage consistency", body: "MOT mileage charted over time, with any drops flagged for a closer look." },
  { icon: ShieldAlert, title: "Safety recalls", body: "A direct link to the official GOV.UK recall check for the exact car." },
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

        <div className="bs">
          <PremiumSection />
          <div className="bs-rule" />
          <ExampleReport />
          <div className="bs-rule" />
          <FreeVsPremium />
          <div className="bs-rule" />
          <HowItWorks />
          <div className="bs-rule" />
          <ValuationContext />
          <div className="bs-rule" />
          <WhyValu8 />
          <div className="bs-rule" />

          <section className="container max-w-5xl py-14" aria-labelledby="features-h">
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

          {/* TODO(social-proof): add a customer quotes section here once we have REAL, consented
              customer quotes or a review-platform widget. Never add invented testimonials. */}

          <div className="bs-rule" />
          <Faq />
        </div>

        <section className="container max-w-3xl pb-12 pt-4" aria-labelledby="models-h">
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
