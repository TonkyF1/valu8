import { describe, it, expect } from "vitest";
import { suggestedAskRange, hasPhotos } from "@/lib/askingPrice";
import { parseAttribution } from "@/lib/attribution";

describe("suggestedAskRange", () => {
  it("starts strictly above the private figure (+5% to +15%)", () => {
    for (const p of [800, 3950, 6000, 9990, 16600, 42000]) {
      const r = suggestedAskRange(p);
      expect(r.low).toBeGreaterThan(p);
      expect(r.low).toBeGreaterThanOrEqual(p * 1.05);
      expect(r.high).toBeGreaterThan(r.low);
      expect(r.high).toBeLessThanOrEqual(p * 1.15 + 100);
    }
  });
  it("rounds to £50 under £10k and £100 above", () => {
    expect(suggestedAskRange(6000)).toEqual({ low: 6300, high: 6900 });
    expect(suggestedAskRange(4321).low % 50).toBe(0);
    expect(suggestedAskRange(16600)).toEqual({ low: 17500, high: 19100 });
  });
  it("hasPhotos", () => {
    expect(hasPhotos([])).toBe(false);
    expect(hasPhotos(null)).toBe(false);
    expect(hasPhotos(["", null])).toBe(false);
    expect(hasPhotos(["a.jpg"])).toBe(true);
  });
});

describe("parseAttribution", () => {
  it("keeps utm params and external referrer host only", () => {
    expect(parseAttribution("?utm_source=x&utm_medium=social&utm_campaign=launch", "https://t.co/abc?x=1", "valu8.uk", "/car-values")).toEqual({
      utm_source: "x", utm_medium: "social", utm_campaign: "launch", referrer: "t.co", landing_path: "/car-values",
    });
  });
  it("ignores self-referrals and empty visits", () => {
    expect(parseAttribution("", "https://valu8.uk/pricing", "valu8.uk")).toBeNull();
    expect(parseAttribution("", "", "valu8.uk")).toBeNull();
  });
  it("strips odd characters", () => {
    expect(parseAttribution("?utm_source=<script>", "", "valu8.uk")?.utm_source).toBe("script");
  });
});
