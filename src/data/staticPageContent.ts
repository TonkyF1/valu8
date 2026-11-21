import { embedInfoBodyHtml } from "./embedContent";
import { escapeHtml } from "../../scripts/routeHtml";
import { popularModelsHtml } from "./popularModels";
import { HOME_FAQS, SITE_FAQS, faqPageJsonLd, type SiteFaq } from "./siteFaqs";

/** Render non-interactive page copy into the build-time HTML root. React replaces it on mount. */
function page(title: string, intro: string, sections: [string, string][]): string {
  return `<main id="main"><header><h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p></header>${sections.map(([heading, body]) => `<section><h2>${escapeHtml(heading)}</h2><p>${body}</p></section>`).join("")}</main>`;
}

// FAQPage JSON-LD must match the FAQs a visitor can see: the homepage shows the first four, /faq shows them all.
const homepageFaqJsonLd = faqPageJsonLd(HOME_FAQS);

/** Build-time HTML with raw section bodies (lists, h3s), for pages whose copy isn't one paragraph per section. */
function richPage(title: string, intro: string, sections: [string, string][]): string {
  return `<main id="main"><header><h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p></header>${sections.map(([heading, body]) => `<section><h2>${escapeHtml(heading)}</h2>${body}</section>`).join("")}</main>`;
}
const p = (t: string) => `<p>${escapeHtml(t)}</p>`;
const items = (rows: [string, string][]) => rows.map(([h, t]) => `<h3>${escapeHtml(h)}</h3>${p(t)}`).join("");
const faqItems = (list: SiteFaq[]) => list.map((f) => `<h3>${escapeHtml(f.q)}</h3>${p(f.a)}`).join("");
const READY_LINKS = '<p><a href="/">Value a car, free</a> · <a href="/pricing">Pricing</a> · <a href="/guides">Guides</a> · <a href="/faq">FAQ</a></p>';

// Copy for /how-it-works, /faq and /example-report mirrors HowItWorksPage, FaqPage and ExampleReportPage
// (sections from src/components/home/BuyerSellerSections.tsx). React replaces it on mount.
const HOW_STEPS: [string, string][] = [["Registration", "Enter the number plate of the car you’re buying or selling"], ["Details", "Confirm the mileage, trim and history"], ["Photos", "Add a few photos (optional) for a condition score"], ["Result", "Get a free valuation, then unlock buying or selling guidance"]];
const howStepsHtml = `<ol>${HOW_STEPS.map(([t, d]) => `<li><strong>${escapeHtml(t)}</strong>: ${escapeHtml(d)}</li>`).join("")}</ol>`;

function howItWorksBodyHtml(): string {
  return richPage("How Valu8 works", "Enter a UK number plate and get a free private-sale estimate built from comparable adverts, adjusted for age and mileage and backed by official MOT history.", [
    ["How it works", howStepsHtml],
    ["More than a number. A valuation with context.", p("How Valu8 reaches its estimates, in plain English.") + items([
      ["Comparable UK adverts", "We look at typical asking prices for the same make and model in UK adverts."],
      ["Age and mileage", "Each comparable is adjusted to the car’s age and mileage, so like is compared with like."],
      ["MOT history", "Official DVSA records add context: passes, advisories and the mileage at every test."],
      ["Condition", "Optional photos let us flag visible wear and selling points that can move the estimate."],
      ["Confidence rating", "Shows how much comparable market data sits behind the estimate. Low confidence means fewer similar cars, so treat the figure as a rougher guide."],
    ]) + p("Valu8 doesn’t buy or sell vehicles. We provide valuations to help you make more informed decisions.") + p("Valuations and negotiation ranges are estimates, not guaranteed prices. They don’t replace a vehicle history check or a mechanical inspection.")],
    ["Built for both sides of the deal.", items([
      ["Understand the market", "See estimated vehicle values informed by relevant market information."],
      ["Buy with confidence", "Understand what a car may be worth before making an offer."],
      ["Sell smarter", "Choose a realistic asking price and approach negotiations prepared."],
      ["Independent valuations", "We don’t buy or sell cars, so our service isn’t designed to generate purchase offers for your vehicle."],
      ["Affordable insights", "Get personalised buying or selling guidance for just £2.99."],
    ])],
    ["Ready to value your car?", READY_LINKS + '<p><a href="/example-report">See an example report</a></p>'],
  ]);
}

