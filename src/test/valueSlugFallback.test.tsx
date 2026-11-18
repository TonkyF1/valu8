// A published slug whose price data has gone: proven with a fake registry entry that isn't in MODEL_PRICES.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const FAKE = vi.hoisted(() => ({ slug: "testmake-testcar", make: "Testmake", model: "Testcar" }));
vi.mock("@/data/valueSlugRegistry", async (orig) => {
  const o = await orig<typeof import("@/data/valueSlugRegistry")>();
  return { ...o, VALUE_SLUG_REGISTRY: [...o.VALUE_SLUG_REGISTRY, FAKE] };
});
vi.mock("@/components/Layout", () => ({ Header: () => null, TestModeBanner: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

import { MODEL_PRICES } from "@/data/modelPriceBands";
import { ALL_ROUTES } from "@/data/allRoutes";
import { getValueRouteMeta } from "@/data/valueRoutes";
import { registryOnlyModels } from "@/data/valuePages";
import { buildRouteHtml, homepageHtml } from "../../scripts/routePages";
import { buildSitemap } from "../../scripts/sitemap";
import ModelValue from "@/pages/ModelValue";

const COPY = "We don't have enough recent UK adverts for the Testmake Testcar to show typical asking prices right now. You can still get a free valuation for your own Testmake Testcar.";
const shell = readFileSync("index.html", "utf8");

describe("registry-only /value page", () => {
  it("is a served, indexable route that stays out of the sitemap", () => {
    expect(MODEL_PRICES.some((m) => m.slug === FAKE.slug)).toBe(false);
    expect(registryOnlyModels().map((r) => r.slug)).toEqual([FAKE.slug]);
    const meta = getValueRouteMeta("/value/testmake-testcar");
    expect(meta).toMatchObject({ title: "How much is my Testmake Testcar worth? UK prices | Valu8", inSitemap: false });
    expect(meta.noindex).toBeFalsy();
    expect(buildSitemap()).toBe(readFileSync("public/sitemap.xml", "utf8"));
    expect(new Set(ALL_ROUTES.map((r) => r.title)).size).toBe(ALL_ROUTES.length);
    expect(new Set(ALL_ROUTES.map((r) => r.description)).size).toBe(ALL_ROUTES.length);
  });
  it("prerenders one H1, the no-data paragraph, CTA, breadcrumb, guidance and JSON-LD, with no table and no noindex", () => {
    const html = buildRouteHtml(shell, getValueRouteMeta("/value/testmake-testcar"));
    expect(html.match(/<h1\b/g)?.length).toBe(1);
    expect(html).toContain("<h1>How much is my Testmake Testcar worth?</h1>");
    expect(html).toContain('content="See what a used Testmake Testcar is worth in the UK and get a free valuation by registration from Valu8."');
    expect(html).not.toContain("In November 2026, a ");
    expect(html).toContain(COPY);
    expect(html).not.toMatch(/<meta name="robots"/);
    expect(html).not.toContain("<table");
    expect(html).toContain('<link rel="canonical" href="https://valu8.uk/value/testmake-testcar" />');
    for (const t of ['<nav aria-label="Breadcrumb">', "Value my Testmake Testcar free", "How we value a Testmake Testcar", "Testmake Testcar valuation FAQ", "Related valuations", 'id="value-faq-jsonld"', 'id="value-breadcrumb-jsonld"']) expect(html, t).toContain(t);
    expect(html).not.toContain("What moves the value of a");
  });
  it("the unknown-route script knows the slug", () => {
    expect(homepageHtml(shell)).toContain('"testmake-testcar"');
  });
  it("React renders the page, not NotFound, and leaves it indexable", () => {
    document.head.innerHTML = "";
    render(<MemoryRouter initialEntries={["/value/testmake-testcar"]}><Routes><Route path="/value/:slug" element={<ModelValue />} /></Routes></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("How much is my Testmake Testcar worth?");
    expect(screen.getByText(COPY)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Value my Testmake Testcar free/ })).toBeInTheDocument();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
    expect(document.querySelectorAll("#value-faq-jsonld").length).toBe(1);
    expect(document.querySelector("table")).toBeNull();
  });
});
