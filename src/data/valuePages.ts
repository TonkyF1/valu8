// Node-safe content for the /value pages (React + build-time HTML in vite.config.ts).
// Figures are typical asking prices from UK adverts (generated into modelPriceBands.ts), not valuations.
import { MODEL_PRICES, PRICE_DATA_UPDATED, type ModelPrices, type YearPrices } from "./modelPriceBands";
import { enrichedYearHtml, findEnrichedYear } from "./enrichedYears";
import { VALUE_MODELS, valueModelPath, valueModelsByMake, type ValueModel } from "./valueModels";
import { modelDisplayName } from "./modelDisplayName";
import { CAR_MODELS, SEGMENT_LABEL, SEGMENT_TIPS, type CarModelPage } from "./carModels";
import { carRelated, carValueMatch, modelFaqs, modelSteps } from "./carValueContent";
import { SITE_URL } from "./routeMeta";
import { VALUE_SLUG_REGISTRY, type ValueSlugEntry } from "./valueSlugRegistry";

/** The parts of a model every /value/:slug page needs; priced models (ModelPrices) and registry-only slugs both fit. */
export type ValueRef = Pick<ModelPrices, "slug" | "make" | "model">;

export const VALUE_INDEX_PATH = "/value";
export const VALUE_INDEX_TITLE = "How much is my car worth? UK prices by model | Valu8";
export const VALUE_INDEX_DESCRIPTION = `Typical asking prices from UK adverts for the ${MODEL_PRICES.length} most-advertised used car models, by year. Then get a free valuation for your own car.`;
export const VALUE_INDEX_H1 = "How much is my car worth? Typical UK asking prices by model";
export const VALUE_INDEX_INTRO = "Typical asking prices from UK adverts for the most-advertised used cars, grouped by year. Pick your model for a quick guide, then value your own car for free.";

/** Display name (modelDisplayName); kept as the short name used across these pages. */
export const valueName = (m: ValueRef) => modelDisplayName(m);
export const valuePath = (m: ValueRef) => `/value/${m.slug}`;
export const yearPath = (m: ModelPrices, y: YearPrices | number) => `/value/${m.slug}/${typeof y === "number" ? y : y.year}`;
export const gbp = (n: number) => "£" + n.toLocaleString("en-GB");
export const miles = (n: number) => n.toLocaleString("en-GB") + " miles";

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;

/** First title tier that fits 60 chars; if none does, retry without a leading "Land Rover " (title only). */
export function valueTitle(m: ValueRef): string {
  const tiers = (n: string) => [
    `How much is my ${n} worth? UK prices by year | Valu8`,
    `How much is my ${n} worth? UK prices | Valu8`,
    `${n} value: UK prices by year | Valu8`,
  ];
  const fit = (n: string) => tiers(n).find((t) => t.length <= TITLE_MAX);
  const name = valueName(m);
  const short = name.replace(/^Land Rover /, "");
  return fit(name) ?? fit(short) ?? tiers(short)[2];
}

export function valueMeta(m: ModelPrices) {
  const name = valueName(m);
  const all = m.bands.map((b) => b.median);
  const lo = gbp(Math.min(...all)), hi = gbp(Math.max(...all));
  const range = lo === hi ? lo : `${lo}–${hi}`;
  const full = `A used ${name} is typically advertised for ${range} in the UK, by year (${m.listings.toLocaleString("en-GB")} adverts, ${PRICE_DATA_UPDATED}). Get a free valuation by reg.`;
  return {
    path: valuePath(m),
    title: valueTitle(m),
    description: full.length <= DESCRIPTION_MAX ? full : `A used ${name} is typically advertised for ${range} in the UK, by year. Get a free valuation by reg.`,
  };
}

export const valueH1 = (m: ValueRef) => `How much is my ${valueName(m)} worth?`;

const bandStart = (label: string) => parseInt(label, 10);
/** "2018–2020" stays as is; "2021 and newer" -> "2021-or-newer"; "2008 and older" -> "2008-or-older". */
export const bandPhrase = (label: string) => label.replace(/^(\d{4}) and newer$/, "$1-or-newer").replace(/^(\d{4}) and older$/, "$1-or-older");

