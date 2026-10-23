import { describe, expect, it } from "vitest";
import { valueWithOwnComps, writeOffAdj, conditionAdj, photoAdj } from "../../supabase/functions/_shared/ownCompsAdjust";

describe("ownComps engine", () => {
  it("prices a common car at model level with a sane range", () => {
    const v = valueWithOwnComps({ make: "Ford", model: "Fiesta", variant: "Zetec", year: 2016, mileage: 70000 });
    expect(v.level).toBe("model");
    expect(v.finalPrivate).toBeGreaterThan(2000);
    expect(v.finalLow).toBeLessThanOrEqual(v.finalPrivate);
  });
  it("ranks performance variant above base trim", () => {
    const st = valueWithOwnComps({ make: "Ford", model: "Fiesta", variant: "ST-2", year: 2016, mileage: 50000 });
    const z = valueWithOwnComps({ make: "Ford", model: "Fiesta", variant: "Zetec", year: 2016, mileage: 50000 });
    expect(st.finalPrivate).toBeGreaterThan(z.finalPrivate);
  });
  it("falls back to global curve with Very Low confidence", () => {
    expect(valueWithOwnComps({ make: "Zzz", model: "Nothing", year: 2015, mileage: 80000 }).confidence).toBe("Very Low");
  });
  it("write-off and condition modules", () => {
    const s = writeOffAdj("Cat N", -0.2).pct;
    expect(s).toBeLessThanOrEqual(-25); expect(s).toBeGreaterThanOrEqual(-40);
    expect(writeOffAdj("cat a", -0.2).blocksValuation).toBe(true);
    expect(conditionAdj(7).pct).toBe(0);
    expect(photoAdj([]).basis).toBe("stub");
  });
});
