import "@/styles/buyerSeller.css";
import { Link } from "react-router-dom";
import { IntentSwitch } from "@/components/IntentSwitch";
import { useIntent } from "@/lib/intent";
import { buyerGuide, compareAsking, diffLine, VERDICT_COPY } from "@/lib/buyerGuide";
import { suggestedAskRange } from "@/lib/askingPrice";
import { BENEFITS, PREMIUM_CTA, PREMIUM_NAME } from "@/components/tesla/premium";

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

export const Tick = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="8.25" fill="rgba(0,214,200,.14)" stroke="#00D6C8" strokeWidth="1.2" /><path d="M5.6 9.2l2.2 2.2 4.6-4.7" stroke="#1AFFF0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const TickGrey = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="8.25" fill="rgba(255,255,255,.04)" stroke="rgba(247,245,243,.35)" strokeWidth="1.2" /><path d="M5.6 9.2l2.2 2.2 4.6-4.7" stroke="#F7F5F3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Ic = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d }} />
);
const I = {
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  gauge: '<path d="M12 14l4-4"/><path d="M3.3 17a9 9 0 1117.4 0"/>',
  file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/><path d="M9 14l2 2 4-4"/>',
  cam: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  sig: '<path d="M5 20V14"/><path d="M12 20V8"/><path d="M19 20V4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  pound: '<path d="M17 20H7c2-1.5 2.5-3.5 2.5-6V9a3.5 3.5 0 016.5-1.8"/><path d="M6.5 13.5h8"/>',
  buy: '<path d="M3 6h2l2.2 10.2a1.5 1.5 0 001.5 1.2h8.6a1.5 1.5 0 001.5-1.1L21 9H6.2"/><circle cx="9.5" cy="20.5" r="1"/><circle cx="17.5" cy="20.5" r="1"/>',
  sell: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
};
const Chev = () => (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6.5L8 10.5L12 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);

/** Sends the visitor back up to the registration card (TeslaFlow listens), ready for the premium path. */
export function goToReg(premium: boolean) {
  window.dispatchEvent(new CustomEvent("valu8:reg", { detail: { premium } }));
}

export function PremiumSection() {
  const [intent] = useIntent();
  const b = BENEFITS[intent];
  return (
    <section className="bs-sec" aria-labelledby="bs-premium-h" id="premium-report">
      <div className="bs-ctr"><span className="bs-pill"><i />Valu8 {PREMIUM_NAME}</span></div>
      <h2 id="bs-premium-h" className="bs-h2">A valuation tells you the price. <em>Valu8 helps you make the deal.</em></h2>
      <p className="bs-lead">Turn a car’s estimated value into practical buying or selling guidance. Know what to offer, what to ask and how to negotiate with confidence.</p>
      <IntentSwitch where="home_section" />
      <div className="bs-panel">
        <div className="bs-swap" key={intent}>
          <h3>{b.heading}</h3>
          <p className="d">{b.body}</p>
          <ul className="bs-ben">{b.items.map((t) => <li key={t}><Tick />{t}</li>)}</ul>
        </div>
      </div>
      <button type="button" className="bs-cta" data-testid="section-premium" onClick={() => goToReg(true)}>{PREMIUM_CTA}</button>
      <p className="bs-reass"><b>One-off payment.</b> No subscription.</p>
    </section>
  );
}

/** Illustrative example only. Seller figures follow the report's own asking-price rule; buyer figures use buyerGuide. */
const EX = { tradeIn: 6400, privateSale: 7700, retail: 9100, privateLow: 7500, privateHigh: 7900, asking: 8495 };