function faqBodyHtml(): string {
  return richPage("Car valuation FAQs", "Straight answers about how Valu8 values a car, what is free and what the £2.99 report adds.", [
    ["Questions", faqItems(SITE_FAQS)],
    ["Ready to value your car?", READY_LINKS.replace(' · <a href="/faq">FAQ</a>', ' · <a href="/how-it-works">How Valu8 works</a>')],
  ]);
}

function exampleReportBodyHtml(): string {
  return richPage("Example Valu8 car valuation report", "An illustrative report for a made-up car, showing the buying and selling guidance the £2.99 report adds to the free valuation.", [
    ["See how Valu8 helps you make the right deal.", p("Explore how our premium reports turn vehicle valuations into personalised buying and selling guidance.")
      + p("Example car: 2018 Ford Fiesta 1.0 EcoBoost, 42,000 miles, medium confidence.")
      + '<ul><li>Part-exchange: £6,400</li><li>Private sale: £7,700</li><li>Dealer retail: £9,100</li></ul>'
      + items([
        ["Your Personalised Selling Strategy", "A suggested advertised asking price, an estimated selling range of £7,500 to £7,900, a negotiation target of £7,700 and the lowest offer to accept, plus a ready-to-use advert: 2018 Ford Fiesta 1.0 EcoBoost, 42,000 miles. Six MOT passes with the mileage consistent at every test. Two minor advisories on the latest MOT. Light scuff on the rear bumper, priced to reflect it. Drives well and ready for a new owner."],
        ["Your Personalised Buying Strategy", "An estimated fair purchase price, a suggested opening offer and a negotiation range, compared with the advertised asking price of £8,495."],
      ])
      + p("Priced from comparable UK adverts, each adjusted to this car’s age and mileage. MOT: 6 passes, 2 minor advisories, mileage consistent.")
      + p("Illustrative example only, not a real vehicle or valuation.")],
    ["A valuation tells you the price. Valu8 helps you make the deal.", p("Turn a car’s estimated value into practical buying or selling guidance. Know what to offer, what to ask and how to negotiate with confidence. One-off payment. No subscription.")],
    ["Ready to value your car?", READY_LINKS],
  ]);
}


