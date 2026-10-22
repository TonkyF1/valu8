import { describe, expect, it } from "vitest";
import {
  parseCsv, parseRecalls, matchRecalls, parseUkDate, analyseMileage, estimateVed, estimateUlez,
  advisoryCostBand, summariseAdvisoryCosts, fairPrice, fuelKind, sellerChecklist,
} from "../../supabase/functions/_shared/insights";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and CRLF", () => {
    const rows = parseCsv('a,b,c\r\n1,"x, y","say ""hi"""\r\n2,,last\n');
    expect(rows).toEqual([["a", "b", "c"], ["1", "x, y", 'say "hi"'], ["2", "", "last"]]);
  });
  it("handles multi-line quoted fields", () => {
    expect(parseCsv('a\n"line1\nline2"')).toEqual([["a"], ["line1\nline2"]]);
  });
});

describe("parseUkDate", () => {
  it("parses dd/mm/yyyy and ISO", () => {
    expect(parseUkDate("31/01/2007")?.toISOString().slice(0, 10)).toBe("2007-01-31");
    expect(parseUkDate("2019-05-02T10:00:00Z")?.toISOString().slice(0, 10)).toBe("2019-05-02");
    expect(parseUkDate("2019.05.02")?.toISOString().slice(0, 10)).toBe("2019-05-02");
    expect(parseUkDate("nonsense")).toBeNull();
  });
});

const CSV = [
  "Launch Date,Recalls Number,Make,Recalls Model Information,Concern,Defect,Remedy,Vehicle Numbers,Manufacturer Ref,Model,VIN Start,Vin End,Build Start,Build End",
  '01/02/2020,R/2020/001,FORD,"FOCUS, all",BRAKES,"Pipe may chafe",Inspect,100,X1,FOCUS,,,01/01/2014,31/12/2016',
  "05/06/2021,R/2021/002,FORD,FIESTA,FUEL,Leak,Replace,50,X2,FIESTA,,,01/01/2017,31/12/2019",
  "05/06/2022,R/2022/003,MERCEDES-BENZ CARS UK LTD,C-CLASS,AIRBAG,Fault,Replace,50,X3,C-CLASS,,,01/01/2015,31/12/2018",
  "05/06/2022,R/2022/004,HONDA MOTORCYCLES,CIVIC,X,Y,Z,1,X4,CIVIC,,,01/01/2015,31/12/2018",
  "05/06/2023,R/2023/005,VW,GOLF,X,Y,Z,1,X5,GOLF,,,01/01/2015,31/12/2018",
].join("\n");

describe("recalls", () => {
  const all = parseRecalls(CSV);
  it("parses rows", () => {
    expect(all).toHaveLength(5);
    expect(all[0]).toMatchObject({ number: "R/2020/001", make: "FORD", model: "FOCUS", buildEnd: "31/12/2016" });
  });
  it("matches make, model and build window", () => {
    expect(matchRecalls(all, "Ford", "Focus", 2015).map((r) => r.number)).toEqual(["R/2020/001"]);
    expect(matchRecalls(all, "Ford", "Focus", 2020)).toHaveLength(0);
    expect(matchRecalls(all, "Ford", "Fiesta", 2018)).toHaveLength(1);
  });
  it("normalises messy manufacturer names and aliases", () => {
    expect(matchRecalls(all, "Mercedes-Benz", "C-Class", 2016)).toHaveLength(1);
    expect(matchRecalls(all, "Volkswagen", "Golf", 2016)).toHaveLength(1);
  });
  it("excludes motorcycles/trucks", () => {
    expect(matchRecalls(all, "Honda", "Civic", 2016)).toHaveLength(0);
  });
});

describe("analyseMileage", () => {
  it("flags a mileage drop (possible clocking)", () => {
    const a = analyseMileage([
      { date: "2019-05-01", mileage: 30000 },
      { date: "2020-05-01", mileage: 40000 },
      { date: "2021-05-01", mileage: 25000 },
    ]);
    expect(a.status).toBe("warning");
    expect(a.decreases).toEqual([{ date: "2021-05-01", from: 40000, to: 25000 }]);
  });
  it("is ok for monotonic readings and computes miles/year", () => {
    const a = analyseMileage([{ date: "2020-01-01", mileage: 10000 }, { date: "2022-01-01", mileage: 30000 }]);
    expect(a.status).toBe("ok");
    expect(a.avgMilesPerYear).toBeGreaterThan(9900);
    expect(a.avgMilesPerYear).toBeLessThan(10100);
  });
  it("flags entered mileage below last MOT", () => {
    const a = analyseMileage([{ date: "2020-01-01", mileage: 10000 }, { date: "2022-01-01", mileage: 30000 }], 20000);
    expect(a.enteredBelowLastMot).toBe(true);
    expect(a.status).toBe("warning");
  });
  it("needs two readings", () => {
    expect(analyseMileage([{ date: "2020-01-01", mileage: 1 }]).status).toBe("insufficient");
  });
});

