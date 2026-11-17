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
  it("privacy no longer says ICO registration is pending and never shows a number we haven't confirmed", () => {
    expect(privacy).not.toMatch(/registration pending/i);
    expect(privacy).toContain('export const ICO_REGISTRATION_NUMBER = "";');
    expect(privacy).toContain("we have paid the Information Commissioner's Office data protection fee");
    expect(staticPageBodyHtml("/privacy")).not.toMatch(/pending/i);
  });
  it("terms allow valuing a car you are buying", () => {
    expect(terms).not.toContain("Submit only vehicles you own or are authorised to value");
    expect(terms).toContain("considering buying");
    expect(staticPageBodyHtml("/terms")).toContain("considering buying");
  });
  it("footer drops the StartupBase and Fazier badges", () => {
    expect(footer).not.toMatch(/startupbase|fazier/i);
    expect(footer).toContain("twelve.tools");
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
    expect(home).toContain("Know its value. Make the right move.");
    expect(flow).toContain("Know its value.<br /><em>Make the right move.</em>");
    const meta = getRouteMeta("/");
    expect(indexHtml).toContain(`<title>${meta.title}</title>`);
    expect(indexHtml).not.toContain("Instant Car Valuation for UK Private Sellers");
  });
  it("/check-an-advert goes to the advert checker", () => {
    expect(app).toContain('<Route path="/check-an-advert" element={<Navigate to="/check" replace />} />');
    expect(getRouteMeta("/check-an-advert")).toMatchObject({ canonicalPath: "/check", noindex: true, inSitemap: false });
  });
  it("new copy keeps the copy rules: no em dashes", () => {
    for (const s of [flow.match(/Free guest valuations[^<]*/)![0], "Buying? Check an advert", staticPageBodyHtml("/") ?? ""]) expect(s).not.toContain("\u2014");
  });
});
