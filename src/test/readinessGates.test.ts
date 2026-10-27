import { describe, expect, it } from "vitest";
import { gates } from "@/components/admin/ReadinessPanel";

const base = { median_signed_pct: 0, within_10_pct: 60, recent_90d_share: 80, rejected: null, all_bands_n: 0, breakdown: [], weekly: [], funnel: [] };

describe("readiness gate", () => {
  it("is NOT READY below 200 in-band outcomes even with perfect error", () => {
    expect(gates({ ...base, n_in_band: 199, median_abs_pct: 1, miss_30_pct: 0 } as any, null).ready).toBe(false);
  });
  it("is READY at 200 outcomes, ≤12% median error and <5% misses", () => {
    expect(gates({ ...base, n_in_band: 200, median_abs_pct: 12, miss_30_pct: 4.9 } as any, null).ready).toBe(true);
  });
  it("fails when 5% or more miss by over 30%", () => {
    expect(gates({ ...base, n_in_band: 300, median_abs_pct: 8, miss_30_pct: 5 } as any, null).ready).toBe(false);
  });
});
