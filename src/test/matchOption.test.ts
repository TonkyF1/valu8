import { describe, it, expect } from "vitest";
import { matchOption, CAR_MAKES } from "@/lib/cars";

describe("matchOption", () => {
  it("maps DVLA upper case to the canonical make", () => {
    expect(matchOption("FORD", CAR_MAKES)).toBe("Ford");
    expect(matchOption(" volkswagen ", CAR_MAKES)).toBe("Volkswagen");
  });
  it("ignores hyphens and spaces", () => {
    expect(matchOption("MERCEDESBENZ", ["Mercedes-Benz"])).toBe("Mercedes-Benz");
  });
  it("falls back to the raw value or empty", () => {
    expect(matchOption("Zastava", ["Ford"])).toBe("Zastava");
    expect(matchOption(null, ["Ford"])).toBe("");
  });
});
