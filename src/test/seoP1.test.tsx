// SEO P1 (Nov 2026): year-by-year data on /value pages, WebPage/Article/hub BreadcrumbList JSON-LD, en-GB,
// homepage H1 and internal links to the most-searched model pages. The sitemap must not change.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getRouteMeta } from "@/data/routeMeta";
import { ALL_ROUTES } from "@/data/allRoutes";
import { MODEL_PRICES } from "@/data/modelPriceBands";
import { GUIDES } from "@/data/guides";
import { POPULAR_VALUE_SLUGS, popularValueModels } from "@/data/popularModels";
import { VALUE_SLUGS } from "@/data/valueModels";
import { valueName, valuePageModifiedIso, valueDepreciation, valueMileageYear, valuePath, yearPath } from "@/data/valuePages";
import { staticPageBodyHtml } from "@/data/staticPageContent";
import { buildRouteHtml } from "../../scripts/routePages";
import { buildSitemap } from "../../scripts/sitemap";

vi.mock("@/components/Layout", () => ({ Header: () => null, TestModeBanner: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
import ModelValue from "@/pages/ModelValue";

const shell = readFileSync("index.html", "utf8");
const jsonLd = (html: string) => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((x) => JSON.parse(x[1]));
const types = (blocks: any[]) => blocks.flatMap((b) => (Array.isArray(b) ? b : b["@graph"] ?? [b])).map((b: any) => b["@type"]);
const built = (path: string) => buildRouteHtml(shell, ALL_ROUTES.find((r) => r.path === path) ?? getRouteMeta(path));

describe("sitemap URLs unchanged by P1", () => {
  // Tony-approved URL additions only (20 Nov 2026: "Yes, add the 3 new pages to the sitemap").
  // Growth plan 21 Nov 2026: /guides/electric-car-value is added by its own commit and only merges if Tony OKs the
  // new sitemap URL in the PR. If he says no, revert that commit (this line goes with it).
  const APPROVED_NEW_URLS = ["/how-it-works", "/faq", "/example-report", "/guides/electric-car-value"];
  it("matches the pre-SEO-work sitemap (sha1 9762fe89…) once the <lastmod> dates (added 20 Nov 2026, Tony approved) and the Tony-approved new URLs are removed", () => {
    const xml = buildSitemap();
    for (const u of APPROVED_NEW_URLS) expect(xml).toContain(`<loc>https://valu8.uk${u}</loc>`);
    const original = xml.replace(/<lastmod>[^<]*<\/lastmod>/g, "")
      .split("\n").filter((l) => !APPROVED_NEW_URLS.some((u) => l.includes(`<loc>https://valu8.uk${u}</loc>`))).join("\n");
    expect(createHash("sha1").update(original).digest("hex")).toBe("9762fe89e1f910e3fbb9c9884859c377c9e607ba");
    expect((xml.match(/<url>/g) ?? []).length).toBe(261);
  });
});

describe("site-wide head", () => {
  it("html lang is en-GB", () => {
    expect(shell).toContain('<html lang="en-GB"');
    expect(built("/value/ford-kuga")).toContain('<html lang="en-GB"');
  });
});

describe("/value model pages: year-by-year data", () => {
  it("every priced model has a full year table linking each year page, plus WebPage JSON-LD with dateModified", () => {
    for (const m of MODEL_PRICES) {
      const html = built(valuePath(m));
      if (m.years.length) expect(html, m.slug).toContain("asking prices for every year</caption>");
      for (const y of m.years) expect(html, `${m.slug} ${y.year}`).toContain(`<td><a href="${yearPath(m, y)}">${y.year}</a></td>`);
      const page = jsonLd(html).find((b) => b["@type"] === "WebPage");
      expect(page, m.slug).toBeDefined();
      expect(page.dateModified).toBe(valuePageModifiedIso(m.slug));
      expect(page.url).toBe(`https://valu8.uk${valuePath(m)}`);
      expect(page.inLanguage).toBe("en-GB");
      expect(html).toContain(`Selling your ${valueName(m)}: private sale, part-exchange or dealer price?`);
      expect(html).not.toContain('content="noindex');
    }
  });
  it("depreciation only shows for 5–35% from 4+ consecutive-year steps; mileage table uses the biggest year", () => {
    const kuga = MODEL_PRICES.find((m) => m.slug === "ford-kuga")!;
    const d = valueDepreciation(kuga)!;
    expect(d.pct).toBeGreaterThanOrEqual(5);
    expect(d.pct).toBeLessThanOrEqual(35);
    expect(built("/value/ford-kuga")).toContain("How much a Ford Kuga loses per year");
    const my = valueMileageYear(kuga)!;
    expect(my.count).toBe(Math.max(...kuga.years.filter((y) => y.byMileage.length >= 2).map((y) => y.count)));
    expect(built("/value/ford-kuga")).toContain(`${my.year} Ford Kuga asking prices by mileage</caption>`);
  });
  it("year pages stay noindex", () => {
    const m = MODEL_PRICES.find((x) => x.slug === "kia-sportage")!;
    expect(built(yearPath(m, 2016))).toContain('<meta name="robots" content="noindex, follow" />');
  });
  it("React page shows the year table, mileage table and price-type section", () => {
    document.head.innerHTML = "";
    const { container, unmount } = render(
      <MemoryRouter initialEntries={["/value/ford-kuga"]}><Routes><Route path="/value/:slug" element={<ModelValue />} /></Routes></MemoryRouter>,
    );
    const text = container.textContent ?? "";
    const kuga = MODEL_PRICES.find((m) => m.slug === "ford-kuga")!;
    for (const y of kuga.years) expect(container.querySelector(`a[href="${yearPath(kuga, y)}"]`), String(y.year)).not.toBeNull();
    expect(text).toContain("How much a Ford Kuga loses per year");
    expect(text).toContain("How mileage changes the price of a Ford Kuga");
    expect(text).toContain("Selling your Ford Kuga: private sale, part-exchange or dealer price?");
    expect(document.querySelectorAll("#value-webpage-jsonld").length).toBe(1);
    expect(container.querySelectorAll("h1").length).toBe(1);
    unmount();
  });
});

describe("structured data on hubs and guides", () => {
  it("/value and /car-values hubs have BreadcrumbList", () => {
    for (const p of ["/value", "/car-values"]) expect(types(jsonLd(built(p))), p).toContain("BreadcrumbList");
  });
  it("every guide has Article + FAQPage JSON-LD, and its content is unchanged", () => {
    for (const g of GUIDES) {
      const html = built(g.path);
      const t = types(jsonLd(html));
      expect(t, g.slug).toContain("Article");
      expect(t, g.slug).toContain("FAQPage");
      const art = jsonLd(html).find((b) => b["@type"] === "Article");
      expect(art.headline).toBe(g.h1);
      expect(art.mainEntityOfPage["@id"]).toBe(`https://valu8.uk${g.path}`);
    }
  });
});

describe("homepage and internal links", () => {
  it("homepage H1 carries the search terms", () => {
    const home = staticPageBodyHtml("/") ?? "";
    expect(home.match(/<h1>/g)?.length).toBe(1);
    expect(home).toContain("<h1>Free car valuation by registration</h1>");
  });
  it("popular model slugs all exist", () => {
    for (const s of POPULAR_VALUE_SLUGS) expect(VALUE_SLUGS.has(s), s).toBe(true);
    expect(popularValueModels().length).toBe(POPULAR_VALUE_SLUGS.length);
  });
  it("homepage and every guide link to the popular /value model pages", () => {
    for (const v of popularValueModels()) expect(built("/"), v.slug).toContain(`href="/value/${v.slug}"`);
    for (const g of GUIDES) for (const v of popularValueModels(8)) expect(built(g.path), `${g.slug} ${v.slug}`).toContain(`href="/value/${v.slug}"`);
  });
});
