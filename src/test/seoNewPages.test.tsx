// /how-it-works, /faq and /example-report (added with the shorter homepage, 20 Nov 2026): route metadata,
// prebuilt HTML, sitemap dates, and FAQPage JSON-LD that matches the FAQs a visitor can actually see.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildRouteHtml } from "../../scripts/routePages";
import { buildSitemap } from "../../scripts/sitemap";
import { ALL_ROUTES } from "@/data/allRoutes";
import { getRouteMeta } from "@/data/routeMeta";
import { PAGE_LASTMOD } from "@/data/pageLastmod";
import { HOME_FAQS, HOME_FAQ_COUNT, SITE_FAQS } from "@/data/siteFaqs";
import { FAQS } from "@/components/home/BuyerSellerSections";
import { popularValueModels } from "@/data/popularModels";
import { HOMEPAGE_INTRO } from "@/data/staticPageContent";
import { newPageMeta } from "@/pages/newPageMeta";

const shell = readFileSync("index.html", "utf8");
const built = (path: string) => buildRouteHtml(shell, getRouteMeta(path));
const root = (html: string) => html.match(/<div id="root">([\s\S]*?)<\/div>\s*(?:<script|<\/body>)/)?.[1] ?? "";
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim();
const words = (t: string) => t.split(" ").filter(Boolean).length;
const faqBlocks = (html: string) => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => JSON.parse(m[1])).filter((b) => b["@type"] === "FAQPage");
const qa = (block: any) => block.mainEntity.map((e: any) => ({ q: e.name, a: e.acceptedAnswer.text }));

const NEW_PAGES = {
  "/how-it-works": { title: "How Valu8 works: free car valuation by reg | Valu8", h1: "How Valu8 works", file: "src/pages/HowItWorksPage.tsx" },
  "/faq": { title: "Car valuation FAQs: your questions answered | Valu8", h1: "Car valuation FAQs", file: "src/pages/FaqPage.tsx" },
  "/example-report": { title: "Example Valu8 car valuation report | Valu8", h1: "Example Valu8 car valuation report", file: "src/pages/ExampleReportPage.tsx" },
} as const;

describe("new pages: route metadata", () => {
  for (const [path, want] of Object.entries(NEW_PAGES)) {
    it(`${path}: unique title of 60 characters or fewer, description, indexable, in the sitemap`, () => {
      const meta = getRouteMeta(path);
      expect(meta.title).toBe(want.title);
      expect(meta.title.length).toBeLessThanOrEqual(60);
      expect(ALL_ROUTES.filter((r) => r.title === meta.title).length).toBe(1);
      expect(meta.description.length).toBeGreaterThanOrEqual(70);
      expect(meta.description.length).toBeLessThanOrEqual(160);
      expect(meta.noindex ?? false).toBe(false);
      expect(meta.canonicalPath ?? path).toBe(path);
      expect(meta.inSitemap).toBe(true);
    });
    it(`${path}: the page sets the same title in the browser as the build HTML`, () => {
      const src = readFileSync(want.file, "utf8");
      const usesRouteMeta = src.includes(`getRouteMeta("${path}")`);
      if (!usesRouteMeta) expect(src).toContain(`title: "${want.title}"`);
      // The browser uses routeMeta, so its title and description match the build HTML exactly.
      expect(newPageMeta(path, { title: "fallback", description: "fallback" })).toEqual(getRouteMeta(path));
      const desc = getRouteMeta(path).description;
      expect(src.includes(`description: "${desc}"`) || usesRouteMeta, `${path} fallback description`).toBe(true);
    });
  }
});

describe("new pages: prebuilt HTML", () => {
  for (const [path, want] of Object.entries(NEW_PAGES)) {
    it(`${path}: one H1, self canonical, en-GB, description and real crawlable copy`, () => {
      const html = built(path);
      const body = root(html);
      expect(html).toContain('<html lang="en-GB"');
      expect(html).toContain(`<title>${want.title}</title>`);
      expect(html).toContain(`<link rel="canonical" href="https://valu8.uk${path}" />`);
      expect(html).toMatch(/<meta name="description" content="[^"]{70,}" \/>/);
      expect(html).not.toMatch(/<meta name="robots"[^>]*noindex/);
      expect(html).not.toContain("homepage-faq-jsonld");
      expect(body.match(/<h1>/g)?.length).toBe(1);
      expect(body).toContain(`<h1>${want.h1}</h1>`);
      expect(words(text(body))).toBeGreaterThanOrEqual(150);
    });
  }
  it("the unknown-route script knows the new paths", () => {
    for (const path of Object.keys(NEW_PAGES)) expect(shell).toContain(`"${path}"`);
  });
});

describe("FAQPage JSON-LD matches the visible FAQs", () => {
  it("the build-time FAQ copy is the same list the site shows", () => {
    expect(FAQS).toBe(SITE_FAQS);
    expect(readFileSync("src/pages/Landing.tsx", "utf8")).toContain(`FAQS.slice(0, ${HOME_FAQ_COUNT})`);
  });
  it("homepage: exactly one FAQPage, with the four visible questions and answers", () => {
    const blocks = faqBlocks(built("/"));
    expect(blocks.length).toBe(1);
    expect(qa(blocks[0])).toEqual(HOME_FAQS);
    for (const f of HOME_FAQS) expect(root(built("/"))).toContain(`<h3>${f.q}</h3>`);
  });
  it("/faq: exactly one FAQPage with the full visible list, each question in the page copy", () => {
    const html = built("/faq");
    const blocks = faqBlocks(html);
    expect(blocks.length).toBe(1);
    expect(qa(blocks[0])).toEqual(FAQS);
    for (const f of FAQS) expect(root(html)).toContain(`<h3>${f.q}</h3>`);
  });
});

describe("homepage keeps its SEO essentials", () => {
  const home = root(built("/"));
  it("H1, intro, report H2, guides link, and normal links to the new pages", () => {
    expect(home).toContain("<h1>Free car valuation by registration</h1>");
    // Tony removed the hero tagline (21 Nov 2026); the prerendered intro must not bring it back for crawlers.
    expect(home).not.toContain("Know its value. Make the right move.");
    expect(home).toContain(HOMEPAGE_INTRO);
    expect(HOMEPAGE_INTRO.toLowerCase()).toContain("buying or selling, know the right price");
    expect(home).toContain("<h2>What's in every report</h2>");
    for (const href of ["/guides", "/how-it-works", "/faq", "/example-report", "/value"]) expect(home).toContain(`href="${href}"`);
    for (const v of popularValueModels()) expect(home).toContain(`href="/value/${v.slug}"`);
    expect(home).not.toMatch(/href="\/car-values\/[^"]+\/[^"]+"/);
    expect(words(text(home))).toBeGreaterThanOrEqual(300);
  });
});

describe("sitemap", () => {
  it("lists the three new pages, dated 20 Nov 2026, and the homepage's date (21 Nov 2026: intro without the removed tagline)", () => {
    const xml = buildSitemap();
    for (const path of Object.keys(NEW_PAGES)) {
      expect(PAGE_LASTMOD[path]).toBe("2026-11-20");
      expect(xml).toContain(`<loc>https://valu8.uk${path}</loc><lastmod>2026-11-20</lastmod>`);
    }
    expect(xml).toContain("<loc>https://valu8.uk/</loc><lastmod>2026-11-21</lastmod>");
    expect(readFileSync("public/sitemap.xml", "utf8")).toBe(xml);
  });
});
