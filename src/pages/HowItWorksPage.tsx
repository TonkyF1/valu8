import { Link } from "react-router-dom";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { useSeo } from "@/lib/seo";
import { HomeLink } from "@/components/HomeLink";
import { Steps } from "@/components/home/TeslaSections";
import "@/styles/tesla.css";

// Titles for new pages live here until they are added to routeMeta (owned by Marketing).
const META = {
  path: "/how-it-works",
  title: "How Valu8 works: free car valuation by reg | Valu8",
  description: "How Valu8 turns a UK number plate into a free car valuation: comparable adverts, age and mileage, official MOT history and optional photos.",
};

const CONTEXT: [string, string][] = [
  ["Comparable UK adverts", "We look at typical asking prices for the same make and model in UK adverts."],
  ["Age and mileage", "Each comparable is adjusted to the car’s age and mileage, so like is compared with like."],
  ["MOT history", "Official DVSA records add context: passes, advisories and the mileage at every test."],
  ["Condition", "Optional photos let us flag visible wear and selling points that can move the estimate."],
  ["Confidence rating", "Shows how much comparable market data sits behind the estimate. Low confidence means fewer similar cars, so treat the figure as a rougher guide."],
];
const WHY: [string, string][] = [
  ["Understand the market", "See estimated vehicle values informed by relevant market information."],
  ["Buy with confidence", "Understand what a car may be worth before making an offer."],
  ["Sell smarter", "Choose a realistic asking price and approach negotiations prepared."],
  ["Independent", "Valu8 doesn’t buy or sell cars, so our service isn’t designed to generate purchase offers for your vehicle."],
];

export default function HowItWorksPage() {
  useSeo(META);
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1">
        <div className="t8p">
          <section className="t8p-sec first" aria-labelledby="hiw-h1">
            <div className="t8p-in">
              <p className="t8p-label teal">How Valu8 works</p>
              <h1 id="hiw-h1" className="t8p-h">A free car valuation, <em>from the reg.</em></h1>
              <p className="t8p-p">Enter a UK number plate and Valu8 builds a private-sale estimate from comparable adverts, adjusted for the car’s age and mileage and backed by its official MOT history. Here is what happens, step by step.</p>
            </div>
          </section>
          <Steps heading="The three steps" label="Step by step" />
          <section className="t8p-sec" aria-labelledby="hiw-ctx-h">
            <div className="t8p-in">
              <p className="t8p-label">The method</p>
              <h2 id="hiw-ctx-h" className="t8p-h">More than a number. <em>A valuation with context.</em></h2>
              <ul className="t8p-list plain">{CONTEXT.map(([t, p]) => <li key={t}><div><h3>{t}</h3><p>{p}</p></div></li>)}</ul>
              <p className="t8p-note">Valuations and negotiation ranges are estimates, not guaranteed prices. They don’t replace a vehicle history check or a mechanical inspection.</p>
            </div>
          </section>
          <section className="t8p-sec" aria-labelledby="hiw-why-h">
            <div className="t8p-in">
              <p className="t8p-label">Why Valu8</p>
              <h2 id="hiw-why-h" className="t8p-h">Built for both sides <em>of the deal.</em></h2>
              <ul className="t8p-list plain">{WHY.map(([t, p]) => <li key={t}><div><h3>{t}</h3><p>{p}</p></div></li>)}</ul>
            </div>
          </section>
          <section className="t8p-sec" aria-labelledby="hiw-next-h">
            <div className="t8p-in">
              <p className="t8p-label">Try it</p>
              <h2 id="hiw-next-h" className="t8p-h">Ready when you are.</h2>
              <div className="t8p-cta"><HomeLink focusReg className="t8p-pill teal">Value a car · Free</HomeLink></div>
              <ul className="t8p-links">
                <li><Link to="/example-report">See an example report</Link></li>
                <li><Link to="/faq">Common questions</Link></li>
                <li><Link to="/pricing">What’s free and what’s £2.99</Link></li>
              </ul>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
