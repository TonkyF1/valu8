import type { ValuationReport } from "@/lib/valuation";
import { normaliseReportPricing } from "@/lib/askingPrice";

/** Short, stable report reference shown on the page and the PDF, e.g. "V8-F6B441DC". */
export function reportRef(id: string): string {
  return `V8-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/** The seller plan, every figure from the report's one coherent pricing model. */
export function sellerPlan(r: ValuationReport) {
  const p = normaliseReportPricing(r);
  const stored = r.recommendations?.recommendedAskingPrice ?? r.recommendations?.listingPrice;
  const advertise = typeof stored === "number" && stored >= p.privateSale ? stored : p.askLow;
  const lowest = p.privateLow;
  return { advertise, lowest, room: Math.max(0, advertise - lowest), privateSale: p.privateSale };
}

