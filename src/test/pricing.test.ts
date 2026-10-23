import { describe, it, expect } from "vitest";
import {
  dealerToPrivate, retailFromPrivate,
  askRange, calibrateAiPrivate, compAdjustedAnchor, compAdjustmentFactor, dedupeReportText, dedupeSentences,
  highMileagePenalty, privateFromRetail, privateRange, sumPhotoImpacts, tradeFrom,
} from "../../supabase/functions/_shared/pricing";
import { displayModel, fixOdometerWording, normaliseColour, normaliseFuel } from "../../supabase/functions/_shared/vehicle-text";
import { cleanReportText } from "@/lib/reportText";
import { BACKTEST_CARS } from "./fixtures/backtest-cars";
import { recomputeCar } from "./fixtures/backtest-engine";

describe("comp mileage/age correction", () => {
  it("discounts low-mileage comps for a 180k car", () => {
    const f = compAdjustmentFactor(180_000, 2013, { price: 3000, miles: 60_000, year: 2013 });
    expect(f).toBeLessThan(0.85);
    expect(f).toBeGreaterThanOrEqual(0.7);
  });
  it("adjusts for newer comps", () => {
    expect(compAdjustmentFactor(80_000, 2017, { price: 1, miles: 80_000, year: 2019 })).toBeCloseTo(0.88 ** 2, 5);
  });
  it("anchor is the median of corrected comps", () => {
    const a = compAdjustedAnchor([{ price: 5000, miles: 100_000 }, { price: 6000, miles: 100_000 }, { price: 7000, miles: 100_000 }], 100_000, 2017);
    expect(a).toBe(6000);
    expect(compAdjustedAnchor([], 1, 2017)).toBeNull();
  });
});

describe("private from dealer retail", () => {
  it("applies a dealer discount bigger on cheap cars", () => {
    expect(privateFromRetail(20_000, 50_000) / 20_000).toBeGreaterThan(privateFromRetail(4_000, 50_000) / 4_000);
    expect(privateFromRetail(7_330, 80_000)).toBeCloseTo(5317.4, 1);
  });
  it("prices private sale well below dealer retail (Prius YM15GJU / Mazda DG65JCZ)", () => {
    // Prius anchor £6,200 vs private ask £3,600; Mazda £6,400 vs £3,899.
    expect(dealerToPrivate(6200)).toBeCloseTo(4436, 6);
    expect(dealerToPrivate(6400)).toBeCloseTo(4592, 6);
    expect(dealerToPrivate(1500)).toBeCloseTo(1020, 5); // 0.68 floor on cheap cars
  });
  it("is monotonic in retail with a ratio that never falls as price rises", () => {
    let prevP = 0, prevRatio = 0;
    for (let r = 500; r <= 40_000; r += 250) {
      const p = dealerToPrivate(r);
      expect(p).toBeGreaterThan(prevP);
      expect(p / r).toBeGreaterThanOrEqual(prevRatio - 1e-9);
      prevP = p; prevRatio = p / r;
    }
    expect(dealerToPrivate(3000) / 3000).toBeCloseTo(0.68, 6); // floor binds below £4,000
    expect(dealerToPrivate(20_000) / 20_000).toBeCloseTo(0.76, 6);
  });
  it("retailFromPrivate inverts dealerToPrivate", () => {
    for (const r of [1500, 3000, 6200, 15000]) expect(retailFromPrivate(dealerToPrivate(r))).toBeCloseTo(r, 6);
  });
  it("adds a high-mileage penalty above 140k", () => {
    expect(highMileagePenalty(120_000)).toBe(0);
    expect(highMileagePenalty(200_000)).toBeCloseTo(0.35);
    expect(privateFromRetail(3000, 180_000)).toBeLessThan(privateFromRetail(3000, 120_000));
  });
  it("trade sits below private", () => {
    expect(tradeFrom(7000, 6000)).toBeLessThan(6000);
  });
});

describe("AI-path calibration", () => {
  const base = { currentYear: 2026, motValid: true };
  it("discounts young cars for dealer bias", () => {
    expect(calibrateAiPrivate({ ...base, aiPrivate: 16600, make: "Toyota", year: 2022, miles: 36000 }).privateSale).toBeCloseTo(14608, 0);
  });
  it("floors old MOT'd average-mileage cars", () => {
    expect(calibrateAiPrivate({ ...base, aiPrivate: 900, make: "Ford", year: 2010, miles: 100_000 }).privateSale).toBe(1500);
    expect(calibrateAiPrivate({ ...base, motValid: false, aiPrivate: 900, make: "Ford", year: 2010, miles: 100_000 }).privateSale).toBe(900);
  });
  it("no floor for very high mileage", () => {
    expect(calibrateAiPrivate({ ...base, aiPrivate: 1850, make: "MINI", year: 2013, miles: 180_279 }).privateSale).toBeLessThan(1500);
  });
});

