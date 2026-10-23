import { describe, it, expect } from "vitest";
import { motPenaltyItems, classifyCorrosion, MOT_PENALTY_CAP } from "../../supabase/functions/_shared/pricing";

const sum = (xs: { impactPct: number }[]) => xs.reduce((s, i) => s + i.impactPct, 0);
const T = "2026-10-23";

describe("motPenaltyItems", () => {
  it("treats 'not seriously weakened' corrosion as mild (Kuga THZ3075)", () => {
    const items = motPenaltyItems([{ date: "2026-10-12", result: "Advisory", failures: [], advisories: [
      "Rear Sub-frame corroded but not seriously weakened (5.3.3 (b) (i))",
      "Nearside Rear Suspension arm corroded but not seriously weakened (5.3.3 (b) (i))",
      "Offside Rear Suspension arm corroded but not seriously weakened (5.3.3 (b) (i))"] }], T);
    expect(sum(items)).toBe(-5);
    expect(items[0].label).toMatch(/Minor corrosion/);
  });
  it("one routine corrosion advisory is -2", () => {
    expect(sum(motPenaltyItems([{ result: "Advisory", advisories: ["Brake pipe corroded, covered in grease"] }], T))).toBe(-2);
  });
  it("keeps serious/structural corrosion strong", () => {
    const c = classifyCorrosion(["Sill excessively corroded", "Floor corroded, seriously weakened", "Subframe corroded but not seriously weakened"]);
    expect(c).toEqual({ serious: 2, routine: 1 });
    expect(sum(motPenaltyItems([{ result: "Advisory", advisories: ["Offside sill excessively corroded within 30cm of seat belt mounting"] }], T))).toBe(-8);
  });
  it("corrosion on a failure item is serious", () => {
    expect(classifyCorrosion([], ["Brake pipe excessively corroded"]).serious).toBe(1);
  });
  it("prices failures only within 12 months", () => {
    const old = motPenaltyItems([{ date: "2026-10-19", result: "Pass", advisories: [] }, { date: "2025-09-09", result: "Fail", failures: ["Coil spring broken"] }], T);
    expect(old).toEqual([]);
    const recent = motPenaltyItems([{ date: "2026-10-19", result: "Pass" }, { date: "2026-05-01", result: "Fail" }], T);
    expect(sum(recent)).toBe(-6);
  });
  it("caps the total MOT penalty and labels still sum to it", () => {
    const items = motPenaltyItems([{ date: "2026-10-01", result: "Fail",
      advisories: ["Sill seriously weakened by corrosion", "Floor perforated by corrosion", "Subframe excessively corroded", "a", "b", "c"],
      failures: ["Chassis excessively corroded"] }], T);
    expect(sum(items)).toBe(MOT_PENALTY_CAP);
  });
  it("no penalty for a clean latest test", () => {
    expect(motPenaltyItems([{ result: "Pass", advisories: [] }], T)).toEqual([]);
  });
});
