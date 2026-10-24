import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { CAR_MODELS, findModel } from "@/data/carModels";
import { buildSitemap } from "../../scripts/sitemap";
import { routeHtml } from "../../scripts/routeHtml";
import { ALL_ROUTES, getRouteMeta } from "@/data/routeMeta";
import { explainValuation } from "@/lib/valuationExplainer";
import type { ValuationReport } from "@/lib/valuation";

describe("car model pages", () => {
  it("has ~30 unique slugs", () => {
    const keys = CAR_MODELS.map((m) => `${m.makeSlug}/${m.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThanOrEqual(30);
    expect(findModel("toyota", "c-hr")?.model).toBe("C-HR");
  });
  it("sitemap is in sync (run npx tsx scripts/sitemap.ts)", () => {
    expect(readFileSync("public/sitemap.xml", "utf8")).toBe(buildSitemap());
  });
});

describe("route metadata HTML", () => {
  const shell = readFileSync("index.html", "utf8");
  it("gives each route a unique title and description", () => {
    expect(new Set(ALL_ROUTES.map((r) => r.title)).size).toBe(ALL_ROUTES.length);
    expect(new Set(ALL_ROUTES.map((r) => r.description)).size).toBe(ALL_ROUTES.length);
  });
  it("uses contact's own canonical and includes accuracy in the sitemap", () => {
    expect(routeHtml(shell, getRouteMeta("/contact"))).toContain('<link rel="canonical" href="https://valu8.uk/contact" />');
    expect(buildSitemap()).toContain("<loc>https://valu8.uk/accuracy</loc><priority>0.6</priority>");
  });
  it("marks private shells noindex and omits 404 canonical", () => {
    expect(routeHtml(shell, getRouteMeta("/dashboard"))).toContain('<meta name="robots" content="noindex, follow" />');
    const html = routeHtml(shell, { path: "/404", title: "Page not found — Valu8", description: "This page doesn't exist. Value your car free with Valu8." }, true);
    expect(html).not.toMatch(/rel="canonical"|property="og:url"/);
  });
  it("fails when a required head tag is missing", () => {
    expect(() => routeHtml(shell.replace(/<link rel="canonical"[^>]*>/, ""), getRouteMeta("/check"))).toThrow(/canonical/);
  });
});

describe("explainValuation", () => {
  const base = { values: { privateSale: 7100, dealerTradeIn: 6000, dealerRetail: 7700 }, pricingSource: "marketcheck",
    marketBaseline: { source: "MarketCheck UK", sampleSize: 44, baseDealerRetail: 7700, basePrivateSale: 7100, baseTradeIn: 6000, netAdjustmentPct: -6 },
    priceAdjustments: [{ label: "Above comparable mileage", impactPct: -5 }],
    comparableListings: [{ price: 10000, mileage: 30000, year: 2018 }] } as unknown as ValuationReport;
  it("corrects a lower-mileage comp downwards and explains why", () => {
    const ex = explainValuation(base, { year: 2018, mileage: 60000 })!;
    expect(ex.comps[0].adjustedPrice).toBeLessThan(10000);
    expect(ex.comps[0].why).toContain("30,000 fewer miles");
    expect(ex.adjustments[0].plain).toContain("takes off about 5%");
    expect(ex.steps.map((s) => s.title)[0]).toMatch(/comparable/);
  });
  it("returns null when unavailable", () => {
    expect(explainValuation({ ...base, valuationUnavailable: true } as ValuationReport, { year: 2018, mileage: 1 })).toBeNull();
  });
});