/** Featured-snippet answer under the H1, from the newest year band. */
export function valueAnswer(m: ModelPrices): string | null {
  if (!m.bands.length) return null;
  const b = [...m.bands].sort((x, y) => bandStart(y.band) - bandStart(x.band))[0];
  return `In ${PRICE_DATA_UPDATED}, a ${bandPhrase(b.band)} ${valueName(m)} is typically advertised for ${gbp(b.median)} (most between ${gbp(b.low)} and ${gbp(b.high)}), based on ${m.listings.toLocaleString("en-GB")} UK adverts.`;
}

export function valueIntro(m: ModelPrices): string {
  const name = valueName(m);
  return `Here's what the ${name} is typically advertised for in the UK, grouped by year. It's a guide to asking prices from UK adverts, not a valuation: mileage, condition, trim and history all move the price of an individual car. For a figure for your own ${valueName(m)}, get a free valuation.`;
}

export const VALUE_TABLE_NOTE = (m: ModelPrices) =>
  `Typical asking prices from UK adverts (${m.listings.toLocaleString("en-GB")} ${valueName(m)} adverts, updated ${PRICE_DATA_UPDATED}). Typical range is the middle half of asking prices. Year groups with fewer than 15 adverts are not shown.`;

export const VALUE_YEARS_INTRO = (m: ModelPrices) =>
  `Typical ${valueName(m)} asking prices for every year we have enough adverts for. Pick a year for its mileage breakdown. Years with fewer than 15 adverts are not listed.`;

// ---------- Year-by-year data on the model page (P1-2) ----------

/** ISO date the /value page content last changed (WebPage dateModified). Bump it with every price-data refresh. */
export const VALUE_PAGES_MODIFIED_ISO = "2026-11-18";
export const VALUE_UPDATED_TEXT = `Prices last updated: ${PRICE_DATA_UPDATED}.`;

const MIN_YEAR_ADVERTS = 15;

/** Median year-on-year fall in median asking price, over consecutive years with at least 15 adverts each.
 *  Null when there are fewer than 4 such steps or the result is outside 5–35%. */
export function valueDepreciation(m: ModelPrices): { pct: number; steps: number; from: number; to: number } | null {
  const ys = m.years.filter((y) => y.count >= MIN_YEAR_ADVERTS && y.median > 0).sort((a, b) => a.year - b.year);
  const drops: number[] = [];
  for (let i = 0; i + 1 < ys.length; i++) if (ys[i + 1].year === ys[i].year + 1) drops.push(1 - ys[i].median / ys[i + 1].median);
  if (drops.length < 4) return null;
  const d = [...drops].sort((a, b) => a - b);
  const mid = d.length % 2 ? d[(d.length - 1) / 2] : (d[d.length / 2 - 1] + d[d.length / 2]) / 2;
  const pct = Math.round(mid * 100);
  // Outside 5–35% the sample is too patchy to say anything useful (e.g. vans, or gaps between years).
  if (pct < 5 || pct > 35) return null;
  return { pct, steps: drops.length, from: ys[0].year, to: ys[ys.length - 1].year };
}

export const VALUE_DEPRECIATION_H2 = (m: ValueRef) => `How much a ${valueName(m)} loses per year`;
export function valueDepreciationText(m: ModelPrices): string | null {
  const d = valueDepreciation(m);
  if (!d) return null;
  const name = valueName(m);
  return `Comparing ${d.from} to ${d.to} ${name} adverts year by year, each extra year of age typically takes about ${d.pct}% off the median asking price (the middle of ${d.steps} year-on-year changes). Mileage and condition move the price as much as age, so treat this as a rough guide.`;
}

/** The year with the most adverts that has a mileage breakdown (at least 2 rows). */
export function valueMileageYear(m: ModelPrices): YearPrices | null {
  const ys = m.years.filter((y) => y.byMileage.length >= 2);
  if (!ys.length) return null;
  return ys.reduce((a, b) => (b.count > a.count ? b : a));
}
export const VALUE_MILEAGE_H2 = (m: ValueRef) => `How mileage changes the price of a ${valueName(m)}`;
export const VALUE_MILEAGE_INTRO = (m: ModelPrices, y: YearPrices) =>
  `Median asking prices by mileage for the ${y.year} ${valueName(m)}, the year with the most adverts (${y.count}).`;

