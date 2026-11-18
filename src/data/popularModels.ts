// Most-searched /value model pages (Google Search Console impressions, 28 Oct–17 Nov 2026), used for internal
// links from the homepage, the guides and the hubs. Node-safe and dependency-light (imported by guides.ts).
// Only slugs that exist in VALUE_MODELS are linked, so a dropped model can never create a broken link.
import { VALUE_MODELS, valueModelPath, type ValueModel } from "./valueModels";
import { modelDisplayName } from "./modelDisplayName";

export const POPULAR_VALUE_SLUGS = [
  "ford-kuga", "toyota-yaris", "hyundai-tucson", "vauxhall-mokka", "mercedes-benz-c-class", "toyota-c-hr",
  "audi-a3", "hyundai-i10", "kia-sportage", "ford-fiesta", "honda-jazz", "hyundai-i20",
  "toyota-corolla", "audi-a1", "honda-civic", "nissan-leaf",
];

export function popularValueModels(limit = POPULAR_VALUE_SLUGS.length): ValueModel[] {
  return POPULAR_VALUE_SLUGS.map((s) => VALUE_MODELS.find((v) => v.slug === s))
    .filter((v): v is ValueModel => !!v).slice(0, limit);
}

export const POPULAR_MODELS_H2 = "Popular car values";
export const popularModelLabel = (v: ValueModel) => `How much is my ${modelDisplayName(v)} worth?`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Build-time HTML block: links to the most-searched /value model pages plus the /value hub. */
export function popularModelsHtml(limit?: number): string {
  return `<section><h2>${POPULAR_MODELS_H2}</h2><ul>`
    + popularValueModels(limit).map((v) => `<li><a href="${valueModelPath(v)}">${esc(popularModelLabel(v))}</a></li>`).join("")
    + `</ul><p><a href="/value">See typical prices for all models</a></p></section>`;
}
