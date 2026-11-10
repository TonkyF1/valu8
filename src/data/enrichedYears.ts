// Hand-written, enriched year pages (/value/:slug/:year). Unlike the templated year pages
// these are indexable and listed in the sitemap. Figures always come from modelPriceBands.ts
// (typical asking prices from UK adverts), so the copy never drifts from the table.
// Node-safe: imported by vite.config.ts for build-time HTML.
import { MODEL_PRICES, type ModelPrices, type YearPrices } from "./modelPriceBands";
import { guideBodyHtml } from "./guides";

const gbp = (n: number) => "£" + n.toLocaleString("en-GB");

export type EnrichedYear = {
  slug: string;
  year: number;
  title: string;
  description: string;
  /** Markdown rendered below the price table (guide renderer). */
  markdown: (m: ModelPrices, y: YearPrices) => string;
  faqs: (m: ModelPrices, y: YearPrices) => { q: string; a: string }[];
};

const fiesta2016: EnrichedYear = {
  slug: "ford-fiesta",
  year: 2016,
  title: "2016 Ford Fiesta value UK: private sale, part-ex and asking prices | Valu8",
  description: "What's a 2016 Ford Fiesta worth in the UK? Typical asking prices by mileage from UK adverts, what moves the price, and a free valuation from your reg.",
  markdown: () => `## Private sale, part-exchange or dealer: which figure is yours?

The table above shows **asking prices**, which is what sellers advertise for. What you actually get depends on how you sell:

- **Private sale:** usually a little below typical asking prices, because buyers haggle.
- **Part-exchange:** usually lower again, because the dealer needs room to prepare and resell the car.
- **Dealer retail:** usually the highest, as it includes preparation, warranty and margin.

Your free Valu8 valuation shows all three for your car, so you can see the gap before you decide. More on choosing a route in [part-exchange vs private sale](/guides/part-exchange-vs-private-sale), and what to do if a dealer's figure feels low in [part-exchange offer too low?](/guides/part-exchange-offer-too-low)

## What moves the price of a 2016 Fiesta

2016 cars come from the last years of the previous-shape Fiesta (the new shape arrived in 2017), so engines and trims vary a lot. Things that typically move the price:

- **Mileage:** the biggest single factor, as the table shows.
- **Engine and trim:** the 1.0 EcoBoost, ST-Line and Titanium trims tend to be advertised higher than entry-level versions. ST models are a separate market.
- **MOT history:** recent advisories for tyres, brakes, suspension or corrosion make buyers nervous. A clean recent MOT helps. See [do MOT advisories affect my car's value?](/guides/mot-advisories-car-value)
- **Service history:** a stamped book or digital record with regular services helps you hold your price.
- **Condition:** kerbed alloys, scuffs and interior wear all give buyers a reason to offer less. Adding photos to your Valu8 valuation gives you an optional photo condition score.

## Selling a 2016 Fiesta: quick tips

1. Check your MOT history and fix cheap advisories before you list.
2. Price with room to negotiate, a little above the figure you'd accept.
3. Take clear photos in daylight, including the dashboard with mileage showing.
4. Have the V5C, both keys and service records ready.
5. Read our guide to [selling a car privately and safely](/guides/how-to-sell-a-car-privately-safely).`,
  faqs: (_m, y) => [
    { q: "How much is a 2016 Ford Fiesta worth?", a: `Typical UK asking prices sit around ${gbp(y.median)}, with most between ${gbp(y.low)} and ${gbp(y.high)}. Your car's value depends on mileage, trim and condition. Get a free estimate from your reg for a figure for your car.` },
    { q: "What is a 65 plate Fiesta worth?", a: "65 plates were registered from September 2015 to February 2016, so they may be listed as 2015 or 2016. Check both the 2015 and 2016 pages, or value your own car from its reg." },
    { q: "Does Valu8 buy cars?", a: "No. We don't buy, sell or broker cars, so we have no reason to push your number up or down. All figures are estimates, not offers." },
  ],
};

export const ENRICHED_YEARS: EnrichedYear[] = [fiesta2016].filter((e) =>
  MODEL_PRICES.some((m) => m.slug === e.slug && m.years.some((y) => y.year === e.year)));

export const findEnrichedYear = (slug: string | undefined, year: number | string | undefined) =>
  ENRICHED_YEARS.find((e) => e.slug === slug && String(e.year) === String(year));

export function enrichedYearHtml(e: EnrichedYear, m: ModelPrices, y: YearPrices): string {
  const faqs = e.faqs(m, y);
  const faqMd = "## FAQs\n\n" + faqs.map((f) => `**${f.q}**\n${f.a}`).join("\n\n");
  return guideBodyHtml(e.markdown(m, y) + "\n\n" + faqMd);
}

export function enrichedYearFaqJsonLd(e: EnrichedYear, m: ModelPrices, y: YearPrices): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: e.faqs(m, y).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  }).replace(/</g, "\\u003c");
}
