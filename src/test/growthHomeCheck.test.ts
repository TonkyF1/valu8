// Google growth plan (21 Nov 2026): homepage, /check and /car-values hub head tags, prerendered homepage
// WebSite/Organization JSON-LD, and the /car-values rule (hub indexable; matched model URLs are redirect stubs).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildRouteHtml } from "../../scripts/routePages";
import { buildSitemap } from "../../scripts/sitemap";
import { getRouteMeta, CAR_MODEL_ROUTES } from "@/data/routeMeta";
import { HOMEPAGE_ORG_JSONLD, HOMEPAGE_WEBSITE_JSONLD, staticPageBodyHtml } from "@/data/staticPageContent";

const shell = readFileSync("index.html", "utf8");
const built = (p: string) => buildRouteHtml(shell, getRouteMeta(p));
const ld = (html: string, id: string) => {
  const m = html.match(new RegExp(`<script type="application/ld\\+json" id="${id}">([\\s\\S]*?)</script>`, "g"));
  return m ?? [];
};

describe("homepage head", () => {
  it("title targets 'free car valuation online' / 'value my car' within 60 chars; description <= 160", () => {
    const m = getRouteMeta("/");
    expect(m.title).toBe("Free Car Valuation Online by Reg | Value My Car UK | Valu8");
    expect(m.title.length).toBeLessThanOrEqual(60);
    expect(m.description.length).toBeLessThanOrEqual(160);
    const html = built("/");
    expect(html).toContain(`<title>${m.title}</title>`);
    expect(html.match(/<title>/g)).toHaveLength(1);
  });

  it("prerenders exactly one WebSite and one Organization block, identical to the ones Landing.tsx upserts", () => {
    const html = built("/");
    expect(ld(html, "homepage-website-jsonld")).toHaveLength(1);
    expect(ld(html, "homepage-org-jsonld")).toHaveLength(1);
    expect(ld(html, "homepage-faq-jsonld")).toHaveLength(1);
    const landing = readFileSync("src/pages/Landing.tsx", "utf8");
    expect(landing).toContain(`setJsonLd("homepage-website-jsonld", ${JSON.stringify(HOMEPAGE_WEBSITE_JSONLD).replace(/"(@?\w+)":/g, (_, k) => (k.startsWith("@") ? `"${k}": ` : `${k}: `)).replace(/,/g, ", ").replace(/^\{/, "{ ").replace(/\}$/, " }")})`);
    expect(landing).toContain(`setJsonLd("homepage-org-jsonld", ${JSON.stringify(HOMEPAGE_ORG_JSONLD).replace(/"(@?\w+)":/g, (_, k) => (k.startsWith("@") ? `"${k}": ` : `${k}: `)).replace(/,/g, ", ").replace(/^\{/, "{ ").replace(/\}$/, " }")})`);
    expect(built("/check")).not.toContain("homepage-website-jsonld");
  });

  it("keeps the agreed homepage essentials", () => {
    const home = staticPageBodyHtml("/") ?? "";
    expect(home).toContain("<h1>Free car valuation by registration</h1>");
    expect(home).toContain("<h2>What's in every report</h2>");
    expect(home).toContain('href="/guides"');
    expect(home).not.toContain("Know its value. Make the right move.");
  });
});

describe("/check head", () => {
  it("title leads with 'car price check' within 60 chars (was 63), H1 unchanged", () => {
    const m = getRouteMeta("/check");
    expect(m.title).toBe("Car price check: is this used car a fair price? | Valu8");
    expect(m.title.length).toBeLessThanOrEqual(60);
    expect(m.description.toLowerCase()).toContain("price checker");
    expect(m.description.length).toBeLessThanOrEqual(160);
    expect(built("/check")).toContain("<h1>Is this used car a fair price?</h1>");
  });
});

describe("/car-values rule", () => {
  it("the old hub is a redirect stub to /value (fix leaks, 24 Nov 2026): canonical + refresh, no noindex, out of the sitemap", () => {
    const m = getRouteMeta("/car-values");
    expect(m.noindex).toBeFalsy();
    expect(m.inSitemap).toBe(false);
    expect(m.canonicalPath).toBe("/value");
    const html = built("/car-values");
    expect(html).toContain('<link rel="canonical" href="https://valu8.uk/value"');
    expect(html).toContain('<meta http-equiv="refresh" content="0; url=https://valu8.uk/value">');
    expect(html).not.toMatch(/<meta name="robots"/);
    expect(buildSitemap()).not.toContain("<loc>https://valu8.uk/car-values</loc>");
  });

  it("every matched /car-values model URL is a redirect stub to its /value page, out of the sitemap", () => {
    const xml = buildSitemap();
    for (const r of CAR_MODEL_ROUTES.filter((x) => x.canonicalPath)) {
      expect(r.canonicalPath!.startsWith("/value/"), r.path).toBe(true);
      expect(r.noindex, r.path).toBeFalsy();
      expect(xml).not.toContain(`<loc>https://valu8.uk${r.path}</loc>`);
      expect(built(r.path)).toContain(`<meta http-equiv="refresh" content="0; url=https://valu8.uk${r.canonicalPath}">`);
    }
  });

  it("the /valuation/new prerender links to /value, not the hub", () => {
    const html = staticPageBodyHtml("/valuation/new") ?? "";
    expect(html).toContain('href="/value"');
    expect(html).not.toContain('href="/car-values"');
  });
});
