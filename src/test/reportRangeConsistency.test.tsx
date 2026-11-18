import { describe, expect, it, vi, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen, cleanup } from "@testing-library/react";
import { PremiumReport } from "@/components/PremiumReport";
import { normaliseReportPricing, displayPrivateRange } from "@/lib/askingPrice";
import { reportPriceRange } from "../../supabase/functions/_shared/cheapRange";
import type { ValuationReport } from "@/lib/valuation";
import { downloadValuationPdf } from "@/lib/pdf";
import { downloadPremiumPdf } from "@/lib/pdfPremium";

// Every jsPDF text call lands here, so the PDFs can be checked without drawing anything.
const pdfText: string[] = [];
vi.mock("jspdf", () => {
  class FakeDoc {
    internal = { pageSize: { getWidth: () => 595, getHeight: () => 842 } };
    constructor() {
      return new Proxy(this, {
        get(t, p) {
          if (p in t) return (t as any)[p];
          if (p === "text") return (s: string | string[]) => { pdfText.push(...(Array.isArray(s) ? s : [s])); };
          if (p === "splitTextToSize") return (s: string) => [s];
          if (p === "getTextWidth") return (s: string) => s.length * 5;
          if (p === "getNumberOfPages") return () => 1;
          if (p === "output") return () => new Blob(["x"]);
          return () => undefined;
        },
      });
    }
  }
  return { default: FakeDoc };
});

// 2017 Ford Fiesta, private £2,700: the comps band (valueRange) is £2,500–£2,850, the headline range £2,200–£3,700.
const fiesta = {
  values: { privateSale: 2700, dealerTradeIn: 2450, dealerRetail: 3900 },
  valueRange: { privateSaleLow: 2500, privateSaleHigh: 2850 },
  priceRange: { low: 2200, high: 3700, mid: 2700, rule: "cheap-range-1" },
  marketConfidence: "Medium",
  conditionScore: 0, conditionLabel: "", motHistory: [], comparableListings: [], strengths: [], watchPoints: [],
  recommendations: { recommendedAskingPrice: 2950, listingPrice: 2950, documents: [], highlights: [], whereToSell: [] }, marketPositioning: "",
} as unknown as ValuationReport;
const car = { make: "Ford", model: "Fiesta", year: 2017, mileage: 60000, registration: "AB17CDE", created_at: "2026-11-18T10:00:00Z" };

// Exactly what the Report page headline prints (src/pages/Report.tsx, data-testid="headline-range").
const reportPageText = (r: ValuationReport) => {
  const pr = reportPriceRange(r, normaliseReportPricing(r).privateSale)!;
  return `£${pr.low.toLocaleString()} – £${pr.high.toLocaleString()}`;
};

beforeAll(() => {
  (URL as any).createObjectURL = () => "blob:x";
  (URL as any).revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = () => undefined; // the PDF download link; jsdom can't navigate
});

describe("one private-sale range everywhere (£2,700 Fiesta, comps band £2,500–£2,850)", () => {
  it("the Report page shows £2,200 – £3,700", () => {
    expect(readFileSync("src/pages/Report.tsx", "utf8")).toContain("const pr = reportPriceRange(r, normaliseReportPricing(r).privateSale);");
    expect(reportPageText(fiesta)).toBe("£2,200 – £3,700");
    expect(displayPrivateRange(fiesta).text).toBe(reportPageText(fiesta));
  });

  it("the Premium report (seller) headline is the same range, with no £2,500–£2,850 anywhere", () => {
    render(<PremiumReport r={fiesta} registration="AB17CDE" intent="selling" />);
    const section = screen.getByTestId("premium-report");
    expect(screen.getByTestId("pr-headline").textContent).toContain(reportPageText(fiesta));
    expect(screen.getByTestId("pr-headline").textContent).not.toContain("£2,700");
    expect(screen.getByTestId("pr-range").textContent).toContain("Realistic private sale £2,700");
    expect(section.textContent).not.toMatch(/£2,500|£2,850/);
    cleanup();
  });

  it("the Premium report (buyer) estimated range is the same range", () => {
    render(<PremiumReport r={fiesta} registration="AB17CDE" intent="buying" valuationId="v-test" />);
    expect(screen.getByTestId("pr-buy-range").textContent).toContain(`Estimated range ${reportPageText(fiesta)}`);
    cleanup();
  });

  it("the standard PDF prints the same range in the tier and the range line", async () => {
    pdfText.length = 0;
    await downloadValuationPdf(car, fiesta);
    expect(pdfText).toContain(reportPageText(fiesta));
    expect(pdfText.some((t) => t.startsWith(`PRIVATE SALE RANGE  ${reportPageText(fiesta)}`))).toBe(true);
    expect(pdfText.join("\n")).not.toMatch(/£2,500|£2,850/);
  }, 20_000);

  it("the Premium PDF prints the same range (seller and buyer)", async () => {
    pdfText.length = 0;
    await downloadPremiumPdf(car, fiesta, { intent: "selling" });
    expect(pdfText).toContain(reportPageText(fiesta));
    expect(pdfText.join("\n")).not.toMatch(/£2,500|£2,850/);
    pdfText.length = 0;
    await downloadPremiumPdf(car, fiesta, { intent: "buying", valuationId: "v-test" });
    expect(pdfText.some((t) => t.startsWith(`Estimated range ${reportPageText(fiesta)}`))).toBe(true);
  }, 20_000);

  it("falls back to the comps band only when there is no headline range (£5k+, under 16y)", () => {
    const dear = { ...fiesta, values: { privateSale: 9000, dealerTradeIn: 7600, dealerRetail: 11000 }, valueRange: { privateSaleLow: 8600, privateSaleHigh: 9400 }, priceRange: undefined } as unknown as ValuationReport;
    const p = normaliseReportPricing(dear);
    expect(displayPrivateRange(dear)).toMatchObject({ headline: null, low: p.privateLow, high: p.privateHigh, text: `£${p.privateLow.toLocaleString()} – £${p.privateHigh.toLocaleString()}` });
  });
});
