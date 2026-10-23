// The 6 live test cars (valu8_tests.csv + stored valuation rows, Oct 2026).
// `old*` are what the pre-calibration engine produced; inputs are the stored
// engine inputs so the new engine can be recomputed deterministically.
export type BacktestCar = {
  name: string; make: string; year: number; miles: number; seller: "dealer" | "private"; ask: number;
  oldPrivate: number; oldRetail: number; motValid: boolean;
  /** comps path: stored mileage-matched anchor, median comp mileage, non-mileage/non-MOT multiplier, MOT multiplier */
  comps?: { anchor: number; compMiles: number; compYear: number; mult: number; motMult: number };
};

export const BACKTEST_CARS: BacktestCar[] = [
  { name: "Ford Fiesta BD67 USJ", make: "Ford", year: 2017, miles: 115120, seller: "dealer", ask: 4485, oldPrivate: 3800, oldRetail: 4150, motValid: true,
    comps: { anchor: 4250, compMiles: 102000, compYear: 2017, mult: 1.0, motMult: 0.98 } },
  { name: "Toyota Auris MA59 GKD", make: "Toyota", year: 2009, miles: 133930, seller: "private", ask: 2090, oldPrivate: 1450, oldRetail: 1650, motValid: true },
  { name: "Nissan Qashqai MT17 HZB", make: "Nissan", year: 2017, miles: 80000, seller: "private", ask: 5200, oldPrivate: 6700, oldRetail: 7250, motValid: true,
    comps: { anchor: 7700, compMiles: 61000, compYear: 2017, mult: 0.99, motMult: 1 } },
  { name: "BMW 320d FP18 MXK", make: "BMW", year: 2018, miles: 108000, seller: "private", ask: 5995, oldPrivate: 6100, oldRetail: 7000, motValid: true },
  { name: "Toyota C-HR LV22 VLK", make: "Toyota", year: 2022, miles: 36000, seller: "private", ask: 13900, oldPrivate: 16600, oldRetail: 19100, motValid: true },
  { name: "Mini Countryman SV13 KNY", make: "MINI", year: 2013, miles: 180279, seller: "private", ask: 1250, oldPrivate: 1850, oldRetail: 2150, motValid: true },
];