const legalSections: Record<string, [string, string][]> = {
  "/privacy": [
    ["1. Who we are", "Valu8 (valu8.uk) gives free car valuations to people in the United Kingdom. Valu8 is the data controller for the personal data described here. You can reach us at <a href=\"mailto:hello@valu8.uk\">hello@valu8.uk</a>. Registered with the Information Commissioner's Office, registration reference <strong>ZC283979</strong>, registered 4 November 2026."],
    ["2. What we collect", "Your registration number; valuation inputs; optional email address; anonymous funnel steps; campaign tags (utm_source, utm_medium, utm_campaign) and referring site details, saved with each valuation; and, only if you accept, analytics and Meta advertising measurement. Submissions can include make, model, trim, year, mileage, condition answers, notes and photos."],
    ["3. Why we use it", "To provide and save your valuation, send requested emails, keep the service secure, understand and improve the service, and, only with your consent, measure usage and our Facebook and Instagram ads. We never sell your personal data."],
    ["4. Who processes it for us", "Processors include Supabase via Lovable Cloud, the Lovable AI gateway, DVSA and vehicle-data providers, our email provider, Stripe for payments, carVertical (an affiliate link we earn a commission from if you buy; if you click the vehicle history check link, the car's registration is passed to carVertical so it can open that car's check; we share no other data with them), Cloudflare Turnstile and, with your consent, PostHog EU and Meta (Meta Pixel and Conversions API, with emails hashed). Appropriate safeguards protect data transferred outside the UK."],
    ["5. How long we keep it", "Account data and saved valuations are kept until deletion. Guest valuation links continue to work unless you ask us to delete them. Alert emails are kept until you unsubscribe. Anonymous funnel steps are kept for up to 13 months."],
    ["6. Your rights", "Under UK GDPR you can request access, correction, export, deletion or restriction of your personal data. Withdraw email consent through an unsubscribe link, or email hello@valu8.uk. You can also complain to the Information Commissioner's Office."],
    ["7. Cookies and browser storage", "Essential storage supports sign-in, cookie choices, attribution and guest valuation access; campaign tags stay in session storage for one tab. Analytics and Meta advertising cookies are set only if you click Accept. Reject is as easy as Accept, and you can change your choice through Cookie settings in the footer."],
    ["8. Contact", "For privacy questions or requests, email <a href=\"mailto:hello@valu8.uk\">hello@valu8.uk</a>. Last updated: 18 November 2026."],
  ],
  "/terms": [
    ["1. Acceptance", "By using Valu8 you agree to these terms. If you do not agree, do not use the service."],
    ["2. The service", "Valu8 generates indicative AI valuations for used vehicles in the UK private sale market. The service is provided as is. Essentials valuations are free; the Full seller report is a one-off £2.99 with no subscription."],
    ["3. Acceptable use", "Value only vehicles you own, are selling or are considering buying, or are otherwise authorised to value. Do not upload third-party personal data or attempt to reverse-engineer, scrape or abuse the service."],
    ["4. Accuracy and no warranty", "Valuations are estimates only and may vary materially from actual sale prices. Valu8 provides no warranty as to accuracy, fitness for purpose or merchantability."],
    ["5. Liability", "To the maximum extent permitted by law, Valu8 is not liable for losses arising from reliance on a valuation, including missed sale opportunities or undervaluation or overvaluation."],
    ["6. Account termination", "We may suspend or terminate accounts that breach these terms. You may close your account at any time."],
    ["7. Governing law", "These terms are governed by the laws of England and Wales."],
    ["8. Contact", "Questions about these terms? Email <a href=\"mailto:hello@valu8.uk\">hello@valu8.uk</a>. Last updated: 17 November 2026."],
  ],
  "/disclaimers": [
    ["AI-generated estimates", "Each report combines UK adverts from our database and DVSA data with a general-purpose AI model that reads your photos and details. Results are indicative and will vary from actual sale prices depending on local demand, time of year and buyer competition."],
    ["Data sources", "Valuations are AI market estimates informed by our own UK comparable-sales data. MOT history is retrieved from the official DVSA MOT History API. Where any provider is unavailable we fall back to an estimate and label it clearly inside the report."],
    ["Not financial advice", "Valu8 reports do not constitute financial, legal or commercial advice. Always carry out an independent vehicle history check and arrange a viewing or inspection before transacting."],
    ["Who runs Valu8", "Valu8 is an independent UK car valuation service for private sellers and buyers."],
    ["Liability", "Valu8 accepts no liability for outcomes arising from reliance on a valuation. By using the service you acknowledge the indicative nature of the results."],
  ],
};

/** Homepage hero: the H1 carries the search terms; the brand line moves into the intro. Mirrored in TeslaFlow.tsx. */
export const HOMEPAGE_H1 = "Free car valuation by registration";
/** Prerendered intro under the H1. Tony removed the visible hero tagline (21 Nov 2026), so this only repeats what the
 *  hero still shows (the "Buying or Selling, Know the right price" line by the reg box) plus what the free valuation gives. */
export const HOMEPAGE_INTRO = "Buying or selling, know the right price. Enter a UK number plate for a free car valuation: an estimated private-sale value with official DVSA MOT history.";

