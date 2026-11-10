import { describe, expect, it } from "vitest";
import { MODEL_PRICES } from "@/data/modelPriceBands";
import { VALUE_MODELS, valueModelsByMake } from "@/data/valueModels";
import { ALL_ROUTES, getAnyRouteMeta } from "@/data/allRoutes";
import { getValueRouteMeta } from "@/data/valueRoutes";
import { valueBodyHtml, valueIndexBodyHtml, sameMakeModels } from "@/data/valuePages";
import { carValuesIndexBodyHtml } from "@/data/carValueContent";
import { buildSitemap } from "../../scripts/sitemap";
import { indexNowBody, newUrls, sitemapUrls, INDEXNOW_KEY } from "../../scripts/indexnow";
import { REPORT_ADDS, REPORT_CTA, reportAdds, reportOfferLine } from "@/components/ReportCheckout";

function assertCopyRules(text: string) {
  expect(text).not.toContain("—");
  expect(text).not.toMatch(/gumtree|autotrader|auto trader|webuyanycar|we buy any car|motorway\.co|cazoo|carwow|parkers/i);
  expect(text).not.toMatch(/\baccura(te|cy)\b|\bexact\b|guarantee(d)? (price|value)|most accurate|precise/i);
  expect(text).not.toMatch(/hurry|only today|limited time|ends soon|last chance/i);
}

describe("programmatic /value pages", () => {
  it("the light index matches the price tables exactly", () => {
    expect(VALUE_MODELS.map((m) => [m.slug, m.make, m.model])).toEqual(MODEL_PRICES.map((m) => [m.slug, m.make, m.model]));
    expect(new Set(MODEL_PRICES.map((m) => m.slug)).size).toBe(MODEL_PRICES.length);
  });
  it("every model page has at least 50 adverts and a price table", () => {
    expect(MODEL_PRICES.length).toBe(234);
    for (const m of MODEL_PRICES) {
      expect(m.listings).toBeGreaterThanOrEqual(50);
      expect(m.bands.length).toBeGreaterThan(0);
      for (const b of m.bands) expect(b.count).toBeGreaterThanOrEqual(15);
      for (const y of m.years) expect(y.count).toBeGreaterThanOrEqual(15);
    }
  });
  it("every model page is in the sitemap; templated year pages stay noindex and out", () => {
    const xml = buildSitemap();
    for (const m of MODEL_PRICES) expect(xml).toContain(`<loc>https://valu8.uk/value/${m.slug}</loc>`);
    const y = getAnyRouteMeta("/value/ford-transit/2018");
    expect(y.noindex).toBe(true);
    expect(xml).not.toContain("/value/ford-transit/2018<");
    expect(getValueRouteMeta("/value/ford-transit").noindex).toBeFalsy();
  });
  it("every model page is linked from /value, from /car-values and from its make's other pages", () => {
    const idx = valueIndexBodyHtml();
    const hub = carValuesIndexBodyHtml();
    for (const m of MODEL_PRICES) {
      expect(idx).toContain(`href="/value/${m.slug}"`);
      expect(hub).toContain(`href="/value/${m.slug}"`);
    }
    expect(valueModelsByMake().reduce((n, g) => n + g.models.length, 0)).toBe(MODEL_PRICES.length);
    const transit = MODEL_PRICES.find((m) => m.slug === "ford-transit")!;
    expect(valueBodyHtml(transit)).toContain('href="/value/ford-fiesta"');
    expect(sameMakeModels("ford-transit", "Ford").some((v) => v.slug === "ford-transit")).toBe(false);
  });
  it("titles and descriptions stay unique across every route", () => {
    expect(new Set(ALL_ROUTES.map((r) => r.title)).size).toBe(ALL_ROUTES.length);
    expect(new Set(ALL_ROUTES.map((r) => r.description)).size).toBe(ALL_ROUTES.length);
  });
});

describe("IndexNow", () => {
  it("submits sitemap URLs only, with the key file at the site root", () => {
    const urls = sitemapUrls();
    expect(urls.length).toBe((buildSitemap().match(/<loc>/g) ?? []).length);
    const body = indexNowBody(urls.slice(0, 2));
    expect(body.host).toBe("valu8.uk");
    expect(body.keyLocation).toBe(`https://valu8.uk/${INDEXNOW_KEY}.txt`);
    expect(INDEXNOW_KEY).toMatch(/^[a-zA-Z0-9-]{8,128}$/);
  });
  it("only sends URLs it has not sent before", () => {
    expect(newUrls(["a", "b", "c"], ["a", "c"])).toEqual(["b"]);
  });
});

describe("£2.99 offer copy", () => {
  it("button says what you get", () => {
    expect(REPORT_CTA).toBe("See my asking price · £2.99");
    assertCopyRules(REPORT_CTA);
  });
  it("one honest line under the free price, guest-aware about the advert", () => {
    const range = reportOfferLine({ isRange: true });
    const single = reportOfferLine({ isRange: false, isGuest: true });
    expect(range).toContain("narrows this range to one suggested asking price");
    expect(single).toContain("free account");
    for (const t of [range, single, reportOfferLine({ isRange: true, isGuest: true }), ...reportAdds(true)]) assertCopyRules(t);
    expect(reportAdds(false)).toEqual(REPORT_ADDS);
  });
});
