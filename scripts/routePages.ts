// Build-time HTML for every route (used by the vite.config.ts build plugin and by tests, so tests check
// exactly what the build emits). Node-safe, dependency-free.
import type { RouteMeta } from "../src/data/routeMeta";
import { getRouteMeta } from "../src/data/routeMeta";
import { routeHtml } from "./routeHtml";
import { GUIDES, GUIDE_ARTICLE_JSONLD_ID, guideArticleHtml, guideArticleJsonLd, guideFaqJsonLd, guidesIndexBodyHtml } from "../src/data/guides";
import { CAR_MODELS } from "../src/data/carModels";
import { MODEL_PRICES } from "../src/data/modelPriceBands";
import { hubHeadHtml, registryOnlyModels, valueBodyHtml, valueFallbackBodyHtml, valueHeadHtml, valueIndexBodyHtml, valuePath, yearBodyHtml, yearPath, type ValueRef } from "../src/data/valuePages";
import { VALUE_SLUG_REGISTRY } from "../src/data/valueSlugRegistry";
import { carModelBodyHtml, carModelJsonLd, carPath, carRedirectBodyHtml, carRedirectHeadHtml, carValueMatch, carValuesIndexBodyHtml } from "../src/data/carValueContent";
import { faqPageHeadHtml, homepageFaqHeadHtml, staticPageBodyHtml } from "../src/data/staticPageContent";
import { enrichedYearFaqJsonLd, findEnrichedYear } from "../src/data/enrichedYears";

type Extra = { bodyHtml?: string; headHtml?: string };

/** A published /value slug with no price data: same page minus the table (indexable; route meta in valueRoutes.ts). */
export const valueFallbackExtra = (v: ValueRef): Extra => ({ bodyHtml: valueFallbackBodyHtml(v), headHtml: valueHeadHtml(v) });

/** Prerendered body/head additions for one route (undefined = plain SPA shell with route metadata). */
export function routeExtra(meta: RouteMeta): Extra | undefined {
  if (meta.path === "/") return { bodyHtml: staticPageBodyHtml("/"), headHtml: homepageFaqHeadHtml };
  const pageBody = staticPageBodyHtml(meta.path);
  if (pageBody) return meta.path === "/faq" ? { bodyHtml: pageBody, headHtml: faqPageHeadHtml } : { bodyHtml: pageBody };
  if (meta.path === "/value") return { bodyHtml: valueIndexBodyHtml(), headHtml: hubHeadHtml("Car values", "/value") };
  const vm = MODEL_PRICES.find((m) => valuePath(m) === meta.path);
  if (vm) return { bodyHtml: valueBodyHtml(vm), headHtml: valueHeadHtml(vm) };
  const fallback = registryOnlyModels().find((v) => valuePath(v) === meta.path);
  if (fallback) return valueFallbackExtra(fallback);
  const vy = MODEL_PRICES.flatMap((m) => m.years.map((y) => ({ m, y }))).find(({ m, y }) => yearPath(m, y) === meta.path);
  if (vy) {
    const e = findEnrichedYear(vy.m.slug, vy.y.year);
    return { bodyHtml: yearBodyHtml(vy.m, vy.y), ...(e ? { headHtml: '<script type="application/ld+json" id="year-faq-jsonld">' + enrichedYearFaqJsonLd(e, vy.m, vy.y) + '</script>' } : {}) };
  }
  if (meta.path === "/guides") return { bodyHtml: guidesIndexBodyHtml() };
  const guide = GUIDES.find((g) => g.path === meta.path);
  if (guide) return { bodyHtml: guideArticleHtml(guide), headHtml: '<script type="application/ld+json" id="guide-faq-jsonld">' + guideFaqJsonLd(guide) + '</script>\n'
    + `<script type="application/ld+json" id="${GUIDE_ARTICLE_JSONLD_ID}">${guideArticleJsonLd(guide)}</script>` };
  if (meta.path === "/car-values") return { bodyHtml: carValuesIndexBodyHtml(), headHtml: hubHeadHtml("Car values by make and model", "/car-values") };
  const car = CAR_MODELS.find((m) => carPath(m) === meta.path);
  if (car) {
    // Matched models permanently redirect to /value/<slug> (noindex + canonical come from carModelMeta).
    const v = carValueMatch(car);
    if (v) return { bodyHtml: carRedirectBodyHtml(v), headHtml: carRedirectHeadHtml(v) };
    return { bodyHtml: carModelBodyHtml(car), headHtml: '<script type="application/ld+json" id="car-value-jsonld">' + carModelJsonLd(car) + '</script>' };
  }
  return undefined;
}

export function buildRouteHtml(shell: string, meta: RouteMeta): string {
  const extra = routeExtra(meta);
  // Old advert-check URL: the prebuilt page refreshes to /check (the app route also redirects).
  if (meta.path === "/check-an-advert") return routeHtml(shell, meta, false, { ...extra, headHtml: '<meta http-equiv="refresh" content="0; url=/check" />' });
  return routeHtml(shell, meta, false, extra);
}

// ---------- Valid model paths for the unknown-route script in index.html ----------

export const ROUTE_DATA_PLACEHOLDER = "/*VALU8_ROUTE_DATA*/null";

const yearRanges = (years: number[]) => {
  const ys = [...new Set(years)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < ys.length; ) {
    let j = i;
    while (j + 1 < ys.length && ys[j + 1] === ys[j] + 1) j++;
    out.push(j > i ? `${ys[i]}-${ys[j]}` : String(ys[i]));
    i = j + 1;
  }
  return out.join(" ");
};

/** Compact lists of every valid /value slug, /value/{slug}/{year} pair and /car-values make/model pair. */
export function routeData() {
  const y: Record<string, string> = {};
  for (const m of MODEL_PRICES) if (m.years.length) y[m.slug] = yearRanges(m.years.map((x) => x.year));
  return {
    v: [...new Set([...VALUE_SLUG_REGISTRY.map((r) => r.slug), ...MODEL_PRICES.map((m) => m.slug)])],
    y,
    c: CAR_MODELS.map((m) => `${m.makeSlug}/${m.slug}`),
  };
}

/** Fill the placeholder in index.html's unknown-route script. Only the shells hosting serves for paths without
 *  their own file (homepage index.html, 404.html) need it; prebuilt routes are known by their own canonical. */
export function withRouteData(html: string): string {
  const n = html.split(ROUTE_DATA_PLACEHOLDER).length - 1;
  if (n !== 1) throw new Error(`Route HTML: expected exactly one ${ROUTE_DATA_PLACEHOLDER}, found ${n}`);
  return html.replace(ROUTE_DATA_PLACEHOLDER, () => JSON.stringify(routeData()).replace(/</g, "\\u003c"));
}

export const homepageHtml = (shell: string) => withRouteData(buildRouteHtml(shell, getRouteMeta("/")));

export const notFoundHtml = (shell: string) => withRouteData(routeHtml(shell, {
  path: "/404", title: "Page not found | Valu8",
  description: "This page doesn't exist. Value your car free with Valu8.", noindex: true,
}, true));