describe("ranges", () => {
  it("ask range never starts below the realistic private figure (C-HR case)", () => {
    const r = askRange(16600, 17400);
    expect(r.low).toBeGreaterThanOrEqual(16600);
    expect(r.high).toBeGreaterThan(r.low);
  });
  it("private range contains the private figure", () => {
    const r = privateRange(6000, 0.08);
    expect(r.low).toBeLessThanOrEqual(6000);
    expect(r.high).toBeGreaterThanOrEqual(6000);
  });
});

describe("vision net", () => {
  it("sums the line items exactly, coercing strings", () => {
    expect(sumPhotoImpacts([{ priceImpact: 50 }, { priceImpact: "50" }, { priceImpact: 50 }, { priceImpact: 50 }, {}])).toBe(200);
    expect(sumPhotoImpacts([{ priceImpact: -50 }, { priceImpact: -100 }])).toBe(-150);
    expect(sumPhotoImpacts(null)).toBe(0);
  });
});

describe("sentence dedupe", () => {
  it("removes repeated sentences within a field", () => {
    expect(dedupeSentences("The car is clean and tidy. The car is clean and tidy. Good MOT.")).toBe("The car is clean and tidy. Good MOT.");
  });
  it("removes sentences repeated across fields", () => {
    const r = dedupeReportText({ headline: "Strong diesel commuter with clean history.", valueReasoning: "Strong diesel commuter with clean history. Priced keenly." });
    expect(r.valueReasoning).toBe("Priced keenly.");
  });
  it("is applied by cleanReportText", () => {
    const r = cleanReportText({ honestAnalysis: "A solid example overall here. A solid example overall here." }, null);
    expect(r.honestAnalysis).toBe("A solid example overall here.");
  });
});

describe("vehicle text", () => {
  it("maps DVSA fuels", () => {
    expect(normaliseFuel("HEAVY OIL")).toBe("Diesel");
    expect(normaliseFuel("PETROL")).toBe("Petrol");
    expect(normaliseFuel("Hybrid Electric (Clean)")).toBe("Hybrid");
    expect(normaliseFuel(undefined)).toBeUndefined();
  });
  it("title-cases colour", () => {
    expect(normaliseColour("RED")).toBe("Red");
    expect(normaliseColour("DARK BLUE")).toBe("Dark blue");
  });
  it("restores BMW fuel suffix and tidies caps", () => {
    expect(displayModel("BMW", "320", "Diesel")).toBe("320d");
    expect(displayModel("BMW", "320", "PETROL")).toBe("320i");
    expect(displayModel("BMW", "320d", "Diesel")).toBe("320d");
    expect(displayModel("Nissan", "QASHQAI", "Diesel")).toBe("Qashqai");
    expect(displayModel("MINI", "COUNTRYMAN COOPER SD ALL4", "HEAVY OIL")).toBe("Countryman Cooper SD ALL4");
    expect(displayModel("Toyota", "C-HR GR SPORT HEV CVT", "Hybrid")).toBe("C-HR GR Sport HEV CVT");
    expect(displayModel("Ford", "Focus · ST-Line", "Petrol")).toBe("Focus · ST-Line");
  });
  it("odometer is not a rev counter", () => {
    expect(fixOdometerWording("Rev counter shows 179,224 mls with handbrake light lit")).toBe("Odometer shows 179,224 mls with handbrake light lit");
    expect(fixOdometerWording("Rev counter needle steady at idle")).toBe("Rev counter needle steady at idle");
  });
});

describe("backtest (12 live cars)", () => {
  it("improves mean abs error vs ask and keeps each car within 20%", () => {
    let oldErr = 0, newErr = 0;
    for (const c of BACKTEST_CARS) {
      const n = recomputeCar(c);
      const oldV = c.seller === "dealer" ? c.oldRetail : c.oldPrivate;
      const newV = c.seller === "dealer" ? n.retail : n.privateSale;
      oldErr += Math.abs(oldV - c.ask) / c.ask;
      newErr += Math.abs(newV - c.ask) / c.ask;
      expect(Math.abs(newV - c.ask) / c.ask).toBeLessThan(0.2);
      expect(n.ask.low).toBeGreaterThanOrEqual(n.privateSale);
    }
    expect(newErr).toBeLessThan(oldErr * 0.6);
  });
});
