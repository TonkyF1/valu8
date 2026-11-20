// The site's single FAQ list (Node-safe). BuyerSellerSections.tsx re-exports it as FAQS for the visible FAQs on
// / and /faq, and the build uses it for their prebuilt HTML and FAQPage JSON-LD, so all of them always match.
export type SiteFaq = { q: string; a: string };

export const SITE_FAQS: SiteFaq[] = [
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

/** The homepage shows the first four (Landing.tsx: FAQS.slice(0, 4)), with "More questions" linking to /faq. */
export const HOME_FAQ_COUNT = 4;
export const HOME_FAQS = SITE_FAQS.slice(0, HOME_FAQ_COUNT);

export const faqPageJsonLd = (items: SiteFaq[]) => JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
}).replace(/</g, "\\u003c");
