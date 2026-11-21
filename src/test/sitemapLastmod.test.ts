// Sitemap quality: every listed URL is a canonical, indexable 200 page on https://valu8.uk, and every
// <lastmod> is a real W3C date (YYYY-MM-DD) that isn't in the future.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildSitemap, sitemapLastmod } from "../../scripts/sitemap";
import { buildRouteHtml } from "../../scripts/routePages";
import { ALL_ROUTES } from "@/data/allRoutes";
import { PAGE_LASTMOD } from "@/data/pageLastmod";
import { VALUE_PAGES_MODIFIED_ISO, registryOnlyModels, valuePageModifiedIso, valuePath } from "@/data/valuePages";

const shell = readFileSync("index.html", "utf8");
const xml = buildSitemap();
const entries = [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<priority>[^<]+<\/priority><\/url>/g)].map((m) => ({ loc: m[1], lastmod: m[2] }));
const W3C_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const validDate = (d: string) => W3C_DATE.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;

describe("sitemap.xml", () => {
  it("parses every <url> entry, with no duplicates", () => {
    expect(entries.length).toBe((xml.match(/<url>/g) ?? []).length);
    expect(entries.length).toBeGreaterThan(200);
    expect(new Set(entries.map((e) => e.loc)).size).toBe(entries.length);
  });

  it("uses the canonical https://valu8.uk host with no trailing-slash mismatch", () => {
    for (const { loc } of entries) {
      expect(loc).toMatch(/^https:\/\/valu8\.uk\//);
      const path = loc.slice("https://valu8.uk".length);
      if (path !== "/") expect(path.endsWith("/"), loc).toBe(false);
      expect(loc, "no query strings or fragments").not.toMatch(/[?#]/);
    }
  });

  it("lists only known, indexable, self-canonical routes, and their built HTML has no noindex", () => {
    for (const { loc } of entries) {
      const path = loc.slice("https://valu8.uk".length);
      const route = ALL_ROUTES.find((r) => r.path === path);
      expect(route, loc).toBeDefined();
      expect(route!.noindex ?? false, `${loc} is noindex`).toBe(false);
      expect(route!.canonicalPath ?? path, `${loc} canonicalises elsewhere`).toBe(path);
      const html = buildRouteHtml(shell, route!);
      expect(html, loc).not.toMatch(/<meta name="robots"[^>]*noindex/);
      expect(html, loc).not.toMatch(/http-equiv="refresh"/);
      if (path !== "/") expect(html, loc).toContain(`<link rel="canonical" href="${loc}" />`);
    }
  });

  it("includes every indexable route except thin no-price /value fallbacks", () => {
    const fallbacks = new Set(registryOnlyModels().map(valuePath));
    const expected = ALL_ROUTES.filter((r) => !r.noindex && !r.canonicalPath && !fallbacks.has(r.path) && r.path !== "/valuation/new").map((r) => `https://valu8.uk${r.path}`);
    expect(entries.map((e) => e.loc).sort()).toEqual([...new Set(expected)].sort());
    for (const f of fallbacks) expect(xml).not.toContain(`<loc>https://valu8.uk${f}</loc>`);
  });

  it("never lists /car-values model pages that redirect to /value, or templated year pages", () => {
    for (const r of ALL_ROUTES.filter((r) => r.noindex)) expect(xml).not.toContain(`<loc>https://valu8.uk${r.path}</loc>`);
  });

  it("gives every URL a valid W3C <lastmod> date that isn't in the future", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const { loc, lastmod } of entries) {
      expect(lastmod, `${loc} has no lastmod`).toBeDefined();
      expect(validDate(lastmod!), `${loc}: ${lastmod}`).toBe(true);
      expect(lastmod! <= today, `${loc}: ${lastmod} is in the future`).toBe(true);
    }
  });

  it("dates /value pages from VALUE_PAGES_MODIFIED_ISO and everything else from PAGE_LASTMOD (no stale keys)", () => {
    for (const r of ALL_ROUTES.filter((r) => r.inSitemap)) {
      if (r.path === "/value" || r.path.split("/").length > 3) expect(sitemapLastmod(r), r.path).toBe(VALUE_PAGES_MODIFIED_ISO);
      else if (r.path.startsWith("/value/")) expect(sitemapLastmod(r), r.path).toBe(valuePageModifiedIso(r.path.slice("/value/".length)));
      else if (!r.path.startsWith("/car-values/")) expect(PAGE_LASTMOD[r.path], `add ${r.path} to src/data/pageLastmod.ts`).toBeDefined();
    }
    const listed = new Set(ALL_ROUTES.filter((r) => r.inSitemap).map((r) => r.path));
    for (const key of Object.keys(PAGE_LASTMOD)) {
      expect(listed.has(key), `${key} in pageLastmod.ts is not a sitemap page`).toBe(true);
      expect(validDate(PAGE_LASTMOD[key]), key).toBe(true);
    }
  });

  it("is not stamped with one date for every URL", () => {
    expect(new Set(entries.map((e) => e.lastmod)).size).toBeGreaterThan(1);
  });
});
