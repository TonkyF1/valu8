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
  it("does not substitute a hatchback or saloon for other new body variants", () => {
    expect(r("TOYOTA", "COROLLA TOURING SPORTS", 2021)).toBeNull();
    expect(r("VOLKSWAGEN", "PASSAT", 2020, "ESTATE")).toBeNull();
    expect(r("TOYOTA", "YARIS CROSS", 2022)).toBeNull();
    expect(r("VAUXHALL", "ASTRA GTC", 2013)).toBeNull();
  });
});
