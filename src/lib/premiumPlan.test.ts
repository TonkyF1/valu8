import { describe, expect, it, vi, beforeAll } from "vitest";
import type { ValuationReport } from "@/lib/valuation";
import { reportRef, sellerPlan } from "./premiumPlan";

const pdfText: string[] = [];
const images: number[] = [];
vi.mock("jspdf", () => {
  class FakeDoc {
    internal = { pageSize: { getWidth: () => 595, getHeight: () => 842 } };
    pages = 1;
    constructor() {
      return new Proxy(this, {
        get(t, p) {
          if (p in t) return (t as any)[p];
          if (p === "text") return (s: string | string[]) => { pdfText.push(...(Array.isArray(s) ? s : [s])); };
          if (p === "splitTextToSize") return (s: string) => [s];
          if (p === "getTextWidth") return (s: string) => s.length * 5;
          if (p === "addPage") return () => { (t as any).pages++; };
          if (p === "getNumberOfPages") return () => (t as any).pages;
          if (p === "addImage") return () => { images.push(1); };
          return () => undefined;
        },
      });
    }
  }
  return { default: FakeDoc };
});

// The f6b441dc test car: private £2,400, buffer £200, stored asking £2,600.
const fiesta = {
  values: { privateSale: 2400, dealerTradeIn: 2150, dealerRetail: 3650 },
  valueRange: { privateSaleLow: 2200, privateSaleHigh: 2600 },
  negotiationBuffer: 200,
  marketConfidence: "Very Low",
  conditionScore: 7.2, conditionLabel: "Good",
  motSource: "dvsa",
  motHistory: [
    { date: "2025-10-20", result: "Pass", note: "", mileage: 96000, expiryDate: "2026-10-28", advisories: ["Nearside Front tyre wearing on edges"], failures: [] },
    { date: "2024-10-10", result: "Fail", note: "", mileage: 88000, advisories: [], failures: ["Brake pipe corroded"] },
  ],
  comparableListings: [{ year: 2017, price: 3000, mileage: 100000 }, { year: 2017, price: 2500, mileage: 103000 }],
  strengths: [], watchPoints: ["Tyres near the limit"],
  recommendations: { recommendedAskingPrice: 2600, listingPrice: 2600, negotiationBuffer: 200, documents: ["V5C logbook"], highlights: ["Full Ford service history"], whereToSell: ["Gumtree / Facebook Marketplace"] },
  vehicle: { fuelType: "Petrol", engineCapacity: 998, firstRegistered: "2017-03-01" },
} as unknown as ValuationReport;

beforeAll(() => {
  (URL as any).createObjectURL = () => "blob:x";
  (URL as any).revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = () => undefined;
});

describe("Premium plan figures", () => {
  it("reference id is short, stable and upper case", () => {
    expect(reportRef("f6b441dc-09ee-4050-9d1b-87f6cc5355a2")).toBe("V8-F6B441DC");
  });
  it("seller plan: advertise at the stored asking price, lowest offer from the coherent model", () => {
    expect(sellerPlan(fiesta)).toEqual({ advertise: 2600, lowest: 2200, room: 400, privateSale: 2400 });
  });
  it("seller plan never advertises below the private figure", () => {
    const r = { ...fiesta, recommendations: { ...fiesta.recommendations, recommendedAskingPrice: 1000, listingPrice: 1000 } } as ValuationReport;
    expect(sellerPlan(r).advertise).toBeGreaterThanOrEqual(2400);
  });
});

describe("Premium Report PDF (certificate)", () => {
  it("carries the reference, issue date, car, price block, plan, MOT table, comps and footer", async () => {
    pdfText.length = 0;
    const { downloadPremiumPdf } = await import("./pdfPremium");
    await downloadPremiumPdf({ id: "f6b441dc-09ee-4050-9d1b-87f6cc5355a2", make: "Ford", model: "Fiesta Zetec 1.0 EcoBoost", year: 2017, mileage: 99500, registration: "BD67USJ", created_at: "2026-11-21T10:00:00Z" },
      fiesta, { intent: "selling", movers: [{ label: "MOT expired", pct: -20 }], confidence: "Very low", issuedAt: new Date("2026-11-21T12:00:00Z") });
    const all = pdfText.join("\n");
    expect(all).toContain("Ref V8-F6B441DC · Valued 21 Nov 2026");
    expect(all).toContain("2017 Ford Fiesta Zetec 1.0 EcoBoost");
    expect(all).toContain("BD67USJ");
    expect(pdfText).toContain("£2,400");
    expect(pdfText).toContain("ADVERTISE AT");
    expect(pdfText).toContain("£2,600");
    expect(pdfText).toContain("LOWEST OFFER TO ACCEPT");
    expect(pdfText).toContain("£2,200");
    expect(pdfText).toContain("-20%");
    expect(all).toContain("MOT HISTORY (DVSA)");
    expect(pdfText).toContain("Fail");
    expect(all).toContain("UK ADVERTS WE COMPARED (2)");
    expect(all).toMatch(/Page 1 of 2/);
    expect(all).toContain("Valu8 Premium Report · Ref V8-F6B441DC · valu8.uk");
    expect(all).not.toMatch(/Marketplace/);
  });
});
