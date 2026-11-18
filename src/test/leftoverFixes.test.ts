import { describe, it, expect } from "vitest";
import { alignRangeMentions, displayPrivateRange, hasAskFigure } from "@/lib/askingPrice";
import { facts, PAID_ONLY_LINE } from "@/pages/Compare";
import { drawShareCard } from "@/lib/shareCard";
import { reportForViewer, fullReportAllowed } from "../../supabase/functions/_shared/sharedReport";

const fiesta: any = {
  values: { privateSale: 2700, dealerTradeIn: 2450, dealerRetail: 3900 },
  valueRange: { privateSaleLow: 2500, privateSaleHigh: 2850 },
  headline: "Worth about £2,700 in a private sale (typically £2,500–£2,850).",
  valueReasoning: "Prices range £2,500 to £2,850 for similar cars.",
  sellerTip: "List at £2,850–£3,000 and expect to settle around £2,700.",
  recommendations: { recommendedAskingPrice: 2850, listingPrice: 2850, negotiationBuffer: 150 },
  photoInsights: [{ slot: "front" }],
  saleFeedback: { price: 1 },
};

describe("alignRangeMentions", () => {
  it("rewrites the stale comps band to the displayed range", () => {
    expect(displayPrivateRange(fiesta).text).toBe("£2,200 – £3,700");
    const r = alignRangeMentions(fiesta);
    expect(r.headline).toBe("Worth about £2,700 in a private sale (typically £2,200–£3,700).");
    expect(r.valueReasoning).toContain("range £2,200–£3,700");
  });
  it("leaves asking-range wording alone", () => {
    expect(alignRangeMentions(fiesta).sellerTip).toBe(fiesta.sellerTip);
  });
  it("is a no-op when no headline range applies", () => {
    const dear = { ...fiesta, values: { privateSale: 8000, dealerTradeIn: 7000, dealerRetail: 9500 }, valueRange: { privateSaleLow: 7500, privateSaleHigh: 8500 }, headline: "typically £7,500–£8,500" };
    expect(alignRangeMentions(dear).headline).toBe("typically £7,500–£8,500");
  });
});

describe("hasAskFigure", () => {
  it("rejects missing/zero", () => {
    expect(hasAskFigure(undefined)).toBe(false);
    expect(hasAskFigure(0)).toBe(false);
    expect(hasAskFigure(2850)).toBe(true);
  });
});

describe("Compare hides paid figures for unpaid valuations", () => {
  const row: any = { id: "x", make: "Ford", model: "Fiesta", year: 2017, mileage: 99000, registration: "BD67USJ", report: fiesta, created_at: "", photo_urls: [] };
  it("unpaid", () => {
    const f = Object.fromEntries(facts(row, false));
    expect(f["Dealer retail"]).toBe(PAID_ONLY_LINE);
    expect(f["Trade-in"]).toBe(PAID_ONLY_LINE);
    expect(f["Private sale"]).toBe("£2,200–£3,700");
  });
  it("paid", () => {
    const f = Object.fromEntries(facts(row, true));
    expect(f["Dealer retail"]).toMatch(/^£3,/);
  });
});

describe("share card", () => {
  const texts = (entitled: boolean) => {
    const out: string[] = [];
    const ctx: any = new Proxy({}, { get: (_t, k) => k === "fillText" ? (t: string) => out.push(String(t)) : k === "createLinearGradient" ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
    const orig = document.createElement.bind(document);
    (document as any).createElement = (tag: string) => tag === "canvas" ? ({ getContext: () => ctx, width: 0, height: 0 }) : orig(tag);
    try { drawShareCard({ year: 2017, make: "Ford", model: "Fiesta", mileage: 99458 }, fiesta, entitled); } finally { (document as any).createElement = orig; }
    return out.join("|");
  };
  it("unpaid shows no part-ex/dealer", () => {
    const t = texts(false);
    expect(t).not.toMatch(/Part-exchange\||Dealer retail/);
    expect(t).toContain("£2.99 report");
    expect(t).toContain("£2,200–£3,700");
  });
  it("paid keeps all three", () => {
    const t = texts(true);
    expect(t).toContain("Dealer retail");
    expect(t).toContain("Part-exchange");
  });
});

describe("get-shared-valuation viewer decision", () => {
  it("owner or paid get the full report; others get Essentials", () => {
    expect(fullReportAllowed(true, false)).toBe(true);
    expect(fullReportAllowed(false, true)).toBe(true);
    expect(fullReportAllowed(false, false)).toBe(false);
    const paid: any = reportForViewer(fiesta, false, true);
    expect(paid.recommendations.recommendedAskingPrice).toBe(2850);
    expect(paid.photoInsights).toBeTruthy();
    expect(paid.saleFeedback).toBeUndefined();
    const free: any = reportForViewer(fiesta, false, false);
    expect(free.recommendations.recommendedAskingPrice).toBeUndefined();
    expect(free.photoInsights).toBeUndefined();
    expect((reportForViewer(fiesta, true, false) as any).saleFeedback).toBeTruthy();
  });
});
