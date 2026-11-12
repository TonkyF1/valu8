import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODEL_RENDERS, renderFor } from "@/components/tesla/modelRenders";

const r = (make: string, model: string, year: number, bodyStyle?: string) => renderFor({ make, model, year, bodyStyle });

describe("renderFor", () => {
  it("picks the right generation by year", () => {
    expect(r("FORD", "FIESTA", 2016)).toBe("/cars/m/fiesta-mk7.svg");
    expect(r("FORD", "FIESTA", 2019)).toBe("/cars/m/fiesta-mk8.svg");
    expect(r("VOLKSWAGEN", "GOLF", 2011)).toBe("/cars/m/golf-mk6.svg");
    expect(r("VOLKSWAGEN", "GOLF GT TSI BMT S-A · GT TSI", 2016)).toBe("/cars/m/golf-mk7.svg");
    expect(r("VOLKSWAGEN", "GOLF", 2021)).toBe("/cars/m/golf-mk8.svg");
    expect(r("RENAULT", "CLIO", 2010)).toBe("/cars/m/clio-3.svg");
    expect(r("RENAULT", "CLIO", 2017)).toBe("/cars/m/clio-4.svg");
    expect(r("VAUXHALL", "CORSA", 2009)).toBe("/cars/m/corsa-d.svg");
    expect(r("VAUXHALL", "CORSA", 2016)).toBe("/cars/m/corsa-e.svg");
    expect(r("VAUXHALL", "CORSA ELITE", 2021)).toBe("/cars/m/corsa-f.svg");
  });
  it("understands DVSA model spellings", () => {
    expect(r("BMW", "330E M SPORT AUTO", 2020)).toBe("/cars/m/3series-g20.svg");
    expect(r("BMW", "320", 2018)).toBe("/cars/m/3series-f30.svg");
    expect(r("BMW", "X3 · M40I", 2019)).toBe("/cars/m/x3-g01.svg");
    expect(r("MERCEDES-BENZ", "A 180 AMG LINE EXECUTIVE D A", 2018)).toBe("/cars/m/aclass-w177.svg");
    expect(r("MERCEDES-BENZ", "C220 AMG LINE", 2016)).toBe("/cars/m/cclass-w205.svg");
    expect(r("LAND ROVER", "RANGE ROVER SPORT", 2014)).toBe("/cars/m/rr-sport-l494.svg");
    expect(r("LAND ROVER", "RANGE ROVER VOGUE SE SDV6 AUTO", 2019)).toBe("/cars/m/rangerover-l405.svg");
    expect(r("LAND ROVER", "R ROVER EVOQUE DYN SE D MHEV A", 2016)).toBe("/cars/m/evoque-mk1.svg");
    expect(r("MINI", "COOPER · COOPER 5DR", 2017)).toBe("/cars/m/mini-f56.svg");
    expect(r("MINI", "COUNTRYMAN COOPER SD ALL4", 2019)).toBe("/cars/m/countryman-f60.svg");
    expect(r("FORD", "TRANSIT CUSTOM 300LIMITD EBLUE", 2019, "PANEL VAN")).toBe("/cars/m/transit-custom.svg");
    expect(r("FORD", "TRANSIT 350 L3 H2", 2018)).toBe("/cars/m/transit-mk8.svg");
    expect(r("VAUXHALL", "MOKKA X SE", 2017)).toBe("/cars/m/mokka-1.svg");
    expect(r("MERCEDES-BENZ", "E220 D AMG LINE", 2014)).toBe("/cars/m/eclass-w212.svg");
    expect(r("MERCEDES-BENZ", "E CLASS", 2019)).toBe("/cars/m/eclass-w213.svg");
    expect(r("MERCEDES-BENZ", "E220 D AMG LINE ESTATE", 2019)).toBeNull();
    expect(r("PEUGEOT", "PARTNER", 2020, "PANEL VAN")).toBe("/cars/m/berlingo-3.svg");
    expect(r("FORD", "TRANSIT CONNECT", 2018)).toBe("/cars/m/tconnect-2.svg");
    expect(r("NISSAN", "QASHQAI", 2010)).toBe("/cars/m/qashqai-j10.svg");
    expect(r("VOLKSWAGEN", "TIGUAN", 2015)).toBe("/cars/m/tiguan-mk1.svg");
    expect(r("JAGUAR", "F-PACE", 2018)).toBe("/cars/m/fpace-1.svg");
    expect(r("JAGUAR", "XF SPORTBRAKE", 2018)).toBeNull();
    expect(r("BMW", "520D M SPORT", 2019)).toBe("/cars/m/5series-g30.svg");
    expect(r("PEUGEOT", "308 SW", 2017)).toBeNull();
    expect(r("HONDA", "CR-V", 2016)).toBe("/cars/m/crv-4.svg");
  });
  it("falls back for other generations, other shapes, supercars and unknowns", () => {
    expect(r("LAND ROVER", "R ROVER EVOQUE DYN SE D MHEV A", 2024)).toBeNull();
    expect(r("MINI", "COUNTRYMAN COOPER SD ALL4", 2009)).toBeNull();
    expect(r("VOLKSWAGEN", "GOLF", 1998)).toBeNull();
    expect(r("VOLKSWAGEN", "GOLF", 2016, "ESTATE")).toBeNull();
    expect(r("BMW", "3 SERIES TOURING", 2016)).toBeNull();
    expect(r("BMW", "M3 COMPETITION M XDRIVE AUTO", 2023)).toBeNull();
    expect(r("MERCEDES-BENZ", "CLA", 2015)).toBeNull();
    expect(r("FORD", "TRANSIT COURIER", 2018)).toBeNull();
    expect(r("FORD", "FIESTA", 2016, "PANEL VAN")).toBeNull();
    expect(r("FERRARI", "LAFERRARI", 2016)).toBeNull();
    expect(r("FORD", "FIESTA", 0)).toBeNull();
    expect(renderFor({})).toBeNull();
  });
  it("every listed render ships", () => {
    const keys = MODEL_RENDERS.map((e) => `${e.id}|${e.make.source}`);
    expect(new Set(keys).size).toBe(keys.length);
    const ids = [...new Set(MODEL_RENDERS.map((e) => e.id))];
    for (const id of ids) expect(existsSync(`public/cars/m/${id}.svg`), id).toBe(true);
  });
  it.each([
    ["VAUXHALL", "ASTRA", 2012, "astra-j"],
    ["FORD", "KUGA", 2021, "kuga-mk3"],
    ["VOLKSWAGEN", "PASSAT", 2017, "passat-b8"],
    ["TOYOTA", "C-HR", 2019, "chr-1"],
    ["VAUXHALL", "CROSSLAND X", 2019, "crossland-x"],
    ["VAUXHALL", "GRANDLAND X", 2019, "grandland-x"],
    ["VOLKSWAGEN", "T-CROSS", 2020, "tcross-1"],
    ["SKODA", "OCTAVIA", 2021, "octavia-mk4"],
    ["TOYOTA", "COROLLA", 2020, "corolla-e210"],
    ["TOYOTA", "YARIS", 2021, "yaris-xp210"],
    ["KIA", "SPORTAGE", 2023, "sportage-nq5"],
    ["HYUNDAI", "TUCSON", 2022, "tucson-4"],
  ])("selects additional model %s %s (%s)", (make, model, year, id) => {
    expect(r(make as string, model as string, year as number)).toBe(`/cars/m/${id}.svg`);
  });
  it.each([
    ["AUDI", "A1 SPORTBACK S LINE", 2020, "a1-gb"],
    ["AUDI", "A3 SPORTBACK", 2022, "a3-8y"],
    ["AUDI", "S3 SALOON", 2022, "a3-saloon-8y"],
    ["AUDI", "RS3", 2018, "a3-8v"],
    ["AUDI", "A4", 2012, "a4-b8"],
    ["AUDI", "A5 SPORTBACK", 2019, "a5-sportback-f5"],
    ["AUDI", "A5", 2025, "a5-b10"],
    ["AUDI", "A6", 2016, "a6-c7"],
    ["AUDI", "A6", 2021, "a6-c8"],
    ["AUDI", "A6 SPORTBACK E-TRON", 2025, "a6-etron"],
    ["AUDI", "A7 SPORTBACK", 2020, "a7-c8"],
    ["AUDI", "A8 L", 2019, "a8-d5"],
    ["AUDI", "TT", 2017, "tt-8s"],
    ["AUDI", "Q2", 2018, "q2-1"],
    ["AUDI", "Q3", 2020, "q3-f3"],
    ["AUDI", "Q3 SPORTBACK", 2021, "q3-sportback"],
    ["AUDI", "Q4 E-TRON", 2022, "q4-etron"],
    ["AUDI", "Q4 SPORTBACK E-TRON", 2022, "q4-sportback-etron"],
    ["AUDI", "Q5", 2014, "q5-8r"],
    ["AUDI", "SQ5", 2019, "q5-fy"],
    ["AUDI", "Q5 SPORTBACK", 2022, "q5-sportback"],
    ["AUDI", "Q6 E-TRON", 2025, "q6-etron"],
    ["AUDI", "Q7", 2020, "q7-4m"],
    ["AUDI", "RS Q8", 2021, "q8-1"],
    ["AUDI", "E-TRON", 2020, "etron-suv"],
    ["AUDI", "Q8 E-TRON", 2023, "etron-suv"],
    ["AUDI", "E-TRON GT", 2022, "etron-gt"],
    ["AUDI", "RS E-TRON GT", 2022, "etron-gt"],
  ])("selects Audi %s %s (%s)", (make, model, year, id) => {
    expect(r(make as string, model as string, year as number)).toBe(`/cars/m/${id}.svg`);
  });
  it("keeps Audi estates, cabriolets and coupe variants on the body-type fallback", () => {
    expect(r("AUDI", "A6 AVANT", 2021)).toBeNull();
    expect(r("AUDI", "RS6 AVANT", 2021)).toBeNull();
    expect(r("AUDI", "A4 ALLROAD", 2019)).toBeNull();
    expect(r("AUDI", "A5 CABRIOLET", 2019)).toBeNull();
    expect(r("AUDI", "A5 COUPE", 2019)).toBeNull();
    expect(r("AUDI", "TT ROADSTER", 2017)).toBeNull();
    expect(r("AUDI", "E-TRON SPORTBACK", 2021)).toBeNull();
    expect(r("AUDI", "TT", 2017, "COUPE")).toBe("/cars/m/tt-8s.svg");
  });
  it("does not substitute a hatchback or saloon for other new body variants", () => {
    expect(r("TOYOTA", "COROLLA TOURING SPORTS", 2021)).toBeNull();
    expect(r("VOLKSWAGEN", "PASSAT", 2020, "ESTATE")).toBeNull();
    expect(r("TOYOTA", "YARIS CROSS", 2022)).toBeNull();
    expect(r("VAUXHALL", "ASTRA GTC", 2013)).toBeNull();
  });
});