describe("estimateVed", () => {
  const now = new Date("2026-10-23");
  it("post-2017 standard rate", () => {
    const v = estimateVed({ firstRegistered: "2019-06-01", fuelType: "Petrol", now });
    expect(v.annual).toBe(200);
    expect(v.supplementPossible).toBe(false); // > 6 years old
  });
  it("flags possible expensive-car supplement on newer cars", () => {
    expect(estimateVed({ firstRegistered: "2023-06-01", fuelType: "Diesel", now }).supplementPossible).toBe(true);
    // EVs registered before April 2025 are exempt from the supplement
    expect(estimateVed({ firstRegistered: "2024-06-01", fuelType: "Electric", now }).supplementPossible).toBe(false);
    expect(estimateVed({ firstRegistered: "2025-06-01", fuelType: "Electric", now }).supplementPossible).toBe(true);
  });
  it("2001-2017 CO2 bands", () => {
    expect(estimateVed({ firstRegistered: "2012-03-01", fuelType: "Diesel", co2: 99, now })).toMatchObject({ annual: 20, band: "A" });
    expect(estimateVed({ firstRegistered: "2012-03-01", fuelType: "Petrol", co2: 139, now })).toMatchObject({ annual: 200, band: "E" });
    expect(estimateVed({ firstRegistered: "2010-03-01", fuelType: "Petrol", co2: 300, now })).toMatchObject({ annual: 790, band: "M" });
    expect(estimateVed({ firstRegistered: "2005-03-01", fuelType: "Petrol", co2: 300, now })).toMatchObject({ annual: 445, band: "K" });
    expect(estimateVed({ firstRegistered: "2012-03-01", fuelType: "Petrol", now }).annual).toBeNull();
  });
  it("pre-2001 engine size", () => {
    expect(estimateVed({ year: 1998, engineCc: 1400, now }).annual).toBe(230);
    expect(estimateVed({ year: 1998, engineCc: 2000, now }).annual).toBe(375);
  });
});

describe("estimateUlez", () => {
  it("uses Euro status when known", () => {
    expect(estimateUlez({ fuelType: "Diesel", euroStatus: "Euro 5" }).status).toBe("likely_non_compliant");
    expect(estimateUlez({ fuelType: "Diesel", euroStatus: "EURO 6" }).status).toBe("likely_compliant");
    expect(estimateUlez({ fuelType: "Petrol", euroStatus: "Euro 4" }).status).toBe("likely_compliant");
  });
  it("falls back to year", () => {
    expect(estimateUlez({ fuelType: "Petrol", year: 2008 }).status).toBe("likely_compliant");
    expect(estimateUlez({ fuelType: "Petrol", year: 2003 }).status).toBe("check");
    expect(estimateUlez({ fuelType: "Diesel", year: 2013 }).status).toBe("likely_non_compliant");
    expect(estimateUlez({ fuelType: "Diesel", year: 2015 }).status).toBe("check");
    expect(estimateUlez({ fuelType: "Electricity", year: 2012 }).status).toBe("likely_compliant");
    expect(estimateUlez({ year: 2012 }).status).toBe("check");
  });
});

describe("fuelKind", () => {
  it("classifies", () => {
    expect(fuelKind("HYBRID ELECTRIC")).toBe("hybrid");
    expect(fuelKind("ELECTRICITY")).toBe("electric");
    expect(fuelKind("Heavy oil / diesel")).toBe("diesel");
    expect(fuelKind(undefined)).toBe("unknown");
  });
});

describe("advisory costs", () => {
  it("bands common advisories", () => {
    expect(advisoryCostBand("Nearside Front Tyre worn close to legal limit")?.category).toBe("Tyres");
    expect(advisoryCostBand("Offside front brake disc worn, pitted or scored")?.category).toBe("Brakes");
    expect(advisoryCostBand("something unrelated")).toBeNull();
  });
  it("summarises without wild double counting", () => {
    const s = summariseAdvisoryCosts(["Nearside tyre worn", "Offside tyre worn", "Offside tyre worn again"]);
    expect(s.low).toBe(60);
    expect(s.high).toBe(360);
  });
});

describe("fairPrice", () => {
  const comps = [9000, 9500, 10000, 10500, 11000].map((price) => ({ price, mileage: 50000 }));
  it("returns IQR band and verdicts", () => {
    expect(fairPrice(9000, 50000, comps)).toMatchObject({ verdict: "great", low: 9500, mid: 10000, high: 10500, sample: 5 });
    expect(fairPrice(10000, 50000, comps).verdict).toBe("fair");
    expect(fairPrice(11000, 50000, comps).verdict).toBe("high");
    expect(fairPrice(13000, 50000, comps).verdict).toBe("overpriced");
  });
  it("adjusts for mileage", () => {
    const r = fairPrice(10000, 70000, comps);
    expect(r.mid).toBe(9400);
  });
  it("needs enough comps", () => {
    expect(fairPrice(1000, 1, [{ price: 1000 }]).verdict).toBe("unknown");
  });
});

describe("sellerChecklist", () => {
  it("adds an urgent MOT item when close to expiry", () => {
    const l = sellerChecklist({ motExpiry: "2026-11-01", now: new Date("2026-10-23") });
    expect(l[0].urgent).toBe(true);
  });
});
