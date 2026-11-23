// Ford Kuga /value page improvement (SEO finding, Nov 2026): own title/description for "ford kuga valuation",
// hand-written generation + price-factor copy built only from the price data, extra FAQs in both the visible
// FAQ and the FAQPage JSON-LD, and its own lastmod. Other models are unchanged.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ALL_ROUTES } from "@/data/allRoutes";
import { MODEL_PRICES } from "@/data/modelPriceBands";
import { VALUE_PAGES_MODIFIED_ISO, valueMeta, valuePageModifiedIso } from "@/data/valuePages";
import { findEnrichedModel } from "@/data/enrichedModels";
import { buildRouteHtml } from "../../scripts/routePages";
import { buildSitemap } from "../../scripts/sitemap";

vi.mock("@/components/Layout", () => ({ Header: () => null, TestModeBanner: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
import ModelValue from "@/pages/ModelValue";

const shell = readFileSync("index.html", "utf8");
const kuga = MODEL_PRICES.find((m) => m.slug === "ford-kuga")!;
const html = buildRouteHtml(shell, ALL_ROUTES.find((r) => r.path === "/value/ford-kuga")!);
const faqLd = () => {
  const block = [...html.matchAll(/<script type="application\/ld\+json" id="value-faq-jsonld">([\s\S]*?)<\/script>/g)][0][1];
  return JSON.parse(block).mainEntity.map((q: any) => q.name as string);
};

describe("Ford Kuga value page", () => {
  it("targets 'how much is my Ford Kuga worth' and 'Ford Kuga valuation' in a title within 60 characters and a description within 155", () => {
    const meta = valueMeta(kuga);
    expect(meta.title).toBe("How much is my Ford Kuga worth? Free valuation | Valu8");
    expect(meta.title.length).toBeLessThanOrEqual(60);
    expect(meta.description.startsWith("How much is your Ford Kuga worth? Free instant Ford Kuga valuation by reg")).toBe(true);
    expect(meta.description.length).toBeLessThanOrEqual(155);
    expect(html).toContain(`<meta property="og:title" content="${meta.title}" />`);
  });

  it("shows the generations section and quotes the 2019 and 2020 medians from the price data", () => {
    const y19 = kuga.years.find((y) => y.year === 2019)!, y20 = kuga.years.find((y) => y.year === 2020)!;
    expect(html).toContain("<h2>Ford Kuga generations and what they mean for the price</h2>");
    expect(html).toContain(`£${y19.median.toLocaleString("en-GB")} for a 2019 Kuga to £${y20.median.toLocaleString("en-GB")} for a 2020 one`);
  });

  it("adds the Kuga FAQs to the visible FAQ and the FAQPage JSON-LD", () => {
    expect(faqLd()).toEqual(expect.arrayContaining(["Which Ford Kuga generation do I have?", "What is a high-mileage Ford Kuga worth?"]));
    expect(html).toContain("<h3>Which Ford Kuga generation do I have?</h3>");
  });

  it("renders the same Kuga section in the app", () => {
    const { container } = render(<MemoryRouter initialEntries={["/value/ford-kuga"]}><Routes><Route path="/value/:slug" element={<ModelValue />} /></Routes></MemoryRouter>);
    expect(container.textContent).toContain("Ford Kuga generations and what they mean for the price");
    expect(container.textContent).toContain("Which Ford Kuga generation do I have?");
  });

  it("dates the Kuga page from the latest shared copy change (2026-11-23)", () => {
    expect(valuePageModifiedIso("ford-kuga")).toBe("2026-11-23");
    expect(buildSitemap()).toContain("<loc>https://valu8.uk/value/ford-kuga</loc><lastmod>2026-11-23</lastmod>");
    expect(valuePageModifiedIso("ford-fiesta")).toBe("2026-11-23");
    expect(VALUE_PAGES_MODIFIED_ISO).toBe("2026-11-18");
  });

  it("new copy uses no em dashes", () => {
    const e = findEnrichedModel("ford-kuga")!;
    const text = [e.title, e.description!(kuga), e.markdown(kuga), ...e.faqs(kuga).flatMap((f) => [f.q, f.a])].join("\n");
    expect(text).not.toContain("—");
  });
});
