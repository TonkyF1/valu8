import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MODEL_PRICES, PRICE_DATA_UPDATED } from "@/data/modelPriceBands";
import { VALUE_SLUG_REGISTRY } from "@/data/valueSlugRegistry";
import { DISPLAY_NAME_OVERRIDES, modelDisplayName } from "@/data/modelDisplayName";
import { bandPhrase, valueAnswer, valueBodyHtml, valueFallbackMeta, valueMeta, valueTitle, yearMeta } from "@/data/valuePages";
import { getAnyRouteMeta, ALL_ROUTES } from "@/data/allRoutes";
import { getRouteMeta } from "@/data/routeMeta";
import { buildRouteHtml } from "../../scripts/routePages";
import { buildSitemap } from "../../scripts/sitemap";

vi.mock("@/components/Layout", () => ({ Header: () => null, TestModeBanner: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
import ModelValue from "@/pages/ModelValue";

const shell = readFileSync("index.html", "utf8");
const by = (s: string) => MODEL_PRICES.find((m) => m.slug === s)!;
const built = (path: string) => buildRouteHtml(shell, getAnyRouteMeta(path));
const tag = (html: string, re: RegExp) => html.match(re)?.[1];

describe("model display names", () => {
  it("applies only the agreed overrides", () => {
    expect(modelDisplayName("mercedes-benz-c-class")).toBe("Mercedes-Benz C-Class");
    expect(modelDisplayName("mercedes-benz-a-class")).toBe("Mercedes-Benz A-Class");
    expect(modelDisplayName("mercedes-benz-e-class")).toBe("Mercedes-Benz E-Class");
    expect(modelDisplayName("mercedes-benz-b-class")).toBe("Mercedes-Benz B-Class");
    expect(modelDisplayName(by("ds-ds-3"))).toBe("DS 3");
    expect(modelDisplayName(by("ds-ds-4"))).toBe("DS 4");
    expect(modelDisplayName("citroen-ds3")).toBe("Citroen DS3");
    expect(modelDisplayName("ford-kuga")).toBe("Ford Kuga");
    expect(Object.keys(DISPLAY_NAME_OVERRIDES).sort()).toEqual(["ds-ds-3", "ds-ds-4", "mercedes-benz-a-class", "mercedes-benz-b-class", "mercedes-benz-c-class", "mercedes-benz-e-class"]);
    for (const s of Object.keys(DISPLAY_NAME_OVERRIDES)) expect(VALUE_SLUG_REGISTRY.some((r) => r.slug === s), s).toBe(true);
  });
  it("is used on the model page, its breadcrumb JSON-LD, the hub and the /car-values redirect", () => {
    const html = built("/value/mercedes-benz-c-class");
    expect(html).toContain("<h1>How much is my Mercedes-Benz C-Class worth?</h1>");
    expect(html).toContain('"name":"Mercedes-Benz C-Class"');
    expect(html).not.toMatch(/C Class/);
    expect(built("/value")).toContain("Mercedes-Benz C-Class");
    expect(built("/value")).not.toContain("C Class");
    const redirect = buildRouteHtml(shell, getRouteMeta("/car-values/mercedes-benz/c-class"));
    expect(redirect).toContain("<title>Mercedes-Benz C-Class prices and valuation | Valu8</title>");
    expect(redirect).toContain('<meta http-equiv="refresh" content="0; url=https://valu8.uk/value/mercedes-benz-c-class">');
    expect(redirect).toContain('<meta name="robots" content="noindex, follow" />');
    expect(built("/value/mercedes-benz-a-class")).toContain('href="/value/mercedes-benz-c-class">Mercedes-Benz C-Class</a>');
  });
});

describe("/value model page titles, descriptions, H1 and answer line", () => {
  it("every model title <= 60 chars, description <= 155, exactly one H1 starting 'How much is my'", () => {
    for (const m of [...MODEL_PRICES, ...VALUE_SLUG_REGISTRY]) {
      const meta = getAnyRouteMeta(`/value/${m.slug}`);
      expect(meta.title.length, m.slug).toBeLessThanOrEqual(60);
      expect(meta.description.length, m.slug).toBeLessThanOrEqual(155);
      const html = built(meta.path);
      expect(html.match(/<h1\b/g)?.length, m.slug).toBe(1);
      expect(tag(html, /<h1>([^<]*)<\/h1>/), m.slug).toBe(`How much is my ${modelDisplayName(m)} worth?`);
      expect(tag(html, /<title>([^<]*)<\/title>/)).toBe(meta.title);
      for (const k of ["og:title", "twitter:title"]) expect(html).toContain(`"${k}" content="${meta.title}"`);
      for (const k of ["description", "og:description", "twitter:description"]) expect(html).toContain(`"${k}" content="${meta.description.replace(/&/g, "&amp;")}"`);
    }
  });
  it("uses the agreed title tiers", () => {
    expect(valueTitle(by("toyota-yaris"))).toBe("How much is my Toyota Yaris worth? UK prices by year | Valu8");
    expect(valueTitle(by("toyota-yaris")).length).toBe(60);
    expect(valueTitle(by("mercedes-benz-c-class"))).toBe("How much is my Mercedes-Benz C-Class worth? | Valu8");
    // Every model page title asks the searched question (Google growth plan, 21 Nov 2026).
    for (const m of [...MODEL_PRICES, ...VALUE_SLUG_REGISTRY]) expect(getAnyRouteMeta(`/value/${m.slug}`).title.startsWith("How much is my "), m.slug).toBe(true);
    expect(valueTitle(by("land-rover-range-rover-evoque"))).toBe("How much is my Range Rover Evoque worth? UK prices | Valu8");
    expect(valueTitle(by("ford-kuga"))).toBe("How much is my Ford Kuga worth? UK prices by year | Valu8");
    // Hand-written titles (enrichedModels.ts): Kuga keeps "valuation" (its clicked query), Discovery Sport the full name.
    expect(valueMeta(by("ford-kuga")).title).toBe("How much is my Ford Kuga worth? Free valuation | Valu8");
    expect(valueMeta(by("land-rover-discovery-sport")).title).toBe("How much is my Land Rover Discovery Sport worth? | Valu8");
  });
  it("description uses the lowest/highest band medians and drops the bracket only when too long", () => {
    const yaris = by("toyota-yaris");
    const meds = yaris.bands.map((b) => b.median);
    expect(valueMeta(yaris).description).toBe(`How much is your Toyota Yaris worth? UK asking prices £${Math.min(...meds).toLocaleString("en-GB")}–£${Math.max(...meds).toLocaleString("en-GB")} by year (${PRICE_DATA_UPDATED}). Get a free instant valuation by reg.`);
    expect(valueMeta(by("land-rover-range-rover-evoque")).description).toContain(`(${PRICE_DATA_UPDATED})`);
    for (const m of MODEL_PRICES) expect(valueMeta(m).description.length, m.slug).toBeLessThanOrEqual(155);
    expect(valueFallbackMeta({ slug: "x-y", make: "X", model: "Y" }).description).toBe("See what a used X Y is worth in the UK and get a free valuation by registration from Valu8.");
  });
  it("answer line comes from the newest band, directly under the H1, in build HTML and React", () => {
    const kuga = by("ford-kuga");
    expect(valueAnswer(kuga)!.startsWith("In November 2026, a 2021-or-newer Ford Kuga is typically advertised for")).toBe(true);
    expect(bandPhrase("2018–2020")).toBe("2018–2020");
    expect(bandPhrase("2021 and newer")).toBe("2021-or-newer");
    expect(valueBodyHtml(kuga)).toContain(`<h1>How much is my Ford Kuga worth?</h1><p>${valueAnswer(kuga)}</p>`);
    expect(valueBodyHtml(kuga)).toContain("not a valuation");
    const { container, unmount } = render(<MemoryRouter initialEntries={["/value/ford-kuga"]}><Routes><Route path="/value/:slug" element={<ModelValue />} /></Routes></MemoryRouter>);
    const h1 = container.querySelector("h1")!;
    expect(h1.textContent).toBe("How much is my Ford Kuga worth?");
    expect(h1.nextElementSibling?.textContent).toBe(valueAnswer(kuga));
    unmount();
  });
});

describe("year pages and sitemap", () => {
  it("templated year titles use the display name and the agreed format; still noindex", () => {
    const kuga = by("ford-kuga");
    const y = kuga.years[0];
    expect(yearMeta(kuga, y).title).toBe(`How much is my ${y.year} Ford Kuga worth? | Valu8`);
    expect(yearMeta(kuga, y).noindex).toBe(true);
    for (const m of MODEL_PRICES) for (const yy of m.years) {
      const t = yearMeta(m, yy);
      if (!t.noindex) continue;
      expect(t.title.length <= 60 || t.title === `${yy.year} ${modelDisplayName(m)} value | Valu8`, t.path).toBe(true);
      expect(t.title).toContain(modelDisplayName(m));
    }
  });
  it("titles/descriptions stay unique and the sitemap is unchanged", () => {
    expect(new Set(ALL_ROUTES.map((r) => r.title)).size).toBe(ALL_ROUTES.length);
    expect(new Set(ALL_ROUTES.map((r) => r.description)).size).toBe(ALL_ROUTES.length);
    expect(buildSitemap()).toBe(readFileSync("public/sitemap.xml", "utf8"));
  });
});
