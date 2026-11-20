import { Link, Navigate } from "react-router-dom";
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
import { HOME_FAQS } from "@/components/home/BuyerSellerSections";
import { FaqT, FeaturesT, FreeVsPremiumT, Steps } from "@/components/home/TeslaSections";

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

        <div className="t8p">
          <Steps />
          <FreeVsPremiumT />
          <FeaturesT items={FEATURES} />
          <FaqT items={HOME_FAQS} more />

          <section className="t8p-sec" aria-labelledby="models-h">
            <div className="t8p-in">
              <p className="t8p-label">Car values</p>
              <h2 id="models-h" className="t8p-h">{POPULAR_MODELS_H2}</h2>
              <ul className="t8p-chips">
                {popularValueModels().map((v) => (
                  <li key={v.slug}><Link to={valueModelPath(v)}>{popularModelLabel(v)}</Link></li>
                ))}
              </ul>
              <ul className="t8p-links">
                <li><Link to="/value">See typical prices for all models</Link></li>
                <li><Link to="/guides">Car buying and selling guides</Link></li>
                <li><Link to="/how-it-works">How Valu8 works</Link></li>
                <li><Link to="/example-report">See an example report</Link></li>
              </ul>
            </div>
          </section>
        </div>

        <section className="t8p pb-24 sm:pb-10">
          <div className="container max-w-3xl pt-2"><AccuracyDisclaimer /></div>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: HOME_FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }) }} />
    </div>
  );
}
