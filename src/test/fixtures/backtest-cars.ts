// The 12 live test cars (valu8_tests.csv + stored valuation rows, Oct 2026).
// `old*` are what the engine produced at the time; inputs are the stored
// engine inputs so the current engine can be recomputed deterministically.
// Ledger items are derived mechanically from the stored reports using the
// current rules (no per-car tuning): see docs/pricing-calibration.md.
import type { LedgerItem } from "../../../supabase/functions/_shared/pricing";

export type BacktestCar = {
  name: string; make: string; year: number; miles: number; seller: "dealer" | "private"; ask: number;
  oldPrivate: number; oldRetail: number; motValid: boolean;
  /** Highest DVSA odometer reading, when known. */
  motMaxMiles?: number;
  /**
   * comps path: `anchor` is the stored mileage-matched anchor, which was
   * corrected to `compMiles`/`compYear`; `compMedianMiles` is the median
   * mileage of the stored example comparables; `items` is the ledger.
   */
  comps?: { anchor: number; compMiles: number; compYear: number; compMedianMiles: number; items: LedgerItem[] };
};

const R = (label: string, impactPct: number): LedgerItem => ({ label, impactPct, scope: "retail" });
const P = (label: string, impactPct: number): LedgerItem => ({ label, impactPct, scope: "private" });
const A = (label: string, impactPct: number): LedgerItem => ({ label, impactPct, scope: "anchor" });

export const BACKTEST_CARS: BacktestCar[] = [
  // --- Batch 1 ---
  { name: "Ford Fiesta BD67 USJ", make: "Ford", year: 2017, miles: 115120, seller: "dealer", ask: 4485, oldPrivate: 3800, oldRetail: 4150, motValid: true,
    comps: { anchor: 4250, compMiles: 102000, compYear: 2017, compMedianMiles: 102000, items: [P("MOT expiring soon", -2)] } },
  { name: "Toyota Auris MA59 GKD", make: "Toyota", year: 2009, miles: 133930, seller: "private", ask: 2090, oldPrivate: 1450, oldRetail: 1650, motValid: true },
  { name: "Nissan Qashqai MT17 HZB", make: "Nissan", year: 2017, miles: 80000, seller: "private", ask: 5200, oldPrivate: 6700, oldRetail: 7250, motValid: true,
    comps: { anchor: 7700, compMiles: 61000, compYear: 2017, compMedianMiles: 61000, items: [R("Stored net adjustment", -1)] } },
  { name: "BMW 320d FP18 MXK", make: "BMW", year: 2018, miles: 108000, seller: "private", ask: 5995, oldPrivate: 6100, oldRetail: 7000, motValid: true },
  { name: "Toyota C-HR LV22 VLK", make: "Toyota", year: 2022, miles: 36000, seller: "private", ask: 13900, oldPrivate: 16600, oldRetail: 19100, motValid: true },
  { name: "Mini Countryman SV13 KNY", make: "MINI", year: 2013, miles: 180279, seller: "private", ask: 1250, oldPrivate: 1850, oldRetail: 2150, motValid: true },
  // --- Batch 2 (validation set) ---
  { name: "VW Golf 2014", make: "Volkswagen", year: 2014, miles: 158581, seller: "private", ask: 3650, oldPrivate: 3250, oldRetail: 4750, motValid: true, motMaxMiles: 158553,
    comps: { anchor: 4650, compMiles: 158581, compYear: 2014, compMedianMiles: 157000, items: [A("Higher mileage / older than comparables", -2), R("Specific issues seen in photos", 2)] } },
  // Declared 169,000 vs MOT 171,007: within tolerance → priced on 171,007, no clocking penalty.
  { name: "Audi A4 2017", make: "Audi", year: 2017, miles: 169000, seller: "private", ask: 5550, oldPrivate: 3800, oldRetail: 5750, motValid: true, motMaxMiles: 171007,
    comps: { anchor: 6750, compMiles: 169000, compYear: 2017, compMedianMiles: 156000, items: [A("Higher mileage / older than comparables", -3)] } },
  // Validated photo items: the −£100 tyre item cited MOT evidence and is stripped (+£200 net → +4%).
  { name: "Nissan Leaf 2017", make: "Nissan", year: 2017, miles: 42500, seller: "private", ask: 4325, oldPrivate: 4650, oldRetail: 5800, motValid: true, motMaxMiles: 40026,
    comps: { anchor: 5600, compMiles: 42500, compYear: 2017, compMedianMiles: 44540, items: [A("Higher mileage / older than comparables", -3), R("Good visible condition (7.6/10)", 2), R("Specific issues seen in photos", 4)] } },
  { name: "Kia Picanto 2009", make: "Kia", year: 2009, miles: 98300, seller: "private", ask: 1200, oldPrivate: 1000, oldRetail: 1500, motValid: true, motMaxMiles: 83562,
    comps: { anchor: 1650, compMiles: 98300, compYear: 2009, compMedianMiles: 97131, items: [R("Recent MOT failure(s)", -6), R("Condition deductions (6.8/10)", -3), R("Specific issues seen in photos", -2)] } },
  { name: "Vauxhall Corsa 2016", make: "Vauxhall", year: 2016, miles: 82249, seller: "dealer", ask: 4200, oldPrivate: 3650, oldRetail: 4750, motValid: true, motMaxMiles: 79493,
    comps: { anchor: 4750, compMiles: 82249, compYear: 2016, compMedianMiles: 68000, items: [A("Higher mileage / older than comparables", -4)] } },
  // Advisory-count deduction no longer stacks on top of the corrosion advisories.
  { name: "Hyundai i20 2014", make: "Hyundai", year: 2014, miles: 64248, seller: "dealer", ask: 3499, oldPrivate: 1900, oldRetail: 2800, motValid: true, motMaxMiles: 62228,
    comps: { anchor: 3550, compMiles: 64248, compYear: 2014, compMedianMiles: 63900, items: [R("Multiple corrosion advisories (3)", -16), R("Condition deductions (6.8/10)", -3)] } },
];
