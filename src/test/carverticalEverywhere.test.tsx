// carVertical across the site (27 Nov 2026): placements, the /car-history-check page, SEO, email and click tracking.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { getRouteMeta } from "@/data/routeMeta";
import { ALL_ROUTES } from "@/data/allRoutes";
import { buildRouteHtml } from "../../scripts/routePages";
import { buildSitemap } from "../../scripts/sitemap";
import { HISTORY_COVERS, HISTORY_FAQS, historyCheckBodyHtml } from "@/data/historyCheckContent";
import { HISTORY_CHECK_URL } from "@/components/report/HistoryCheckButton";
import { HISTORY_CHECK_URL as EMAIL_URL, historyCheckEmailUrl } from "../../supabase/functions/_shared/emailTemplates";
import { renderEmail } from "../../supabase/functions/_shared/email";

const ev = vi.fn();
vi.mock("@/lib/analytics", () => ({ ev: (...a: unknown[]) => ev(...a) }));

const read = (f: string) => readFileSync(f, "utf8");

describe("placements", () => {
  const sites: [string, RegExp][] = [
    ["src/components/tesla/TeslaFlow.tsx", /placement="home_result_buying"[\s\S]*placement="home_result"/],
    ["src/pages/ModelValue.tsx", /placement="value_model"[\s\S]*placement="value_year"/],
    ["src/pages/Guide.tsx", /HISTORY_GUIDES\.has\(guide\.slug\) && <HistoryCheckButton placement="guide"/],
    ["src/pages/Check.tsx", /placement="check"/],
    ["src/pages/FaqPage.tsx", /variant="line" placement="faq"/],
    ["src/pages/Landing.tsx", /variant="line" placement="home"/],
  ];
  for (const [f, re] of sites) it(`${f} renders the carVertical block`, () => expect(read(f)).toMatch(re));
  it("buying intent gets the 'check before you buy' card above the Premium card; selling gets the slim line", () => {
    const s = read("src/components/tesla/TeslaFlow.tsx");
    expect(s.indexOf('intent === "buying" && (')).toBeLessThan(s.indexOf('className="t8-unlock"'));
    expect(s.indexOf('intent !== "buying" && (')).toBeGreaterThan(s.indexOf('className="t8-unlock"'));
  });
  it("nav (laptop, signed in and the menu) and footer link to the page", () => {
    expect((read("src/components/Layout.tsx").match(/to: "\/car-history-check", label: "History check"/g) ?? []).length).toBe(3);
    expect(read("src/components/Footer.tsx")).toContain('{ to: "/car-history-check", label: "History check" }');
    expect(read("src/App.tsx")).toContain('<Route path="/car-history-check" element={<CarHistoryCheck />} />');
  });
  it("logs an anonymous click with the placement only (no reg)", async () => {
    const { HistoryCheckButton } = await import("@/components/report/HistoryCheckButton");
    const { render, fireEvent } = await import("@testing-library/react");
    const { getByRole } = render(<HistoryCheckButton registration="BD67 USJ" placement="value_model" />);
    const a = getByRole("link", { name: /Full vehicle history check/ });
    a.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(a);
    expect(ev).toHaveBeenCalledWith("history_check_click", { placement: "value_model" });
    expect(JSON.stringify(ev.mock.calls)).not.toContain("BD67");
  });
});

describe("/car-history-check", () => {
  const meta = getRouteMeta("/car-history-check");
  it("has its own title, description and a sitemap entry", () => {
    expect(meta.title).toMatch(/^Car history check by reg/);
    expect(meta.title.length).toBeLessThanOrEqual(70);
    expect(meta.description.length).toBeLessThanOrEqual(160);
    expect(buildSitemap()).toContain("<loc>https://valu8.uk/car-history-check</loc>");
    expect(read("public/sitemap.xml")).toContain("<loc>https://valu8.uk/car-history-check</loc>");
  });
  it("build HTML carries the copy and FAQPage schema that matches the visible FAQs", () => {
    const html = buildRouteHtml(read("index.html"), ALL_ROUTES.find((r) => r.path === "/car-history-check")!);
    expect(html).toContain("<h1>Car history check</h1>");
    for (const [h] of HISTORY_COVERS) expect(html).toContain(h);
    const ld = [...html.matchAll(/<script type="application\/ld\+json" id="history-faq-jsonld">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    expect(ld).toHaveLength(1);
    expect(ld[0]["@type"]).toBe("FAQPage");
    expect(ld[0].mainEntity.map((q: any) => q.name)).toEqual(HISTORY_FAQS.map((f) => f.q));
    expect(historyCheckBodyHtml()).toContain("Affiliate link: Valu8 earns a commission if you buy");
    expect(historyCheckBodyHtml()).toContain("valu8");
  });
  it("only claims what carVertical lists on its UK site (no invented features or prices)", () => {
    const all = JSON.stringify([HISTORY_COVERS, HISTORY_FAQS]);
    expect(all).not.toMatch(/£\d|\d+% off|guarantee|HPI|police national/i);
  });
  it("page renders the reg form, coupon, logo and disclosure", async () => {
    const { MemoryRouter } = await import("react-router-dom");
    vi.doMock("@/components/Layout", () => ({ Header: () => null, TestModeBanner: () => null }));
    vi.doMock("@/components/Footer", () => ({ Footer: () => null }));
    const { default: Page } = await import("@/pages/CarHistoryCheck");
    const html = renderToStaticMarkup(<MemoryRouter><Page /></MemoryRouter>);
    expect(html).toContain('data-testid="history-reg-form"');
    expect(html).toContain('data-testid="history-coupon"');
    expect(html).toContain('alt="carVertical"');
    expect(html).toContain('rel="sponsored noopener"');
    expect(html).toContain("sub2=history_page");
  });
});

describe("valuation email", () => {
  it("uses the same affiliate link with sub2=email and the reg as sub3", () => {
    expect(EMAIL_URL).toBe(HISTORY_CHECK_URL);
    expect(historyCheckEmailUrl("bd67 usj")).toBe(`${HISTORY_CHECK_URL}&sub2=email&sub3=BD67USJ`);
    expect(historyCheckEmailUrl(null)).toBe(`${HISTORY_CHECK_URL}&sub2=email`);
  });
  it("renders the aside with the link, coupon and disclosure in HTML and text", () => {
    const { html, text } = renderEmail({ preview: "p", heading: "h", buttons: [], unsubscribe: "https://valu8.uk/u",
      aside: { text: "Buying?", linkLabel: "Full history check via carVertical", url: historyCheckEmailUrl("AB12CDE"), small: "Code valu8 is applied automatically. Affiliate link: Valu8 earns a commission if you buy." } });
    expect(html).toContain("sub2=email&amp;sub3=AB12CDE");
    expect(html).toContain("Affiliate link: Valu8 earns a commission if you buy.");
    expect(text).toContain("Full history check via carVertical: https://www.carvertical.deal/");
  });
});
