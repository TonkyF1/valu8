import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { CAR_MODELS } from "@/data/carModels";
import { carPath, carValueMatch } from "@/data/carValueContent";
import { getRouteMeta } from "@/data/routeMeta";
import { ALL_ROUTES } from "@/data/allRoutes";
import { MODEL_PRICES } from "@/data/modelPriceBands";
import { valueBodyHtml, valueGuidance, valueName, valuePath } from "@/data/valuePages";
import { buildRouteHtml } from "../../scripts/routePages";
import { buildSitemap } from "../../scripts/sitemap";

vi.mock("@/components/Layout", () => ({ Header: () => null, TestModeBanner: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
import ModelValue from "@/pages/ModelValue";
import CarValue from "@/pages/CarValue";

const shell = readFileSync("index.html", "utf8");
const matched = CAR_MODELS.filter((m) => carValueMatch(m));
const matchedPaths = new Set(matched.map(carPath));
const jsonLd = (html: string) => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((x) => JSON.parse(x[1]));
const types = (blocks: any[]) => blocks.flatMap((b) => (Array.isArray(b) ? b : b["@graph"] ?? [b])).map((b: any) => b["@type"]);

describe("/car-values model pages redirect to /value", () => {
  it("every /car-values model has a /value match today", () => {
    expect(matched.length).toBe(CAR_MODELS.length);
  });
  it("built HTML: refresh + canonical to /value, noindex follow, one moved-link paragraph, no FAQ/JSON-LD", () => {
    for (const m of matched) {
      const slug = carValueMatch(m)!.slug;
      const html = buildRouteHtml(shell, getRouteMeta(carPath(m)));
      expect(html, slug).toContain(`<meta http-equiv="refresh" content="0; url=https://valu8.uk/value/${slug}">`);
      expect(html).toContain(`<link rel="canonical" href="https://valu8.uk/value/${slug}" />`);
      expect(html).toContain('<meta name="robots" content="noindex, follow" />');
      expect(html).toMatch(/<title>[^<]+ prices and valuation \| Valu8<\/title>/);
      const root = html.match(/<div id="root">([\s\S]*?)<\/div>/)![1];
      expect(root).toMatch(new RegExp(`^<p><a href="/value/${slug}">This page has moved to [^<]+ prices and valuation</a></p>$`));
      expect(types(jsonLd(html))).not.toContain("FAQPage");
      expect(types(jsonLd(html))).not.toContain("BreadcrumbList");
    }
    expect(buildRouteHtml(shell, getRouteMeta("/car-values/ford/fiesta"))).toContain("<title>Ford Fiesta prices and valuation | Valu8</title>");
  });
  it("matched pages stay out of the sitemap; the /car-values hub stays in", () => {
    const xml = buildSitemap();
    for (const p of matchedPaths) expect(xml).not.toContain(`<loc>https://valu8.uk${p}</loc>`);
    expect(xml).toContain("<loc>https://valu8.uk/car-values</loc>");
    expect(getRouteMeta("/car-values").noindex).toBeFalsy();
  });
  it("React: a matched /car-values route navigates to /value", () => {
    function Where() { return <p data-testid="where">{useLocation().pathname}</p>; }
    const { getByTestId } = render(
      <MemoryRouter initialEntries={["/car-values/ford/fiesta"]}>
        <Routes>
          <Route path="/car-values/:make/:model" element={<CarValue />} />
          <Route path="/value/:slug" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(getByTestId("where").textContent).toBe("/value/ford-fiesta");
  });
});

describe("/value model pages", () => {
  it("built HTML: one H1, breadcrumb, BreadcrumbList + FAQPage JSON-LD that match the visible FAQ", () => {
    for (const m of MODEL_PRICES) {
      const html = buildRouteHtml(shell, { ...ALL_ROUTES.find((r) => r.path === valuePath(m))! });
      expect(html.match(/<h1\b/g)?.length, m.slug).toBe(1);
      const blocks = jsonLd(html);
      const crumbs = blocks.find((b) => b["@type"] === "BreadcrumbList");
      const faq = blocks.find((b) => b["@type"] === "FAQPage");
      expect(crumbs, m.slug).toBeDefined();
      expect(faq, m.slug).toBeDefined();
      expect(crumbs.itemListElement.map((i: any) => i.item)).toEqual(["https://valu8.uk/", "https://valu8.uk/value", `https://valu8.uk/value/${m.slug}`]);
      const g = valueGuidance(m);
      expect(faq.mainEntity.map((q: any) => [q.name, q.acceptedAnswer.text])).toEqual(g.faqs.map((f) => [f.q, f.a]));
      expect(html).toContain('<nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/value">Car values</a>');
      for (const v of g.related) expect(html).toContain(`href="/value/${v.slug}"`);
      expect(g.related.every((v) => v.slug !== m.slug)).toBe(true);
    }
  });
  it("segment block only when the model has a known segment", () => {
    const fiesta = MODEL_PRICES.find((m) => m.slug === "ford-fiesta")!;
    const fiat = MODEL_PRICES.find((m) => m.slug === "fiat-500")!;
    expect(valueBodyHtml(fiesta)).toContain("What moves the value of a supermini");
    expect(valueBodyHtml(fiat)).not.toContain("What moves the value of a");
    expect(valueBodyHtml(fiat)).toContain("Fiat 500 valuation FAQ");
    expect(valueGuidance(fiat).related.length).toBeGreaterThan(0);
  });
  it("React page shows the same guidance text as the build HTML, with one copy of each JSON-LD", () => {
    for (const slug of ["ford-fiesta", "fiat-500"]) {
      const m = MODEL_PRICES.find((x) => x.slug === slug)!;
      document.head.innerHTML = "";
      const { container, unmount } = render(
        <MemoryRouter initialEntries={[`/value/${slug}`]}><Routes><Route path="/value/:slug" element={<ModelValue />} /></Routes></MemoryRouter>,
      );
      const built = document.createElement("div");
      built.innerHTML = valueBodyHtml(m);
      const pick = (root: Element) => [...root.querySelectorAll("h1, h2, h3, ol li, nav[aria-label=Breadcrumb]")].map((e) => e.textContent!.replace(/\s+/g, " ").trim());
      const fromBuilt = pick(built).filter((t) => /How we value|What moves|valuation FAQ|Related valuations|\?$|^Home/.test(t) || valueGuidance(m).steps.includes(t));
      const fromReact = pick(container);
      expect(fromBuilt.length).toBeGreaterThan(8);
      for (const t of fromBuilt) expect(fromReact, `${slug}: ${t}`).toContain(t);
      expect(container.querySelectorAll("h1").length).toBe(1);
      expect(document.querySelectorAll("#value-faq-jsonld").length).toBe(1);
      expect(document.querySelectorAll("#value-breadcrumb-jsonld").length).toBe(1);
      expect(valueName(m)).toBeTruthy();
      unmount();
    }
  });
});

describe("no links to matched /car-values model pages", () => {
  it("no built HTML for any route links to one", () => {
    const linkRe = /href="(?:https:\/\/valu8\.uk)?(\/car-values\/[^"/?#]+\/[^"/?#]+)"/g;
    for (const meta of ALL_ROUTES) {
      const html = buildRouteHtml(shell, meta);
      for (const [, p] of html.matchAll(linkRe)) expect(matchedPaths.has(p), `${meta.path} links to ${p}`).toBe(false);
      for (const p of matchedPaths) expect(html.includes(`content="https://valu8.uk${p}"`), `${meta.path} og:url`).toBe(false);
    }
  });
  it("app source links go through carHref, not hand-built /car-values model URLs", () => {
    for (const f of ["src/pages/Landing.tsx", "src/pages/CarValuesIndex.tsx", "src/pages/CarValue.tsx", "src/components/ShareResult.tsx", "src/components/Footer.tsx"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/\/car-values\/\$\{|\/car-values\/[a-z0-9-]+\/[a-z0-9-]+/);
    }
  });
});