export const PRICE_TYPES_H2 = "Private sale, part-exchange or dealer: which price is this?";
export const PRICE_TYPES_COPY = (m: ValueRef): string[] => [
  `The figures on this page are asking prices from UK used-car adverts. They show what sellers are hoping to get for a ${valueName(m)}, so the price a car actually sells for is often a little lower after negotiation.`,
  `Selling privately usually gets you closest to these figures, once you leave some room to haggle. A part-exchange offer from a dealer is usually lower, because the dealer has to prepare and resell the car at a profit.`,
  `Buying from a dealer usually costs more than buying privately, but can include preparation and a warranty. A free Valu8 valuation gives you a private-sale estimate for your own car, and the optional £2.99 Full report adds part-exchange and dealer figures.`,
];
export const PRICE_TYPES_LINKS: [string, string][] = [
  ["/guides/part-exchange-vs-private-sale", "Part-exchange vs private sale"],
  ["/guides/private-sale-vs-dealer-prices", "Private sale vs dealer prices"],
  ["/guides/what-is-my-car-worth", "What is my car worth?"],
];

/** Other /value pages for the same make (internal links), A–Z. */
export function sameMakeModels(slug: string, make: string): ValueModel[] {
  return VALUE_MODELS.filter((v) => v.make === make && v.slug !== slug)
    .sort((a, b) => a.model.localeCompare(b.model, "en-GB", { numeric: true, sensitivity: "base" }));
}

// ---------- Model page guidance (moved here from /car-values/*, which now redirect to /value) ----------

/** The /car-values model this /value page replaces, when there is one (gives the segment and related models). */
export const valueCarModel = (m: ValueRef): CarModelPage | undefined => CAR_MODELS.find((c) => `${c.makeSlug}-${c.slug}` === m.slug);

export type ValueGuidance = {
  name: string;
  steps: string[];
  segment: { label: string; tips: string[] } | null;
  faqs: { q: string; a: string }[];
  related: ValueModel[];
};

/** Visible guidance blocks for /value/:slug. React (ModelValue.tsx) and build HTML (valueBodyHtml) both render
 *  exactly this, and the FAQPage JSON-LD uses the same faqs. Related links only go to /value pages. */
export function valueGuidance(m: ValueRef): ValueGuidance {
  const name = valueName(m);
  const car = valueCarModel(m);
  const pool = car ? carRelated(car) : CAR_MODELS.filter((c) => c.make === m.make);
  const fromPool = (list: CarModelPage[]) => list.map(carValueMatch).filter((v): v is ValueModel => !!v && v.slug !== m.slug);
  let related = fromPool(pool);
  if (!related.length) related = fromPool(CAR_MODELS).slice(0, 6);
  related = related.filter((v, i) => related.findIndex((x) => x.slug === v.slug) === i);
  return {
    name,
    steps: modelSteps(name),
    segment: car ? { label: SEGMENT_LABEL[car.segment], tips: SEGMENT_TIPS[car.segment] } : null,
    faqs: modelFaqs(name, car ? SEGMENT_LABEL[car.segment] : undefined),
    related,
  };
}

/** FAQPage JSON-LD for /value/:slug, same text as the visible FAQ (escaped for inline <script>). */
export function valueFaqJsonLd(m: ValueRef): string {
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: valueGuidance(m).faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  }).replace(/</g, "\\u003c");
}

/** BreadcrumbList JSON-LD (Home / Car values / model) with absolute URLs. */
export function valueBreadcrumbJsonLd(m: ValueRef): string {
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Car values", item: `${SITE_URL}${VALUE_INDEX_PATH}` },
      { "@type": "ListItem", position: 3, name: valueName(m), item: SITE_URL + valuePath(m) },
    ],
  }).replace(/</g, "\\u003c");
}

/** WebPage JSON-LD for /value/:slug with dateModified (same title and description as the page head). */
export function valueWebPageJsonLd(m: ValueRef): string {
  const priced = MODEL_PRICES.find((x) => x.slug === m.slug);
  const meta = priced ? valueMeta(priced) : valueFallbackMeta(m);
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "WebPage",
    "@id": SITE_URL + valuePath(m), url: SITE_URL + valuePath(m),
    name: meta.title, description: meta.description, inLanguage: "en-GB",
    dateModified: VALUE_PAGES_MODIFIED_ISO,
    isPartOf: { "@type": "WebSite", name: "Valu8", url: `${SITE_URL}/` },
  }).replace(/</g, "\\u003c");
}

