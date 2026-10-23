// Plain-English "How we value your car" breakdown. Only uses figures already stored
// on the report — never invents numbers. Shared by the Report page and the PDF.
import type { ValuationReport } from "@/lib/valuation";
import { compAdjustmentFactor, retailNetFromAdjustments, inferScope } from "../../supabase/functions/_shared/pricing";

export interface ExplainedComp {
  price: number; year: number; mileage: number; trim?: string; location?: string; url?: string;
  /** What this listing would be priced at with your car's age and mileage. */
  adjustedPrice: number;
  correctionPct: number;
  why: string;
}

export interface ValuationExplanation {
  steps: { title: string; body: string }[];
  comps: ExplainedComp[];
  adjustments: { label: string; impactPct: number; plain: string; scope: "anchor" | "retail" | "private" }[];
}

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

function compWhy(carMiles: number, carYear: number, c: { mileage: number; year: number }): string {
  const parts: string[] = [];
  const dm = c.mileage - carMiles;
  if (Math.abs(dm) >= 2000) parts.push(`${Math.abs(dm).toLocaleString("en-GB")} ${dm > 0 ? "more" : "fewer"} miles`);
  const dy = c.year - carYear;
  if (dy !== 0) parts.push(`${Math.abs(dy)} year${Math.abs(dy) === 1 ? "" : "s"} ${dy > 0 ? "newer" : "older"}`);
  return parts.length ? `This one has ${parts.join(" and ")} than yours` : "Very close match on age and mileage";
}

export function adjustmentPlain(label: string, pct: number): string {
  const dir = pct > 0 ? "adds" : "takes off";
  return pct === 0 ? `${label}: no change to the price.` : `${label}: ${dir} about ${Math.abs(pct)}%.`;
}

export function explainValuation(r: ValuationReport, car: { year: number; mileage: number }): ValuationExplanation | null {
  if (r.valuationUnavailable || !r.values) return null;
  const steps: { title: string; body: string }[] = [];
  const n = r.marketBaseline?.sampleSize ?? r.marketSampleSize;
  const live = r.pricingSource === "marketcheck" || !!r.marketBaseline;

  if (live) {
    steps.push({
      title: "1. Find comparable cars for sale",
      body: `We searched live UK dealer listings for the same make and model${n ? ` and found ${n.toLocaleString("en-GB")} comparable advert${n === 1 ? "" : "s"}` : ""}, widening the year and mileage window only when there weren't enough close matches.`,
    });
    steps.push({
      title: "2. Correct each one to your car",
      body: `Every listing is re-priced as if it had your car's age and mileage (${((r as any).pricedMileage ?? car.mileage).toLocaleString("en-GB")} miles, ${car.year}). Roughly: double the mileage is worth about 12% less, and each extra year of age about 12% less. We then take the median of the closest matches${r.marketAnchor ? `, which gave a dealer retail anchor of ${gbp(r.marketAnchor)}` : ""}.`,
    });
  } else {
    steps.push({
      title: "1. Estimate from market knowledge",
      body: "There weren't enough live listings for a reliable comparison, so this figure is an AI estimate calibrated against our backtests. Treat it as a starting point and check a few local adverts.",
    });
  }
  steps.push({
    title: `${steps.length + 1}. Adjust for this car`,
    body: (r.priceAdjustments?.length ?? 0) > 0
      ? (() => {
          // Net % = the sum of the listed dealer-retail adjustments (one source of truth).
          const net = retailNetFromAdjustments(r.priceAdjustments as any);
          const anchor = r.marketBaseline?.baseDealerRetail ?? r.marketAnchor;
          const sign = net > 0 ? "+" : "";
          return `We then adjusted for what we know about your car specifically (net ${sign}${net}% from the adjustments listed below)${anchor && r.values?.dealerRetail ? `, taking the ${gbp(anchor)} anchor to a dealer retail figure of ${gbp(r.values.dealerRetail)}` : ""}. MOT timing and very high mileage only affect the private and part-exchange figures.`;
        })()
      : "Nothing specific to your car moved the price up or down beyond the market comparison.",
  });
  steps.push({
    title: `${steps.length + 1}. Convert dealer prices to what you'd actually get`,
    body: `Dealer adverts include preparation, warranty and margin. A private buyer typically pays around 7% less than dealer retail, minus a fixed amount, which gives your private sale figure of ${gbp(r.values.privateSale)}. Part-exchange (${gbp(r.values.dealerTradeIn)}) is lower again because the dealer has to resell it.`,
  });

  const comps: ExplainedComp[] = (r.comparableListings ?? [])
    .filter((c) => c && c.price > 0)
    .slice(0, 5)
    .map((c) => {
      const f = compAdjustmentFactor(car.mileage, car.year, { price: c.price, miles: c.mileage, year: c.year });
      return { ...c, adjustedPrice: Math.round((c.price * f) / 50) * 50, correctionPct: Math.round((f - 1) * 100), why: compWhy(car.mileage, car.year, c) };
    });

  const adjustments = (r.priceAdjustments ?? []).map((a) => ({ ...a, scope: (a as any).scope ?? inferScope(a.label), plain: adjustmentPlain(a.label, a.impactPct) }));
  return { steps, comps, adjustments };
}
