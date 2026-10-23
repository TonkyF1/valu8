import { describe, expect, it } from "vitest";
import { compSearchModels } from "../../supabase/functions/_shared/vehicle-text";

describe("compSearchModels", () => {
  it("keeps the original model first", () => {
    expect(compSearchModels("AUDI", "A4")).toEqual(["A4"]);
  });
  it("strips trim from DVLA model strings (Volvo V70 R-Design SE D)", () => {
    expect(compSearchModels("VOLVO", "V70 R-Design SE D")).toEqual(["V70 R-Design SE D", "V70"]);
  });
  it("adds Mazda6-style names for bare-number Mazda models", () => {
    expect(compSearchModels("MAZDA", "6")).toEqual(["6", "Mazda6", "MAZDA6"]);
  });
  it("maps JDM import names to UK names (Honda Fit -> Jazz)", () => {
    expect(compSearchModels("HONDA", "Fit")).toEqual(["Fit", "Jazz"]);
  });
  it("ignores the · suffix and empty input", () => {
    expect(compSearchModels("FORD", "Kuga · Zetec")).toEqual(["Kuga"]);
    expect(compSearchModels("FORD", "")).toEqual([]);
  });
});