export function staticPageBodyHtml(path: string): string | undefined {
  if (path === "/") {
    return page(HOMEPAGE_H1, HOMEPAGE_INTRO, [
      ["We don't buy cars", "We don't buy cars, so we've no reason to nudge your number up or down. Independent: we don't buy, sell or broker cars. The free valuation gives a private-sale estimate, and the £2.99 Full report adds part-ex and dealer prices. Official DVSA MOT history and mileage records. Optional photo condition score. Free guest valuations are limited each day; a free account gives you more."],
      ["Free UK car valuation", "Buying or selling, get a free valuation from the number plate. Your report includes official DVSA MOT data where available. <a href=\"/valuation/new\">Start your free valuation</a> or <a href=\"/check\">check if a used car advert is fairly priced</a>."],
      ["Buying a used car?", "<a href=\"/check\">Check an advert</a>: copy in the details from any UK car advert to see how the asking price compares with our estimated ranges."],
      ["Free to value. £2.99 to make the deal.", "The free valuation gives a private-sale estimate from the registration, its confidence level and the data behind it, official DVSA MOT history and vehicle details from DVLA records. The £2.99 Premium Valuation Report adds guidance for buyers (a suggested opening offer, an indicative negotiation range and how the asking price compares) and sellers (a suggested advertised asking price, the lowest offer to accept and ready-to-post advert text). <a href=\"/pricing\">See pricing</a>."],
      ["How it works", "Enter the number plate of the car you're buying or selling, confirm the mileage, trim and history, optionally add a few photos for a condition score, then get a free valuation and unlock buying or selling guidance. <a href=\"/how-it-works\">How Valu8 works</a>."],
      ["What's in every report", "A market-based private-sale estimate, with part-exchange and dealer estimates in the £2.99 Full report; optional photo condition checks; official DVSA MOT history; mileage consistency information; a GOV.UK recall-check link; and estimated tax and clean-air-zone information with links to official checkers. <a href=\"/example-report\">See an example report</a>."],
    ]).replace(/<\/main>$/, `<section><h2>Questions</h2>${faqItems(HOME_FAQS)}<p><a href="/faq">More questions</a></p></section>`
      + '<section><h2>More about Valu8</h2><p><a href="/example-report">See an example report</a> · <a href="/how-it-works">How Valu8 works</a> · <a href="/guides">Guides</a></p></section>'
      + `<section><h2>Popular car valuations</h2><p>Explore <a href="/value">typical UK asking prices by make and model</a> or read our <a href="/guides">UK car valuation, buying and selling guides</a>.</p></section>`
      + popularModelsHtml() + "</main>");
  }
  const simple: Record<string, [string, string, [string, string][]]> = {
    "/valuation/new": ["Find out what your car is worth", "Enter your UK registration to start a free private-sale valuation.", [["Start with your registration", "We look up the vehicle record and MOT history, then you can confirm details, mileage, service history and photos. <a href=\"/value\">Browse car values by model</a>."], ["Free valuation", "Essentials valuations are free, with a daily limit for guests. An optional Full seller report is available for a one-off £2.99. Valuation figures are estimates, not guaranteed offers."]]],
    "/check": ["Is this used car a fair price?", "Copy in the details from any UK car advert to compare its asking price with our estimated private-sale and dealer ranges.", [["Check a used car advert", "Enter the make, model, year, mileage and asking price, with an optional advert link and seller type. The check is free. Guests get a few checks each day, and a free account gives you more."], ["Understand the result", "Results give an estimated market-based starting point for questions and negotiation. They do not replace a viewing, inspection or independent vehicle history check."]]],
    "/accuracy": ["How accurate are we?", "We compare our private-sale estimates with the prices our users report selling for.", [["Collecting real sale feedback", "We will publish predicted-versus-sold figures once at least 20 owners have reported sale prices. Every reported sale counts, with no cherry-picking."], ["Why estimates differ from dealer adverts", "Dealer asking prices can include preparation, warranty and margin, and are a starting point for negotiation. A private-sale estimate normally sits below them."]]],
    "/pricing": ["A price you can defend, without paying a dealer's margin", "Essentials is free. Unlock the Full seller report for a one-off £2.99 when you want the extra detail.", [["Essentials — free", "Includes an instant valuation from reg and mileage, an estimated private-sale value, DVSA MOT history and mileage information, a GOV.UK recall-check link, tax and clean-air-zone estimates, and advert price checks."], ["Full seller report — £2.99 one-off", "Adds part-exchange and dealer figures, comparable UK advert pricing, optional AI photo condition scoring, a suggested asking price and negotiation buffer, ready-to-post advert copy, advisory repair-cost bands and a shareable report. Pay by card, Apple Pay or Google Pay. No subscription."]]],
    "/about": ["About Valu8", "Valu8 is an independent car valuation tool for UK private sellers and buyers.", [["How valuations work", "Where there are enough UK adverts for your make and model, we use them to estimate the price and adjust for age and mileage. MOT history comes from the official DVSA database. Photo condition checks are optional and use AI. Every report shows a confidence level; figures are estimates, not financial advice or guaranteed sale prices."], ["Still improving", "Valu8 is new and still improving. Essentials valuations are free and the Full seller report is a one-off £2.99. Some estimates will be less precise than others while our data grows."], ["Contact", "Email <a href=\"mailto:hello@valu8.uk\">hello@valu8.uk</a>. We aim to reply within a few working days."]]],
    "/contact": ["Get in touch", "Valu8 is an independent car valuation tool for UK private sellers and buyers.", [["Contact Valu8", "Questions about a valuation, your account or feedback? Email <a href=\"mailto:hello@valu8.uk\">hello@valu8.uk</a>. We aim to reply within a few working days."], ["Using Valu8", "Start a <a href=\"/valuation/new\">free car valuation</a>, check an advert asking price, read our guides or learn more about how valuations work. Figures are estimates and not guaranteed sale prices."]]],
  };
  if (simple[path]) return page(...simple[path]);
  if (path === "/embed-info") return embedInfoBodyHtml();
  if (path === "/how-it-works") return howItWorksBodyHtml();
  if (path === "/faq") return faqBodyHtml();
  if (path === "/example-report") return exampleReportBodyHtml();
  if (path === "/privacy") return page("Privacy Policy", "How Valu8 collects, uses and protects your data under UK GDPR.", legalSections[path]);
  if (path === "/terms") return page("Terms of Service", "The terms for using Valu8 car valuations.", legalSections[path]);
  if (path === "/disclaimers") return page("Disclaimers & Data Sources", "Honest small print so you know exactly what a Valu8 report is — and isn't.", legalSections[path]);
  return undefined;
}

/** WebSite + Organization JSON-LD in the static homepage HTML. Same ids and JSON as Landing.tsx, which upserts by id
 *  (setJsonLd), so crawlers that don't run JS see it and the app never adds a second copy. */
export const HOMEPAGE_WEBSITE_JSONLD = { "@context": "https://schema.org", "@type": "WebSite", name: "Valu8", url: "https://valu8.uk/" };
export const HOMEPAGE_ORG_JSONLD = { "@context": "https://schema.org", "@type": "Organization", name: "Valu8", url: "https://valu8.uk/" };
export const homepageFaqHeadHtml = `<script type="application/ld+json" id="homepage-faq-jsonld">${homepageFaqJsonLd}</script>`
  + `<script type="application/ld+json" id="homepage-website-jsonld">${JSON.stringify(HOMEPAGE_WEBSITE_JSONLD)}</script>`
  + `<script type="application/ld+json" id="homepage-org-jsonld">${JSON.stringify(HOMEPAGE_ORG_JSONLD)}</script>`;
/** /faq: FAQPage JSON-LD for the full visible list. */
export const faqPageHeadHtml = `<script type="application/ld+json" id="faq-page-jsonld">${faqPageJsonLd(SITE_FAQS)}</script>`;