/** BreadcrumbList JSON-LD for a hub page (Home / hub). */
export function hubBreadcrumbJsonLd(name: string, path: string): string {
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name, item: SITE_URL + path },
    ],
  }).replace(/</g, "\\u003c");
}
export const HUB_BREADCRUMB_JSONLD_ID = "hub-breadcrumb-jsonld";
export const hubHeadHtml = (name: string, path: string) =>
  `<script type="application/ld+json" id="${HUB_BREADCRUMB_JSONLD_ID}">${hubBreadcrumbJsonLd(name, path)}</script>`;

export const VALUE_WEBPAGE_JSONLD_ID = "value-webpage-jsonld";
export const VALUE_BREADCRUMB_JSONLD_ID = "value-breadcrumb-jsonld";
export const VALUE_FAQ_JSONLD_ID = "value-faq-jsonld";

export function valueHeadHtml(m: ValueRef): string {
  return `<script type="application/ld+json" id="${VALUE_BREADCRUMB_JSONLD_ID}">${valueBreadcrumbJsonLd(m)}</script>\n`
    + `<script type="application/ld+json" id="${VALUE_FAQ_JSONLD_ID}">${valueFaqJsonLd(m)}</script>\n`
    + `<script type="application/ld+json" id="${VALUE_WEBPAGE_JSONLD_ID}">${valueWebPageJsonLd(m)}</script>`;
}

// ---------- Registry-only model pages (published slug, no current price data) ----------

/** Published slugs with no price data right now. They keep an indexable (200, not noindex) /value page but stay
 *  out of the sitemap. Parameters exist for tests. */
export function registryOnlyModels(registry: ValueSlugEntry[] = VALUE_SLUG_REGISTRY, prices: ValueRef[] = MODEL_PRICES): ValueSlugEntry[] {
  const priced = new Set(prices.map((m) => m.slug));
  return registry.filter((r) => !priced.has(r.slug));
}
export const findRegistryOnly = (slug?: string): ValueSlugEntry | undefined => registryOnlyModels().find((r) => r.slug === slug);

export const VALUE_NO_DATA_COPY = (m: ValueRef) =>
  `We don't have enough recent UK adverts for the ${valueName(m)} to show typical asking prices right now. You can still get a free valuation for your own ${valueName(m)}.`;

export function valueFallbackMeta(m: ValueRef) {
  return {
    path: valuePath(m),
    title: valueTitle(m),
    description: `See what a used ${valueName(m)} is worth in the UK and get a free valuation by registration from Valu8.`,
  };
}

// ---------- Per-year pages (/value/:slug/:year) ----------

/** Templated year pages stay live (shared in social replies) but are noindex,follow and out of the
 *  sitemap; only hand-enriched years (enrichedYears.ts) are indexable. */
export const yearTitle = (name: string, year: number) => {
  const t = `How much is my ${year} ${name} worth? | Valu8`;
  return t.length <= TITLE_MAX ? t : `${year} ${name} value | Valu8`;
};

export function yearMeta(m: ModelPrices, y: YearPrices) {
  const name = valueName(m);
  const e = findEnrichedYear(m.slug, y.year);
  return {
    path: yearPath(m, y),
    title: e?.title ?? yearTitle(name, y.year),
    description: e?.description ?? `A ${y.year} ${name} is typically advertised for ${gbp(y.median)} in the UK (most between ${gbp(y.low)} and ${gbp(y.high)}), from ${y.count} adverts. Get a free valuation for your own ${y.year} ${valueName(m)}.`,
    noindex: !e,
  };
}

export function yearIntro(m: ModelPrices, y: YearPrices): string {
  const name = valueName(m);
  const mil = y.mileage ? `, with a typical advertised mileage of about ${miles(y.mileage)}` : "";
  return `A ${y.year} ${name} is typically advertised for around ${gbp(y.median)} in the UK, with the middle half of asking prices between ${gbp(y.low)} and ${gbp(y.high)}. That's from ${y.count} UK adverts for the ${y.year} ${valueName(m)}${mil}. It's a guide to asking prices, not a valuation: mileage, condition, trim and history all move the price of an individual car.`;
}

