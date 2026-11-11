import { describe, expect, it } from "vitest";
import { mileageHint } from "@/lib/mileageHint";

const now = new Date("2026-11-11");
describe("mileage hint", () => {
  it("shows the DVSA reading and its month", () => {
    expect(mileageHint({ lastMileage: 99458, lastMileageDate: "2025-10-17" }, now)).toBe("From the last MOT (Oct 2025): 99,458 mi. Update it if it's gone up.");
  });
  it("explains a car too new for an MOT", () => {
    expect(mileageHint({ firstRegistered: "2024-03-31", motTestCount: 0 }, now)).toContain("first one due Mar 2027");
  });
  it("falls back when tests exist but no reading", () => {
    expect(mileageHint({ firstRegistered: "2015-01-01", motTestCount: 4 }, now)).toContain("no mileage reading");
  });
});
