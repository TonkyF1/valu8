// Node-safe content for the /value pages (React + build-time HTML in vite.config.ts).
// Figures are typical asking prices from UK adverts (generated into modelPriceBands.ts), not valuations.
import { MODEL_PRICES, PRICE_DATA_UPDATED, type ModelPrices } from "./modelPriceBands";

export const VALUE_INDEX_PATH = "/value";
export const VALUE_INDEX_TITLE = "What's my car worth? Typical UK asking prices by model | Valu8";
export const VALUE_INDEX_DESCRIPTION = "Typical asking prices from UK adverts for the 20 most-advertised used car models, by year. Then get a free valuation for your own car.";
export const VALUE_INDEX_H1 = "What's my car worth? Typical asking prices by model";
export const VALUE_INDEX_INTRO = "Typical asking prices from UK adverts for the most-advertised used cars, grouped by year. Pick your model for a quick guide, then value your own car for free.";

export const valueName = (m: ModelPrices) => `${m.make} ${m.model}`;
export const valuePath = (m: ModelPrices) => `/value/${m.slug}`;
export const gbp = (n: number) => "£" + n.toLocaleString("en-GB");

export function valueMeta(m: ModelPrices) {
  const name = valueName(m);
  const all = m.bands.map((b) => b.median);
  return {
    path: valuePath(m),
    title: `What's my ${name} worth? Typical UK asking prices | Valu8`,
    description: `Typical ${name} asking prices from UK adverts by year, from ${gbp(Math.min(...all))} to ${gbp(Math.max(...all))} (median). Get a free valuation for your own ${m.model}.`,
  };
}

export function valueIntro(m: ModelPrices): string {
  const name = valueName(m);
  return `Here's what ${name}s are typically advertised for in the UK, grouped by year. It's a guide to asking prices from UK adverts, not a valuation: mileage, condition, trim and history all move the price of an individual car. For a figure for your own ${m.model}, get a free valuation.`;
}

export const VALUE_TABLE_NOTE = (m: ModelPrices) =>
  `Typical asking prices from UK adverts (${m.listings.toLocaleString("en-GB")} ${valueName(m)} adverts, updated ${PRICE_DATA_UPDATED}). Typical range is the middle half of asking prices. Year groups with fewer than 15 adverts are not shown.`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function valueBodyHtml(m: ModelPrices): string {
  const name = esc(valueName(m));
  return `<main id="main"><h1>What's my ${name} worth?</h1><p>${esc(valueIntro(m))}</p>`
    + `<table><caption>Typical ${name} asking prices by year</caption><thead><tr><th>Year</th><th>Median asking price</th><th>Typical range</th></tr></thead><tbody>`
    + m.bands.map((b) => `<tr><td>${esc(b.band)}</td><td>${gbp(b.median)}</td><td>${gbp(b.low)} – ${gbp(b.high)}</td></tr>`).join("")
    + `</tbody></table><p>${esc(VALUE_TABLE_NOTE(m))}</p><p><a href="/valuation/new">Value my ${esc(m.model)} free</a></p>`
    + `<p><a href="/value">All models</a></p></main>`;
}

export function valueIndexBodyHtml(): string {
  return `<main id="main"><h1>${esc(VALUE_INDEX_H1)}</h1><p>${esc(VALUE_INDEX_INTRO)}</p><ul>`
    + MODEL_PRICES.map((m) => `<li><a href="${valuePath(m)}">What's my ${esc(valueName(m))} worth?</a></li>`).join("")
    + `</ul><p><a href="/valuation/new">Value my car free</a></p></main>`;
}
