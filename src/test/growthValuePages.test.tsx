// Google growth plan (21 Nov 2026), /value model pages: hand-written depth for the page-2 models with the most
// "how much is my X worth" impressions (incl. the EV pages), rival comparison tables with internal links, guide
// links, and "How much is my X worth?" titles everywhere. Every figure must come from MODEL_PRICES.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ALL_ROUTES } from "@/data/allRoutes";
import { MODEL_PRICES } from "@/data/modelPriceBands";
import { VALUE_MODELS } from "@/data/valueModels";
import { GUIDES } from "@/data/guides";
import { ENRICHED_MODELS, findEnrichedModel, rivalsMarkdown } from "@/data/enrichedModels";
import { VALUE_PAGES_MODIFIED_ISO, valueGuidance, valuePageModifiedIso } from "@/data/valuePages";
import { buildRouteHtml } from "../../scripts/routePages";
import { buildSitemap } from "../../scripts/sitemap";

vi.mock("@/components/Layout", () => ({ Header: () => null, TestModeBanner: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
import ModelValue from "@/pages/ModelValue";

const shell = readFileSync("index.html", "utf8");
const built = (slug: string) => buildRouteHtml(shell, ALL_ROUTES.find((r) => r.path === `/value/${slug}`)!);
const by = (s: string) => MODEL_PRICES.find((m) => m.slug === s)!;
const NEW = ["toyota-yaris", "toyota-c-hr", "hyundai-kona", "kia-sportage", "seat-leon", "land-rover-discovery-sport", "audi-a1", "peugeot-208", "tesla-model-3", "tesla-model-y", "nissan-leaf"];
const EV = ["tesla-model-3", "tesla-model-y", "nissan-leaf"];
const words = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;

describe("enriched /value model pages", () => {
  it("covers the agreed page-2 models plus the Kuga", () => {
    expect(ENRICHED_MODELS.map((e) => e.slug).sort()).toEqual(["ford-kuga", ...NEW].sort());
  });

  it.each(NEW)("%s: generations, price factors, rivals and guides in the build HTML, dated 2026-11-21", (slug) => {
    const m = by(slug), html = built(slug);
    expect(html).toMatch(/<h2>[^<]+ generations and what they mean for the price<\/h2>/);
    expect(html).toMatch(/<h2>What moves the price of a used [^<]+<\/h2>/);
    expect(html).toMatch(/<h2>[^<]+ vs rivals: typical asking prices<\/h2>/);
    expect(html).toContain('href="/guides/part-exchange-vs-private-sale"');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(words(html)).toBeGreaterThan(1200);
    expect(valuePageModifiedIso(slug)).toBe("2026-11-21");
    expect(buildSitemap()).toContain(`<loc>https://valu8.uk/value/${slug}</loc><lastmod>2026-11-21</lastmod>`);
    // FAQPage JSON-LD = visible FAQ, including the new model FAQs.
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json" id="value-faq-jsonld">([\s\S]*?)<\/script>/)![1]);
    const qs = valueGuidance(m).faqs.map((f) => f.q);
    expect(ld.mainEntity.map((q: { name: string }) => q.name)).toEqual(qs);
    for (const q of findEnrichedModel(slug)!.faqs(m)) expect(html).toContain(`<h3>${q.q.replace(/'/g, "'")}</h3>`);
  });

  it("EV pages carry the battery, range and charging section; others don't", () => {
    for (const s of EV) expect(built(s)).toContain("<h2>Battery health, range and charging: what they do to the price</h2>");
    expect(built("toyota-yaris")).not.toContain("Battery health, range and charging");
  });

  it("rival tables link only to real /value pages and quote their band figures from the price data", () => {
    const valueSlugs = new Set(VALUE_MODELS.map((v) => v.slug));
    for (const e of ENRICHED_MODELS) {
      const m = by(e.slug), md = e.markdown(m);
      const links = [...md.matchAll(/\]\((\/[^)\s]+)\)/g)].map((x) => x[1]);
      for (const href of links) {
        if (href.startsWith("/value/")) expect(valueSlugs.has(href.slice(7)), `${e.slug} -> ${href}`).toBe(true);
        else expect(GUIDES.some((g) => g.path === href), `${e.slug} -> ${href}`).toBe(true);
      }
      const rows = [...md.matchAll(/^\| \[([^\]]+)\]\(\/value\/([a-z0-9-]+)\) \| (£[\d,]+) \|/gm)];
      expect(rows.length, e.slug).toBeGreaterThanOrEqual(3);
      const band = md.match(/Cars registered (.+?), from the same UK adverts/)![1].replace(" or ", " and ");
      for (const [, , slug, price] of rows) {
        const b = by(slug).bands.find((x) => x.band === band)!;
        expect(price, `${e.slug} rival ${slug}`).toBe("£" + b.median.toLocaleString("en-GB"));
      }
    }
  });

  it("generation tables only quote yearly medians that exist in the price data", () => {
    for (const e of ENRICHED_MODELS) {
      const m = by(e.slug), md = e.markdown(m);
      const meds = new Set(m.years.map((y) => "£" + y.median.toLocaleString("en-GB")));
      for (const row of md.matchAll(/^\| [^|]+ \| [^|]+ \| [\d,]+ \| (£[\d,]+)(?: to (£[\d,]+))? \|$/gm)) {
        expect(meds.has(row[1]), `${e.slug} ${row[1]}`).toBe(true);
        if (row[2]) expect(meds.has(row[2]), `${e.slug} ${row[2]}`).toBe(true);
      }
    }
  });

  it("rivalsMarkdown skips models without data and needs at least three rows", () => {
    expect(rivalsMarkdown(by("toyota-yaris"), ["no-such-model"])).toBe("");
  });

  it("renders the same sections in the app (React), including the rival links", () => {
    const { container } = render(<MemoryRouter initialEntries={["/value/nissan-leaf"]}><Routes><Route path="/value/:slug" element={<ModelValue />} /></Routes></MemoryRouter>);
    expect(container.textContent).toContain("Nissan Leaf generations and what they mean for the price");
    expect(container.textContent).toContain("Battery health, range and charging");
    expect(container.querySelector('a[href="/value/hyundai-ioniq"]')).not.toBeNull();
  });

  it("other model pages keep the shared date and copy", () => {
    expect(valuePageModifiedIso("ford-fiesta")).toBe(VALUE_PAGES_MODIFIED_ISO);
    expect(built("ford-fiesta")).not.toContain("vs rivals: typical asking prices");
  });

  it("new copy uses no em dashes and never says 'partner'", () => {
    for (const e of ENRICHED_MODELS) {
      const m = by(e.slug);
      const text = [e.title ?? "", e.description?.(m) ?? "", e.markdown(m), ...e.faqs(m).flatMap((f) => [f.q, f.a])].join("\n");
      expect(text, e.slug).not.toContain("—");
      expect(text.toLowerCase(), e.slug).not.toContain("partner");
    }
  });
});
