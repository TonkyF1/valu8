import { Link } from "react-router-dom";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { useSeo } from "@/lib/seo";
import { FAQS } from "@/components/home/BuyerSellerSections";
import { FaqT } from "@/components/home/TeslaSections";

const META = {
  path: "/faq",
  title: "Car valuation FAQs: your questions answered | Valu8",
  description: "Answers to common questions about Valu8 car valuations: how accurate they are, what the £2.99 report includes, where the data comes from and who can see your valuation.",
};

export default function FaqPage() {
  useSeo(META);
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1">
        <div className="t8p">
          <FaqT items={FAQS} as="h1" heading="Car valuation FAQs" label="Your questions answered" />
          <section className="t8p-sec" style={{ minHeight: 0, paddingTop: 40, paddingBottom: 72 }}>
            <div className="t8p-in">
              <ul className="t8p-links" style={{ marginTop: 0 }}>
                <li><Link to="/how-it-works">How Valu8 works</Link></li>
                <li><Link to="/accuracy">Accuracy results</Link></li>
                <li><Link to="/pricing">Pricing</Link></li>
              </ul>
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }) }} />
    </div>
  );
}
