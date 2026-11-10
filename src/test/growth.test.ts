import { describe, expect, it, beforeEach } from "vitest";
import { buildSitemap } from "../../scripts/sitemap";
import { routeHtml } from "../../scripts/routeHtml";
import { getAnyRouteMeta as getRouteMeta } from "@/data/allRoutes";
import { cleanUtm, captureUtm, getUtm, parseUtm } from "@/lib/funnel";
import { findGuide, guideBodyHtml } from "@/data/guides";
import { findEnrichedYear } from "@/data/enrichedYears";
import { loadMetaPixel, metaPixelConfigured, metaPixelLoaded } from "@/lib/metaPixel";
import { yearBodyHtml } from "@/data/valuePages";
import { findModelPrices, findYearPrices } from "@/data/modelPriceBands";

const shell = `<!doctype html><html><head><title>x</title><link rel="canonical" href="https://valu8.uk/" /><meta name="description" content="x" /><meta property="og:url" content="x" /><meta property="og:title" content="x" /><meta property="og:description" content="x" /><meta name="twitter:title" content="x" /><meta name="twitter:description" content="x" /></head><body><div id="root"></div></body></html>`;

describe("UTM capture", () => {
  beforeEach(() => sessionStorage.clear());
  it("sanitises tags to the DB rule", () => {
    expect(cleanUtm(" Facebook Ads ")).toBe("facebook_ads");
    expect(cleanUtm("report299")).toBe("report299");
    expect(cleanUtm("<script>")).toBe("script");
    expect(cleanUtm("")).toBeNull();
    expect(cleanUtm("x".repeat(80))!.length).toBe(64);
  });
  it("keeps landing tags for the tab and ignores untagged later loads", () => {
    expect(parseUtm("?foo=1")).toBeNull();
    captureUtm("?utm_source=test&utm_medium=test&utm_campaign=test");
    expect(getUtm()).toEqual({ utm_source: "test", utm_medium: "test", utm_campaign: "test" });
    captureUtm("");
    expect(getUtm().utm_campaign).toBe("test");
    captureUtm("?utm_source=facebook&utm_campaign=report299");
    expect(getUtm()).toEqual({ utm_source: "facebook", utm_medium: null, utm_campaign: "report299" });
  });
  it("uses sessionStorage only (no cookies)", () => {
    captureUtm("?utm_source=a");
    expect(document.cookie).toBe("");
  });
});

describe("SEO: year pages and new pages", () => {
  it("templated year pages are noindex,follow and out of the sitemap", () => {
    const meta = getRouteMeta("/value/volkswagen-golf/2017");
    expect(meta.noindex).toBe(true);
    expect(meta.inSitemap).toBe(false);
    expect(routeHtml(shell, meta)).toContain('<meta name="robots" content="noindex, follow" />');
    const xml = buildSitemap();
    expect(xml).not.toContain("/value/volkswagen-golf/2017");
    const years = xml.match(/\/value\/[a-z0-9-]+\/\d{4}</g) ?? [];
    expect(years).toEqual(["/value/ford-fiesta/2016<"]);
  });
  it("the enriched 2016 Fiesta page is indexable, in the sitemap and uses live figures", () => {
    const meta = getRouteMeta("/value/ford-fiesta/2016");
    expect(meta.noindex).toBe(false);
    expect(meta.inSitemap).toBe(true);
    expect(findEnrichedYear("ford-fiesta", 2016)).toBeTruthy();
    const m = findModelPrices("ford-fiesta")!; const y = findYearPrices(m, "2016")!;
    const html = yearBodyHtml(m, y);
    expect(html).toContain("Private sale, part-exchange or dealer");
    expect(html).toContain("Does Valu8 buy cars?");
    expect(html).toContain("£" + y.median.toLocaleString("en-GB"));
  });
  it("publishes the two new guides with tables rendered", () => {
    const px = findGuide("part-exchange-offer-too-low");
    const mot = findGuide("mot-advisories-car-value");
    expect(px && mot).toBeTruthy();
    expect(guideBodyHtml(mot!.markdown)).toContain("<table>");
    expect(mot!.faqs.length).toBeGreaterThanOrEqual(4);
    expect(px!.faqs.length).toBeGreaterThanOrEqual(4);
    const xml = buildSitemap();
    expect(xml).toContain("<loc>https://valu8.uk/guides/part-exchange-offer-too-low</loc>");
    expect(xml).toContain("<loc>https://valu8.uk/guides/mot-advisories-car-value</loc>");
  });
  it("new copy follows the copy rules", () => {
    const text = [findGuide("part-exchange-offer-too-low")!.markdown, findGuide("mot-advisories-car-value")!.markdown, yearBodyHtml(findModelPrices("ford-fiesta")!, findYearPrices(findModelPrices("ford-fiesta"), "2016")!)].join("\n");
    expect(text).not.toMatch(/—/);
    expect(text.toLowerCase()).not.toContain("gumtree");
    expect(text.toLowerCase()).not.toMatch(/\baccurate\b|\baccuracy\b/);
  });
});

describe("Meta Pixel", () => {
  it("is switched off with no pixel ID and never injects a script", () => {
    expect(metaPixelConfigured()).toBe(false);
    expect(loadMetaPixel()).toBe(false);
    expect(metaPixelLoaded()).toBe(false);
    expect(document.querySelector('script[src*="facebook"]')).toBeNull();
  });
});
