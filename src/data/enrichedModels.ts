// Hand-written additions for individual /value/:slug model pages (search-led improvements, one model at a time).
// Every figure comes from modelPriceBands.ts (typical asking prices from UK adverts), so the copy never drifts
// from the tables on the page. Node-safe: used by the build-time HTML as well as the React page.
import { MODEL_PRICES, PRICE_DATA_UPDATED, type ModelPrices, type YearPrices } from "./modelPriceBands";
import { guideBodyHtml } from "./guides";

const gbp = (n: number) => "£" + n.toLocaleString("en-GB");
const DESCRIPTION_MAX = 155;

export type EnrichedModel = {
  slug: string;
  /** ISO date this page's hand-written copy last changed (later than VALUE_PAGES_MODIFIED_ISO wins). */
  modifiedIso: string;
  title: string;
  description: (m: ModelPrices) => string;
  /** Markdown rendered after the mileage table (guide renderer). */
  markdown: (m: ModelPrices) => string;
  /** Extra FAQs, appended to the page's valuation FAQ (visible and FAQPage JSON-LD). */
  faqs: (m: ModelPrices) => { q: string; a: string }[];
};

const yearOf = (m: ModelPrices, year: number): YearPrices | undefined => m.years.find((y) => y.year === year);
const yearSpan = (m: ModelPrices) => {
  const ys = m.years.map((y) => y.year);
  return ys.length ? { first: Math.min(...ys), last: Math.max(...ys) } : null;
};
const fit = (...options: string[]) => options.find((d) => d.length <= DESCRIPTION_MAX) ?? options[options.length - 1];

/** The year with the most adverts that has both a 40,000–80,000 and an over-80,000-mile row. */
function highMileageExample(m: ModelPrices) {
  const rows = m.years
    .map((y) => ({ y, mid: y.byMileage.find((r) => r.label === "40,000–80,000 miles"), high: y.byMileage.find((r) => r.label === "Over 80,000 miles") }))
    .filter((r) => r.mid && r.high);
  if (!rows.length) return null;
  const best = rows.reduce((a, b) => (b.y.count > a.y.count ? b : a));
  return { year: best.y.year, mid: best.mid!.median, high: best.high!.median };
}

const fordKuga: EnrichedModel = {
  slug: "ford-kuga",
  modifiedIso: "2026-11-21",
  title: "Ford Kuga valuation: UK prices by year and mileage | Valu8",
  description: (m) => {
    const span = yearSpan(m);
    const years = span ? ` for every year from ${span.first} to ${span.last}` : "";
    return fit(
      `Free Ford Kuga valuation by reg, plus typical UK asking prices${years} and by mileage, from ${m.listings.toLocaleString("en-GB")} adverts (${PRICE_DATA_UPDATED}).`,
      `Free Ford Kuga valuation by reg, plus typical UK asking prices${years} and by mileage.`,
    );
  },
  markdown: (m) => {
    const secondGen = m.years.filter((y) => y.year >= 2013 && y.year <= 2019).reduce((n, y) => n + y.count, 0);
    const y2019 = yearOf(m, 2019), y2020 = yearOf(m, 2020);
    const share = secondGen > 0 ? ` ${secondGen.toLocaleString("en-GB")} of the ${m.listings.toLocaleString("en-GB")} Kuga adverts behind this page are 2013 to 2019 cars.` : "";
    const jump = y2019 && y2020
      ? `\n\nIn those adverts the median asking price goes from ${gbp(y2019.median)} for a 2019 Kuga to ${gbp(y2020.median)} for a 2020 one. Part of that gap is the change to the newer shape, so check which generation a car is before comparing prices.`
      : "";
    return `## Ford Kuga generations and what they mean for the price

The Kuga has been sold in the UK in three generations. Roughly:

- **First generation (2008 to 2012):** now the cheapest Kugas. At this age, condition and MOT history matter more than trim.
- **Second generation (2013 to 2019):** updated in 2016 with a new front end and a newer touchscreen system.
- **Third generation (2020 onwards):** a new shape, sold with mild hybrid, full hybrid and plug-in hybrid versions as well as petrol and diesel.
${share ? `\n${share.trim()}` : ""}${jump}

## What moves the price of a used Ford Kuga

- **Engine and fuel:** petrol, diesel and hybrid Kugas are advertised at different prices, so compare like with like. A plug-in hybrid should come with its charging cable.
- **Trim:** higher trims such as Titanium, ST-Line and Vignale tend to be advertised above entry-level Zetec cars of the same age.
- **Two- or four-wheel drive:** some Kugas have four-wheel drive, which matters to some buyers.
- **Mileage:** the biggest single factor, as the mileage table above shows.
- **MOT history:** recent advisories for tyres, brakes, suspension or corrosion give buyers a reason to offer less. See [do MOT advisories affect my car's value?](/guides/mot-advisories-car-value)
- **Recalls:** buyers may ask whether recall work has been done. You can [check for vehicle recalls on GOV.UK](https://www.gov.uk/check-vehicle-recall).

## Valuing your own Kuga

The tables on this page are asking prices for all Kugas of each year. For a figure for your own car, enter your reg: the free valuation gives an estimated private-sale value and your DVSA MOT history, and the optional £2.99 Full report adds part-exchange and dealer figures, a suggested asking price and a ready-to-post advert. If you're unsure which route to take, read [part-exchange vs private sale](/guides/part-exchange-vs-private-sale).`;
  },
  faqs: (m) => {
    const out = [{
      q: "Which Ford Kuga generation do I have?",
      a: "Roughly, Kugas registered from 2008 to 2012 are first generation, 2013 to 2019 second generation (updated in 2016) and 2020 onwards third generation. Cars registered around a changeover can be either, so check the shape or ask a Ford dealer with your reg.",
    }];
    const hm = highMileageExample(m);
    if (hm) out.push({
      q: "What is a high-mileage Ford Kuga worth?",
      a: `In our ${hm.year} Kuga adverts, cars with over 80,000 miles have a median asking price of ${gbp(hm.high)}, against ${gbp(hm.mid)} for 40,000 to 80,000 miles. Condition and MOT history move it too, so get a free valuation by reg for a figure for your car.`,
    });
    return out;
  },
};

export const ENRICHED_MODELS: EnrichedModel[] = [fordKuga].filter((e) => MODEL_PRICES.some((m) => m.slug === e.slug));

export const findEnrichedModel = (slug: string | undefined) => ENRICHED_MODELS.find((e) => e.slug === slug);

export const enrichedModelHtml = (e: EnrichedModel, m: ModelPrices) => guideBodyHtml(e.markdown(m));
