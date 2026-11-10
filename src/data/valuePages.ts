// Node-safe content for the /value pages (React + build-time HTML in vite.config.ts).
// Figures are typical asking prices from UK adverts (generated into modelPriceBands.ts), not valuations.
import { MODEL_PRICES, PRICE_DATA_UPDATED, type ModelPrices, type YearPrices } from "./modelPriceBands";
import { enrichedYearHtml, findEnrichedYear } from "./enrichedYears";
import { VALUE_MODELS, joinMakeModel, valueModelName, valueModelPath, valueModelsByMake, type ValueModel } from "./valueModels";

export const VALUE_INDEX_PATH = "/value";
export const VALUE_INDEX_TITLE = "What's my car worth? Typical UK asking prices by model | Valu8";
export const VALUE_INDEX_DESCRIPTION = `Typical asking prices from UK adverts for the ${MODEL_PRICES.length} most-advertised used car models, by year. Then get a free valuation for your own car.`;
export const VALUE_INDEX_H1 = "What's my car worth? Typical asking prices by model";
export const VALUE_INDEX_INTRO = "Typical asking prices from UK adverts for the most-advertised used cars, grouped by year. Pick your model for a quick guide, then value your own car for free.";

export const valueName = (m: ModelPrices) => joinMakeModel(m.make, m.model);
export const valuePath = (m: ModelPrices) => `/value/${m.slug}`;
export const yearPath = (m: ModelPrices, y: YearPrices | number) => `/value/${m.slug}/${typeof y === "number" ? y : y.year}`;
export const gbp = (n: number) => "£" + n.toLocaleString("en-GB");
export const miles = (n: number) => n.toLocaleString("en-GB") + " miles";

export function valueMeta(m: ModelPrices) {
  const name = valueName(m);
  const all = m.bands.map((b) => b.median);
  return {
    path: valuePath(m),
    title: `What's my ${name} worth? Typical UK asking prices | Valu8`,
    description: `Typical ${name} asking prices from UK adverts by year, from ${gbp(Math.min(...all))} to ${gbp(Math.max(...all))} (median). Get a free valuation for your own ${valueName(m)}.`,
  };
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

// ---------- Per-year pages (/value/:slug/:year) ----------

/** Templated year pages stay live (shared in social replies) but are noindex,follow and out of the
 *  sitemap; only hand-enriched years (enrichedYears.ts) are indexable. */
export function yearMeta(m: ModelPrices, y: YearPrices) {
  const name = valueName(m);
  const e = findEnrichedYear(m.slug, y.year);
  return {
    path: yearPath(m, y),
    title: e?.title ?? `What's my ${y.year} ${name} worth? Typical asking prices | Valu8`,
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

function moreFromMakeHtml(m: ModelPrices): string {
  const others = sameMakeModels(m.slug, m.make);
  if (!others.length) return "";
  return `<h2>More ${esc(m.make)} asking prices</h2><ul>` + others.map((v) => `<li><a href="${valueModelPath(v)}">${esc(valueModelName(v))}</a></li>`).join("") + `</ul>`;
}

export function valueBodyHtml(m: ModelPrices): string {
  const name = esc(valueName(m));
  return `<main id="main"><h1>What's my ${name} worth?</h1><p>${esc(valueIntro(m))}</p>`
    + `<table><caption>Typical ${name} asking prices by year</caption><thead><tr><th>Year</th><th>Median asking price</th><th>Typical range</th></tr></thead><tbody>`
    + m.bands.map((b) => `<tr><td>${esc(b.band)}</td><td>${gbp(b.median)}</td><td>${gbp(b.low)} – ${gbp(b.high)}</td></tr>`).join("")
    + `</tbody></table><p>${esc(VALUE_TABLE_NOTE(m))}</p>${yearLinksHtml(m)}<p><a href="/valuation/new">Value my ${esc(valueName(m))} free</a></p>`
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

export function valueIndexBodyHtml(): string {
  return `<main id="main"><h1>${esc(VALUE_INDEX_H1)}</h1><p>${esc(VALUE_INDEX_INTRO)}</p>`
    + valueModelsByMake().map((g) => `<section><h2>${esc(g.make)}</h2><ul>` + g.models.map((v) => `<li><a href="${valueModelPath(v)}">What's my ${esc(valueModelName(v))} worth?</a></li>`).join("") + `</ul></section>`).join("")
    + `<p><a href="/valuation/new">Value my car free</a></p></main>`;
}
