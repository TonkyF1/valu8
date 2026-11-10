import { embedInfoBodyHtml } from "./embedContent";
import { escapeHtml } from "../../scripts/routeHtml";

/** Render non-interactive page copy into the build-time HTML root. React replaces it on mount. */
function page(title: string, intro: string, sections: [string, string][]): string {
  return `<main id="main"><header><h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p></header>${sections.map(([heading, body]) => `<section><h2>${escapeHtml(heading)}</h2><p>${body}</p></section>`).join("")}</main>`;
}

const homepageFaqJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    ["How is the valuation worked out?", "Prices are estimated from comparable UK adverts for your make and model, adjusted for your car's age and mileage. Every report shows its confidence level and how the figure was built."],
    ["Where does the data come from?", "MOT history comes from the official DVSA database. Market prices are estimates built from comparable UK adverts plus an AI market estimate, and are clearly labelled as estimates. Photo condition checks are done by AI."],
    ["Is it really free?", "The valuation (Essentials) is free. The Full seller report is a one-off £2.99 — no subscription. Pay by card, Apple Pay or Google Pay."],
    ["Do I need photos?", "No, but adding a few lets us spot condition issues and selling points that move the price, and gives you better advert copy."],
    ["Who can see my valuation?", "Your valuations are private to your account unless you choose to share a report link. See our privacy policy for how data is handled."],
    ["Should I sell privately or part-exchange?", "Your report shows both. Private sale usually gets more money; part-exchange is quicker. We show the gap so you can decide if it's worth it."],
  ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
});

const legalSections: Record<string, [string, string][]> = {
  "/privacy": [
    ["1. Who we are", "Valu8 (valu8.uk) gives free car valuations to people in the United Kingdom. Valu8 is the data controller for the personal data described here. You can reach us at <a href=\"mailto:hello@valu8.uk\">hello@valu8.uk</a>. ICO registration pending."],
    ["2. What we collect", "Your registration number; valuation inputs; optional email address; anonymous funnel steps; campaign tags (utm_source, utm_medium, utm_campaign) and referring site details, saved with each valuation; and, only if you accept, analytics and Meta advertising measurement. Submissions can include make, model, trim, year, mileage, condition answers, notes and photos."],
    ["3. Why we use it", "To provide and save your valuation, send requested emails, keep the service secure, understand and improve the service, and, only with your consent, measure usage and our Facebook and Instagram ads. We never sell your personal data."],
    ["4. Who processes it for us", "Processors include Supabase via Lovable Cloud, the Lovable AI gateway, DVSA and vehicle-data providers, our email provider, Stripe for payments, Cloudflare Turnstile and, with your consent, PostHog EU and Meta (Meta Pixel and Conversions API, with emails hashed). Appropriate safeguards protect data transferred outside the UK."],
    ["5. How long we keep it", "Account data and saved valuations are kept until deletion. Guest valuation links continue to work unless you ask us to delete them. Alert emails are kept until you unsubscribe. Anonymous funnel steps are kept for up to 13 months."],
    ["6. Your rights", "Under UK GDPR you can request access, correction, export, deletion or restriction of your personal data. Withdraw email consent through an unsubscribe link, or email hello@valu8.uk. You can also complain to the Information Commissioner's Office."],
    ["7. Cookies and browser storage", "Essential storage supports sign-in, cookie choices, attribution and guest valuation access; campaign tags stay in session storage for one tab. Analytics and Meta advertising cookies are set only if you click Accept. Reject is as easy as Accept, and you can change your choice through Cookie settings in the footer."],
    ["8. Contact", "For privacy questions or requests, email <a href=\"mailto:hello@valu8.uk\">hello@valu8.uk</a>. Last updated: 10 November 2026."],
  ],
  "/terms": [
    ["1. Acceptance", "By using Valu8 you agree to these terms. If you do not agree, do not use the service."],
    ["2. The service", "Valu8 generates indicative AI valuations for used vehicles in the UK private sale market. The service is provided as is. Essentials valuations are free; the Full seller report is a one-off £2.99 with no subscription."],
    ["3. Acceptable use", "Submit only vehicles you own or are authorised to value. Do not upload third-party personal data or attempt to reverse-engineer, scrape or abuse the service."],
    ["4. Accuracy and no warranty", "Valuations are estimates only and may vary materially from actual sale prices. Valu8 provides no warranty as to accuracy, fitness for purpose or merchantability."],
    ["5. Liability", "To the maximum extent permitted by law, Valu8 is not liable for losses arising from reliance on a valuation, including missed sale opportunities or undervaluation or overvaluation."],
    ["6. Account termination", "We may suspend or terminate accounts that breach these terms. You may close your account at any time."],
    ["7. Governing law", "These terms are governed by the laws of England and Wales."],
    ["8. Contact", "Questions about these terms? Email <a href=\"mailto:hello@valu8.uk\">hello@valu8.uk</a>. Last updated: 16 May 2026."],
  ],
  "/disclaimers": [
    ["AI-generated estimates", "Each report combines UK adverts from our database and DVSA data with a general-purpose AI model that reads your photos and details. Results are indicative and will vary from actual sale prices depending on local demand, time of year and buyer competition."],
    ["Data sources", "Valuations are AI market estimates informed by our own UK comparable-sales data. MOT history is retrieved from the official DVSA MOT History API. Where any provider is unavailable we fall back to an estimate and label it clearly inside the report."],
    ["Not financial advice", "Valu8 reports do not constitute financial, legal or commercial advice. Always carry out an independent vehicle history check and arrange a viewing or inspection before transacting."],
    ["Who runs Valu8", "Valu8 is an independent UK car valuation service for private sellers and buyers."],
    ["Liability", "Valu8 accepts no liability for outcomes arising from reliance on a valuation. By using the service you acknowledge the indicative nature of the results."],
  ],
};

