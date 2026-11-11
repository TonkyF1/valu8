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
  });
  it("falls back for other generations, other shapes, supercars and unknowns", () => {
    expect(r("LAND ROVER", "R ROVER EVOQUE DYN SE D MHEV A", 2024)).toBeNull();
    expect(r("MINI", "COUNTRYMAN COOPER SD ALL4", 2013)).toBeNull();
    expect(r("VOLKSWAGEN", "GOLF", 1998)).toBeNull();
    expect(r("VOLKSWAGEN", "GOLF", 2016, "ESTATE")).toBeNull();
    expect(r("BMW", "3 SERIES TOURING", 2016)).toBeNull();
    expect(r("BMW", "M3 COMPETITION M XDRIVE AUTO", 2023)).toBeNull();
    expect(r("MERCEDES-BENZ", "CLA", 2015)).toBeNull();
    expect(r("FORD", "TRANSIT CONNECT", 2018)).toBeNull();
    expect(r("FORD", "FIESTA", 2016, "PANEL VAN")).toBeNull();
    expect(r("FERRARI", "LAFERRARI", 2016)).toBeNull();
    expect(r("FORD", "FIESTA", 0)).toBeNull();
    expect(renderFor({})).toBeNull();
  });
  it("every listed render ships", () => {
    const ids = MODEL_RENDERS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(existsSync(`public/cars/m/${id}.svg`), id).toBe(true);
  });
});
