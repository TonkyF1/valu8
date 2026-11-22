import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getRouteMeta } from "@/data/routeMeta";
import { staticPageBodyHtml } from "@/data/staticPageContent";

const read = (p: string) => readFileSync(p, "utf8");
const flow = read("src/components/tesla/TeslaFlow.tsx");
const layout = read("src/components/Layout.tsx");
const footer = read("src/components/Footer.tsx");
const privacy = read("src/pages/Privacy.tsx");
const terms = read("src/pages/Terms.tsx");
const app = read("src/App.tsx");
const indexHtml = read("index.html");

describe("trust details", () => {
  it("privacy shows the confirmed ICO registration ZC283979 and never says pending", () => {
    expect(privacy).not.toMatch(/registration pending/i);
    expect(privacy).toContain('export const ICO_REGISTRATION_NUMBER = "ZC283979";');
    expect(privacy).toContain("Registered with the Information Commissioner's Office, registration reference <strong");
    expect(privacy).toContain(", registered 4 November 2026.");
    expect(staticPageBodyHtml("/privacy")).toContain("Registered with the Information Commissioner's Office, registration reference <strong>ZC283979</strong>, registered 4 November 2026.");
    expect(staticPageBodyHtml("/privacy")).not.toMatch(/pending/i);
  });
  it("terms allow valuing a car you are buying", () => {
    expect(terms).not.toContain("Submit only vehicles you own or are authorised to value");
    expect(terms).toContain("considering buying");
    expect(staticPageBodyHtml("/terms")).toContain("considering buying");
  });
  it("footer has no directory badges (StartupBase, Fazier, Twelve Tools all gone)", () => {
    expect(footer).not.toMatch(/startupbase|fazier|twelve\.tools/i);
  });
});

describe("accuracy page out of the menus", () => {
  it("is not in the header or footer and is noindex, but the route stays", () => {
    expect(layout).not.toContain('"/accuracy"');
    expect(footer).not.toContain('"/accuracy"');
    expect(app).toContain('<Route path="/accuracy"');
    expect(getRouteMeta("/accuracy")).toMatchObject({ noindex: true, inSitemap: false });
  });
});

describe("guest limit said up front", () => {
  it("the reg card mentions the daily guest limit for guests, and no promise of no sign-up remains", () => {
    expect(flow).toContain("Free guest valuations are limited each day. A free account gives you more.");
    expect(flow).toMatch(/\{!user && !guestLimit && <p className="t8-cap"/);
    const home = staticPageBodyHtml("/") ?? "";
    expect(home).not.toMatch(/no sign-up|no account needed/i);
    expect(read("src/pages/Check.tsx")).not.toMatch(/no account needed/i);
  });
});

describe("buyer signpost", () => {
  it("the homepage reg card links buyers to the advert checker", () => {
    expect(flow).toMatch(/<Link to="\/check" data-testid="buyer-check-link">Buying\? Check an advert/);
    expect(staticPageBodyHtml("/")).toContain('<a href="/check">Check an advert</a>');
  });
});

describe("headline and old advert-check URL", () => {
  it("the headline search engines see matches the visible hero", () => {
    const home = staticPageBodyHtml("/") ?? "";
    expect(home).toContain("<h1>Free car valuation by registration</h1>");
    expect(flow).toContain('<h1 id="t8-h" className="t8-h1 t8-h1-bs">Free car valuation<br /><em>by registration.</em></h1>');
    // Tony removed the hero tagline (21 Nov 2026); the build HTML intro no longer carries it either.
    expect(home).not.toContain("Know its value. Make the right move.");
    expect(flow).not.toContain("Know its value. Make the right move.");
    const meta = getRouteMeta("/");
    expect(indexHtml).toContain(`<title>${meta.title}</title>`);
    expect(indexHtml).not.toContain("Instant Car Valuation for UK Private Sellers");
  });
  it("/check-an-advert goes to the advert checker", () => {
    expect(app).toContain('<Route path="/check-an-advert" element={<Navigate to="/check" replace />} />');
    expect(getRouteMeta("/check-an-advert")).toMatchObject({ canonicalPath: "/check", noindex: true, inSitemap: false });
    // The refresh moved from vite.config.ts into scripts/routePages.ts (buildRouteHtml), which the build uses.
    expect(read("scripts/routePages.ts")).toContain(`if (meta.path === "/check-an-advert") return routeHtml(shell, meta, false, { ...extra, headHtml: '<meta http-equiv="refresh" content="0; url=/check" />' });`);
  });
  it("new copy keeps the copy rules: no em dashes", () => {
    for (const s of [flow.match(/Free guest valuations[^<]*/)![0], "Buying? Check an advert", staticPageBodyHtml("/") ?? ""]) expect(s).not.toContain("\u2014");
  });
});
