import { Link } from "react-router-dom";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { useSeo } from "@/lib/seo";
import { ExampleReport } from "@/components/home/BuyerSellerSections";
import "@/styles/tesla.css";

const META = {
  path: "/example-report",
  title: "Example Valu8 car valuation report | Valu8",
  description: "See what a Valu8 car valuation report looks like: the private-sale estimate, the buyer and seller guidance in the £2.99 report, and how the figures are set out.",
};

export default function ExampleReportPage() {
  useSeo(META);
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1">
        <div className="t8p">
          <section className="t8p-sec first" aria-labelledby="ex-h1">
            <div className="t8p-in">
              <p className="t8p-label teal">Example report</p>
              <h1 id="ex-h1" className="t8p-h">Example Valu8 <em>car valuation report.</em></h1>
              <p className="t8p-p">An illustrative report for a made-up car, not a real vehicle or valuation. It shows the guidance the £2.99 report adds to the free valuation, for buyers and for sellers.</p>
            </div>
          </section>
          <div className="bs"><ExampleReport /></div>
          <section className="t8p-sec" style={{ minHeight: 0, paddingTop: 40, paddingBottom: 72 }}>
            <div className="t8p-in">
              <ul className="t8p-links" style={{ marginTop: 0 }}>
                <li><Link to="/how-it-works">How Valu8 works</Link></li>
                <li><Link to="/faq">Common questions</Link></li>
                <li><Link to="/pricing">Pricing</Link></li>
              </ul>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
