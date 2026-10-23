import { askRange, calibrateAiPrivate, compAdjustmentFactor, privateFromRetail } from "../../../supabase/functions/_shared/pricing";
import { roundToGrain, roundTo50 } from "../../../supabase/functions/_shared/valuation-math";
import type { BacktestCar } from "./backtest-cars";

export const BACKTEST_YEAR = 2026;

/** Mirrors analyse-vehicle's two pricing paths using the stored inputs. */
export function recomputeCar(c: BacktestCar) {
  let privateSale: number; let retail: number; const notes: string[] = [];
  if (c.comps) {
    const anchor = c.comps.anchor * compAdjustmentFactor(c.miles, c.year, { price: c.comps.anchor, miles: c.comps.compMiles, year: c.comps.compYear });
    retail = roundToGrain(anchor * c.comps.mult);
    privateSale = roundToGrain(privateFromRetail(retail, c.miles) * c.comps.motMult);
    notes.push(`comps anchor ${Math.round(anchor)}`);
  } else {
    const cal = calibrateAiPrivate({ aiPrivate: c.oldPrivate, make: c.make, year: c.year, miles: c.miles, currentYear: BACKTEST_YEAR, motValid: c.motValid });
    privateSale = roundToGrain(cal.privateSale);
    retail = roundToGrain((privateSale + 750) / 0.93);
    notes.push(...cal.notes);
  }
  const buffer = roundTo50(privateSale * 0.04);
  return { privateSale, retail, ask: askRange(privateSale, privateSale + buffer), notes };
}