export function staticPageBodyHtml(path: string): string | undefined {
  if (path === "/") {
    return page("What's your car worth? Find out free from your number plate.", "Private sale, part-exchange and dealer estimates, plus your full MOT history, in about two minutes. No sign-up.", [
      ["We don't buy cars", "We don't buy cars, so we've no reason to nudge your number up or down. Independent: we don't buy, sell or broker cars. Three prices, not one: private sale, part-ex and dealer. Official DVSA MOT history and mileage records. Optional photo condition score. Free, no account needed."],
      ["Free UK car valuation", "Get a valuation with no sign-up. Your report includes official DVSA MOT data where available. <a href=\"/valuation/new\">Start your free valuation</a> or <a href=\"/check\">check if a used car advert is fairly priced</a>."],
      ["How it works", "Enter your registration and mileage, confirm the car and add service notes, optionally add photos for a condition score, then get your valuation and report."],
      ["What's in every report", "Market-based private-sale, trade-in and dealer estimates; optional photo condition checks; official DVSA MOT history; mileage consistency information; a GOV.UK recall-check link; and estimated tax and clean-air-zone information with links to official checkers."],
      ["Private sale, part-exchange or dealer price", "Your report shows the different price types so you can choose a selling route and set an asking price with room to negotiate. All figures are estimates, not guaranteed offers."],
      ["Questions", "Essentials is free. The optional Full seller report is a one-off £2.99 with no subscription. Photos are optional. Valuations remain private unless you share a report link."],
      ["Popular car valuations", "Explore <a href=\"/car-values\">free car values by make and model</a> or read our <a href=\"/guides\">UK car valuation, buying and selling guides</a>."],
    ]);
  }
  const simple: Record<string, [string, string, [string, string][]]> = {
    "/valuation/new": ["Know exactly what your car is worth", "Enter your UK registration to start a free private-sale valuation.", [["Start with your registration", "We look up the vehicle record and MOT history, then you can confirm details, mileage, service history and photos. <a href=\"/car-values\">Browse car values by model</a>."], ["Free valuation, no sign-up", "Essentials valuations are free. An optional Full seller report is available for a one-off £2.99. Valuation figures are estimates, not guaranteed offers."]]],
    "/check": ["Is this used car a fair price?", "Copy in the details from any UK car advert to compare its asking price with our estimated private-sale and dealer ranges.", [["Check a used car advert", "Enter the make, model, year, mileage and asking price, with an optional advert link and seller type. The check is free and no account is needed."], ["Understand the result", "Results give an estimated market-based starting point for questions and negotiation. They do not replace a viewing, inspection or independent vehicle history check."]]],
    "/accuracy": ["How accurate are we?", "We compare our private-sale estimates with the prices our users report selling for.", [["Collecting real sale feedback", "We will publish predicted-versus-sold figures once at least 20 owners have reported sale prices. Every reported sale counts, with no cherry-picking."], ["Why estimates differ from dealer adverts", "Dealer asking prices can include preparation, warranty and margin, and are a starting point for negotiation. A private-sale estimate normally sits below them."]]],
    "/pricing": ["A price you can defend, without paying a dealer's margin", "Essentials is free. Unlock the Full seller report for a one-off £2.99 when you want the extra detail.", [["Essentials — free", "Includes an instant valuation from reg and mileage, private-sale, part-exchange and dealer figures, DVSA MOT history and mileage information, a GOV.UK recall-check link, tax and clean-air-zone estimates, and advert price checks."], ["Full seller report — £2.99 one-off", "Adds comparable UK advert pricing, optional AI photo condition scoring, a suggested asking price and negotiation buffer, ready-to-post advert copy, advisory repair-cost bands and a shareable report. Pay by card, Apple Pay or Google Pay. No subscription."]]],
    "/about": ["About Valu8", "Valu8 is an independent car valuation tool for UK private sellers and buyers.", [["How valuations work", "Where there are enough UK adverts for your make and model, we use them to estimate the price and adjust for age and mileage. MOT history comes from the official DVSA database. Photo condition checks are optional and use AI. Every report shows a confidence level; figures are estimates, not financial advice or guaranteed sale prices."], ["Still improving", "Valu8 is new and still improving. Essentials valuations are free and the Full seller report is a one-off £2.99. Some estimates will be less precise than others while our data grows."], ["Contact", "Email <a href=\"mailto:hello@valu8.uk\">hello@valu8.uk</a>. We aim to reply within a few working days."]]],
    "/contact": ["Get in touch", "Valu8 is an independent car valuation tool for UK private sellers and buyers.", [["Contact Valu8", "Questions about a valuation, your account or feedback? Email <a href=\"mailto:hello@valu8.uk\">hello@valu8.uk</a>. We aim to reply within a few working days."], ["Using Valu8", "Start a <a href=\"/valuation/new\">free car valuation</a>, check an advert asking price, read our guides or learn more about how valuations work. Figures are estimates and not guaranteed sale prices."]]],
  };
  if (simple[path]) return page(...simple[path]);
  if (path === "/embed-info") return embedInfoBodyHtml();
  if (path === "/privacy") return page("Privacy Policy", "How Valu8 collects, uses and protects your data under UK GDPR.", legalSections[path]);
  if (path === "/terms") return page("Terms of Service", "The terms for using Valu8 car valuations.", legalSections[path]);
  if (path === "/disclaimers") return page("Disclaimers & Data Sources", "Honest small print so you know exactly what a Valu8 report is — and isn't.", legalSections[path]);
  return undefined;
}

export const homepageFaqHeadHtml = `<script type="application/ld+json" id="homepage-faq-jsonld">${homepageFaqJsonLd}</script>`;
