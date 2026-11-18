// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { VALUE_SLUG_REGISTRY } from "@/data/valueSlugRegistry";
import { VALUE_MODELS } from "@/data/valueModels";
import { ALL_ROUTES } from "@/data/allRoutes";
import { buildRouteHtml, homepageHtml, notFoundHtml, ROUTE_DATA_PLACEHOLDER, routeData } from "../../scripts/routePages";
import { buildSitemap } from "../../scripts/sitemap";

vi.mock("@/components/Layout", () => ({ Header: () => null, TestModeBanner: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
import ModelValue, { ModelYearValue } from "@/pages/ModelValue";
import CarValue from "@/pages/CarValue";

const shell = readFileSync("index.html", "utf8");
const scriptOf = (html: string) => html.match(/<script>\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/)![1];

function run(script: string, path: string) {
  document.head.innerHTML = `<title>Home</title><link rel="canonical" href="https://valu8.uk/" /><meta property="og:url" content="https://valu8.uk/" />`;
  window.history.replaceState(null, "", path);
  new Function(script)();
  return {
    title: document.title,
    canonical: document.querySelector("link[rel=canonical]")?.getAttribute("href") ?? null,
    ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute("content") ?? null,
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
  };
}
const notFound = { title: "Page not found — Valu8", canonical: null, ogUrl: null, robots: "noindex" };

describe("value slug registry (add-only)", () => {
  it("holds every published /value slug, once each (234 today)", () => {
    const slugs = VALUE_SLUG_REGISTRY.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.length).toBeGreaterThanOrEqual(234);
    for (const v of VALUE_MODELS) expect(slugs, `add ${v.slug} to valueSlugRegistry.ts`).toContain(v.slug);
  });
  it("every registry slug prerenders a /value page with one H1 and no robots noindex", () => {
    for (const r of VALUE_SLUG_REGISTRY) {
      const meta = ALL_ROUTES.find((x) => x.path === `/value/${r.slug}`);
      expect(meta, r.slug).toBeDefined();
      const html = buildRouteHtml(shell, meta!);
      expect(html.match(/<h1\b/g)?.length, r.slug).toBe(1);
      expect(html, r.slug).not.toMatch(/<meta name="robots"[^>]*noindex/);
      expect(html).toContain(`<link rel="canonical" href="https://valu8.uk/value/${r.slug}" />`);
    }
  });
  it("sitemap is still byte-identical to the committed one", () => {
    expect(buildSitemap()).toBe(readFileSync("public/sitemap.xml", "utf8"));
  });
});

describe("unknown-route script with build-time model data", () => {
  const built = scriptOf(homepageHtml(shell));
  it("is filled in the homepage and 404 shells, and the build fails without the placeholder", () => {
    expect(built).not.toContain(ROUTE_DATA_PLACEHOLDER);
    expect(scriptOf(notFoundHtml(shell))).not.toContain(ROUTE_DATA_PLACEHOLDER);
    expect(() => homepageHtml(shell.replace(ROUTE_DATA_PLACEHOLDER, "null"))).toThrow(/VALU8_ROUTE_DATA/);
    expect(routeData().y["kia-sportage"]).toMatch(/\d{4}/);
  });
  it("treats invalid model, year and /car-values paths as not found", () => {
    for (const p of ["/value/not-a-car", "/value/ford-kuga/1899", "/car-values/foo/bar", "/value/ford-kuga/abc", "/value/constructor/2016", "/value/Ford-Kuga"]) {
      expect(run(built, p), p).toEqual(notFound);
    }
  });
  it("keeps valid model, year and /car-values paths known", () => {
    for (const p of ["/value/ford-kuga", "/value/kia-sportage/2016", "/car-values/ford/kuga", "/value", "/car-values", "/value/ford-kuga/"]) {
      expect(run(built, p).robots, p).toBeNull();
    }
  });
  it("dev fallback (no data injected) still treats any model path as known", () => {
    const dev = scriptOf(shell);
    for (const p of ["/value/not-a-car", "/value/ford-kuga/1899", "/car-values/foo/bar"]) expect(run(dev, p).robots, p).toBeNull();
    expect(run(dev, "/zzz-bogus")).toEqual(notFound);
  });
});

describe("React not-found pages set robots noindex", () => {
  const routes = (
    <Routes>
      <Route path="/value/:slug" element={<ModelValue />} />
      <Route path="/value/:slug/:year" element={<ModelYearValue />} />
      <Route path="/car-values/:make/:model" element={<CarValue />} />
    </Routes>
  );
  for (const p of ["/value/not-a-car", "/value/ford-kuga/1899", "/car-values/foo/bar"]) {
    it(p, () => {
      document.head.innerHTML = "";
      const { unmount } = render(<MemoryRouter initialEntries={[p]}>{routes}</MemoryRouter>);
      expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex");
      expect(document.querySelector("link[rel=canonical]")).toBeNull();
      unmount();
    });
  }
  it("/value/ford-kuga is not noindex", () => {
    document.head.innerHTML = "";
    const { unmount } = render(<MemoryRouter initialEntries={["/value/ford-kuga"]}>{routes}</MemoryRouter>);
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
    unmount();
  });
});
