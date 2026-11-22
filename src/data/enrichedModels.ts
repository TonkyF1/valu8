// Hand-written additions for individual /value/:slug model pages (search-led improvements, one model at a time).
// Every figure comes from modelPriceBands.ts (typical asking prices from UK adverts), so the copy never drifts
// from the tables on the page. Node-safe: used by the build-time HTML as well as the React page.
import { MODEL_PRICES, PRICE_DATA_UPDATED, type ModelPrices, type YearPrices } from "./modelPriceBands";
import { guideBodyHtml } from "./guides";
import { modelDisplayName } from "./modelDisplayName";

const gbp = (n: number) => "£" + n.toLocaleString("en-GB");
const DESCRIPTION_MAX = 155;

export type EnrichedModel = {
  slug: string;
  /** ISO date this page's hand-written copy last changed (later than VALUE_PAGES_MODIFIED_ISO wins). */
  modifiedIso: string;
  /** Own <title>; when omitted the page keeps the standard "How much is my X worth?" title (valueTitle). */
  title?: string;
  /** Own meta description; when omitted the standard price-range description is used. */
  description?: (m: ModelPrices) => string;
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
  title: "How much is my Ford Kuga worth? Free valuation | Valu8",
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

The tables on this page are asking prices for all Kugas of each year. For a figure for your own car, enter your reg: the free valuation gives an estimated private-sale value and your DVSA MOT history, and the optional £2.99 Premium Report adds part-exchange and dealer figures, a suggested asking price and a ready-to-post advert. If you're unsure which route to take, read [part-exchange vs private sale](/guides/part-exchange-vs-private-sale).`;
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

// ---------- Shared, data-driven blocks for the hand-enriched pages ----------

const fmt = (n: number) => n.toLocaleString("en-GB");
const nameOf = (m: ModelPrices) => modelDisplayName(m);
const priced = (slug: string) => MODEL_PRICES.find((x) => x.slug === slug);

/** Sum of adverts and the spread of yearly median asking prices for registration years [from, to]. */
function yearsSummary(m: ModelPrices, from: number, to: number) {
  const ys = m.years.filter((y) => y.year >= from && y.year <= to);
  if (!ys.length) return null;
  const meds = ys.map((y) => y.median);
  return { count: ys.reduce((n, y) => n + y.count, 0), lo: Math.min(...meds), hi: Math.max(...meds) };
}

export type Generation = { label: string; from: number; to: number; note: string };

/** Markdown table: one row per generation with adverts and the range of yearly medians from the price data. */
export function generationsTable(m: ModelPrices, gens: Generation[]): string {
  const rows = gens.map((g) => {
    const s = yearsSummary(m, g.from, g.to);
    if (!s) return null;
    const price = s.lo === s.hi ? gbp(s.lo) : `${gbp(s.lo)} to ${gbp(s.hi)}`;
    return `| ${g.label} | ${g.note} | ${fmt(s.count)} | ${price} |`;
  }).filter(Boolean);
  if (!rows.length) return "";
  return `| Generation | What changed | Adverts | Yearly median asking prices |\n|---|---|---|---|\n${rows.join("\n")}`;
}

/** "the median asking price goes from £A for a 2019 car to £B for a 2020 one" (null when either year is missing). */
function yearStep(m: ModelPrices, a: number, b: number, short: string): string | null {
  const ya = yearOf(m, a), yb = yearOf(m, b);
  if (!ya || !yb) return null;
  return `the median asking price goes from ${gbp(ya.median)} for a ${a} ${short} to ${gbp(yb.median)} for a ${b} one`;
}

/** The band to compare rivals on: the newest band this model and most rivals share. */
function rivalBand(m: ModelPrices, rivals: ModelPrices[]): string | null {
  const score = (band: string) => rivals.filter((r) => r.bands.some((b) => b.band === band)).length;
  const own = [...m.bands].sort((a, b) => parseInt(b.band, 10) - parseInt(a.band, 10)).filter((b) => b.count >= 15);
  const best = own.map((b) => ({ band: b.band, n: score(b.band) })).filter((x) => x.n >= 2);
  if (!best.length) return null;
  const top = Math.max(...best.map((x) => x.n));
  return best.find((x) => x.n === top)!.band;
}

/** Rival comparison table (internal links to the rivals' /value pages). Rivals without data are skipped. */
export function rivalsMarkdown(m: ModelPrices, rivalSlugs: string[]): string {
  const rivals = rivalSlugs.map(priced).filter((r): r is ModelPrices => !!r && r.slug !== m.slug);
  const band = rivalBand(m, rivals);
  if (!band) return "";
  const row = (r: ModelPrices, self: boolean) => {
    const b = r.bands.find((x) => x.band === band);
    if (!b) return null;
    const label = self ? `**${nameOf(r)}** (this page)` : `[${nameOf(r)}](/value/${r.slug})`;
    return `| ${label} | ${gbp(b.median)} | ${gbp(b.low)} to ${gbp(b.high)} | ${fmt(b.count)} |`;
  };
  const rows = [row(m, true), ...rivals.map((r) => row(r, false))].filter(Boolean);
  if (rows.length < 3) return "";
  return `## ${nameOf(m)} vs rivals: typical asking prices

Cars registered ${band.replace(/ and /, " or ")}, from the same UK adverts (${PRICE_DATA_UPDATED}). Different trims, engines and mileages sit inside each figure, so use it to see where the ${nameOf(m)} sits in its class, then open a model for its year-by-year prices.

| Model | Median asking price | Typical range | Adverts |
|---|---|---|---|
${rows.join("\n")}`;
}

const GUIDE_LINKS: [string, string][] = [
  ["/guides/what-is-my-car-worth", "How much is my car worth? Private, part-exchange and dealer prices explained"],
  ["/guides/part-exchange-vs-private-sale", "Part-exchange or sell privately: which pays more?"],
  ["/guides/how-to-price-a-car-for-private-sale", "How to price a car for private sale"],
  ["/guides/mot-advisories-car-value", "Do MOT advisories affect my car's value?"],
];
function guidesMarkdown(m: ModelPrices): string {
  return `## Selling or buying a ${nameOf(m)}?\n\n${GUIDE_LINKS.map(([href, label]) => `- [${label}](${href})`).join("\n")}`;
}

/** Battery, range and charging block shared by the electric model pages (no figures: none are in our data). */
function evMarkdown(m: ModelPrices, extra: string[]): string {
  const name = nameOf(m);
  return `## Battery health, range and charging: what they do to the price

Our advert data doesn't record battery health or range, so the tables above mix every version and condition of ${name}. For an electric car, these are the things buyers ask about first, and the ones that can move the price of one car above or below the typical figure:

- **Battery health.** Every battery holds a little less charge as it ages. A recent battery health report (state of health, from a dealer or an independent check) answers the first question most buyers will ask.
- **Real-world range.** Range depends on the battery size, the version, the weather and how the car has been driven. Quote the version exactly and, if you can, the range the car shows on a full charge.
- **Battery warranty.** EV batteries usually have their own warranty that runs longer than the rest of the car's. Check what's left on yours, as a car still covered is easier to sell.
- **Charging.** Include the charging cables that came with the car. Buyers also look at the rapid-charging connector and how fast the car can charge.
${extra.map((x) => `- ${x}`).join("\n")}

Electric car prices have moved more than most in the last few years, so check today's adverts as well as the tables before you set a price.`;
}

/** The highest-count year that has an over-80,000 and a 40,000–80,000-mile row, or an under-40,000 and 40,000–80,000 row. */
function mileagePair(m: ModelPrices) {
  const hm = highMileageExample(m);
  if (hm) return { year: hm.year, lowLabel: "40,000 to 80,000 miles", low: hm.mid, highLabel: "over 80,000 miles", high: hm.high };
  const rows = m.years
    .map((y) => ({ y, lo: y.byMileage.find((r) => r.label === "Under 40,000 miles"), mid: y.byMileage.find((r) => r.label === "40,000–80,000 miles") }))
    .filter((r) => r.lo && r.mid);
  if (!rows.length) return null;
  const best = rows.reduce((a, b) => (b.y.count > a.y.count ? b : a));
  return { year: best.y.year, lowLabel: "under 40,000 miles", low: best.lo!.median, highLabel: "40,000 to 80,000 miles", high: best.mid!.median };
}

function mileageFaq(m: ModelPrices, short: string) {
  const p = mileagePair(m);
  if (!p) return [];
  return [{
    q: `Does mileage make a big difference to a ${nameOf(m)}'s value?`,
    a: `Yes. In our ${p.year} ${short} adverts, cars with ${p.highLabel} have a median asking price of ${gbp(p.high)}, against ${gbp(p.low)} for ${p.lowLabel}. Condition, trim and MOT history move it too, so get a free valuation by reg for a figure for your car.`,
  }];
}

type ModelCopy = {
  slug: string;
  short: string;
  gens: Generation[];
  intro: (m: ModelPrices) => string;
  factors: string[];
  rivals: string[];
  ev?: string[];
  faqs: (m: ModelPrices) => { q: string; a: string }[];
};

/** Builds an enriched page: generations, what moves the price, (EV block), rivals, guides, valuing your own car. */
function enriched(c: ModelCopy): EnrichedModel {
  return {
    slug: c.slug,
    modifiedIso: "2026-11-21",
    markdown: (m) => {
      const name = nameOf(m);
      const table = generationsTable(m, c.gens);
      return [
        `## ${name} generations and what they mean for the price`,
        c.intro(m),
        table,
        table ? `Yearly median asking prices are the middle asking price for each registration year in the ${fmt(m.listings)} ${name} adverts behind this page. Cars registered around a changeover can be either generation, so check before comparing prices.` : "",
        `## What moves the price of a used ${name}`,
        c.factors.map((f) => `- ${f}`).join("\n"),
        c.ev ? evMarkdown(m, c.ev) : "",
        rivalsMarkdown(m, c.rivals),
        `## Valuing your own ${c.short}`,
        `The tables on this page are asking prices for every ${c.short} of each year, whatever its condition. For a figure for your own car, enter your reg: the free valuation gives an estimated private-sale value and your DVSA MOT history, and the optional £2.99 Premium Report adds part-exchange and dealer figures, a suggested asking price and a ready-to-post advert.`,
        guidesMarkdown(m),
      ].filter(Boolean).join("\n\n");
    },
    faqs: (m) => [...c.faqs(m), ...mileageFaq(m, c.short)],
  };
}

const MOT_FACTOR = "**MOT history:** buyers can see every past MOT for free. Recent advisories for tyres, brakes, suspension or corrosion give them a reason to offer less. See [do MOT advisories affect my car's value?](/guides/mot-advisories-car-value)";
const RECALL_FACTOR = "**Recalls:** buyers may ask whether recall work has been done. You can [check for vehicle recalls on GOV.UK](https://www.gov.uk/check-vehicle-recall).";
const MILEAGE_FACTOR = "**Mileage:** the biggest single factor after age, as the mileage table above shows.";

const toyotaYaris = enriched({
  slug: "toyota-yaris",
  short: "Yaris",
  gens: [
    { label: "Second generation", from: 2005, to: 2011, note: "Petrol and diesel" },
    { label: "Third generation", from: 2012, to: 2020, note: "Hybrid added in 2012; updated in 2014 and 2017" },
    { label: "Fourth generation", from: 2021, to: 2030, note: "New shape, sold in the UK as a hybrid" },
  ],
  intro: (m) => {
    const step = yearStep(m, 2011, 2012, "Yaris");
    return `The Yaris has been one of the UK's best-selling small cars for two decades, so there are plenty to compare. The model changed in 2011 and again in 2020, and the hybrid version has been the main seller for years.${step ? ` In our adverts ${step}, the first year of the third generation.` : ""}`;
  },
  factors: [
    "**Hybrid or not:** hybrid and petrol-only Yaris models are advertised at different prices, so compare like with like.",
    MILEAGE_FACTOR,
    "**Hybrid battery cover:** Toyota can extend the hybrid battery cover when the car has an annual hybrid health check at a Toyota dealer. Keep the paperwork, as buyers ask.",
    "**Trim:** higher trims such as Design and Excel tend to be advertised above entry-level cars of the same age. The GR Yaris is a separate high-performance model and is priced very differently.",
    MOT_FACTOR,
  ],
  rivals: ["ford-fiesta", "vauxhall-corsa", "volkswagen-polo", "renault-clio", "honda-jazz", "peugeot-208"],
  faqs: () => [{
    q: "Is a hybrid Toyota Yaris worth more than a petrol one?",
    a: "Our advert data doesn't split the Yaris by engine, so we can't give a figure. Since 2020 the Yaris has been sold new in the UK as a hybrid (apart from the GR Yaris), so for newer cars the question doesn't arise. For older ones, compare with adverts for the same engine, or enter your reg for a free valuation of your exact car.",
  }],
});

const toyotaCHr = enriched({
  slug: "toyota-c-hr",
  short: "C-HR",
  gens: [
    { label: "First generation", from: 2016, to: 2023, note: "1.8 hybrid and 1.2 turbo petrol; 2.0 hybrid added at the 2020 update" },
    { label: "Second generation", from: 2024, to: 2030, note: "New shape, hybrid and plug-in hybrid" },
  ],
  intro: (m) => {
    const step = yearStep(m, 2019, 2021, "C-HR");
    return `The C-HR went on sale in the UK at the start of 2017 and was updated in 2020, when a more powerful 2.0 hybrid joined the 1.8. Most used C-HRs are hybrids.${step ? ` In our adverts ${step}.` : ""}`;
  },
  factors: [
    "**Engine:** 1.8 hybrid, 2.0 hybrid and the less common 1.2 turbo petrol are advertised at different prices, so compare like with like.",
    MILEAGE_FACTOR,
    "**Trim:** higher trims such as Excel and Dynamic tend to be advertised above entry-level Icon cars of the same age.",
    "**Catalytic converter:** Toyota hybrids have been targeted by catalytic converter thieves. If yours has been replaced or fitted with a guard, say so in the advert.",
    "**Hybrid battery cover:** Toyota can extend the hybrid battery cover with an annual hybrid health check at a Toyota dealer. Keep the paperwork.",
    MOT_FACTOR,
  ],
  rivals: ["nissan-juke", "ford-puma", "volkswagen-t-roc", "peugeot-2008", "hyundai-kona", "seat-arona"],
  faqs: () => [{
    q: "Which Toyota C-HR engine holds its value best?",
    a: "Our advert data doesn't split the C-HR by engine, so we can't give a figure. Most used C-HRs are hybrids, so compare yours with adverts for the same engine, or enter your reg for a free valuation of your exact car.",
  }],
});

const hyundaiKona = enriched({
  slug: "hyundai-kona",
  short: "Kona",
  gens: [
    { label: "First generation", from: 2017, to: 2023, note: "Petrol, hybrid and Kona Electric" },
    { label: "Second generation", from: 2024, to: 2030, note: "New shape, petrol, hybrid and electric" },
  ],
  intro: (m) => {
    const step = yearStep(m, 2020, 2021, "Kona");
    return `The Kona arrived in the UK in late 2017 as a petrol small SUV, with the Kona Electric following in 2018 and a hybrid in 2019. A new, larger Kona replaced it in 2023.${step ? ` In our adverts ${step}.` : ""}`;
  },
  factors: [
    "**Petrol, hybrid or electric:** the three are advertised at quite different prices, so compare like with like. For a Kona Electric, battery health and range matter most.",
    MILEAGE_FACTOR,
    "**Warranty left:** Hyundai's five-year, unlimited-mileage new-car warranty passes to the next owner, so a recent Kona may still be covered. Check the dates in the service book.",
    "**Trim:** higher trims such as Premium and Ultimate tend to be advertised above entry-level SE cars of the same age.",
    MOT_FACTOR,
  ],
  rivals: ["nissan-juke", "toyota-c-hr", "ford-puma", "volkswagen-t-roc", "kia-niro", "peugeot-2008"],
  faqs: () => [{
    q: "Is a Hyundai Kona Electric worth more than a petrol Kona?",
    a: "Our advert data doesn't split the Kona by fuel, so the tables mix all versions. Electric and petrol Konas are advertised at different prices, and for an electric one, battery health and range matter most. Enter your reg for a free valuation of your exact car.",
  }],
});

const kiaSportage = enriched({
  slug: "kia-sportage",
  short: "Sportage",
  gens: [
    { label: "Third generation", from: 2010, to: 2015, note: "Petrol and diesel, two- or four-wheel drive" },
    { label: "Fourth generation", from: 2016, to: 2021, note: "New shape; mild-hybrid diesel added in 2018" },
    { label: "Fifth generation", from: 2022, to: 2030, note: "New shape, hybrid and plug-in hybrid versions" },
  ],
  intro: (m) => {
    const step = yearStep(m, 2015, 2016, "Sportage");
    return `The Sportage is one of the most common family SUVs in UK adverts. A new generation arrived in 2016 and another in 2022.${step ? ` In our adverts ${step}, partly because of the change to the newer shape.` : ""}`;
  },
  factors: [
    "**Warranty left:** Kia's seven-year, 100,000-mile new-car warranty passes to the next owner. A car that is still covered is easier to sell, so check the dates and mileage in the service book.",
    MILEAGE_FACTOR,
    "**Engine and gearbox:** petrol, diesel and hybrid Sportages, and manuals and automatics, are advertised at different prices, so compare like with like.",
    "**Trim and drive:** higher trims such as GT-Line tend to be advertised above entry-level cars, and some buyers look specifically for four-wheel drive.",
    MOT_FACTOR,
  ],
  rivals: ["nissan-qashqai", "hyundai-tucson", "ford-kuga", "volkswagen-tiguan", "peugeot-3008", "skoda-karoq"],
  faqs: () => [{
    q: "Does the Kia warranty transfer when I sell my Sportage?",
    a: "Yes. Kia's seven-year, 100,000-mile new-car warranty stays with the car, whichever comes first, as long as it has been serviced to Kia's schedule. A car with warranty left is easier to sell.",
  }],
});

const seatLeon = enriched({
  slug: "seat-leon",
  short: "Leon",
  gens: [
    { label: "Second generation", from: 2005, to: 2012, note: "Five-door hatchback" },
    { label: "Third generation", from: 2013, to: 2019, note: "Hatchback, three-door SC and ST estate" },
    { label: "Fourth generation", from: 2020, to: 2030, note: "New shape, plug-in eHybrid added" },
  ],
  intro: (m) => {
    const step = yearStep(m, 2012, 2013, "Leon");
    return `The Leon shares its engines and much of its engineering with the Volkswagen Golf, usually for a lower price. The third generation (2013 to 2019) makes up most of the cars for sale.${step ? ` In our adverts ${step}.` : ""}`;
  },
  factors: [
    MILEAGE_FACTOR + " Many used Leons have high miles (see the typical mileage column in the year table), so a lower-mileage car stands out.",
    "**Trim:** FR trim is popular and tends to be advertised above SE cars of the same age. Cupra performance versions are priced quite differently.",
    "**Body style:** hatchback, three-door SC and ST estate versions are advertised at different prices.",
    "**Service history:** a full history, including any timing belt and DSG gearbox servicing that is due, reassures buyers.",
    MOT_FACTOR,
  ],
  rivals: ["volkswagen-golf", "ford-focus", "vauxhall-astra", "skoda-octavia", "kia-ceed", "hyundai-i30"],
  faqs: () => [{
    q: "Is a Seat Leon cheaper than a Volkswagen Golf of the same age?",
    a: "In our UK adverts it usually is. The comparison table on this page shows median asking prices for both, from the same adverts, and each model's page has the year-by-year figures.",
  }],
});

const landRoverDiscoverySport: EnrichedModel = { ...enriched({
  slug: "land-rover-discovery-sport",
  short: "Discovery Sport",
  gens: [
    { label: "First version", from: 2014, to: 2019, note: "Diesel and petrol, five or 5+2 seats" },
    { label: "Updated version", from: 2020, to: 2030, note: "New platform with mild-hybrid engines; plug-in hybrid added" },
  ],
  intro: (m) => {
    const step = yearStep(m, 2018, 2019, "Discovery Sport");
    return `The Discovery Sport replaced the Freelander in 2015. It was heavily updated for 2020 with a new platform, mild-hybrid engines and a new interior, and a plug-in hybrid joined the range.${step ? ` In our adverts ${step}.` : ""}`;
  },
  factors: [
    MILEAGE_FACTOR + " Most Discovery Sports in our adverts have done more than 70,000 miles, so a lower-mileage car stands out.",
    "**Seven seats:** some cars have the optional third row (5+2 seats), which family buyers look for. Say so in the advert.",
    "**Two- or four-wheel drive:** some early diesel versions are front-wheel drive; most are four-wheel drive.",
    "**Service history:** a full Land Rover dealer or specialist history matters to buyers of this car, so keep every invoice.",
    "**Tyres and wheels:** large alloy wheels make tyres a noticeable cost, and buyers check them.",
    RECALL_FACTOR,
    MOT_FACTOR,
  ],
  rivals: ["land-rover-range-rover-evoque", "volvo-xc60", "audi-q5", "bmw-x3", "volkswagen-tiguan", "skoda-kodiaq"],
  faqs: () => [{
    q: "Is a seven-seat Discovery Sport worth more?",
    a: "Our advert data doesn't record seating, so we can't put a figure on it. The optional third row widens the pool of family buyers, so mention it clearly in your advert. Enter your reg for a free valuation of your exact car.",
  }],
}),
  // Searchers use the full name ("how much is my land rover discovery sport worth"), which only fits without "UK prices".
  title: "How much is my Land Rover Discovery Sport worth? | Valu8",
};

const audiA1 = enriched({
  slug: "audi-a1",
  short: "A1",
  gens: [
    { label: "First generation", from: 2010, to: 2018, note: "Three-door and five-door Sportback" },
    { label: "Second generation", from: 2019, to: 2030, note: "New shape, five-door Sportback only, petrol only" },
  ],
  intro: (m) => {
    const step = yearStep(m, 2018, 2019, "A1");
    return `The A1 is Audi's smallest car. The second generation, sold only as a five-door Sportback, arrived in late 2018.${step ? ` In our adverts ${step}, partly because of the change to the newer model.` : ""}`;
  },
  factors: [
    MILEAGE_FACTOR,
    "**Trim:** S line cars are common and tend to be advertised above SE and Sport cars of the same age. The S1 is a rare performance version priced separately.",
    "**Body style:** on first-generation cars, five-door Sportbacks and three-doors are advertised at different prices.",
    "**Service history:** buyers of a premium small car expect a full history, ideally with Audi or a specialist.",
    MOT_FACTOR,
  ],
  rivals: ["mini-hatch", "volkswagen-polo", "ford-fiesta", "seat-ibiza", "peugeot-208", "vauxhall-corsa"],
  faqs: () => [{
    q: "Is an Audi A1 worth more than a Volkswagen Polo?",
    a: "In our UK adverts the A1 is usually advertised for more than a Polo of the same age, as the comparison table on this page shows. Each model's page has year-by-year figures.",
  }],
});

const peugeot208 = enriched({
  slug: "peugeot-208",
  short: "208",
  gens: [
    { label: "First generation", from: 2012, to: 2019, note: "Petrol and diesel" },
    { label: "Second generation", from: 2020, to: 2030, note: "New shape, petrol, diesel and electric e-208" },
  ],
  intro: (m) => {
    const step = yearStep(m, 2019, 2020, "208");
    return `The 208 is one of the most common superminis in UK adverts. The second generation, including the electric e-208, went on sale at the end of 2019.${step ? ` In our adverts ${step}, a big jump that is partly the change to the newer model.` : ""}`;
  },
  factors: [
    MILEAGE_FACTOR,
    "**Engine:** petrol, diesel and electric e-208 versions are advertised at different prices, so compare like with like.",
    "**Timing belt on 1.2 PureTech petrols:** this engine's timing belt has had widely reported problems, and Peugeot has run extended cover for some cars. Buyers ask when it was last checked or changed, so keep the receipts.",
    "**Trim:** higher trims such as Allure and GT tend to be advertised above entry-level cars of the same age.",
    MOT_FACTOR,
  ],
  rivals: ["vauxhall-corsa", "ford-fiesta", "renault-clio", "volkswagen-polo", "toyota-yaris", "citroen-c3"],
  faqs: () => [{
    q: "Does the PureTech timing belt affect a Peugeot 208's value?",
    a: "It can. Buyers of 1.2 PureTech cars often ask whether the timing belt has been checked or replaced. Proof that the work has been done, with a receipt, helps you sell at a fair price.",
  }],
});

const teslaModel3 = enriched({
  slug: "tesla-model-3",
  short: "Model 3",
  gens: [
    { label: "Original", from: 2019, to: 2023, note: "Standard Range Plus or Rear-Wheel Drive, Long Range and Performance" },
    { label: "Updated", from: 2024, to: 2030, note: "Restyled with a new interior" },
  ],
  intro: (m) => {
    const ys = [2019, 2020, 2021].map((y) => yearOf(m, y)).filter((y): y is YearPrices => !!y);
    const flat = ys.length === 3 ? ` In our adverts, 2019, 2020 and 2021 cars are all advertised for close to ${gbp(ys[1].median)}, so mileage, version and battery health matter more than the exact year.` : "";
    return `UK deliveries of the Model 3 began in 2019, and an updated version arrived in 2024.${flat}`;
  },
  factors: [
    "**Version:** Rear-Wheel Drive (earlier called Standard Range Plus), Long Range and Performance cars have different batteries and range, and are advertised at different prices.",
    MILEAGE_FACTOR,
    "**Battery warranty:** Tesla covers the battery and drive unit for eight years, with a mileage limit that depends on the version. Check what's left on yours.",
    "**Tyres and suspension:** buyers check tyres closely on heavy, quick electric cars.",
    MOT_FACTOR,
  ],
  ev: ["**Software features:** some features are linked to the car or the account, so list exactly what the car has and check what transfers to the next owner."],
  rivals: ["tesla-model-y", "bmw-3-series", "audi-a4", "mercedes-benz-c-class", "cupra-born", "skoda-enyaq"],
  faqs: () => [{
    q: "Does battery health affect a used Tesla Model 3's value?",
    a: "Yes. Battery health and remaining range are the first things buyers ask about. Our advert data doesn't record battery health, so the tables mix every condition. A recent battery health report helps you justify your price.",
  }],
});

const teslaModelY = enriched({
  slug: "tesla-model-y",
  short: "Model Y",
  gens: [
    { label: "Original", from: 2022, to: 2024, note: "Rear-Wheel Drive, Long Range and Performance" },
    { label: "Updated", from: 2025, to: 2030, note: "Restyled with a new interior" },
  ],
  intro: (m) => {
    const y22 = yearOf(m, 2022), y23 = yearOf(m, 2023);
    const same = y22 && y23 ? ` In our adverts a 2022 Model Y has a median asking price of ${gbp(y22.median)} and a 2023 one ${gbp(y23.median)}, so the exact year moves the price less than mileage, version and battery health.` : "";
    return `The Model Y SUV arrived in the UK in 2022 and was updated in 2025.${same}`;
  },
  factors: [
    "**Version:** Rear-Wheel Drive, Long Range and Performance cars have different batteries and range, and are advertised at different prices.",
    MILEAGE_FACTOR,
    "**Battery warranty:** Tesla covers the battery and drive unit for eight years, with a mileage limit that depends on the version. Check what's left on yours.",
    "**Tyres:** buyers check tyres closely on heavy, quick electric SUVs.",
    MOT_FACTOR,
  ],
  ev: ["**Software features:** some features are linked to the car or the account, so list exactly what the car has and check what transfers to the next owner."],
  rivals: ["tesla-model-3", "skoda-enyaq", "kia-niro", "volvo-xc40", "audi-q3", "bmw-x3"],
  faqs: () => [{
    q: "Does battery health affect a used Tesla Model Y's value?",
    a: "Yes. Battery health and remaining range are the first things buyers ask about. Our advert data doesn't record battery health, so the tables mix every condition. A recent battery health report helps you justify your price.",
  }],
});

const nissanLeaf = enriched({
  slug: "nissan-leaf",
  short: "Leaf",
  gens: [
    { label: "First generation", from: 2011, to: 2017, note: "24 kWh battery; 30 kWh from 2016" },
    { label: "Second generation", from: 2018, to: 2030, note: "New shape, 40 kWh battery; 62 kWh e+ from 2019" },
  ],
  intro: (m) => {
    const step = yearStep(m, 2017, 2019, "Leaf");
    return `The Leaf was one of the first mass-market electric cars in the UK, so there are Leafs of every age for sale. The second generation, with a bigger battery and more range, arrived in 2018.${step ? ` In our adverts ${step}.` : ""}`;
  },
  factors: [
    "**Battery size:** the battery size sets the range, so 24, 30, 40 and 62 kWh cars are advertised at quite different prices. Quote yours exactly.",
    "**Battery capacity bars:** the Leaf shows battery capacity as bars beside the charge gauge. Buyers look at how many are left, so mention it.",
    "**Battery hire:** some early Leafs were sold with the battery on a separate monthly lease. A car that owns its battery outright is simpler to sell, so check which yours is.",
    MILEAGE_FACTOR,
    MOT_FACTOR,
  ],
  ev: ["**Rapid charging:** the Leaf uses the CHAdeMO rapid-charging connector, which is less common at newer chargers than CCS, so some buyers check charger access near them."],
  rivals: ["hyundai-ioniq", "kia-niro", "hyundai-kona", "cupra-born", "tesla-model-3", "toyota-prius"],
  faqs: () => [{
    q: "How do I check a used Nissan Leaf's battery health?",
    a: "Look at the battery capacity bars beside the charge gauge, and ask a Nissan dealer or an independent EV specialist for a battery health report. Our advert data doesn't record battery health, so the tables mix every condition.",
  }],
});

const fordKugaWithRivals: EnrichedModel = {
  ...fordKuga,
  markdown: (m) => [fordKuga.markdown(m), rivalsMarkdown(m, ["nissan-qashqai", "kia-sportage", "hyundai-tucson", "volkswagen-tiguan", "peugeot-3008", "skoda-karoq"]), guidesMarkdown(m)].filter(Boolean).join("\n\n"),
};

export const ENRICHED_MODELS: EnrichedModel[] = [fordKugaWithRivals, toyotaYaris, toyotaCHr, hyundaiKona, kiaSportage, seatLeon, landRoverDiscoverySport, audiA1, peugeot208, teslaModel3, teslaModelY, nissanLeaf].filter((e) => MODEL_PRICES.some((m) => m.slug === e.slug));

export const findEnrichedModel = (slug: string | undefined) => ENRICHED_MODELS.find((e) => e.slug === slug);

export const enrichedModelHtml = (e: EnrichedModel, m: ModelPrices) => guideBodyHtml(e.markdown(m));
