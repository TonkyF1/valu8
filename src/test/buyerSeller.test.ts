import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buyerGuide, compareAsking, diffLine, parseAsking, VERDICT_COPY } from "@/lib/buyerGuide";
import { askingFor, getIntent, initialReportIntent, intentFor, parseIntent, saveAskingFor, saveIntentFor, setIntent } from "@/lib/intent";
import { BENEFITS, LOCKED_ROWS, PREMIUM_CTA, PREMIUM_INCLUDES, PREMIUM_INCLUDES_BUYING, PREMIUM_TITLE, includesFor, includesLine } from "@/components/tesla/premium";
import { REPORT_ADDS, REPORT_ADDS_BUYING, reportOfferLine } from "@/components/ReportCheckout";
import { FAQS } from "@/components/home/BuyerSellerSections";
import { getRouteMeta } from "@/data/routeMeta";

const read = (f: string) => readFileSync(f, "utf8");
function copyOk(t: string) {
  expect(t).not.toContain("—");
  expect(t).not.toMatch(/gumtree|autotrader|webuyanycar|motorway|cazoo|carwow|carvertical|tony/i);
  expect(t).not.toMatch(/\baccura(te|cy)\b|\bexact(ly)?\b|guaranteed (price|value)|precise/i);
}

describe("buyer guide (derived from existing figures only)", () => {
  const ex = { privateSale: 7700, privateLow: 7500, privateHigh: 7900, tradeIn: 6400, retail: 9100 };
  it("opening offer under the fair price, never below part-exchange, range up to the private top", () => {
    const g = buyerGuide(ex)!;
    expect(g.fairPrice).toBe(7700);
    expect(g.openingOffer).toBe(7150);
    expect(g.openingOffer).toBeGreaterThanOrEqual(ex.tradeIn);
    expect(g.openingOffer).toBeLessThan(g.fairPrice);
    expect([g.rangeLow, g.rangeHigh]).toEqual([7150, 7900]);
    expect(buyerGuide({ privateSale: 7700, tradeIn: 7600 })!.openingOffer).toBe(7600);
  });
  it("does not change the inputs and handles missing or bad figures", () => {
    const copy = { ...ex };
    buyerGuide(copy, 8495);
    expect(copy).toEqual(ex);
    expect(buyerGuide({ privateSale: 0 })).toBeNull();
    const g = buyerGuide({ privateSale: 3000 })!;
    expect(g.rangeHigh).toBeGreaterThan(g.rangeLow);
    expect(g.openingOffer % 50).toBe(0);
    expect(buyerGuide({ privateSale: 24000 })!.openingOffer % 100).toBe(0);
  });
  it("asking price never pushes the range above it, and a low asking price lowers the opening offer", () => {
    expect(buyerGuide(ex, 7800)!.rangeHigh).toBe(7800);
    const low = buyerGuide(ex, 7000)!;
    expect(low.openingOffer).toBeLessThan(7000);
    expect(low.rangeHigh).toBeGreaterThan(low.openingOffer);
  });
  it("compares an asking price like the /check tool: below, in line, room, above dealer", () => {
    const g = buyerGuide(ex)!;
    expect(compareAsking(7000, g)!.verdict).toBe("below");
    expect(compareAsking(7800, g)!.verdict).toBe("in_line");
    const c = compareAsking(8495, g)!;
    expect(c.verdict).toBe("room");
    expect(c.diff).toBe(795);
    expect(diffLine(c)).toBe("£795 above the estimated fair price");
    expect(compareAsking(9900, g)!.verdict).toBe("above_dealer");
    expect(compareAsking(0, g)).toBeNull();
    expect(parseAsking("£8,495")).toBe(8495);
    expect(parseAsking("12")).toBeNull();
    Object.values(VERDICT_COPY).forEach((v) => { copyOk(v.label); copyOk(v.tip); });
  });
});

