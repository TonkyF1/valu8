import { describe, it, expect } from "vitest";
import { parseMotDate, motDaysRemaining, motStatus, motAdjustment, sanitizeMotClaim, isFalseLongMotClaim } from "../../supabase/functions/_shared/mot";
import { cleanReportText, marketCountLine, rewordSource } from "../lib/reportText";

const NOW = new Date("2026-10-23T12:00:00Z");

describe("parseMotDate", () => {
  it("parses ISO, DVSA dotted and UK formats to the same day", () => {
    const iso = parseMotDate("2026-10-28")!.getTime();
    expect(parseMotDate("2026.10.28")!.getTime()).toBe(iso);
    expect(parseMotDate("28/10/2026")!.getTime()).toBe(iso);
    expect(parseMotDate("2026-10-28T00:00:00.000Z")!.getTime()).toBe(iso);
  });
  it("rejects garbage and impossible dates", () => {
    expect(parseMotDate("soon")).toBeNull();
    expect(parseMotDate("31/02/2026")).toBeNull();
    expect(parseMotDate("")).toBeNull();
  });
});

describe("motStatus / motAdjustment", () => {
  it("BD67 USJ case: expiry 28 Oct 2026 is 5 days away and due soon", () => {
    expect(motDaysRemaining("2026-10-28", NOW)).toBe(5);
    expect(motStatus("2026-10-28", NOW).kind).toBe("due_soon");
    expect(motAdjustment("2026-10-28", NOW)).toMatchObject({ impactPct: -2 });
  });
  it("applies -2% for UK-format dates too (new Date() gave NaN before)", () => {
    expect(motAdjustment("27/10/2026", NOW)).toMatchObject({ impactPct: -2 });
  });
  it("expired and long cases", () => {
    expect(motAdjustment("2026-10-01", NOW)).toMatchObject({ impactPct: -5 });
    expect(motStatus("2027-10-20", NOW).kind).toBe("long");
    expect(motAdjustment("2027-10-20", NOW)).toBeNull();
    expect(motStatus("2027-03-01", NOW).kind).toBe("ok");
  });
  it("uses the UK calendar day near midnight BST", () => {
    // 23:30 UTC on 22 Oct = 00:30 BST on 23 Oct
    expect(motDaysRemaining("2026-10-28", new Date("2026-10-22T23:30:00Z"))).toBe(5);
  });
});

describe("long MOT claims", () => {
  it("rewrites text and drops bullets when the MOT is due soon", () => {
    expect(sanitizeMotClaim("having a long MOT running to October 2026", "2026-10-28", NOW)).toBe("having an MOT running to October 2026");
    expect(sanitizeMotClaim("highlight the long MOT prominently.", "2026-10-28", NOW)).toBe("highlight the MOT prominently.");
    expect(isFalseLongMotClaim("Long MOT valid until October 2026", "2026-10-28", NOW)).toBe(true);
  });
  it("leaves genuinely long MOTs alone", () => {
    expect(sanitizeMotClaim("a long MOT", "2027-10-20", NOW)).toBe("a long MOT");
    expect(isFalseLongMotClaim("Long MOT", "2027-10-20", NOW)).toBe(false);
  });
  it("cleans a stored report", () => {
    const r = cleanReportText({
      strengths: ["Long MOT in place until October 2026", "Clean interior"],
      factorsUp: ["Long MOT valid until October 2026"],
      recommendations: { highlights: ["Long MOT test valid until late October 2026", "Mk8 styling"], documents: ["MOT certificate valid until October 2026"] },
      expertInsight: { sources: ["54 live UK listings via MarketCheck"] },
    }, "2026-10-28", NOW);
    expect(r.strengths).toEqual(["Clean interior"]);
    expect(r.factorsUp).toEqual([]);
    expect(r.recommendations!.highlights).toEqual(["Mk8 styling"]);
    expect(r.recommendations!.documents).toEqual(["MOT certificate valid until October 2026"]);
    expect(r.expertInsight!.sources).toEqual(["Priced from the 54 closest-matching UK listings (MarketCheck)"]);
  });
});

describe("market count wording", () => {
  it("combines total for sale and pricing sample", () => {
    expect(marketCountLine(2781, 54)).toBe("2,781 similar cars for sale in the UK · priced from the 54 closest matches");
    expect(marketCountLine(2781, null)).toBe("2,781 similar cars for sale in the UK");
    expect(marketCountLine(null, 1)).toBe("Priced from the 1 closest match");
    expect(marketCountLine(0, 0)).toBeNull();
  });
  it("leaves other sources untouched", () => {
    expect(rewordSource("6 DVSA MOT records")).toBe("6 DVSA MOT records");
  });
});
