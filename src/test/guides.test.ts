import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GUIDES, guideArticleHtml, guideFaqJsonLd } from "@/data/guides";
import { getRouteMeta } from "@/data/routeMeta";
import { routeHtml } from "../../scripts/routeHtml";
import { buildSitemap } from "../../scripts/sitemap";

const SLUGS = [
  "what-is-my-car-worth",
  "part-exchange-vs-private-sale",
  "how-to-tell-if-a-used-car-is-overpriced",
  "how-to-sell-a-car-privately-safely",
  "check-mot-and-mileage-history-before-buying",
];

describe("guides", () => {
  it("has the five expected guides", () => {
    expect(GUIDES.map((g) => g.slug)).toEqual(SLUGS);
  });

  it("each guide has title, description, h1 and at least 3 FAQs", () => {
    for (const g of GUIDES) {
      expect(g.title).not.toBe("");
      expect(g.description).not.toBe("");
      expect(g.h1).not.toBe("");
      expect(g.faqs.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("uses the seo_title as route title", () => {
    expect(getRouteMeta("/guides/what-is-my-car-worth").title).toBe("What Is My Car Worth? UK Car Values Explained");
  });

  it("prerenders guide HTML with canonical, description, body and FAQ JSON-LD", () => {
    const shell = readFileSync("index.html", "utf8");
    const g = GUIDES[0];
    const html = routeHtml(shell, getRouteMeta(g.path), false, {
      bodyHtml: guideArticleHtml(g),
      headHtml: '<script type="application/ld+json" id="guide-faq-jsonld">' + guideFaqJsonLd(g) + "</script>",
    });
    expect(html).toContain(`https://valu8.uk/guides/${g.slug}`);
    expect(html).toContain(g.description);
    expect(html).toContain("Your car has three prices, not one");
    expect(html).toContain('"@type":"FAQPage"');
  });

  it("sitemap lists the guides index and all five guides", () => {
    const xml = buildSitemap();
    expect(xml).toContain("<loc>https://valu8.uk/guides</loc>");
    for (const s of SLUGS) expect(xml).toContain(`<loc>https://valu8.uk/guides/${s}</loc>`);
  });
});
