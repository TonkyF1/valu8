import "@/styles/tesla.css";
import { Link } from "react-router-dom";
import { goToReg, HOW_STEPS } from "@/components/home/BuyerSellerSections";
import { PREMIUM_CTA, PREMIUM_NAME } from "@/components/tesla/premium";

const Chev = () => (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6.5L8 10.5L12 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);

export function Steps({ as: H = "h2", label = "How it works", heading = "Three steps to a price.", first = false }: { as?: "h1" | "h2"; label?: string; heading?: string; first?: boolean }) {
  return (
    <section className={`t8p-sec${first ? " first" : ""}`} aria-labelledby="t8p-steps-h">
      <div className="t8p-in">
        <p className="t8p-label teal">{label}</p>
        <H id="t8p-steps-h" className="t8p-h">{heading}</H>
        <ol className="t8p-list">
          {HOW_STEPS.map(([t, d], i) => (
            <li key={t}><span className="n">0{i + 1}</span><div><h3>{t}</h3><p>{d}</p></div></li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function FreeVsPremiumT() {
  const free = ["Private sale estimate from the registration", "Confidence level and the data behind it", "Official DVSA MOT history", "Vehicle details from DVLA records"];
  const buy = ["Suggested opening offer and negotiation range", "How the asking price compares", "MOT and mileage insights with repair cost bands"];
  const sell = ["Suggested asking price and the lowest offer to accept", "Ready-to-post advert text", "Where to sell and documents to have ready"];
  return (
    <section className="t8p-sec" aria-labelledby="t8p-fp-h">
      <div className="t8p-in wide">
        <p className="t8p-label teal">Free or £2.99</p>
        <h2 id="t8p-fp-h" className="t8p-h">Free to value.<br /><em>£2.99 to make the deal.</em></h2>
        <div className="t8p-two">
          <div className="t8p-col">
            <div className="pr">Free valuation · £0</div>
            <h3>What could it be worth?</h3>
            <ul>{free.map((t) => <li key={t}>{t}</li>)}</ul>
            <div className="t8p-cta"><button type="button" className="t8p-pill" onClick={() => goToReg(false)}>Free valuation</button></div>
            <p className="t8p-note">Buying instead? <Link to="/check" className="underline underline-offset-2">Check if an advert is fair</Link>.</p>
          </div>
          <div className="t8p-col">
            <div className="pr">{PREMIUM_NAME} · £2.99</div>
            <h3>What should you do with it?</h3>
            <ul>{[...buy, ...sell].map((t) => <li key={t}>{t}</li>)}</ul>
            <div className="t8p-cta"><button type="button" className="t8p-pill teal" onClick={() => goToReg(true)}>{PREMIUM_CTA}</button></div>
            <p className="t8p-note">One-off payment. No subscription.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FeaturesT({ items }: { items: { title: string; body: string }[] }) {
  return (
    <section className="t8p-sec" aria-labelledby="features-h">
      <div className="t8p-in wide">
        <p className="t8p-label">Every report</p>
        <h2 id="features-h" className="t8p-h">What's in every report</h2>
        <p className="t8p-p">Market data where available, official records always.</p>
        <ul className="t8p-list plain t8p-feat" style={{ display: "grid" }}>
          {items.map((f) => <li key={f.title}><div><h3>{f.title}</h3><p>{f.body}</p></div></li>)}
        </ul>
      </div>
    </section>
  );
}

export function FaqT({ items, as: H = "h2", heading = "Questions", more = false, label = "FAQ" }: { items: { q: string; a: string }[]; as?: "h1" | "h2"; heading?: string; more?: boolean; label?: string }) {
  return (
    <section className={`t8p-sec${H === "h1" ? " first" : ""}`} aria-labelledby="t8p-faq-h">
      <div className="t8p-in">
        <p className="t8p-label teal">{label}</p>
        <H id="t8p-faq-h" className="t8p-h">{heading}</H>
        <div className="t8p-faq">
          {items.map((f, i) => (
            <details key={f.q} open={i === 0}>
              <summary>{f.q}<Chev /></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
        {more && <ul className="t8p-links"><li><Link to="/faq">More questions and answers</Link></li></ul>}
      </div>
    </section>
  );
}
