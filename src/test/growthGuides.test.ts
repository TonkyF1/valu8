// Google growth plan (21 Nov 2026), guides: "What is my car worth?" upgrade, part-exchange / trade-in targeting,
// and (separately) the electric car value guide. Every price quoted in a guide table must match MODEL_PRICES,
// so a price-data refresh that changes a figure fails here and the copy gets updated with it.
import { describe, expect, it } from "vitest";
import { GUIDES, guideFaqJsonLd } from "@/data/guides";
import { getRouteMeta } from "@/data/routeMeta";
import { MODEL_PRICES } from "@/data/modelPriceBands";
import { VALUE_MODELS } from "@/data/valueModels";
import { PAGE_LASTMOD } from "@/data/pageLastmod";
import { buildSitemap } from "../../scripts/sitemap";

const g = (slug: string) => GUIDES.find((x) => x.slug === slug)!;
const gbp = (n: number) => "£" + n.toLocaleString("en-GB");
const band = (label: string) => label.replace(/^(\d{4}) to (\d{4})$/, "$1–$2").replace(/^(\d{4}) or newer$/, "$1 and newer");
const words = (md: string) => md.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").split(/\s+/).filter(Boolean).length;

describe("growth plan guides", () => {
  it("titles <= 60 chars, descriptions <= 160, all unique", () => {
    for (const x of GUIDES) {
      expect(x.title.length, x.slug).toBeLessThanOrEqual(60);
      expect(x.description.length, x.slug).toBeLessThanOrEqual(160);
    }
    expect(new Set(GUIDES.map((x) => x.title)).size).toBe(GUIDES.length);
    expect(new Set(GUIDES.map((x) => x.h1)).size).toBe(GUIDES.length);
  });

  it("'What is my car worth?' targets 'how much is my car worth' and is substantially deeper", () => {
    const w = g("what-is-my-car-worth");
    expect(w.title).toBe("How much is my car worth? UK car valuation guide | Valu8");
    expect(w.h1).toBe("How much is my car worth? A UK car valuation guide");
    expect(w.markdown).toContain("## How much is my car worth to sell?");
    expect(words(w.markdown)).toBeGreaterThan(1500);
    for (const href of ["/valuation/new", "/check", "/value", "/how-it-works", "/guides/private-sale-vs-dealer-prices"]) expect(w.markdown).toContain(`](${href})`);
    expect(w.markdown).not.toContain("](/car-values)");
    expect(getRouteMeta(w.path).title).toBe(w.title);
  });

  it("the two part-exchange guides no longer share a title and each targets its own query", () => {
    expect(g("part-exchange-vs-private-sale").title).toBe("Part exchange vs private sale: which pays more? (UK)");
    expect(g("part-exchange-vs-private-sale").markdown).toContain("## How dealers work out your part-exchange (trade-in) value");
    expect(g("private-sale-vs-dealer-prices").title).toBe("Part exchange value vs private sale: UK price gap data");
    expect(g("private-sale-vs-dealer-prices").faqs.map((f) => f.question)).toContain("What is a good part-exchange value?");
  });

  it("every model price table row in a guide matches MODEL_PRICES", () => {
    let rows = 0;
    for (const x of GUIDES) {
      for (const m of x.markdown.matchAll(/^\| \[([^\]]+)\]\(\/value\/([a-z0-9-]+)\) \|(.*)$/gm)) {
        const slug = m[2], cells = m[3].split("|").map((c) => c.trim()).filter(Boolean);
        const prices = MODEL_PRICES.find((p) => p.slug === slug)!;
        expect(VALUE_MODELS.some((v) => v.slug === slug), slug).toBe(true);
        // Either "| Registered | median | low to high | adverts |" (EV guide) or "| median | low to high |" (2018–2020 table).
        const hasBand = /^\d{4} (to|or) /.test(cells[0]);
        const b = prices.bands.find((pb) => pb.band === (hasBand ? band(cells[0]) : "2018–2020"))!;
        const [med, range] = hasBand ? [cells[1], cells[2]] : [cells[0], cells[1]];
        expect(med, `${x.slug} ${slug}`).toBe(gbp(b.median));
        expect(range, `${x.slug} ${slug}`).toBe(`${gbp(b.low)} to ${gbp(b.high)}`);
        if (hasBand) expect(cells[3], `${x.slug} ${slug}`).toBe(String(b.count));
        rows++;
      }
    }
    expect(rows).toBeGreaterThanOrEqual(8);
  });

  it("FAQPage JSON-LD matches each guide's visible FAQs; changed guides are redated", () => {
    for (const x of GUIDES) expect(JSON.parse(guideFaqJsonLd(x)).mainEntity.length, x.slug).toBe(x.faqs.length);
    for (const p of ["/guides/what-is-my-car-worth", "/guides/part-exchange-vs-private-sale", "/guides/private-sale-vs-dealer-prices"]) {
      expect(PAGE_LASTMOD[p]).toBe("2026-11-21");
      expect(buildSitemap()).toContain(`<loc>https://valu8.uk${p}</loc><lastmod>2026-11-21</lastmod>`);
    }
  });

  it("electric car value guide: EV models, battery section, links to the EV /value pages, in the sitemap", () => {
    const e = g("electric-car-value");
    expect(e.title).toBe("What is my electric car worth? Used EV values in the UK");
    expect(e.markdown).toContain("## Why battery health, range and charging move the price");
    for (const s of ["tesla-model-3", "tesla-model-y", "nissan-leaf", "cupra-born", "skoda-enyaq"]) expect(e.markdown).toContain(`](/value/${s})`);
    expect(e.faqs.length).toBeGreaterThanOrEqual(4);
    expect(PAGE_LASTMOD["/guides/electric-car-value"]).toBe("2026-11-21");
    expect(buildSitemap()).toContain("<loc>https://valu8.uk/guides/electric-car-value</loc><lastmod>2026-11-21</lastmod>");
  });

  it("new copy uses no em dashes and never calls anyone a partner", () => {
    for (const s of ["what-is-my-car-worth", "part-exchange-vs-private-sale", "private-sale-vs-dealer-prices", "electric-car-value"]) {
      expect(g(s).markdown, s).not.toContain("—");
      expect(g(s).markdown.toLowerCase(), s).not.toContain("partner");
    }
  });
});
