import { describe, expect, it } from "vitest";
import { gradeArc, gradeCar, gradeFromReport } from "@/lib/carGrade";

const now = new Date("2026-11-11");
const reg = "2020-11-11"; // 6 years old -> typical ~42,000 miles
const clean = [{ date: "2026-10-01", result: "Pass", advisories: [] }];

describe("car grade", () => {
  it("typical mileage + clean latest MOT is Good", () => {
    expect(gradeCar({ mileage: 42000, firstRegistered: reg, motHistory: clean, now }).label).toBe("Good");
  });
  it("low mileage + clean MOT is Above average", () => {
    expect(gradeCar({ mileage: 30000, firstRegistered: reg, motHistory: clean, now }).label).toBe("Above average");
  });
  it("Excellent needs top photo scores", () => {
    expect(gradeCar({ mileage: 20000, firstRegistered: reg, motHistory: clean, now }).label).toBe("Above average");
    expect(gradeCar({ mileage: 30000, firstRegistered: reg, motHistory: clean, conditionScore: 9.2, now }).label).toBe("Excellent");
  });
  it("high mileage and a failed latest MOT is Poor", () => {
    const fail = [{ date: "2026-10-01", result: "Fail", advisories: [] }];
    expect(gradeCar({ mileage: 70000, firstRegistered: reg, motHistory: fail, now }).label).toBe("Poor");
  });
  it("only the latest MOT counts", () => {
    const h = [{ date: "2025-10-01", result: "Fail" }, { date: "2026-10-01", result: "Pass", advisories: [] }];
    expect(gradeCar({ mileage: 42000, firstRegistered: reg, motHistory: h, now }).label).toBe("Good");
  });
  it("rust advisories on the latest MOT count against it", () => {
    const rust = [{ date: "2026-10-01", result: "Pass", advisories: ["Sill corroded but not seriously weakened"] }];
    expect(gradeCar({ mileage: 42000, firstRegistered: reg, motHistory: rust, now }).label).toBe("Average");
  });
  it("a mileage drop caps the grade at Average", () => {
    expect(gradeCar({ mileage: 20000, firstRegistered: reg, motHistory: clean, conditionScore: 9.5, mileageDrop: true, now }).label).toBe("Average");
  });
  it("end grades fill to the very ends of the arc", () => {
    expect(gradeArc(0)).toEqual({ from: 0, to: 0.2 });
    expect(gradeArc(4)).toEqual({ from: 0.8, to: 1 });
  });
  it("reads a report and ignores non-DVSA MOT data", () => {
    const g = gradeFromReport(
      { motSource: "simulated", motHistory: clean, conditionScore: null, hpi: { checks: [] } },
      { mileage: 42000, firstRegistered: reg },
    );
    expect(g.points).toBe(0);
  });
});
