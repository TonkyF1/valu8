// Regenerates public/sitemap.xml: `bun scripts/sitemap.ts`
import { writeFileSync } from "node:fs";
import { SITE_URL, type RouteMeta } from "../src/data/routeMeta";
import { ALL_ROUTES } from "../src/data/allRoutes";
import { CAR_VALUE_PAGES_MODIFIED_ISO, PAGE_LASTMOD } from "../src/data/pageLastmod";
import { escapeHtml } from "./routeHtml";

/** The real last-content-change date for a sitemap route, or undefined (then <lastmod> is left out). */
export function sitemapLastmod(route: Pick<RouteMeta, "path" | "lastmod">): string | undefined {
  return route.lastmod ?? PAGE_LASTMOD[route.path] ?? (route.path.startsWith("/car-values/") ? CAR_VALUE_PAGES_MODIFIED_ISO : undefined);
}

export function buildSitemap(): string {
  const urls = ALL_ROUTES.filter((route) => route.inSitemap);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((route) => {
    const lastmod = sitemapLastmod(route);
    return `  <url><loc>${escapeHtml(SITE_URL + route.path)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<priority>${route.priority ?? "0.5"}</priority></url>`;
  }).join("\n")}\n</urlset>\n`;
}

if (process.argv[1]?.endsWith("sitemap.ts")) writeFileSync("public/sitemap.xml", buildSitemap());
