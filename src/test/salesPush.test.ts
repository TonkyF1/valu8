import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { shareCardUrl, shareCardText, REFERRAL_COPY } from "@/components/ShareCard";
import { plateText, shareFileName } from "@/lib/shareImage";
import { embedSnippet, embedSiteParam, embedInfoBodyHtml, EMBED_INFO } from "@/data/embedContent";
import { GUIDES } from "@/data/guides";
import { MODEL_PRICES } from "@/data/modelPriceBands";
import { CAR_MODELS } from "@/data/carModels";
import { getRouteMeta } from "@/data/routeMeta";
import { buildSitemap } from "../../scripts/sitemap";
import { FREE_INCLUDES, REPORT_ADDS } from "@/components/ReportCheckout";
import { cleanUtm } from "@/lib/funnel";

const NEW_GUIDES = ["how-to-price-a-car-for-private-sale", "what-lowers-a-cars-value", "private-sale-vs-dealer-prices"];
const NEW_MODELS = ["ford-puma", "vauxhall-astra", "vauxhall-mokka", "volkswagen-t-roc", "toyota-corolla", "toyota-c-hr", "kia-ceed", "mini-hatch", "tesla-model-3"];

/** Copy rules: British English, no em dashes, no accuracy claims, no ad-site or competitor names. */
function assertCopyRules(text: string) {
  expect(text).not.toContain("—");
  expect(text).not.toMatch(/gumtree|autotrader|auto trader|webuyanycar|we buy any car|motorway\.co|cazoo|carwow|parkers/i);
  expect(text).not.toMatch(/\baccura(te|cy)\b|guarantee(d)? (price|value)|most accurate/i);
  expect(text).not.toMatch(/\bcolor\b|\bfavorite\b|\bpersonalized\b/i);
}

describe("share card + referral", () => {
  it("share link carries utm_source=share and the code, and opens the homepage", () => {
    const u = new URL(shareCardUrl("abcdefgh23"));
    expect(u.origin + u.pathname).toBe("https://valu8.uk/");
    expect(u.searchParams.get("utm_source")).toBe("share");
    expect(u.searchParams.get("ref")).toBe("abcdefgh23");
    expect(new URL(shareCardUrl("BAD")).searchParams.get("ref")).toBeNull();
  });
  it("uses the agreed referral copy", () => {
    expect(REFERRAL_COPY).toBe("Share with a friend. When they value their car, your full report is free.");
    assertCopyRules(shareCardText("2017 Volkswagen Golf", "£8,750"));
  });
  it("plate shows VALU8 unless the owner opts in", () => {
    expect(plateText(null)).toBe("VALU8");
    expect(plateText("ab17cde")).toBe("AB17 CDE");
    expect(shareFileName("2017 Volkswagen Golf")).toBe("valu8-2017-volkswagen-golf.png");
  });
});

describe("embed widget", () => {
  it("snippet points at /embed with a clean site name", () => {
    expect(embedSiteParam("https://www.Smiths Garage.co.uk/contact")).toBe("smiths_garage.co.uk");
    expect(cleanUtm(embedSiteParam("Smith's Garage"))).toBe(embedSiteParam("Smith's Garage"));
    expect(embedSnippet("smithsgarage.co.uk", true)).toContain('src="https://valu8.uk/embed/?site=smithsgarage.co.uk&theme=light"');
  });
  it("static widget opens valu8.uk with the reg prefilled and utm_source=embed", () => {
    const html = readFileSync("public/embed/index.html", "utf8");
    expect(html).toContain("https://valu8.uk/valuation/new?reg=");
    expect(html).toContain("utm_source=embed");
    expect(html).toContain("utm_campaign=");
    expect(html).toContain('content="noindex"');
  });
  it("/embed-info has metadata, crawler HTML and is in the sitemap", () => {
    expect(getRouteMeta("/embed-info").title).toContain("Free car valuation box");
    expect(embedInfoBodyHtml()).toContain("&lt;iframe");
    expect(buildSitemap()).toContain("<loc>https://valu8.uk/embed-info</loc>");
    assertCopyRules(JSON.stringify(EMBED_INFO));
  });
});

describe("conversion copy", () => {
  it("the £2.99 card lists what the report adds, with no accuracy claims", () => {
    expect(REPORT_ADDS.length).toBeGreaterThanOrEqual(6);
    assertCopyRules([...FREE_INCLUDES, ...REPORT_ADDS].join(" "));
  });
});

describe("SEO additions", () => {
  it("adds /value pages for the 9 /car-values models, each with at least 50 adverts", () => {
    for (const slug of NEW_MODELS) {
      const m = MODEL_PRICES.find((p) => p.slug === slug);
      expect(m, slug).toBeDefined();
      expect(m!.listings).toBeGreaterThanOrEqual(50);
      expect(buildSitemap()).toContain(`<loc>https://valu8.uk/value/${slug}</loc>`);
    }
    // Every /car-values model now has a matching /value page.
    for (const c of CAR_MODELS) expect(MODEL_PRICES.some((p) => p.slug === `${c.makeSlug}-${c.slug}`), c.slug).toBe(true);
  });
  it("adds three guides that follow the copy rules and are in the sitemap", () => {
    const xml = buildSitemap();
    for (const slug of NEW_GUIDES) {
      const g = GUIDES.find((x) => x.slug === slug)!;
      expect(g, slug).toBeDefined();
      expect(g.faqs.length).toBeGreaterThanOrEqual(3);
      assertCopyRules(g.markdown + g.title + g.description);
      expect(g.markdown).toContain("/valuation/new");
      expect(xml).toContain(`<loc>https://valu8.uk/guides/${slug}</loc>`);
    }
  });
});