export function ExampleReport() {
  const [tab] = useIntent();
  const ask = suggestedAskRange(EX.privateSale);
  const g = buyerGuide(EX)!;
  const c = compareAsking(EX.asking, g)!;
  const lo = Math.min(g.rangeLow, EX.privateLow) * 0.9, hi = Math.max(EX.asking, EX.retail) * 1.02;
  const at = (n: number) => `${((n - lo) / (hi - lo)) * 100}%`;
  return (
    <section className="bs-sec" aria-labelledby="bs-ex-h">
      <h2 id="bs-ex-h" className="bs-h2">See how Valu8 helps you <em>make the right deal.</em></h2>
      <p className="bs-lead">Explore how our premium reports turn vehicle valuations into personalised buying and selling guidance.</p>
      <IntentSwitch size="sm" where="home_example" labels={["Buyer Report", "Seller Report"]} className="bs-tabs" />
      <div className="bs-ex">
        <div className="bs-ex-top">
          <div><div className="bs-ex-n">2018 Ford Fiesta 1.0 EcoBoost</div><div className="bs-ex-m">42,000 miles</div></div>
          <span className="bs-conf">Medium confidence</span>
        </div>
        <dl className="bs-vals">
          <div><dt>Part-exchange</dt><dd>{gbp(EX.tradeIn)}</dd></div>
          <div className="mid"><dt>Private sale</dt><dd>{gbp(EX.privateSale)}</dd></div>
          <div><dt>Dealer retail</dt><dd>{gbp(EX.retail)}</dd></div>
        </dl>
        <div className="bs-swap" key={tab}>
          {tab === "selling" ? (
            <div className="bs-strat">
              <div className="bs-strat-h"><h4>Your Personalised Selling Strategy</h4><span className="bs-ill">Illustrative</span></div>
              <div className="bs-big"><span>Suggested advertised asking price</span><b>{gbp(ask.low)}</b></div>
              <div className="bs-rows">
                <div><span>Estimated selling range</span><b>{gbp(EX.privateLow)} – {gbp(EX.privateHigh)}</b></div>
                <div><span>Negotiation target</span><b className="t">Hold out for {gbp(EX.privateSale)}</b></div>
                <div><span>Lowest offer to accept</span><b>{gbp(EX.privateLow)}</b></div>
              </div>
              <div className="bs-advp">
                <div className="al"><span>Ready-to-use advert</span><span style={{ color: "#1AFFF0" }}>Copy</span></div>
                2018 Ford Fiesta 1.0 EcoBoost, 42,000 miles. Six MOT passes with the mileage consistent at every test. Two minor advisories on the latest MOT. Light scuff on the rear bumper, priced to reflect it. Drives well and ready for a new owner.
              </div>
            </div>
          ) : (
            <div className="bs-strat">
              <div className="bs-strat-h"><h4>Your Personalised Buying Strategy</h4><span className="bs-ill">Illustrative</span></div>
              <div className="bs-big"><span>Estimated fair purchase price</span><b>{gbp(g.fairPrice)}</b></div>
              <div className="bs-rows">
                <div><span>Suggested opening offer</span><b className="t">{gbp(g.openingOffer)}</b></div>
                <div><span>Negotiation range</span><b>{gbp(g.rangeLow)} – {gbp(g.rangeHigh)}</b></div>
              </div>
              <div className="bs-cmp">
                <div className="al"><span>Advertised asking price</span><span style={{ color: "#F7F5F3", letterSpacing: 0, textTransform: "none", font: "600 14px Inter,sans-serif" }}>{gbp(EX.asking)}</span></div>
                <div className="bs-bar" aria-hidden>
                  <div className="zone" style={{ left: at(g.rangeLow), width: `calc(${at(g.rangeHigh)} - ${at(g.rangeLow)})` }} />
                  <div className="mk" style={{ left: at(EX.asking) }}><span>Asking</span></div>
                  <span className="lb" style={{ left: at(g.rangeLow) }}>{gbp(g.rangeLow)}</span>
                  <span className="lb" style={{ left: at(g.rangeHigh) }}>{gbp(g.rangeHigh)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="bs-ver">{VERDICT_COPY[c.verdict].label}</span><span className="bs-small">{diffLine(c)}</span></div>
              </div>
            </div>
          )}
        </div>
        <ul className="bs-ben" style={{ marginTop: 12 }}>
          <li style={{ fontSize: 13, color: "#ADADAD", fontWeight: 400 }}><TickGrey />Priced from comparable UK adverts, each adjusted to this car’s age and mileage</li>
          <li style={{ fontSize: 13, color: "#ADADAD", fontWeight: 400 }}><TickGrey />MOT: 6 passes, 2 minor advisories, mileage consistent</li>
        </ul>
      </div>
      <p className="bs-disc">Illustrative example only, not a real vehicle or valuation.</p>
      <button type="button" className="bs-cta" onClick={() => goToReg(true)}>{PREMIUM_CTA}</button>
      <p className="bs-reass"><b>One-off payment.</b> No subscription.</p>
    </section>
  );
}

export function FreeVsPremium() {
  return (
    <section className="bs-sec wide" aria-labelledby="bs-fp-h">
      <h2 id="bs-fp-h" className="bs-h2">Free to value.<br /><em>£2.99 to make the deal.</em></h2>
      <div className="bs-fp">
        <div className="bs-card">
          <div className="hd"><span className="nm">Free Valuation</span><span className="pr">£0</span></div>
          <h3>Find out what a car could be worth.</h3>
          <ul>
            {["Private sale estimate from the registration", "Confidence level and the data behind it", "Official DVSA MOT history", "Vehicle details from DVLA records"].map((t) => <li key={t}><TickGrey />{t}</li>)}
          </ul>
          <button type="button" className="bs-ghost" onClick={() => goToReg(false)}>Free Valuation</button>
          <p className="bs-reass">Buying instead? <Link to="/check" className="bs-link">Check if an advert is fair</Link></p>
        </div>
        <div className="bs-card p">
          <div className="hd"><span className="nm">{PREMIUM_NAME}</span><span className="pr">£2.99</span></div>
          <h3>Know what to do with that valuation.</h3>
          <div className="sub">If you’re buying</div>
          <ul>{["Suggested opening offer", "Indicative negotiation range", "How the asking price compares", "MOT and mileage insights, with repair cost bands"].map((t) => <li key={t}><Tick />{t}</li>)}</ul>
          <div className="sub">If you’re selling</div>
          <ul>{["Suggested advertised asking price", "The lowest offer to accept", "Ready-to-post advert text", "Where to sell and documents to have ready"].map((t) => <li key={t}><Tick />{t}</li>)}</ul>
          <button type="button" className="bs-cta" onClick={() => goToReg(true)}>{PREMIUM_CTA}</button>
          <p className="bs-reass"><b>One-off payment.</b> No subscription.</p>
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [["Registration", "Enter the number plate of the car you’re buying or selling"], ["Details", "Confirm the mileage, trim and history"], ["Photos", "Add a few photos (optional) for a condition score"], ["Result", "Get a free valuation, then unlock buying or selling guidance"]];
  return (
    <section className="bs-sec wide" aria-labelledby="bs-how-h">
      <h2 id="bs-how-h" className="bs-h2">How it works</h2>
      <ol className="bs-steps">{steps.map(([t, d], i) => <li key={t}><span className="n">{i + 1}</span><div><b>{t}</b><span>{d}</span></div></li>)}</ol>
    </section>
  );
}

export function ValuationContext() {
  const rows: [string, string, string][] = [
    [I.chart, "Comparable UK adverts", "We look at typical asking prices for the same make and model in UK adverts."],
    [I.gauge, "Age and mileage", "Each comparable is adjusted to the car’s age and mileage, so like is compared with like."],
    [I.file, "MOT history", "Official DVSA records add context: passes, advisories and the mileage at every test."],
    [I.cam, "Condition", "Optional photos let us flag visible wear and selling points that can move the estimate."],
  ];
  return (
    <section className="bs-sec" aria-labelledby="bs-ctx-h">
      <h2 id="bs-ctx-h" className="bs-h2">More than a number.<br /><em>A valuation with context.</em></h2>
      <p className="bs-lead">How Valu8 reaches its estimates, in plain English.</p>
      <div className="bs-ctx">
        {rows.map(([d, t, p]) => <div className="r" key={t}><span className="bs-ic"><Ic d={d} /></span><div><h3>{t}</h3><p>{p}</p></div></div>)}
        <div className="r"><span className="bs-ic"><Ic d={I.sig} /></span><div><h3>Confidence rating</h3><p>Shows how much comparable market data sits behind the estimate. Low confidence means fewer similar cars, so treat the figure as a rougher guide.</p><div className="bs-cbad"><span className="h">High</span><span>Medium</span><span>Low</span></div></div></div>
      </div>
      <div className="bs-indep"><Ic d={I.shield} /><p>Valu8 doesn’t buy or sell vehicles. We provide valuations to help you make more informed decisions.</p></div>
      <p className="bs-disc">Valuations and negotiation ranges are estimates, not guaranteed prices. They don’t replace a vehicle history check or a mechanical inspection.</p>
    </section>
  );
}

export function WhyValu8() {
  const items: [string, string, string][] = [
    [I.chart, "Understand the market", "See estimated vehicle values informed by relevant market information."],
    [I.buy, "Buy with confidence", "Understand what a car may be worth before making an offer."],
    [I.sell, "Sell smarter", "Choose a realistic asking price and approach negotiations prepared."],
    [I.shield, "Independent valuations", "We don’t buy or sell cars, so our service isn’t designed to generate purchase offers for your vehicle."],
    [I.pound, "Affordable insights", "Get personalised buying or selling guidance for just £2.99."],
  ];
  return (
    <section className="bs-sec wide" aria-labelledby="bs-why-h">
      <div className="bs-ctr"><span className="bs-pill"><i />Why Valu8?</span></div>
      <h2 id="bs-why-h" className="bs-h2">Built for both sides<br /><em>of the deal.</em></h2>
      <div className="bs-why">{items.map(([d, t, p]) => <div className="w" key={t}><span className="bs-ic"><Ic d={d} /></span><div><h3>{t}</h3><p>{p}</p></div></div>)}</div>
    </section>
  );
}

export const FAQS: { q: string; a: string }[] = [
  { q: "Is the car valuation really free?", a: "Yes. The free valuation gives a private sale estimate, its confidence level and the official DVSA MOT history, with no payment needed." },
  { q: "What is included in the £2.99 premium report?", a: "For selling: a suggested asking price, the lowest offer to accept, ready-to-post advert text and selling tips. For buying: an estimated fair price, a suggested opening offer, an indicative negotiation range and a comparison with the advertised asking price if you add it. Both include the UK adverts we compared, the full MOT history with repair cost bands and a PDF to keep." },
  { q: "What’s the difference between the Buyer and Seller reports?", a: "They use the same valuation. The Buyer report focuses on what to offer and how an asking price compares. The Seller report focuses on what to ask, the lowest offer to accept and an advert ready to post. You can switch between them in your report at any time." },
  { q: "How are the valuations calculated?", a: "We start from typical asking prices in comparable UK adverts for the make and model, adjust them for age and mileage, then take account of the MOT history and, if you add photos, visible condition. Where data is thin we add an AI market estimate, clearly labelled. Each valuation shows a confidence level." },
  { q: "Can I value a car I don’t own?", a: "Yes. Enter any UK registration, whether it’s your own car or one you’re thinking of buying." },
  { q: "Are the prices guaranteed?", a: "No. Valuations and negotiation ranges are estimates to help you decide. The final price depends on the car, its condition and the people involved." },
  { q: "Does Valu8 buy cars?", a: "No. Valu8 doesn’t buy or sell vehicles. We provide valuations to help you make more informed decisions." },
  { q: "Can I download my premium report?", a: "Yes. The premium report includes a PDF you can keep or share." },
  { q: "Is the £2.99 payment a subscription?", a: "No. It’s a one-off payment for one car’s report." },
  { q: "Can I use the advert text on car-selling websites?", a: "Yes. The advert text is yours to copy into any UK car advert. Check it matches the car before you post it." },
  { q: "Where does the data come from?", a: "MOT history comes from the official DVSA database. Market prices are estimates built from comparable UK adverts. Photo condition checks are done by AI. Tax and ULEZ figures are estimates with links to the official checkers." },
  { q: "Who can see my valuation?", a: "Your valuations are private to your account unless you choose to share a report link. See our privacy policy for how data is handled." },
];

export function Faq() {
  return (
    <section className="bs-sec" aria-labelledby="bs-faq-h">
      <h2 id="bs-faq-h" className="bs-h2">Questions</h2>
      <div className="bs-faq">
        {FAQS.map((f, i) => (
          <details key={f.q} open={i === 0}>
            <summary>{f.q}<Chev /></summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
      <button type="button" className="bs-cta" style={{ marginTop: 22 }} onClick={() => goToReg(false)}>Value a car · Free</button>
      <p className="bs-reass">Enter a registration to start.</p>
    </section>
  );
}
