import { describe, it, expect, vi } from "vitest";
import { shareLink, motDue, buildMotIcs, valueTrends } from "@/lib/retention";
import { operatorSentence } from "@/lib/legal";

describe("shareLink", () => {
  it("uses navigator.share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await shareLink("u", "t", undefined, { share } as any)).toBe("shared");
  });
  it("copies when share is missing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareLink("u", "t", undefined, { clipboard: { writeText } } as any)).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("u");
  });
  it("does not copy when user cancels", async () => {
    const writeText = vi.fn();
    const share = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "AbortError" }));
    expect(await shareLink("u", "t", undefined, { share, clipboard: { writeText } } as any)).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe("motDue", () => {
  const now = new Date(2026, 9, 23);
  it("handles soon/overdue/upcoming/invalid", () => {
    expect(motDue("2026-11-10", now)).toMatchObject({ daysLeft: 18, status: "soon" });
    expect(motDue("2026-10-01", now)?.status).toBe("overdue");
    expect(motDue("2027-06-01", now)?.status).toBe("upcoming");
    expect(motDue("garbage", now)).toBeNull();
    expect(motDue(null, now)).toBeNull();
  });
});

describe("buildMotIcs", () => {
  it("builds an all-day event with alarm", () => {
    const ics = buildMotIcs({ vehicle: "2018 Ford Fiesta", registration: "ab12 cde", motDate: new Date(2026, 10, 10), url: "https://valu8.uk/valuation/new", now: new Date(Date.UTC(2026, 9, 23)) });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261110");
    expect(ics).toContain("DTEND;VALUE=DATE:20261111");
    expect(ics).toContain("SUMMARY:MOT due: 2018 Ford Fiesta (AB12 CDE)");
    expect(ics).toContain("TRIGGER:-P14D");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});

describe("valueTrends", () => {
  it("compares with previous valuation of same reg", () => {
    const t = valueTrends([
      { id: "a", registration: "AB12 CDE", private_value: 10000, created_at: "2026-01-01" },
      { id: "b", registration: "ab12cde", private_value: 9500, created_at: "2026-06-01" },
      { id: "c", registration: "XY99 ZZZ", private_value: 5000, created_at: "2026-06-01" },
      { id: "d", registration: null, private_value: 5000, created_at: "2026-06-01" },
    ]);
    expect(Object.keys(t)).toEqual(["b"]);
    expect(t.b).toMatchObject({ change: -500, pct: -5, previousValue: 10000, count: 2 });
  });
});

describe("operatorSentence", () => {
  it("omits empty name/address without placeholders", () => {
    expect(operatorSentence("", "")).not.toMatch(/\[|TBC|operated by/);
    expect(operatorSentence("Jane Smith", "")).toBe("Valu8 (valu8.uk) is operated by Jane Smith, who is the data controller for the personal data described here.");
    expect(operatorSentence("Jane Smith", "1 High St")).toContain("Jane Smith, 1 High St,");
  });
});
