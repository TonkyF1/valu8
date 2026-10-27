// Regenerates public/sitemap.xml: `bun scripts/sitemap.ts`
import { writeFileSync } from "node:fs";
import { ALL_ROUTES, SITE_URL } from "../src/data/routeMeta";
import { escapeHtml } from "./routeHtml";

export function buildSitemap(): string {
  const urls = ALL_ROUTES.filter((route) => route.inSitemap);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((route) => `  <url><loc>${escapeHtml(SITE_URL + route.path)}</loc><priority>${route.priority ?? "0.5"}</priority></url>`).join("\n")}\n</urlset>\n`;
}

if (process.argv[1]?.endsWith("sitemap.ts")) writeFileSync("public/sitemap.xml", buildSitemap());