export const YEAR_NOTE = (m: ModelPrices, y: YearPrices) =>
  `Typical asking prices from UK adverts (${y.count} adverts for the ${y.year} ${valueName(m)}, updated ${PRICE_DATA_UPDATED}). Typical range is the middle half of asking prices. Mileage rows with fewer than 8 adverts are not shown.`;

export function neighbourYears(m: ModelPrices, y: YearPrices): YearPrices[] {
  const i = m.years.findIndex((x) => x.year === y.year);
  return [m.years[i - 1], m.years[i + 1]].filter(Boolean) as YearPrices[];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Full year table: one row per year, each year linking to its (noindex) year page. */
function yearTableHtml(m: ModelPrices): string {
  if (!m.years.length) return "";
  const name = esc(valueName(m));
  return `<section><h2>${name} prices by year</h2><p>${esc(VALUE_YEARS_INTRO(m))}</p>`
    + `<table><caption>${name} asking prices for every year</caption><thead><tr><th>Year</th><th>Median asking price</th><th>Typical range</th><th>Typical mileage</th><th>Adverts</th></tr></thead><tbody>`
    + m.years.map((y) => `<tr><td><a href="${yearPath(m, y)}">${y.year}</a></td><td>${gbp(y.median)}</td><td>${gbp(y.low)} – ${gbp(y.high)}</td><td>${y.mileage ? miles(y.mileage) : "–"}</td><td>${y.count}</td></tr>`).join("")
    + `</tbody></table></section>`;
}

function depreciationHtml(m: ModelPrices): string {
  const t = valueDepreciationText(m);
  return t ? `<section><h2>${esc(VALUE_DEPRECIATION_H2(m))}</h2><p>${esc(t)}</p></section>` : "";
}

function mileageHtml(m: ModelPrices): string {
  const y = valueMileageYear(m);
  if (!y) return "";
  return `<section><h2>${esc(VALUE_MILEAGE_H2(m))}</h2><p>${esc(VALUE_MILEAGE_INTRO(m, y))}</p>`
    + `<table><caption>${y.year} ${esc(valueName(m))} asking prices by mileage</caption><thead><tr><th>Mileage</th><th>Median asking price</th><th>Adverts</th></tr></thead><tbody>`
    + y.byMileage.map((r) => `<tr><td>${esc(r.label)}</td><td>${gbp(r.median)}</td><td>${r.count}</td></tr>`).join("") + `</tbody></table></section>`;
}

function priceTypesHtml(m: ValueRef): string {
  return `<section><h2>${esc(PRICE_TYPES_H2)}</h2>${PRICE_TYPES_COPY(m).map((p) => `<p>${esc(p)}</p>`).join("")}`
    + `<ul>${PRICE_TYPES_LINKS.map(([href, label]) => `<li><a href="${href}">${esc(label)}</a></li>`).join("")}</ul></section>`;
}

function moreFromMakeHtml(m: ValueRef): string {
  const others = sameMakeModels(m.slug, m.make);
  if (!others.length) return "";
  return `<h2>More ${esc(m.make)} asking prices</h2><ul>` + others.map((v) => `<li><a href="${valueModelPath(v)}">${esc(modelDisplayName(v))}</a></li>`).join("") + `</ul>`;
}

function guidanceHtml(m: ValueRef): string {
  const g = valueGuidance(m);
  const name = esc(g.name);
  return `<section><h2>How we value a ${name}</h2><ol>${g.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>`
    + (g.segment ? `<section><h2>What moves the value of a ${esc(g.segment.label)}</h2><ul>${g.segment.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>` : "")
    + `<section><h2>${name} valuation FAQ</h2>${g.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}</section>`
    + (g.related.length ? `<section><h2>Related valuations</h2><ul>${g.related.map((v) => `<li><a href="${valueModelPath(v)}">${esc(modelDisplayName(v))}</a></li>`).join("")}</ul></section>` : "");
}

export function valueBodyHtml(m: ModelPrices): string {
  const name = esc(valueName(m));
  return `<main id="main"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="${VALUE_INDEX_PATH}">Car values</a> / <span aria-current="page">${name}</span></nav>`
    + `<h1>${esc(valueH1(m))}</h1><p>${esc(valueAnswer(m) ?? "")}</p><p>${esc(valueIntro(m))}</p>`
    + `<table><caption>Typical ${name} asking prices by year group</caption><thead><tr><th>Years</th><th>Median asking price</th><th>Typical range</th></tr></thead><tbody>`
    + m.bands.map((b) => `<tr><td>${esc(b.band)}</td><td>${gbp(b.median)}</td><td>${gbp(b.low)} – ${gbp(b.high)}</td></tr>`).join("")
    + `</tbody></table><p>${esc(VALUE_TABLE_NOTE(m))}</p><p><time datetime="${VALUE_PAGES_MODIFIED_ISO}">${esc(VALUE_UPDATED_TEXT)}</time></p>`
    + yearTableHtml(m) + depreciationHtml(m) + mileageHtml(m)
    + `<p><a href="/valuation/new">Value my ${esc(valueName(m))} free</a></p>`
    + priceTypesHtml(m)
    + guidanceHtml(m)
    + moreFromMakeHtml(m)
    + `<p><a href="/value">All models</a></p></main>`;
}

export function yearBodyHtml(m: ModelPrices, y: YearPrices): string {
  const name = esc(valueName(m));
  const rows = y.byMileage.length
    ? `<table><caption>${y.year} ${name} asking prices by mileage</caption><thead><tr><th>Mileage</th><th>Median asking price</th><th>Adverts</th></tr></thead><tbody>`
      + y.byMileage.map((r) => `<tr><td>${esc(r.label)}</td><td>${gbp(r.median)}</td><td>${r.count}</td></tr>`).join("") + `</tbody></table>`
    : "";
  return `<main id="main"><h1>How much is my ${y.year} ${name} worth?</h1><p>${esc(yearIntro(m, y))}</p>`
    + `<ul><li>Median asking price: ${gbp(y.median)}</li><li>Typical range: ${gbp(y.low)} – ${gbp(y.high)}</li><li>UK adverts: ${y.count}</li>`
    + (y.mileage ? `<li>Typical mileage: ${miles(y.mileage)}</li>` : "") + `</ul>${rows}<p>${esc(YEAR_NOTE(m, y))}</p>`
    + `<p><a href="/valuation/new">Value my ${y.year} ${esc(valueName(m))} free</a></p>`
    + neighbourYears(m, y).map((n) => `<p><a href="${yearPath(m, n)}">${n.year} ${name} prices</a></p>`).join("")
    + (findEnrichedYear(m.slug, y.year) ? `<section>${enrichedYearHtml(findEnrichedYear(m.slug, y.year)!, m, y)}</section>` : "")
    + `<p><a href="${valuePath(m)}">All ${name} years</a></p><p><a href="/value">All models</a></p></main>`;
}

/** Build-time body for a registry-only slug: same breadcrumb, H1 and guidance as a priced page, no table. */
export function valueFallbackBodyHtml(m: ValueRef): string {
  const name = esc(valueName(m));
  return `<main id="main"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="${VALUE_INDEX_PATH}">Car values</a> / <span aria-current="page">${name}</span></nav>`
    + `<h1>${esc(valueH1(m))}</h1><p>${esc(VALUE_NO_DATA_COPY(m))}</p>`
    + `<p><a href="/valuation/new">Value my ${name} free</a></p>`
    + guidanceHtml(m)
    + moreFromMakeHtml(m)
    + `<p><a href="/value">All models</a></p></main>`;
}

export function valueIndexBodyHtml(): string {
  return `<main id="main"><h1>${esc(VALUE_INDEX_H1)}</h1><p>${esc(VALUE_INDEX_INTRO)}</p>`
    + valueModelsByMake().map((g) => `<section><h2>${esc(g.make)}</h2><ul>` + g.models.map((v) => `<li><a href="${valueModelPath(v)}">How much is my ${esc(modelDisplayName(v))} worth?</a></li>`).join("") + `</ul></section>`).join("")
    + `<p><a href="/valuation/new">Value a car free</a></p></main>`;
}