describe("intent carried through the flow", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it("shared choice, per valuation, and the report view", () => {
    expect(parseIntent("buying")).toBe("buying");
    expect(parseIntent("x")).toBeNull();
    setIntent("buying");
    expect(getIntent()).toBe("buying");
    expect(sessionStorage.getItem("valu8_intent")).toBe("buying");
    saveIntentFor("v1", "buying");
    expect(intentFor("v1")).toBe("buying");
    setIntent("selling");
    expect(initialReportIntent("v1", "?session_id=cs_1")).toBe("buying");
    expect(initialReportIntent("v1", "?session_id=cs_1&intent=selling")).toBe("selling");
    expect(initialReportIntent("v2", "")).toBe("selling");
    saveAskingFor("v1", 8495);
    expect(askingFor("v1")).toBe(8495);
    saveAskingFor("v1", null);
    expect(askingFor("v1")).toBeNull();
  });
  it("checkout, return URL and Stripe session carry the intent", () => {
    const co = read("src/components/ReportCheckout.tsx");
    expect(co).toContain("intent: getIntent()");
    expect(co).toContain("&intent=${getIntent()}");
    const fn = read("supabase/functions/create-checkout-session/index.ts");
    expect(fn).toContain('"metadata[intent]": intent');
    expect(fn).toMatch(/body\?\.intent === "buying" \|\| body\?\.intent === "selling"/);
    const flow = read("src/components/tesla/TeslaFlow.tsx");
    expect(flow).toContain("navigate(`/valuation/${valuationId}?intent=${getIntent()}`, {");
    expect(flow).toContain('data-testid="asking-price"');
    const rep = read("src/pages/Report.tsx");
    expect(rep).toContain("intent={reportIntent}");
    expect(rep).toMatch(/downloadPremiumPdf\(\{ ...v, [^}]*\}, r, \{ intent: reportIntent, valuationId: v.id,/);
  });
});

describe("buyer and seller copy", () => {
  it("names, CTA and lists", () => {
    expect(PREMIUM_TITLE).toBe("Premium Report · £2.99");
    expect(PREMIUM_CTA).toBe("Unlock Premium Report · £2.99");
    expect(PREMIUM_INCLUDES_BUYING).toHaveLength(8);
    expect(includesFor("selling")).toBe(PREMIUM_INCLUDES);
    expect(REPORT_ADDS).toHaveLength(8);
    const all = [PREMIUM_TITLE, PREMIUM_CTA, ...PREMIUM_INCLUDES, ...PREMIUM_INCLUDES_BUYING, ...REPORT_ADDS_BUYING,
      includesLine("buying"), includesLine("selling"), reportOfferLine({ isRange: true, intent: "buying" }),
      ...Object.values(BENEFITS).flatMap((b) => [b.heading, b.body, ...b.items]),
      ...Object.values(LOCKED_ROWS).flat().map((r) => r.label), ...FAQS.flatMap((f) => [f.q, f.a])];
    all.forEach(copyOk);
    expect(BENEFITS.buying.items).toHaveLength(6);
    expect(BENEFITS.selling.items).toHaveLength(6);
  });
  it("homepage and SEO wording", () => {
    const flow = read("src/components/tesla/TeslaFlow.tsx");
    // SEO (Nov 2026): the H1 carries the search terms; the brand line is kept in the intro under it.
    expect(flow).toContain("Free car valuation<br /><em>by registration.</em>");
    // Tagline paragraph removed from the visible hero (Nov 2026, Tony); prerender intro is owned by Marketing.
    expect(flow).not.toContain("Know its value. Make the right move.");
    expect(flow).toContain("Buying or selling? Know the right price.");
    expect(flow).not.toMatch(/t8-sub[^"]*">Buying or selling/);
    expect(flow).not.toContain("Coming soon");
    const secs = read("src/components/home/BuyerSellerSections.tsx");
    expect(secs).not.toMatch(/coming soon/i);
    expect(secs).toContain("Illustrative example only, not a real vehicle or valuation.");
    [flow, secs, read("src/components/report/PremiumView.tsx"), read("src/styles/buyerSeller.css")].forEach((t) => expect(t).not.toContain("—"));
    expect(read("src/components/Layout.tsx")).toContain("Value a car");
    expect(read("src/components/Layout.tsx")).not.toContain("Value my car");
    const m = getRouteMeta("/");
    expect(m.title).toBe("Free Car Valuation Online by Reg | Value My Car UK | Valu8");
    copyOk(m.description);
  });
});

import { buyerChecks } from "@/lib/buyerGuide";
describe("buyerChecks", () => {
  it("drops seller-framed watch points and tops up", () => {
    const out = buyerChecks(["Gather any service history to reassure buyers on timing chain", "Timing chain noise is a known issue on this engine"]);
    expect(out[0]).toMatch(/Timing chain noise/);
    expect(out.some((s) => /reassure buyers/.test(s))).toBe(false);
    expect(out.length).toBe(3);
  });
});
