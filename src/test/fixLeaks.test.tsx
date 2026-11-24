// Fix leaks (24 Nov 2026, Tony: "fix leaks"). Lovable hosting can't send server-side 301s, so every old /car-values
// URL (the hub and each model page) is a prerendered redirect stub: canonical + instant meta refresh + JS
// location.replace to its /value equivalent, with no noindex (a mixed signal next to a redirect/canonical).
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ALL_ROUTES } from "@/data/allRoutes";
import { getRouteMeta } from "@/data/routeMeta";
import { PAGE_LASTMOD } from "@/data/pageLastmod";
import { redirectHeadHtml } from "@/data/carValueContent";
import { buildRouteHtml } from "../../scripts/routePages";
import { buildSitemap } from "../../scripts/sitemap";

vi.mock("@/components/Layout", () => ({ Header: () => null, TestModeBanner: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));

const shell = readFileSync("index.html", "utf8");
const oldRoutes = ALL_ROUTES.filter((r) => r.path === "/car-values" || r.path.startsWith("/car-values/"));
const built = (p: string) => buildRouteHtml(shell, getRouteMeta(p));

describe("old /car-values URLs are redirect stubs", () => {
  it("covers the hub and every model URL", () => {
    expect(oldRoutes.some((r) => r.path === "/car-values")).toBe(true);
    expect(oldRoutes.length).toBeGreaterThan(20);
  });

  it("each one: canonical, refresh and JS redirect to the same /value target; no robots meta; no H1", () => {
    for (const r of oldRoutes) {
      const target = r.canonicalPath!;
      expect(target, r.path).toMatch(/^\/value(\/[a-z0-9-]+)?$/);
      const html = built(r.path);
      expect(html, r.path).toContain(`<link rel="canonical" href="https://valu8.uk${target}" />`);
      expect(html, r.path).toContain(redirectHeadHtml(target));
      expect(html.indexOf("location.replace("), r.path).toBeLessThan(html.indexOf("</head>"));
      expect(html, r.path).not.toContain('<meta name="robots"');
      expect(html, r.path).not.toMatch(/<h1\b/);
      expect(html, r.path).toContain(`<a href="${target}">This page has moved to `);
    }
    expect(getRouteMeta("/car-values").canonicalPath).toBe("/value");
    expect(getRouteMeta("/car-values/kia/ceed").canonicalPath).toBe("/value/kia-ceed");
  });

  it("the JS redirect keeps query strings (UTM tags) and hashes", () => {
    expect(redirectHeadHtml("/value/kia-ceed")).toContain('location.replace("/value/kia-ceed"+location.search+location.hash)');
  });

  it("the sitemap and pageLastmod list no /car-values URL", () => {
    expect(buildSitemap()).not.toContain("/car-values");
    expect(readFileSync("public/sitemap.xml", "utf8")).not.toContain("/car-values");
    expect(Object.keys(PAGE_LASTMOD).filter((k) => k.startsWith("/car-values"))).toEqual([]);
  });

  it("no page links to any /car-values URL (internal links go straight to /value)", () => {
    const linkRe = /href="(?:https:\/\/valu8\.uk)?\/car-values(?:[/"?#])/;
    for (const r of ALL_ROUTES) expect(buildRouteHtml(shell, r), r.path).not.toMatch(linkRe);
    for (const f of ["src/pages/CarValue.tsx", "src/pages/Landing.tsx", "src/components/Footer.tsx", "src/components/Layout.tsx", "src/data/carValueContent.ts", "src/data/staticPageContent.ts"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/(?:to|href)=["{`]+\/car-values["`/]/);
    }
  });

  it("React: /car-values navigates to /value", () => {
    function Where() { return <p data-testid="where">{useLocation().pathname}</p>; }
    // Mirrors the App.tsx route.
    expect(readFileSync("src/App.tsx", "utf8")).toContain('<Route path="/car-values" element={<Navigate to="/value" replace />} />');
    const { getByTestId } = render(
      <MemoryRouter initialEntries={["/car-values"]}>
        <Routes>
          <Route path="/car-values" element={<Navigate to="/value" replace />} />
          <Route path="/value" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(getByTestId("where").textContent).toBe("/value");
  });
});
