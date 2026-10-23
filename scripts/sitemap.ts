// Regenerates public/sitemap.xml: `npx tsx scripts/sitemap.ts`
import { writeFileSync } from "node:fs";
import { CAR_MODELS } from "../src/data/carModels";

const SITE = "https://valu8.uk";
const STATIC: [string, string][] = [["/", "1.0"], ["/valuation/new", "0.9"], ["/buyer", "0.8"], ["/car-values", "0.8"], ["/pricing", "0.6"], ["/privacy", "0.3"], ["/terms", "0.3"], ["/disclaimers", "0.3"], ["/about", "0.4"], ["/contact", "0.3"]];

export function buildSitemap(): string {
  const urls = [...STATIC, ...CAR_MODELS.map((m) => [`/car-values/${m.makeSlug}/${m.slug}`, "0.7"] as [string, string])];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([p, pr]) => `  <url><loc>${SITE}${p}</loc><priority>${pr}</priority></url>`).join("\n")}\n</urlset>\n`;
}

if (process.argv[1]?.endsWith("sitemap.ts")) writeFileSync("public/sitemap.xml", buildSitemap());
