import { askRange, retailFromPrivate, calibrateAiPrivate, compAdjustmentFactor, finalisePricing, reconcileMileage } from "../../../supabase/functions/_shared/pricing";
import { roundToGrain, roundTo50 } from "../../../supabase/functions/_shared/valuation-math";
import type { BacktestCar } from "./backtest-cars";

export const BACKTEST_YEAR = 2026;

/** Mirrors analyse-vehicle's two pricing paths using the stored inputs. */
export function recomputeCar(c: BacktestCar) {
  let privateSale: number; let retail: number; const notes: string[] = [];
  const check = reconcileMileage(c.miles, c.motMaxMiles ?? 0);
  const miles = check.miles;
  if (check.status !== "ok") notes.push(`mileage ${check.status} (priced on ${miles})`);
  if (c.comps) {
    const anchor = c.comps.anchor * compAdjustmentFactor(miles, c.year, { price: c.comps.anchor, miles: c.comps.compMiles, year: c.comps.compYear });
    const items = [...c.comps.items];
    if (check.status === "clocking") items.push({ label: "Declared mileage below MOT record", impactPct: -15, scope: "retail" });
    const l = finalisePricing({ anchor, miles, compMedianMiles: c.comps.compMedianMiles, items });
    retail = l.dealerRetail; privateSale = l.privateSale;
    notes.push(`anchor ${Math.round(anchor)}, retail net ${l.retailNetPct}%, private net ${l.privateNetPct}%`);
  } else {
    const cal = calibrateAiPrivate({ aiPrivate: c.oldPrivate, make: c.make, year: c.year, miles, currentYear: BACKTEST_YEAR, motValid: c.motValid });
    privateSale = roundToGrain(cal.privateSale);
    retail = roundToGrain(retailFromPrivate(privateSale));
    notes.push(...cal.notes);
  }
  const buffer = roundTo50(privateSale * 0.04);
  return { privateSale, retail, ask: askRange(privateSale, privateSale + buffer), notes };
}
