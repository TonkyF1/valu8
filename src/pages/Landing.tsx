import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { setJsonLd } from "./newPageMeta";
import { BadgePoundSterling, Camera, FileCheck2, Gauge, ShieldAlert, Wind } from "lucide-react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { AccuracyDisclaimer } from "@/components/AccuracyDisclaimer";
import { useAuth } from "@/contexts/AuthContext";
import { POPULAR_MODELS_H2, popularModelLabel, popularValueModels } from "@/data/popularModels";
import { valueModelPath } from "@/data/valueModels";
import { useSeo } from "@/lib/seo";
import { TeslaFlow } from "@/components/tesla/TeslaFlow";
import { getRouteMeta } from "@/data/routeMeta";
import { Faq, FAQS, FreeVsPremium, HowItWorks } from "@/components/home/BuyerSellerSections";

const HOME_FAQS = FAQS.slice(0, 4);

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
  // Brand identity for Google (the build-time home HTML only carries the FAQ data). Same ids on every visit, so no duplicates.
  useEffect(() => {
    const offs = [
      setJsonLd("homepage-website-jsonld", { "@context": "https://schema.org", "@type": "WebSite", name: "Valu8", url: "https://valu8.uk/" }),
      setJsonLd("homepage-org-jsonld", { "@context": "https://schema.org", "@type": "Organization", name: "Valu8", url: "https://valu8.uk/" }),
    ];
    return () => offs.forEach((o) => o());
  }, []);
  useEffect(() => setJsonLd("homepage-faq-jsonld", {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: HOME_FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  }), []);

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
          <FreeVsPremium />
          <div className="bs-rule" />
          <HowItWorks />
          <div className="bs-rule" />

          <section className="container max-w-5xl py-8" aria-labelledby="features-h">
            <h2 id="features-h" className="text-xl md:text-2xl font-semibold tracking-tight text-center mb-2">What's in every report</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">Market data where available, official records always.</p>
            <ul className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="rounded-xl border border-border/70 bg-card/50 p-3 sm:p-5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 mb-2 sm:mb-3"><f.icon className="h-[18px] w-[18px] text-primary" aria-hidden /></span>
                  <div>
                    <h3 className="font-semibold text-[14px] mb-1 leading-snug">{f.title}</h3>
                    <p className="text-[12.5px] sm:text-sm text-muted-foreground leading-snug sm:leading-relaxed">{f.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* TODO(social-proof): add a customer quotes section here once we have REAL, consented
              customer quotes or a review-platform widget. Never add invented testimonials. */}

          <div className="bs-rule" />
          <Faq items={HOME_FAQS} more />
          <nav aria-label="More about Valu8" className="mt-2 pb-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
            <Link to="/example-report" className="text-primary hover:underline">See an example report</Link>
            <Link to="/how-it-works" className="text-primary hover:underline">How Valu8 works</Link>
            <Link to="/faq" className="text-primary hover:underline">All FAQs</Link>
            <Link to="/guides/what-is-my-car-worth" className="text-primary hover:underline">What is my car worth?</Link>
            <Link to="/guides/part-exchange-vs-private-sale" className="text-primary hover:underline">Part-exchange vs private sale</Link>
            <Link to="/check" className="text-primary hover:underline">Check an advert price</Link>
            <Link to="/guides" className="text-primary hover:underline">Guides</Link>
          </nav>
        </div>

        <section className="container max-w-3xl pb-8 pt-2" aria-labelledby="models-h">
          <h2 id="models-h" className="text-base font-semibold text-center mb-4">{POPULAR_MODELS_H2}</h2>
          <ul className="flex flex-wrap justify-center gap-1.5 text-[13px]">
            {popularValueModels().map((v) => (
              <li key={v.slug}>
                <Link to={valueModelPath(v)} className="inline-flex min-h-[36px] items-center rounded-full border border-border px-3 hover:border-primary/50">{popularModelLabel(v).replace(/^How much is (an? |my )/i, "").replace(/ worth\?$/i, "")}</Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-center text-sm"><Link to="/value" className="text-primary hover:underline">See typical prices for all models</Link></p>
        </section>

        <section className="container max-w-3xl pb-28 sm:pb-8">
          <AccuracyDisclaimer />
        </section>
      </main>
      <Footer />
    </div>
  );
}
