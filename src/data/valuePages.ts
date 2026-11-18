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
export const VALUE_INDEX_TITLE = "What's my car worth? Typical UK asking prices by model | Valu8";
export const VALUE_INDEX_DESCRIPTION = `Typical asking prices from UK adverts for the ${MODEL_PRICES.length} most-advertised used car models, by year. Then get a free valuation for your own car.`;
export const VALUE_INDEX_H1 = "What's my car worth? Typical asking prices by model";
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
  `Pick a year for typical ${valueName(m)} asking prices, mileage and how mileage moves the price. Years with fewer than 15 adverts are not listed.`;

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

export const VALUE_BREADCRUMB_JSONLD_ID = "value-breadcrumb-jsonld";
export const VALUE_FAQ_JSONLD_ID = "value-faq-jsonld";

export function valueHeadHtml(m: ValueRef): string {
  return `<script type="application/ld+json" id="${VALUE_BREADCRUMB_JSONLD_ID}">${valueBreadcrumbJsonLd(m)}</script>\n`
    + `<script type="application/ld+json" id="${VALUE_FAQ_JSONLD_ID}">${valueFaqJsonLd(m)}</script>`;
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

function yearLinksHtml(m: ModelPrices): string {
  if (!m.years.length) return "";
  return `<h2>${esc(valueName(m))} prices by year</h2><ul>`
    + m.years.map((y) => `<li><a href="${yearPath(m, y)}">${y.year} ${esc(valueName(m))}</a></li>`).join("") + `</ul>`;
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
    + `<table><caption>Typical ${name} asking prices by year</caption><thead><tr><th>Year</th><th>Median asking price</th><th>Typical range</th></tr></thead><tbody>`
    + m.bands.map((b) => `<tr><td>${esc(b.band)}</td><td>${gbp(b.median)}</td><td>${gbp(b.low)} – ${gbp(b.high)}</td></tr>`).join("")
    + `</tbody></table><p>${esc(VALUE_TABLE_NOTE(m))}</p>${yearLinksHtml(m)}<p><a href="/valuation/new">Value my ${esc(valueName(m))} free</a></p>`
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
  return `<main id="main"><h1>What's my ${y.year} ${name} worth?</h1><p>${esc(yearIntro(m, y))}</p>`
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
    + valueModelsByMake().map((g) => `<section><h2>${esc(g.make)}</h2><ul>` + g.models.map((v) => `<li><a href="${valueModelPath(v)}">What's my ${esc(modelDisplayName(v))} worth?</a></li>`).join("") + `</ul></section>`).join("")
    + `<p><a href="/valuation/new">Value a car free</a></p></main>`;
}
