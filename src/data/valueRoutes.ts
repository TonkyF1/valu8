// Route metadata for the /value/* asking-price pages. Kept apart from routeMeta.ts because it needs the
// full price tables (modelPriceBands.ts), which should only load with the /value pages themselves.
import type { RouteMeta } from "./routeMeta";
import { MODEL_PRICES } from "./modelPriceBands";
import { VALUE_INDEX_DESCRIPTION, VALUE_INDEX_PATH, VALUE_INDEX_TITLE, valueMeta, yearMeta } from "./valuePages";

export const VALUE_ROUTES: RouteMeta[] = [
  { path: VALUE_INDEX_PATH, title: VALUE_INDEX_TITLE, description: VALUE_INDEX_DESCRIPTION, priority: "0.8", inSitemap: true },
  ...MODEL_PRICES.map((m): RouteMeta => ({ ...valueMeta(m), priority: "0.7", inSitemap: true })),
  // Templated year pages: noindex,follow and not in the sitemap (yearMeta). Enriched years are indexable.
  ...MODEL_PRICES.flatMap((m) => m.years.map((y): RouteMeta => { const ym = yearMeta(m, y); return { ...ym, priority: "0.6", inSitemap: !ym.noindex }; })),
];

const BY_PATH = new Map(VALUE_ROUTES.map((r) => [r.path, r]));

export function getValueRouteMeta(path: string): RouteMeta {
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const meta = BY_PATH.get(pathname);
  if (!meta) throw new Error(`Missing route metadata: ${pathname}`);
  return meta;
}
